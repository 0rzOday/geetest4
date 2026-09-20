// ============================================================
// 拼 target、造轨迹、生成 w 和 td —— 一次调用全搞定
//
//   stdin: {
//     captcha_id, lot_number,
//     pow_detail: { version, bits, datetime, hashfunc },
//     pt: "1",
//     gapX,          // ddddocr 给的缺口位置（背景图 px，已修正到左上角）
//     passtime       // 可选，拖动耗时 ms，缺省随机
//     slide          // 可选，直接指定 { setLeft, passtime, userresponse } 覆盖 gapX
//   }
//   stdout: { target, w, td, slide, track }
//
// ── target 的字段顺序是完全照抓包来的（顺序会进 JSON，进 w，别动）──
//   setLeft, passtime, userresponse, device_id, lot_number, pow_msg, pow_sign,
//   geetest, lang, ep, biht, gee_guard, <lot派生字段>, em, td_sign
//
//   td_sign 最后加，是因为浏览器那边 appendTrack 先把 new_track 挂到 target
//   末尾，紧接着 tdSign() 又把它 delete 掉换成 td_sign —— 位置不变。
// ============================================================
'use strict';

const pow = require('./pow.js');
const em = require('./em.js');
const { tdSign } = require('./td_sign.js');
const { newTrack } = require('./new_track.js');
const { makeSlide } = require('./track.js');
const { w } = require('./w.js');

const inp = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const lot = inp.lot_number;
const pd = inp.pow_detail;

// ── biht ──────────────────────────────────────────────────────
// biht 出自 gct 风控脚本（不是 gcaptcha4.js），算法是
//     biht = djb2( GErG.toString() + djb2( Fmhz.toString() ) )
// 关键：哈希的是函数的【源码原文】。任何重新格式化（加换行缩进）
// 都会改变 .toString() 的结果，哈希就对不上 —— 所以必须从 gct 原文件里
// 抠出压缩版的 Fmhz / GErG 文本，不能用重排版。
// 实测：原版文本 → 1426265548（与浏览器一致）；重排的 biht.js → 1250212603（错）。
function getBiht() {
    const fs = require('fs');
    const f = fs.readdirSync(__dirname).find(x => /^gct4\..*\.js$/.test(x));
    if (!f) throw new Error('找不到 gct4.*.js');
    const s = fs.readFileSync(require('path').join(__dirname, f), 'utf8');

    const grab = name => {                       // 按大括号配平抠函数原文
        const i = s.indexOf('function ' + name + '(');
        if (i < 0) return null;
        let d = 0;
        for (let k = s.indexOf('{', i); k < s.length; k++) {
            if (s[k] === '{') d++;
            else if (s[k] === '}') { if (--d === 0) return s.slice(i, k + 1); }
        }
        return null;
    };
    const srcF = grab('Fmhz'), srcG = grab('GErG');
    if (!srcF || !srcG) throw new Error('没在 gct 里找到 Fmhz/GErG');

    // djb2，忠实复刻（依赖 JS 的 int32 语义，别用别的语言重写）
    const djb2 = t => { let e = 5381, n = t.length, o = 0; while (n--) e = (e << 5) + e + t.charCodeAt(o++); return e &= ~(1 << 31); };
    return String(djb2(srcG + djb2(srcF)));
}
let biht = null;
try { biht = getBiht(); } catch (e) { console.error('[warn] biht 计算失败: ' + e.message); }

// ── pow_msg / pow_sign ──
const p = pow(lot, inp.captcha_id, pd.hashfunc, pd.version, pd.bits, pd.datetime, '');

// ── lot 派生的混淆字段（已验证：n[a:b] 是闭区间）──
const n = lot;
const lotField = {
    dQFB: 'BoHp',
    [n.slice(5, 8) + n.slice(7, 10)]: {
        [n.slice(20, 28)]: {
            [n[10] + n[12] + n[3] + n[7]]: n.slice(7, 15)
        }
    }
};

// ── 轨迹 + setLeft / userresponse ─────────────────────────────
let slide, track = null;
if (inp.slide) {
    slide = inp.slide;
} else {
    const passtime = inp.passtime || (700 + Math.floor(Math.random() * 900));
    const r = makeSlide({ gapX: inp.gapX, passtime: passtime });
    track = r.track;
    slide = { setLeft: r.setLeft, passtime: passtime, userresponse: r.userresponse };
}

// ── target：字段顺序按抓包来的 ──
const target = Object.assign({
    setLeft: slide.setLeft,
    passtime: slide.passtime,
    userresponse: slide.userresponse,
    device_id: '',
    lot_number: lot,
    pow_msg: p.pow_msg,
    pow_sign: p.pow_sign,
    geetest: 'captcha',
    lang: 'zh',
    ep: '123',
    biht: biht,
    gee_guard: { roe: { aup: '3', sep: '3', egp: '3', auh: '3', rew: '3', snh: '3', res: '3', cdc: '3' } }
}, lotField, {
    em: em.run(em.browserLike())
});

// ── new_track → td_sign（就地改写 target，返回的就是要单独发出去的 td）──
let td = null;
if (track) {
    target.new_track = newTrack(track);      // 挂在末尾
    td = tdSign(target, lot);                // 删掉 new_track、写上 td_sign、返回它
}
if (inp.new_track) { target.new_track = inp.new_track; td = tdSign(target, lot); }
if (inp.td_sign) target.td_sign = inp.td_sign;

const wstr = w(JSON.stringify(target), { options: { pt: inp.pt || '1' } });
process.stdout.write(JSON.stringify({
    target: target, w: wstr, td: td, slide: slide, track: track,
}, null, 2));
