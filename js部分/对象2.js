'use strict';
/**
 * 对象2 —— 极验4 lot/lotRes 动态对象生成（清理版）
 *
 * 相对 对象2.js 改了什么：
 *   1. em 那部分（原来的 C1..C7 + em 包装，160..275 行）整段删掉 → require('./em.js')
 *      那 7 个函数本来是 em 工厂闭包的复制品，且闭包断了，全是废码。
 *   2. 字符串表 + 解码器（1..135 行）搬去 ./解码器.js；
 *      computeSignature 里的解码索引全部还原成字面量，所以本文件不再依赖解码器。
 *   3. 顶层所有标识符重命名（原文用的乱名池名字和函数内部撞车，是污染的根源）。
 *      函数内部的乱名一律原样保留 —— 那些是纯局部量，不可能跨作用域。
 *   4. 原来的 Object.assign polyfill（313..341 行）换成原生 Object.assign。
 *   5. 修掉隐式全局：原文 `C = [...]`(260) 和 `_ᕴᖗᖗᖆ = {...}`(342) 都没写 var。
 *   6. 去掉自毁语句 `_ᖂᖗᖙᕴ = $_Dl()[15][18]`(359)。
 *
 * 输出结构与原文一致：
 *   {
 *     "<段0>": { "<段1>": { "<段2>": "<lotRes 签名>" } },
 *     "em": { ph, cp, ek, wd, nt, si, sc }
 *   }
 */

const data = require('./lot&lotRes.js');
const em = require('./em.js');

// ─────────────────────────────────────────────────────────────
// lotNumber → 签名片段
//
// data.lot / data.lotRes 是某个类的实例，原型上挂着 $_BIx / $_CAH / $_BJH：
//   source.$_BIx(fn)   —— 遍历每一"段"，把 fn 的返回值收集起来
//   seg.$_BIx(fn)      —— 遍历段内每一"片"
//   part.$_BJH         —— 该片在 lotNumber 上的区间 [from, to]
//   x.$_CAH(sep)       —— 用 sep 把收集到的内容拼成一个字符串
//
// 原文这里套了三层解码器（["$_DJEd"]/["$_DJJl"]/["$_EAEJ"] 标记 + $_Cl(137/149/105/147/106/69/191)），
// 解出来就是下面这些字面量，纯属混淆，已全部还原。
// ─────────────────────────────────────────────────────────────
function computeSignature(source, lotNumber) {
    return source['$_BIx'](function (seg) {
        return seg['$_BIx'](function (part) {
            var r = part['$_BJH']
                , from = r[0]
                , to = 1 < r.length ? r[1] + 1 : r[0] + 1;   // 原文用 "length" 判长度
            return lotNumber.slice(from, to);                // 原文用 "slice"
        })['$_CAH']('');                                     // 片内用 "" 拼
    })['$_CAH']('.');                                        // 段间用 "." 拼
}

// ─────────────────────────────────────────────────────────────
// 主流程（原文 302..359）
// ─────────────────────────────────────────────────────────────
const DEFAULT_LOT_NUMBER = '3debb87104454479b2f9dc9ff75308d2';

/**
 * @param {string} lotNumber  32 位 hex 的 lot 编号
 * @param {object} [env]      环境检测用的 window/document/navigator；
 *                            默认 em.browserLike()，与真实浏览器结果一致
 */
function build(lotNumber, env) {
    const lotSig = computeSignature(data.lot, lotNumber);      // 原文 i
    const resSig = computeSignature(data.lotRes, lotNumber);   // 原文 r

    // 原文 o = lotSig.split(".")；这里拆出来的每一段都当成一层嵌套 key
    const segments = lotSig.split('.');

    // 原文 345..353：逐段下钻建对象，最后一段的值放 resSig
    const out = {};                                            // 原文 a
    segments.reduce(function (prev, cur, idx) {
        return idx === segments.length - 1
            ? prev[cur] = resSig
            : prev[cur] || (prev[cur] = {}),
            prev[cur];
    }, out);

    // 原文 356..358：em 的结果挂在 em 字段下
    out.em = {};
    em([], out.em, env || em.browserLike());

    return out;
}

const result = build(DEFAULT_LOT_NUMBER);

module.exports = result;

// build 挂成不可枚举属性：方便换 lotNumber / 换环境复算，
// 又不会混进 JSON.stringify 和 Object.keys
Object.defineProperty(module.exports, 'build', { value: build, enumerable: false });
