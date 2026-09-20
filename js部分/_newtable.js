// 导出「新版 gcaptcha4.js 自带」的解码器命名空间
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/gcaptcha4.js', 'utf8');
const ns = '_ᖈᕴᖙᕶ';

function matchBrace(str, openIdx) {
    let d = 0, i = openIdx;
    while (i < str.length) {
        const c = str[i];
        if (c === '"' || c === "'" || c === '`') {
            const q = c; i++;
            while (i < str.length && str[i] !== q) { if (str[i] === '\\') i++; i++; }
            i++; continue;
        }
        if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return i; }
        i++;
    }
    return -1;
}

const dl = s.indexOf(ns + '.$_Dl=');
const dlBrace = s.indexOf('{', dl);
const dlEnd = matchBrace(s, dlBrace);
let tail = dlEnd + 1;
if (s[tail] === ';') tail++;
const m = /^\s*function\s+([^\s(]+)\s*\(\)\s*\{\s*\}/.exec(s.slice(tail));
let end = tail;
if (m) end = tail + m[0].length;

const code = s.slice(0, end);
module.exports = new Function('window', 'self', code + '\n;return ' + ns + ';')({}, {}, {});
