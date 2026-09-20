// 量一下：解码器别名的声明形态、是否全局唯一、有没有和普通变量撞名
const fs = require('fs');
const s = fs.readFileSync('gcaptcha4.js', 'utf8');
const NS = require('./_newtable.js');

// ── 分词器（跳过字符串/模板/注释/正则）──
function tok(src) {
    const BS = String.fromCharCode(92);
    const out = [];
    const KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'case', 'yield', 'await', 'throw']);
    const OK = new Set(['(', '[', '{', ',', ';', '=', ':', '!', '&', '|', '?', '+', '-', '*', '%', '^', '~', '<', '>']);
    let i = 0, prev = '[', prevWord = false;
    const isGlyph = c => c.charCodeAt(0) >= 0x1400 && c.charCodeAt(0) <= 0x167F;
    const isId0 = c => /[A-Za-z_$]/.test(c) || isGlyph(c);
    const isId = c => /[A-Za-z0-9_$]/.test(c) || isGlyph(c);
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
        if (c === '"' || c === "'") { const q = c, st = i; i++; while (i < src.length && src[i] !== q) { if (src[i] === BS) i++; i++; } i++; out.push({ t: 's', v: src.slice(st, i), p: st }); prev = q; prevWord = false; continue; }
        if (c === '`') { const st = i; i++; while (i < src.length && src[i] !== '`') { if (src[i] === BS) { i += 2; continue; } i++; } i++; out.push({ t: 's', v: src.slice(st, i), p: st }); prev = '`'; prevWord = false; continue; }
        if (c === '/') {
            const ok = prevWord ? KW.has(prev) : OK.has(prev);
            if (ok) { const st = i; let j = i + 1, inC = false; while (j < src.length) { const ch = src[j]; if (inC) { inC = false; j++; continue; } if (ch === BS) { j += 2; continue; } if (ch === '[') inC = true; else if (ch === '/') { j++; break; } else if (ch === '\n') break; j++; } while (j < src.length && /[a-z]/.test(src[j])) j++; i = j; out.push({ t: 's', v: src.slice(st, i), p: st }); prev = '/'; prevWord = false; continue; }
        }
        if (isId0(c)) { const st = i; let j = i; while (j < src.length && isId(src[j])) j++; const w = src.slice(i, j); out.push({ t: 'w', v: w, p: st }); prev = w; prevWord = true; i = j; continue; }
        if (/[0-9]/.test(c)) { const st = i; let j = i; while (j < src.length && /[0-9a-fA-FxXoObBeE._]/.test(src[j])) j++; i = j; out.push({ t: 'n', v: src.slice(st, i), p: st }); prev = '0'; prevWord = false; continue; }
        out.push({ t: 'p', v: c, p: i }); prev = c; prevWord = false; i++;
    }
    return out;
}

const modStart = 131890;
const T = tok(s.slice(modStart, modStart + 1047303 - modStart));

// 找 prologue 形态:  var A = X.$_Cl , B = [ "..." ] . concat ( A ) , C = B [ 1 ] ; B . shift ( ) ; var D = B [ 0 ] ;
const aliasDecl = new Map();   // 别名 → 出现次数
const declSites = [];
const isGlyphStr = w => w.length > 1 && w[0] === '_' && [...w.slice(1)].every(c => c.charCodeAt(0) >= 0x1400 && c.charCodeAt(0) <= 0x167F);

for (let i = 0; i < T.length - 14; i++) {
    if (T[i].t !== 'w' || T[i].v !== 'var') continue;
    if (!isGlyphStr(T[i + 1].v)) continue;
    if (T[i + 2].v !== '=' || T[i + 3].v !== '.' || T[i + 4].v !== '$_Cl') continue;
    if (T[i + 5].v !== ',') continue;
    aliasDecl.set(T[i + 1].v, (aliasDecl.get(T[i + 1].v) || 0) + 1);
    declSites.push(T[i + 1].p);
}
console.log('prologue 别名声明点: ' + declSites.length + ' 处');
console.log('不同别名名: ' + aliasDecl.size + ' 个');
const dup = [...aliasDecl.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
console.log('被复用的别名 (' + dup.length + ' 个): ' + dup.slice(0, 12).map(([k, n]) => k + '×' + n).join(' '));

// 关键风险检查：这些别名有没有在别处当普通变量用（即名字既作别名又作它用）
// 统计每个别名名在整棵 token 流里作为「标识符」出现的总次数
const cnt = new Map();
for (const t of T) if (t.t === 'w' && isGlyphStr(t.v)) cnt.set(t.v, (cnt.get(t.v) || 0) + 1);
console.log('\n别名名在全文的出现次数 (前 12):');
for (const [k, n] of [...aliasDecl.keys()].slice(0, 12)) console.log('  ' + k + ': 总计 ' + cnt.get(k) + ' 次, 其中 ' + n + ' 次是别名声明');

console.log('\n所有字形标识符种类: ' + cnt.size);
console.log('样例: ' + [...cnt.keys()].slice(0, 10).join(' '));
