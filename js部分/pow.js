'use strict';
/**
 * 极验4 PoW 生成器
 *
 * 来源：从新版 gcaptcha4.js 还原。定位方式是按 msg_pow.js 的结构找同构体：
 *   1. 新版 PoW 生成器是 gcaptcha4.js 偏移 296407..297441 的 `function s(...)`，
 *      7 个形参，与旧版 `function n(A,B,C,D,E,F,G)` 一一对应。
 *   2. 它所在 webpack 模块（296035..297460）里：
 *        t.default = s
 *        var 库     = __importDefault(n(16));   // MD5 / SHA1 / SHA256
 *        var 随机源  = n(9);                    // guid
 *   3. 调用点在偏移 267994 和 269112 两处，参数全部取自 options：
 *
 *        var opt = a.options, pd = opt.powDetail;
 *        var r = POW.default(opt.lotNumber, opt.captchaId,
 *                            pd.hashfunc, pd.version, pd.bits, pd.datetime, "");
 *        opt.powMsg  = r.pow_msg;
 *        opt.powSign = r.pow_sign;
 *
 * ── 与旧版 msg_pow.js 的差异（结论：算法没变）────────────────────
 *   新版局部量把旧版的 c / u 名字对调了，语义完全一致：
 *     旧： u = "0"×parseInt(bits/4)   c = 消息前缀
 *     新： c = "0"×parseInt(bits/4)   _ = 消息前缀
 *   分隔符两版都是 "|"，随机源两版都是 guid()（16 位小写 hex），
 *   哈希表两版都是 {md5:MD5, sha1:SHA1, sha256:SHA256}。
 *
 *   真正会变的只有**参数值**：lotNumber / captchaId 来自 options，
 *   hashfunc / version / bits / datetime 来自服务端下发的 powDetail。
 *   这四个字段今天换没换，取决于接口响应，不取决于前端 JS。
 * ──────────────────────────────────────────────────────────────
 */

/**
 * 原文 guid 的等价实现（模块 n(9)）。
 *   e() = (65536 * (1 + Math.random()) | 0).toString(16).substring(1)
 * 取值落在 [0x10000, 0x1FFFF]，toString(16) 恒为 5 位，substring(1) 砍掉首位 '1'
 * → 恰好 4 位 hex；拼 4 段 = 16 位。
 */
function guid() {
    const e = () => (65536 * (1 + Math.random()) | 0).toString(16).substring(1);
    return e() + e() + e() + e();
}

// 原文：new (库["default"][类型名])()["hex"](msg)
// 类型名 = hashfunc 直接查表（md5 / sha1 / sha256）
const HASH_ALGO = { md5: 'md5', sha1: 'sha1', sha256: 'sha256' };

/**
 * @param {string} lotNumber  options.lotNumber，32 位 hex
 * @param {string} captchaId  options.captchaId，32 位 hex
 * @param {string} hashfunc   powDetail.hashfunc，"md5" | "sha1" | "sha256"
 * @param {string} version    powDetail.version，一般是 "1"
 * @param {number} bits       powDetail.bits，难度位，决定前缀长度
 * @param {string} datetime   powDetail.datetime
 * @param {string} [salt]     原文调用点恒传 ""（dec(69)）
 * @returns {{pow_msg: string, pow_sign: string}}
 */
function pow(lotNumber, captchaId, hashfunc, version, bits, datetime, salt) {
    // 原文：var a = bits % 4, u = parseInt(bits / 4, 10)
    const a = bits % 4;
    const u = parseInt(bits / 4, 10);

    // 原文：new Array(u + 1).join("0")  →  u 个 "0"
    const zeros = new Array(u + 1).join('0');

    // 原文拼接顺序：D | E | C | F | B | A | G |   （即 第4,5,3,6,2,1,7 个形参）
    const prefix = version + '|' + bits + '|' + hashfunc + '|' + datetime + '|'
        + captchaId + '|' + lotNumber + '|' + (salt === undefined ? '' : salt) + '|';

    const algo = HASH_ALGO[hashfunc];
    if (!algo) throw new Error('未知 hashfunc: ' + hashfunc);

    // 原文：while(1) { guid() 当随机后缀，直到哈希满足难度条件 }
    for (;;) {
        const h = guid();
        const msg = prefix + h;
        const sign = require('crypto').createHash(algo).update(msg).digest('hex');

        if (0 === a) {
            // bits 是 4 的倍数：要求前缀恰好 u 个 "0"
            if (0 === sign.indexOf(zeros)) return { pow_msg: msg, pow_sign: sign };
        } else if (0 === sign.indexOf(zeros)) {
            // 非 4 的倍数：前缀 u 个 "0"，再看第 u 位这个 hex 字符是否 <= f
            // 注意原文 d = sign[u] 取到的是「字符」，与数字比较时 JS 会隐式转换：
            // '0'..'9' 转成 0..9 参与比较，'a'..'f' 转成 NaN 恒为 false。
            let f;
            const d = sign[u];
            switch (a) {
                case 1: f = 7; break;
                case 2: f = 3; break;
                case 3: f = 1; break;
            }
            if (d <= f) return { pow_msg: msg, pow_sign: sign };
        }
    }
}

pow.guid = guid;
module.exports = pow;
module.exports.default = pow;   // 对应原文 t.default = s
