// 钉死对称层的密码参数：用已知 guid 把对称段解回明文
const fs = require('fs');
const crypto = require('crypto');
const { w, load } = require('./w.js');
const req = load();
const m0 = req(0);

const TARGET = `{"setLeft":171,"passtime":1043,"userresponse":171.9891312992074,"device_id":"","lot_number":"0267d452d00b45b0bea6e5d4dc02e8c6","pow_msg":"1|8|sha256|2026-09-16 16:04:40.860893+08:00|54088bb07d2df3c46b79f80300b0abbe|0267d452d00b45b0bea6e5d4dc02e8c6||76e5020d0ae6698f","pow_sign":"0047df2a9d354a50dbab7b9f711f753af0847a2e1596b661d908d687a7464ac4","geetest":"captcha","lang":"zh","ep":"123","biht":"1426265548","gee_guard":{"roe":{"aup":"3","sep":"3","egp":"3","auh":"3","rew":"3","snh":"3","res":"3","cdc":"3"}},"dQFB":"BoHp","4522d0":{"e5d4dc02":{"0472":"2d00b45b"}},"em":{"ph":0,"cp":0,"ek":"11","wd":1,"nt":0,"si":0,"sc":0},"td_sign":"4a0b8333c58f07ab0ce089e63203c4401d399dbd8142b5016852be6689c26d4c"}`;

// ── 先看模块[34] 的 encrypt 到底是什么 ──
const s = fs.readFileSync('gcaptcha4.js', 'utf8');
const NS = require('./_newtable.js');
const st = JSON.parse(fs.readFileSync('_modstarts.json', 'utf8'));
const b34 = s.slice(st[34], st[35]).replace(/[\s,]+$/, '');
let d34 = b34;
const al = b34.match(/([^\s,;=()]+)\s*=\s*_ᖈᕴᖙᕶ\.\$_Cl/);
if (al) d34 = b34.replace(new RegExp(al[1].replace(/\$/g, '\\$&') + '\\((\\d+)\\)', 'g'),
    (m, n) => { try { return JSON.stringify(NS.$_Cl(+n)); } catch (e) { return m; } });
console.log('===== 模块[34]（对称 pt=1）长度 ' + b34.length + ' =====');
console.log('导出键: ' + Object.keys(req(34)).join(', ') + ' / default 键: ' + Object.keys(req(34).default).join(', '));
const ei = d34.lastIndexOf('encrypt');
console.log('--- encrypt 附近 ---');
console.log(d34.slice(Math.max(0, ei - 700), ei + 300));

// ── 自己造一条 w，已知 guid ──
const G = '0123456789abcdef';
const o = m0.guid; m0.guid = () => G;
const mine = w(TARGET, { options: { pt: '1' } });
m0.guid = o;
const sym = Buffer.from(mine.slice(0, mine.length - 256), 'hex');
console.log('\n===== 我们的对称段 ' + sym.length + ' 字节，guid=' + G + ' =====');

// ── 穷举常见组合去解 ──
const keyU8 = Buffer.from(G, 'utf8');           // 16 字节
const keyHex = Buffer.from(G, 'hex');           // 8 字节
const zero16 = Buffer.alloc(16);
const cands = [];
for (const [kn, k] of [['utf8(guid)=16B', keyU8], ['hex(guid)=8B', keyHex]]) {
    if (k.length !== 16 && k.length !== 24 && k.length !== 32) continue;
    for (const [mn, m] of [['cbc', 'cbc'], ['ecb', 'ecb']]) {
        cands.push([kn + ' ' + m + ' iv=0', k, m, zero16]);
    }
}
cands.push(['md5(guid) 16B cbc iv=0', crypto.createHash('md5').update(G).digest(), 'cbc', zero16]);
cands.push(['md5(guid) 16B ecb', crypto.createHash('md5').update(G).digest(), 'ecb', zero16]);

for (const [name, key, mode, iv] of cands) {
    try {
        const d = crypto.createDecipheriv('aes-' + key.length * 8 + '-' + mode, key, mode === 'ecb' ? null : iv);
        d.setAutoPadding(false);
        const out = Buffer.concat([d.update(sym), d.final()]);
        const pad = out[out.length - 1];
        const body = out.slice(0, out.length - pad);
        const ok = body.toString('utf8') === TARGET;
        console.log((ok ? '  ✓✓ ' : '  ✗  ') + name + '  → 头 40 字节 ' + JSON.stringify(out.slice(0, 40).toString('utf8').slice(0, 40)));
    } catch (e) {
        console.log('  ✗  ' + name + '  异常: ' + e.message);
    }
}

// ── 再验一次：我们自己的 encrypt 是否可逆（模块[34] 直接解）──
console.log('\n===== 模块[34] 自己的 decrypt 试 =====');
const AES = req(34).default;
console.log('可用方法: ' + Object.keys(AES).filter(k => typeof AES[k] === 'function').join(', '));
