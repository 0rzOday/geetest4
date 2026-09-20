// ============================================================
// new_track 生成器 —— 逆向自 gcaptcha4.js 的 webpack 模块 [42] / [43] / [44]
//
//   new_track = base64url_nopad( gzip( JSON.stringify( 轨迹对象 ) ) )
//
//   轨迹对象 = Track 类(模块[41]) 上 track.finish(arg) 的返回值
//
// ── 关于为什么必须用 pako 而不是 zlib ────────────────────────
// gzip 头（1f 8b 08 / FLG=0 / XFL=0 / OS=3）和尾（CRC32 + ISIZE）两边都一样，
// 但 **deflate 正文永远对不上**，且不限长度：
//   实测 395 B ~ 79 KB 的轨迹 JSON，
//     真 pako vs Node zlib.gzipSync(lvl 6/9)                     → 全部不等
//     真 pako vs Python zlib 裸 deflate(1-9 × memLevel 8/9 × 5策略) → 全部不等
//   最短的 395 B 输入就已经分叉，不是「输入大了才不一样」。
//   两边的解压结果完全一致，只是压缩字节不同。
// 所以这里直接加载抠出来的真 pako。若装了 npm 包 pako，把 src() 换成
// require('pako') 应当等价（pako 上游同源），但务必对拍过再用。
//
// 另注：pako 的 gzip 头里 MTIME 写的是**当前 unix 时间**，同一输入隔一秒跑两次
// 字节就不同。服务端会忽略该字段，但别拿输出做哈希比对（要比对先把这 4 字节清零）。
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const SDK = path.join(__dirname, 'gcaptcha4.js');
const TABLE = path.join(__dirname, '_newtable.js');
const STARTS = path.join(__dirname, '_modstarts.json');

// ── 从 gcaptcha4.js 里按偏移抠出模块并实例化 ──────────────────
let _pako = null, _b64 = null;
function load() {
    if (_pako) return;
    const s = fs.readFileSync(SDK, 'utf8');
    const NS = require(TABLE);                       // 字符串表解码器
    const st = JSON.parse(fs.readFileSync(STARTS, 'utf8'));
    // 模块切片尾部会带上数组的逗号，去掉
    const src = id => s.slice(st[id], st[id + 1]).replace(/[\s,]+$/, '');
    const M = id => new Function('_ᖈᕴᖙᕶ', 'return (' + src(id) + ')')(NS);

    const built = {};
    const req = id => { if (!(id in built)) throw new Error('模块 ' + id + ' 未加载'); return built[id]; };
    for (const id of [44, 43]) { const t = {}; M(id)({}, t, req); built[id] = t; }
    _pako = built[44];   // {gzipSync, strToU8, ...}  pako 2.x
    _b64 = built[43];    // {default: (u8) => string}  URL-safe, 无 '=' 填充
}

// 等价于模块[43]；也可直接用 _b64.default
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// track: track.finish() 的返回值（纯 JSON 对象）
function newTrack(track, opt) {
    load();
    const j = JSON.stringify(track);
    const raw = _pako.gzipSync(_pako.strToU8(j), opt || {});
    return _b64.default(raw);
}

module.exports = { newTrack, ALPHABET };
