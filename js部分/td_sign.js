// ============================================================
// td_sign 生成器 —— 逆向自 gcaptcha4.js 的 webpack 模块 [65] (+ 依赖的 [16] crypto-js)
//
//   td_sign = HMAC-SHA256( key = lot_number , message = new_track )
//             输出 64 位小写 hex
//
// 源码形态 (模块[65] @689198, `td_sign` 全文件仅此一处, @689843):
//
//   function _ᖂᖗᖙᕴ(target, arg) {
//     var n = target["new_track"];
//     return n ? (delete target["new_track"],
//                 target["td_sign"] = new (SHA256)["hex_hmac"](arg, n),
//                 n) : null;
//   }
//
// ⚠ 三个必须记牢的点:
//   1) hex_hmac(A, B) 的参数顺序是反的 —— A 是密钥, B 是消息。(已用真模块实测)
//   2) 调用点 @278185: arg = ctx["lotNumber"], 所以 lot_number 当密钥.
//   3) 函数返回的是 new_track(不是 td_sign). td_sign 只是写在 target 上的副作用,
//      而 target 紧接着被 JSON.stringify 进 w —— 所以 td_sign 是 w 密文里的字段.
//      返回的 new_track 则由调用方作为请求体的 "td" 字段单独发出去.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const SDK = path.join(__dirname, 'gcaptcha4.js');
const TABLE = path.join(__dirname, '_newtable.js');
const STARTS = path.join(__dirname, '_modstarts.json');

let _mod65 = null;

// ── 迷你 webpack 运行时：按数组下标懒加载任意模块 ──────────────
function loader() {
    if (_mod65) return _mod65;
    const s = fs.readFileSync(SDK, 'utf8');
    const NS = require(TABLE);
    const st = JSON.parse(fs.readFileSync(STARTS, 'utf8'));
    const src = id => s.slice(st[id], st[id + 1]).replace(/[\s,]+$/, '');
    const factory = id => new Function('_ᖈᕴᖙᕶ', 'return (' + src(id) + ')')(NS);

    const cache = {};
    function req(id) {                     // == webpack 的 __webpack_require__
        if (cache[id]) return cache[id].exports;
        const m = cache[id] = { exports: {} };
        factory(id)(m, m.exports, req);
        return m.exports;
    }
    _mod65 = req(65).default;              // {default: (target, arg) => ...}
    return _mod65;
}

// ── 等价实现（不依赖抠出来的模块，行为一致）────────────────────
const crypto = require('crypto');
const hmacHex = (key, message) => crypto.createHmac('sha256', key).update(message).digest('hex');

/**
 * 等效于 SDK 模块[65] 的 default:
 *   就地删掉 target.new_track, 写上 target.td_sign, 并返回 new_track
 * @param {object} target  即将被 JSON.stringify 进 w 的那个对象
 * @param {string} lotNumber  服务器下发的 lot_number (当 HMAC 密钥)
 * @returns {string|null}  new_track (原样返回), 没有 new_track 时返回 null
 */
function tdSign(target, lotNumber) {
    return loader()(target, lotNumber);
}

/** 只要那串 hex，不改动 target */
function tdSignHex(newTrack, lotNumber) {
    return hmacHex(lotNumber, newTrack);
}

module.exports = { tdSign, tdSignHex, hmacHex };
