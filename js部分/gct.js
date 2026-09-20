// window._gct —— 直接转发 gct4.<hash>.js 的抠出物
//
// 【重要】不要美化、不要重命名、不要动 gct4.5a2e755576738ba0499d714db4f1c9e0.js 里的
// Fmhz / GErG 一个字符。biht 算的是：
//     djb2( GErG.toString() + String(djb2(Fmhz.toString())) )
// 即函数【源码文本】的哈希，对空格/换行/缩进全敏感。
// 昨天那份美化过的 biht.js 算出来是 1250212603，真文件是 1426265548 —— 错的会被识破。
//
// gcaptcha4.js 偏移 266944 处 $_BCDw 里是这么用的：
//     var n = {geetest:"captcha", lang:"zh", ep:"123"};
//     if (_gct) { _gct(n); $_CBi(target, n); }   // biht 就这么混进 options
// 所以只要把 globalThis._gct 挂上，gcaptcha4.js 那边的自由变量 _gct 就通了。

const _gct = require('./gct4.5a2e755576738ba0499d714db4f1c9e0.js');

// 供 gcaptcha4.js 那种「直接引用全局 _gct」的代码使用
if (typeof globalThis !== 'undefined' && !globalThis._gct) globalThis._gct = _gct;

// 一步拿 biht，参数默认就是 gcaptcha4.js 实际构造的那三个
function biht(n) {
    n = n || { geetest: 'captcha', lang: 'zh', ep: '123' };
    _gct(n);
    return n.biht;
}

module.exports = _gct;
module.exports._gct = _gct;
module.exports.biht = biht;
module.exports.default = _gct;
