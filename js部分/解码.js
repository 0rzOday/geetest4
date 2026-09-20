// 解码.js —— 用 msg_pow.js 里自带的解码器解字符串表
// 用法：
//   node 解码.js              → 解出整张表，写出 字符串表.json
//   node 解码.js 712 731 780  → 打印这几个下标对应的字符串
//
// 注：原来读的是 扣代码.js，但那个文件已经不在项目里了。
//     解码器（$_Aj / $_Be / $_CH / $_DS）在 msg_pow.js 里是完整的，
//     所以改成从 msg_pow.js 加载整份文件，再调 $_CH 取字符串。
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const SRC = path.join(__dirname, "msg_pow.js");
const src = fs.readFileSync(SRC, "utf8");

// msg_pow.js 顶层就写 _ᕶᖗᖗᖆ.$_Aj = ...，所以得先把 _ᕶᖗᖗᖆ 挂出来。
// console.log 屏蔽掉：msg_pow.js 自己会打印一堆 hash，解码时不需要。
const ctx = {
  console: { log() {}, warn() {}, error() {}, info() {} },
  Math, JSON, Date, String, Number, Boolean, Array, Object, RegExp,
  parseInt, parseFloat, isNaN, Error, TypeError, Uint8Array, ArrayBuffer,
};
vm.createContext(ctx);

vm.runInContext("var _ᕶᖗᖗᖆ = {};\n" + src, ctx, { timeout: 60000 });

const decode = (i) => vm.runInContext("_ᕶᖗᖗᖆ.$_CH(" + i + ")", ctx);

const args = process.argv.slice(2);
if (args.length) {
  for (const a of args) console.log(a + "\t" + JSON.stringify(decode(Number(a))));
} else {
  const table = {};
  for (let i = 0; i < 1800; i++) {
    try {
      const v = decode(i);
      if (v !== undefined) table[i] = v;
    } catch (e) { /* 越界的下标解不出来，跳过 */ }
  }
  fs.writeFileSync(path.join(__dirname, "字符串表.json"), JSON.stringify(table, null, 1));
  console.log("已写出 字符串表.json，共 " + Object.keys(table).length + " 条");
}
