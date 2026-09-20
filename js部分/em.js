'use strict';
/**
 * em —— 极验4 环境检测模块
 *
 * 来源：从 gcaptcha4.js 原始混淆代码里还原（原 em 段位于字符偏移 691181..693432）。
 * 原代码把 7 个检测器塞在 _ᕴᖗᖗᖆ(name, obj) 工厂的闭包里，抠函数时闭包会断，
 * 这里按原文语义重写，不依赖任何闭包，也不再复用混淆器的乱名池。
 *
 * 原文字符串表解码结果（索引 → 值）已内联为字面量，避免再拖一份解码器。
 *
 * 返回码约定（原文 o / a / u）：
 *   0 (o) = 否/未检出    1 (a) = 是/检出    2 (u) = 检出且值可用
 *   8 / 9  = 特殊分支（原型链取不到对象 / gOPD 结果异常）
 */

// ───────────────────────── 环境注入 ─────────────────────────
function defaultEnv() {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    return {
        window: typeof window !== 'undefined' ? window : g,
        document: typeof document !== 'undefined' ? document : (g.document || {}),
        navigator: typeof navigator !== 'undefined' ? navigator : (g.navigator || {}),
    };
}

const O = 0   // 原文 o
    , A = 1   // 原文 a
    , U = 2;  // 原文 u

// 原文 c(a, b) → a in b；原文 _(x) → x ? 1 : 0
const isIn = (name, obj) => name in obj;
const code = (x) => (x ? A : O);

/**
 * 原文工厂 _ᕴᖗᖗᖆ(name, obj)：返回一个闭包，调用时算 (name in obj) ? 1 : 0。
 * 工厂一共被调用 4 次 → ph / nt / si / sc，这就是原文件里那 4 份"复制品"的由来。
 */
const containsFactory = (name, obj) => () => code(isIn(name, obj));

// ───────────────────────── 7 个检测器 ─────────────────────────

// ph —— "_phantom" in window          (dec(1818) + dec(1821))
function ph(env) {
    return containsFactory('_p' + 'hantom', env.window)();
}

// nt —— "__nightmare" in window       (["_","_nig","htma","re"].join(""))
function nt(env) {
    return containsFactory(['_', '_nig', 'htma', 're'].join(''), env.window)();
}

// si —— "__webdriver_script_fn" in document   (["_","webdriver","script","fn"].join("_"))
function si(env) {
    return containsFactory(
        ['_', 'webdriver', 'script', 'fn'].join('_'), env.document)();
}

// sc —— "$cdc_asdjflasutopfhvcZLmcfl_" in document  (ChromeDriver 特征变量)
function sc(env) {
    return containsFactory(
        ['$cdc_as', 'djflasu', 'topfhvc', 'ZLmcfl_'].join(''), env.document)();
}

// cp —— "callPhantom" in window        (dec(1894) + dec(1821) = "callP" + "hantom")
function cp(env) {
    const name = 'callP' + 'hantom';
    if (!isIn(name, env.window)) return O;          // 原文：return o
    let r;                                          // 原文 _ᖈᕸᕷᕵ，初始 undefined
    try {
        env.window[name];                           // 取一次，PhantomJS 下会抛
    } catch (e) {
        r = [];
    }
    return r ? 9 : A;                               // 原文：return r ? 9 : a
}

// ek —— Error 对象属性指纹：探测 10 个栈相关属性名是否存在 → 拼二进制 → 转 hex
function ek() {
    const m = 5 * Math.random()                     // 原文就是个数字
        , n = m - 1
        , arr = [];
    let err = arr;
    try {
        err.push(m(err, n));                        // 调用数字 → 必然抛 TypeError，被 catch 拿到 Error 对象
    } catch (e) {
        err = e;
    }

    const head = ['line', 'column', 'Number']
        , names = [
            head[0],                    // "line"
            head[1],                    // "column"
            head[0] + head[2],          // "lineNumber"
            head[1] + head[2],          // "columnNumber"
            'fileName',                 // dec(1838)
            'message',                  // dec(988)
            head[2].toLowerCase(),      // "number"   dec(34)=toLowerCase
            'description',              // dec(1834)
            'sourceURL',                // dec(1873)
            'stack',                    // dec(1830)
        ]
        , out = names.slice(names.length);          // 原文 o = r.slice(r.length) → []
    for (let i = 0, u = names.length; i < u; ++i) {
        out[i] = isIn(names[i], err) ? A : O;
    }
    return parseInt(out.join(''), 2).toString(16);
}

