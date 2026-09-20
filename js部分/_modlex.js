// 真·词法扫描：枚举 webpack 模块数组的每个模块起点
// 关键点：正确区分 正则字面量 / 除号，正确处理模板串与注释，否则 {} 计数会飘。
const fs = require('fs');
const s = fs.readFileSync('gcaptcha4.js', 'utf8');
const BS = String.fromCharCode(92);
const KW_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'case', 'yield', 'await', 'throw']);
const PUNCT_REGEX_OK = new Set(['(', '[', '{', ',', ';', '=', ':', '!', '&', '|', '?', '+', '-', '*', '%', '^', '~', '<', '>']);

function scan(arrOpen) {
    const starts = [];
    let i = arrOpen + 1;
    let depth = 0;            // 只看 {} —— 数组元素是函数
    let prev = '[';           // 上一个有效 token（0/1 字符的标点 或 整个词）
    let prevWasWord = false;
    let atElementStart = true;

    while (i < s.length) {
        const c = s[i];

        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

        // 注释
        if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
        if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }

        // 字符串
        if (c === '"' || c === "'") {
            const q = c; i++;
            while (i < s.length && s[i] !== q) { if (s[i] === BS) i++; i++; }
            i++; prev = q; prevWasWord = false; continue;
        }

        // 模板串
        if (c === '`') {
            i++;
            while (i < s.length && s[i] !== '`') {
                if (s[i] === BS) { i += 2; continue; }
                if (s[i] === '$' && s[i + 1] === '{') {
                    let d = 1; i += 2;
                    while (i < s.length && d) {
                        const ch = s[i];
                        if (ch === BS) { i += 2; continue; }
                        if (ch === '"' || ch === "'") { const q = ch; i++; while (i < s.length && s[i] !== q) { if (s[i] === BS) i++; i++; } i++; continue; }
                        if (ch === '`') { i++; while (i < s.length) { if (s[i] === BS) { i += 2; continue; } if (s[i] === '`') { i++; break; } i++; } continue; }
                        if (ch === '{') d++; else if (ch === '}') d--;
                        i++;
                    }
                    continue;
                }
                i++;
            }
            i++; prev = '`'; prevWasWord = false; continue;
        }

        // 正则
        if (c === '/') {
            const ok = prevWasWord ? KW_REGEX.has(prev) : PUNCT_REGEX_OK.has(prev);
            if (ok) {
                let j = i + 1, inC = false;
                while (j < s.length) {
                    const ch = s[j];
                    if (inC) { inC = false; j++; continue; }
                    if (ch === BS) { j += 2; continue; }
                    if (ch === '[') inC = true;
                    else if (ch === '/') { j++; break; }
                    else if (ch === '\n') break;
                    j++;
                }
                while (j < s.length && /[a-z]/.test(s[j])) j++;
                i = j; prev = '/'; prevWasWord = false; continue;
            }
        }

        // 标识符 / 关键字
        if (/[A-Za-z_$]/.test(c) || c.charCodeAt(0) > 127) {
            let j = i;
            while (j < s.length && (/[A-Za-z0-9_$]/.test(s[j]) || s[j].charCodeAt(0) > 127)) j++;
            const w = s.slice(i, j);
            if (depth === 0 && w === 'function' && atElementStart) { starts.push(i); atElementStart = false; }
            prev = w; prevWasWord = true; i = j; continue;
        }

        // 数字（含 0x / 科学计数 / 小数点）
        if (/[0-9]/.test(c)) {
            let j = i;
            while (j < s.length && /[0-9a-fA-FxXoObBeE._+-]/.test(s[j])) {
                if ((s[j] === '+' || s[j] === '-') && !/[eE]/.test(s[j - 1])) break;
                j++;
            }
            i = j; prev = '0'; prevWasWord = false; continue;
        }

        // 标点
        if (c === '{') { depth++; atElementStart = false; }
        else if (c === '}') { depth--; if (depth === 0) atElementStart = false; }
        else if (c === ']' && depth === 0) { break; }
        else if (c === ',' && depth === 0) { atElementStart = true; }
        prev = c; prevWasWord = false;
        i++;
    }
    return starts;
}

const starts = scan(131890);
console.log('模块总数 =', starts.length);
for (const probe of [131891, 171814, 296008, 313284]) {
    console.log('  ' + probe + ' → 下标 ' + starts.indexOf(probe));
}
fs.writeFileSync('_modstarts.json', JSON.stringify(starts));
console.log('已写出 _modstarts.json');
