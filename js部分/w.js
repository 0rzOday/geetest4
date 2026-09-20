// ============================================================
// w 生成器 —— 逆向自 gcaptcha4.js 的 webpack 模块 [32]
//
//   pt 缺省 / "0"  →  w = base64url_nopad( 明文 )         （不加密）
//   pt = "1"       →  w = hex( AES(明文, guid) ) + RSA_hex(guid)
//   pt = "2"       →  w = hex( 对称(明文, guid) ) + SM2(guid)
//
//   guid  = 模块[0].guid()，每次调用现生成的一串随机
//
// ── 密码参数（已实测反推确认，见 _w_aes.js）────────────────────
//   对称段 = AES-128-CBC
//              key = utf8(guid)                guid 是 16 个 ASCII 字符
//              iv  = utf8("0000000000000000")   16 个 ASCII '0'，不是 16 个零字节！
//            PKCS7 填充 → hex
//     验证：拿已知 guid 生成的 w，用上面参数能整段解回原文，逐字节相等。
//   尾  段 = RSA-1024 / PKCS#1 v1.5 (guid) → hex，恰好 256 字符
//
// ── 哪些部分可比、哪些不可比 ──────────────────────────────────
//   对称段：guid 定了就完全确定，可逐字节比对。
//   尾  段：PKCS#1 v1.5 的填充字节是随机的、SM2 的 k 是随机的，
//           同一个 guid 连跑两次都不同 —— 浏览器自己也无法复现，别拿去比。
//
// ── 模块[32] 原逻辑里两个容易看反的点 ─────────────────────────
// 1) r[a] 的属性名看着像反的：
//      960 = "asymmetric"，1029 = "symmetrical"
//    代码是 r[a][960].encrypt(guid)       ← 非对称只用来包 guid
//             r[a][1029].encrypt(明文, guid) ← 明文走对称
//    名字没写反，是「非对称包 key、对称包数据」这个套路。
// 2) RSA 那条路有个重试循环：密文长度必须正好 256 个 hex（1024bit）。
//    长度不对就重新生成 guid 再包一次，直到凑够 256。SM2 那条没有这个约束。
//
// ── 依赖 ────────────────────────────────────────────────────
// 对称/非对称算法本身是大库，不手工重写，直接走 gcaptcha4.js 自带的
// mini webpack 运行时加载真模块（与 new_track.js / td_sign.js 同一套路）：
//   [0]  helpers   guid / arrayToHex / $_BHE
//   [33] base64url {urlsafe_encode, urlsafe_decode, encode, decode}
//   [34] 对称(pt=1) {encrypt}                crypto-js AES
//   [35] 非对称(pt=1) {default: RSAKey}      jsbn RSA（proto: doPublic/setPublic/encrypt）
//   [36] 对称(pt=2) {default: Cipher}        自研分组密码
//   [37] 非对称(pt=2) {encrypt, ...}         SM2
// 注意 [35] 是 UMD 包，加载前必须先补 globalThis.window。
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SDK = path.join(__dirname, 'gcaptcha4.js');
const TABLE = path.join(__dirname, '_newtable.js');
const STARTS = path.join(__dirname, '_modstarts.json');

let _req = null;
function load() {
    if (_req) return _req;
    // jsbn 的 UMD 包装要 window，Node 里补一个
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

    const s = fs.readFileSync(SDK, 'utf8');
    const NS = require(TABLE);
    const st = JSON.parse(fs.readFileSync(STARTS, 'utf8'));
    const src = id => s.slice(st[id], st[id + 1]).replace(/[\s,]+$/, '');
    const M = id => new Function('_ᖈᕴᖙᕶ', 'return (' + src(id) + ')')(NS);

    const cache = {};
    const req = id => {                       // == webpack __webpack_require__
        if (cache[id]) return cache[id].exports;
        const m = cache[id] = { exports: {} };
        M(id)(m, m.exports, req);
        return m.exports;
    };
    _req = req;
    return req;
}

// ── 正式用法：直接调 bundle 里真的模块[32]。default ──────────
// 这就是「原样抠出来的那个 function i(a, b)」，一个字符都没改，
// 只是把它的 7 个外部依赖接到了真模块上：
//   _ᖈᕴᖙᕶ 解码器命名空间   _ᖀᖚᖙᖈ 模块[33]  _ᖂᖁᖀᖚ 模块[0]
//   _ᖘᕵᖆᖗ 模块[34]        _ᕺᕷᖉᖘ 模块[35]  _ᖈᕵᖘᕶ 模块[36]  _ᕴᖗᖗᖆ 模块[37]
// 单抄那一个函数是跑不起来的，它引用的这 7 个名字必须一起接上。
function w(plaintext, ctx) {
    return load()(32).default(plaintext, ctx);
}

// ── 手抄复刻版（只为读着方便，已与上面逐字节对拍过）──────────
function wByHand(plaintext, ctx) {
    const req = load();
    const m0 = req(0), b64 = req(33).default, aes = req(34).default;
    const RsaKey = req(35).default, Cipher = req(36).default, sm2 = req(37).default;

    const opt = ctx['options'];
    if (!opt['pt'] || opt['pt'] === '0') return b64['urlsafe_encode'](plaintext);

    let guid = m0['guid']();
    const set = new m0['$_BHE'](['1', '2']);
    const r = {
        1: { symmetrical: aes, asymmetric: new RsaKey() },
        2: {
            symmetrical: new Cipher({ key: guid, mode: 'cbc', iv: '0000000000000000' }),
            asymmetric: sm2
        }
    };

    if (set['$_DCL'](opt['pt'])) {
        const isRsa = opt['pt'] === '1';
        const k = opt['pt'];
        let u = r[k]['asymmetric']['encrypt'](guid);
        while (isRsa && (!u || u.length !== 256)) {
            guid = m0['guid']();
            u = new RsaKey()['encrypt'](guid);
        }
        const c = r[k]['symmetrical']['encrypt'](plaintext, guid);
        return m0['arrayToHex'](c) + u;
    }
}

// ── 反向：把一条 w 的对称段解回明文 ───────────────────────────
// 尾段解不了（RSA 要服务器私钥、SM2 要服务器私钥），所以只能验对称段。
// 但对称段的 key 就是 guid，guid 一给，这条 w 就完全可验证了。
function decryptW(wstr, guid, pt) {
    if (!pt || pt === '0') return Buffer.from(wstr, 'base64url').toString('utf8');
    const tail = pt === '1' ? 256 : 224;
    const sym = Buffer.from(wstr.slice(0, wstr.length - tail), 'hex');
    if (pt === '1') {
        const d = crypto.createDecipheriv('aes-128-cbc',
            Buffer.from(guid, 'utf8'), Buffer.from('0000000000000000', 'utf8'));
        d.setAutoPadding(false);                        // 自己剥 PKCS7，方便看坏在哪
        const out = Buffer.concat([d.update(sym), d.final()]);
        return out.slice(0, out.length - out[out.length - 1]).toString('utf8');
    }
    throw new Error('pt=2 是自研分组密码，没做反向解密（模块[36] 只导出了 encrypt）');
}

module.exports = { w, wByHand, decryptW, wNative: w, load };