// wd —— navigator.webdriver（原型链回溯 + getOwnPropertyDescriptor 反检测）
function wd(env) {
    const W = env.window
        , NAV = env.navigator
        , OBJ = Object
        , name = 'webdriver';                       // dec(822)

    // 原文内联 IIFE：找 navigator 的原型链上游对象
    const proto = (function (r) {
        let o;
        if (typeof r != 'undefined')
            return ('function' == typeof OBJ.getPrototypeOf) && (o = OBJ.getPrototypeOf(r)),
                typeof o != 'undefined' ? o
                    : typeof (o = r['$_BGHN']) != 'undefined' ? o
                        : typeof (o = r.constructor) != 'undefined' ? o.prototype
                            : void 0;
    })(NAV);

    if (!proto) return 8;                                   // 原文：if (!_ᖈᕵᖘᕶ) return 8
    if (!isIn(name, proto))                                 // 原型链上没有 webdriver
        return isIn(name, NAV) ? (NAV[name] ? U : A) : O;
    if (!('function' == typeof OBJ.getOwnPropertyDescriptor))
        return NAV[name] ? U : A;                           // 原文 r(...) = 值 ? 2 : 1
    const d = OBJ.getOwnPropertyDescriptor(proto, name);
    return 'object' != typeof d ? 9                         // dec(7) = "object"
        : d.get ? (d.get.call(NAV) ? U : A)                 // dec(1244)="get" dec(37)="call"
            : (d.value ? U : A);                            // dec(362)="value"
}

// ───────────────────────── 组装 ─────────────────────────
// 原文 k = ["ph","cp","ek","wd","nt","si","sc"]，T 与之逐位对应
const TABLE = [
    ['ph', ph],
    ['cp', cp],
    ['ek', ek],
    ['wd', wd],
    ['nt', nt],
    ['si', si],
    ['sc', sc],
];

/**
 * 原文 em(a, b)：把 7 项检测结果写进 b，返回 a。
 * 注意原文是 T[r](r) —— 把下标 r 当参数传进去（那 4 个闭包忽略参数，所以无所谓）。
 */
function em(a, b, env) {
    const E = env || defaultEnv();
    for (let r = 0, u = TABLE.length; r < u; ++r) {
        const n = TABLE[r];
        b[n[0]] = n[1](E, r);
    }
    return a;
}

/** 便捷入口：直接返回结果对象 */
function run(env) {
    const out = {};
    em({}, out, env);
    return out;
}

/**
 * 浏览器仿真环境（Chrome 形状）。
 *
 * 为什么要它：wd 检测走的是「原型链 + getOwnPropertyDescriptor」这条路，
 * 而 Node 的全局 navigator 上压根没有 webdriver 这个属性，原型链上也找不到，
 * 所以裸 Node 里 wd 恒为 0。真实 Chrome 把 webdriver 定义在 Navigator.prototype 上
 * （accessor，正常浏览时 getter 返回 false），于是 wd = 1。
 * 这里把这个形状补出来。
 *
 * 期望结果：{"ph":0,"cp":0,"ek":"11","wd":1,"nt":0,"si":0,"sc":0}
 */
function browserLike(overrides) {
    // 对应 Navigator.prototype.webdriver —— 注意必须是"存在且值为 false"
    const navProto = {
        get webdriver() { return false; },
    };
    const nav = Object.create(navProto);
    const env = {
        window: {},
        document: {},
        navigator: nav,
    };
    if (overrides) Object.assign(env, overrides);
    return env;
}

/** 被 WebDriver 接管的环境（Selenium / ChromeDriver / Puppeteer 默认形态） */
function automationLike() {
    const env = browserLike();
    Object.defineProperty(
        Object.getPrototypeOf(env.navigator), 'webdriver',
        { get() { return true; }, configurable: true });
    env.document['$cdc_asdjflasutopfhvcZLmcfl_'] = 1;   // ChromeDriver 特征变量
    return env;
}

module.exports = em;
module.exports.em = em;
module.exports.run = run;
module.exports.defaultEnv = defaultEnv;
module.exports.browserLike = browserLike;
module.exports.automationLike = automationLike;
module.exports.$_BEj = true;
