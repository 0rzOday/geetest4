// 真实 td（浏览器手拖） vs 合成轨迹 逐项对拍
'use strict';
const fs = require('fs'), zlib = require('zlib');
const T = require('./track.js');

const TYPE_REV = { 0: 'start', 1: 'move', 2: 'end', 3: 'down' };

function dec(s) {
    const b = Buffer.from(s.trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return JSON.parse(zlib.gunzipSync(b).toString('utf8'));
}

function measure(trk) {
    const p = trk.p;
    const types = {};
    for (const q of p) types[TYPE_REV[q[3]]] = (types[TYPE_REV[q[3]]] || 0) + 1;
    const down = p.find(q => q[3] === 3);
    const end = p[p.length - 1];

    const dts = [];
    for (let i = 1; i < p.length; i++) dts.push(p[i][0] - p[i - 1][0]);

    // 相邻点的实际位移（px）
    const steps = [];
    for (let i = 1; i < p.length; i++) {
        if (p[i][3] === 1 && p[i - 1][3] !== 2) {
            steps.push(Math.hypot((p[i][1] - p[i - 1][1]) * trk.w, (p[i][2] - p[i - 1][2]) * trk.h));
        }
    }
    // 只统计拖动段（down 之后）的 dt
    const dragDts = [];
    for (let i = 1; i < p.length; i++) if (p[i][0] > down[0] && p[i][0] <= end[0]) dragDts.push(p[i][0] - p[i - 1][0]);

    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
    const dragMs = end[0] - down[0];
    return {
        n: p.length, types: types,
        downT: down[0], passtime: trk.e - trk.s, dragMs: dragMs,
        dragPct: dragMs / (trk.e - trk.s) * 100,
        stepMean: mean(steps), stepSd: sd(steps), stepMax: Math.max(...steps), stepMin: Math.min(...steps),
        dtMean: mean(dts), dtSd: sd(dts), dtMax: Math.max(...dts),
        dragDtMean: mean(dragDts), dragDtSd: sd(dragDts), dragDtMax: Math.max(...dragDts),
        downX: (down[1] * trk.w).toFixed(0), downY: (down[2] * trk.h).toFixed(0),
        yDrift: ((end[2] - down[2]) * trk.h).toFixed(1),
        setLeft: Math.trunc((end[1] - down[1]) * trk.w),
    };
}

function row(tag, m) {
    console.log('%s', tag);
    console.log('   点数 %-4d (start %d / move %d / down %d / end %d)   passtime %d  down@%d (%.0f%%)',
        m.n, m.types.start || 0, m.types.move || 0, m.types.down || 0, m.types.end || 0,
        m.passtime, m.downT, m.downT / m.passtime * 100);
    console.log('   步长px   均值 %-7s 标准差 %-7s 最小 %-6s 最大 %s',
        m.stepMean.toFixed(2), m.stepSd.toFixed(2), m.stepMin.toFixed(2), m.stepMax.toFixed(2));
    console.log('   dt(全部) 均值 %-7s 标准差 %-7s 最大 %s', m.dtMean.toFixed(1), m.dtSd.toFixed(1), m.dtMax);
    console.log('   dt(拖动) 均值 %-7s 标准差 %-7s 最大 %s', m.dragDtMean.toFixed(1), m.dragDtSd.toFixed(1), m.dragDtMax);
    console.log('   按下(%s,%s)  y漂移 %s px   setLeft %d', m.downX, m.downY, m.yDrift, m.setLeft);
}

const real = dec(fs.readFileSync('_real_td.txt', 'utf8'));
const rm = measure(real);
console.log('\n════════ 真实 td（浏览器手拖）════════');
row('  真值', rm);

console.log('\n════════ 合成 8 条（同 setLeft=%d, 同 passtime=%d）════════', rm.setLeft, rm.passtime);
const agg = [];
for (let i = 0; i < 8; i++) {
    const r = T.makeSlide({ gapX: rm.setLeft / T.SCALE_A, passtime: rm.passtime });
    const m = measure(r.track);
    agg.push(m);
    row('  #' + (i + 1), m);
}
const mean = (k) => agg.reduce((a, b) => a + b[k], 0) / agg.length;
console.log('\n════════ 合成 8 条平均 vs 真实 ════════');
console.log('  指标            真实      合成均值');
console.log('  点数            %-9d %s', rm.n, mean('n').toFixed(1));
console.log('  步长标准差      %-9s %s', rm.stepSd.toFixed(2), mean('stepSd').toFixed(2));
console.log('  步长最大        %-9s %s', rm.stepMax.toFixed(2), mean('stepMax').toFixed(2));
console.log('  dt 标准差       %-9s %s', rm.dtSd.toFixed(1), mean('dtSd').toFixed(1));
console.log('  dt 最大         %-9d %s', rm.dtMax, mean('dtMax').toFixed(0));
console.log('  down 占比 %%     %-9s %s', rm.downT / rm.passtime * 100, (mean('downT') / rm.passtime * 100).toFixed(1));
console.log('  拖动占比 %%     %-9s %s', rm.dragPct.toFixed(1), mean('dragPct').toFixed(1));
console.log('  y 漂移 px       %-9s %s', rm.yDrift, mean('yDrift' in agg[0] ? 'yDrift' : 'yDrift'));
