// 解 td（base64url → gunzip → JSON），顺便把 $_Cl 的几个索引翻出来
'use strict';
const fs = require('fs');
const zlib = require('zlib');

const td = process.argv[2] || fs.readFileSync(0, 'utf8').trim();

/* ── 1. 解 td ── */
const b64 = td.replace(/-/g, '+').replace(/_/g, '/');
const raw = Buffer.from(b64, 'base64');
console.log('=== td ===');
console.log('base64url 长度 =', td.length, ' → 压缩后 =', raw.length, '字节');
console.log('gzip 魔数 =', raw[0].toString(16), raw[1].toString(16), raw[0] === 0x1f && raw[1] === 0x8b ? '✓' : '✗');

let json;
try {
    json = zlib.gunzipSync(raw).toString('utf8');
} catch (e) {
    console.log('zlib 失败:', e.message);
    process.exit(1);
}
console.log('解压后 =', json.length, '字节');
console.log(json);

const o = JSON.parse(json);
const p = o.p;
console.log('\n=== 概要 ===');
console.log('m =', o.m, ' ("' + JSON.stringify(o.m) + '" 类型 ' + typeof o.m + ')');
console.log('w =', o.w, '  h =', o.h);
console.log('s =', o.s, '  e =', o.e, '  passtime = e-s =', o.e - o.s);
console.log('点数 =', p.length);
console.log('类型分布 =', JSON.stringify(p.reduce((a, q) => (a[q[3]] = (a[q[3]] || 0) + 1, a), {})));

const xs = p.map(q => q[1]), ys = p.map(q => q[2]);
console.log('\nx: min =', Math.min(...xs), ' max =', Math.max(...xs), ' 跨度 Δx =', +(Math.max(...xs) - Math.min(...xs)).toFixed(4));
console.log('y: min =', Math.min(...ys), ' max =', Math.max(...ys), ' 跨度 Δy =', +(Math.max(...ys) - Math.min(...ys)).toFixed(4));
console.log('x 首 =', p[0][1], ' x 末 =', p[p.length - 1][1]);
console.log('\nt: 首 =', p[0][0], ' 末 =', p[p.length - 1][0], '  e-s =', o.e - o.s, (p[p.length - 1][0] === o.e - o.s ? ' ✓ 与 e-s 相等' : ' ✗ 与 e-s 不等'));

// 试着把 x 归一化值 × 各种尺寸，看谁像整数
const base = +(Math.max(...xs) - Math.min(...xs)).toFixed(6);
console.log('\n=== 试基准（Δx=' + base + ' 乘各种尺寸）===');
for (const [name, v] of [['innerWidth', 411], ['innerHeight', 898], ['track w', o.w], ['track h', o.h]]) {
    console.log('  ×', name.padEnd(12), '=', +(base * v).toFixed(4));
}

console.log('\n=== 前 5 点 / 后 5 点 ===');
console.log('前:', JSON.stringify(p.slice(0, 5)));
console.log('后:', JSON.stringify(p.slice(-5)));

/* ── 2. $_Cl 翻译 ── */
console.log('\n=== $_Cl 索引 ===');
try {
    const NS = require('./_newtable.js');
    const Cl = NS.$_Cl;
    console.log('typeof $_Cl =', typeof Cl);
    for (const i of [219, 55, 19, 37, 17, 26, 50, 78, 84, 34]) {
        try { console.log('  $_Cl(' + i + ') =', JSON.stringify(Cl(i))); }
        catch (e) { console.log('  $_Cl(' + i + ') 报错', e.message); }
    }
} catch (e) { console.log('加载 _newtable.js 失败:', e.message); }
