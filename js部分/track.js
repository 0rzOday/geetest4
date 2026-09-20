// ============================================================
// 拖动轨迹生成器 —— 逆向自 gcaptcha4.js 的 webpack 模块 [41]（Track 类）
//
// ── 浏览器是怎么记的（模块[41] 全文翻译）──────────────────────
//   Track 绑在滑块元素上，按 mode 选事件组：
//     pointer → pointerdown/move/up   touch → touchstart/move/end
//     mouse   → mousedown/mousemove/mouseup
//
//   每个事件的坐标，是相对 trackArea 的 getBoundingClientRect() 左上角：
//     x = Math.round(clientX - r.left)        y = Math.round(clientY - r.top)
//     w = r.right - r.left   ← td 里的 "w"    h = r.bottom - r.top   ← td 里的 "h"
//   落在矩形外（x<0 ‖ y<0 ‖ x>w ‖ y>h）的点直接丢。
//
//   trackArea = 从滑块元素往上找 class 含 "geetest_subitem_<hash>" 的祖先，
//               没有就找 "geetest_subitem"，再没有就用滑块元素自己。
//
//   点的 type：  start=0   move=1   end=2   down=3
//     第一个被记下的点   → type "start"，同时 startTime = 那一刻
//     mousedown          → type "down"（不参与采样过滤，必收）
//     mousemove          → type "move"
//     mouseup            → type "end"
//     t = 记录时刻 - startTime
//
//   采样过滤 $_BICt（只对 move 生效，顺序照抄）：
//     dt < sampleInterval(1000/60)              → 丢
//     dx=dy=0 且 dt < stillInterval(80)         → 丢
//     否则：dist >= minDistance(2) 或 dt >= 80  → 留，不然丢
//
//   finish() → getPayload() 产出：
//     { m: source, w, h, s: startTime, e: endTime, p: [[t, x/w, y/h, type], ...] }
//     归一化 $_BIDb：Math.round((v/size) * 10^percentPrecision) / 10^percentPrecision
//     percentPrecision = 4
//
//   点数超过 maxPoints(150) 时 $_BHGR 会裁剪（保头、保全部非 move、保 end 前
//   keepBeforeClick(150ms) 内的 move）。下面 trimMaxPoints 是忠实移植。
//
// ── 常量（浏览器实测）────────────────────────────────────────
//   w = 300.60418701171875     .geetest_subitem 的 rect 宽
//   h = 262.03125              同上，高
//   m = 1                      来源 = mouse
//
// ── 生成器的设计依据：真实 td 的统计（一条真人手拖，50 点）──────
//   样本：m=1 w=300.604 h=262.031 passtime=2958  setLeft=196
//         点数 50（1 start + 47 move + 1 down + 1 end）
//         start→down 1792ms（60%）  拖动 1166ms（39%）
//         按下点 (43, 226)，拖动中 y 从 0.8625 漂到 0.9083（下移 12px）
//
//   拖动段的步长序列（px）：
//     1 3 7 12 15 18 16 15 13 9 7 4 2 2 2 5 6 5 6 4 5 5 4 4 4 6 4 2 2 2 2 1 2 1
//   → 加速冲到 18px 峰值 → 衰减 → 二次发力 → 收尾微调回 1px
//
//   拖动段的 dt 序列（ms）：
//     96 17×11 22 18 18 18 17 19 17 18 17 18 19 17 17 17 19 19 18 17 17 18 18 17 18
//     50 98 50 301
//   → 主体是 60fps 的 17ms；尾部掉到 50~98ms
//
//   ★ 关键：尾部那个「1-2px 配 50~98ms」**不是手写出来的，是滤波器自己造的**。
//     步长掉到 2px 以下后，只有 dt>=80ms 才留得下，所以自动变成稀疏长间隔。
//     结论：生成器只需给出【连续速度曲线 + 60fps 采样】，尾部特征会自然长出来。
//     早先那版按「n 步均分距离、dt=ms/n*rand」直接铺点，等于把滤波器本来要
//     塑造的东西提前抹平了，出来是 94 个点、步长 3.19±1.14 的均匀噪声 ——
//     标准差差一个数量级（真实 13.62）。
//
// ── 和 setLeft / userresponse 的关系（模块[46] 实测）──────────
//   a = $_BJH_ = 0.8876 * W / wrap_w      W = min(面板宽, 340)，wrap_w = 背景图宽 = 300
//              = 0.8876 * 340 / 300 = 1.0059466666666665
//
//   松开时： dx = clientX - clientX按下            （CSS px）
//            setLeft      = parseInt(dx, 10)        ← 截断，整数
//            userresponse = setLeft / a + 2
//
//   反推：要把滑块拖到缺口（缺口在背景图里 x = gapX，图 300×200）
//            dx_css       = gapX * a
//            setLeft      = trunc(dx_css)
//            userresponse = setLeft / a + 2      （≈ gapX + 2）
//     实测校验：setLeft=171 → userresponse=171.9891312992074
//               171 / (171.9891312992074 - 2) = 1.0059466666666665 = 0.8876*340/300 ✓
// ============================================================
'use strict';

const TRACK_W = 300.60418701171875;   // .geetest_subitem 宽
const TRACK_H = 262.03125;            // .geetest_subitem 高
const PREC = 4;                       // percentPrecision
const TYPE = { start: 0, move: 1, end: 2, down: 3 };
const SOURCE_MOUSE = 1;

// §_BJH_：CSS px → 背景图 px 的缩放
const SCALE_A = 0.8876 * 340 / 300;   // 1.0059466666666665

// 按下点（实测两次抓包：(43,226) 和 (47,230)）
const DEFAULT_PRESS = { x: 45, y: 228 };

// 采样参数（模块[41] 里的默认值）
const SAMPLE_INTERVAL = 1000 / 60;
const STILL_INTERVAL = 80;
const MIN_DISTANCE = 2;
const MAX_POINTS = 150;
const KEEP_BEFORE_CLICK = 150;

// 一帧。真实 td 的 dt 全是 17~22，**从来没有 16** —— 说明实际帧间隔略大于
// 16.67。写成 17 是为了让 Math.round 之后 dt 稳定落在 17，不会被
// `dt < 16.667` 这条判据误杀。
const FRAME = 17;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ── 归一化（照抄 $_BIDb）───────────────────────────────────
function nrm(v, size) {
    if (!size) return 0;
    const p = Math.pow(10, PREC);
    return Math.round((v / size) * p) / p;
}

// ── 采样过滤（照抄 $_BICt）─────────────────────────────────
function passes(pts, p) {
    const last = pts[pts.length - 1];
    if (!last) return true;
    if (p.type !== TYPE.move) return true;
    const dx = p.x - last.x, dy = p.y - last.y, dt = p.t - last.t;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dt < SAMPLE_INTERVAL) return false;
    if (dist === 0 && dt < STILL_INTERVAL) return false;
    return dist >= MIN_DISTANCE || dt >= STILL_INTERVAL;
}

// ── 超过 maxPoints 时的裁剪（照抄 $_BHGR）──────────────────
function trimMaxPoints(points) {
    if (!MAX_POINTS || points.length <= MAX_POINTS) return points.slice();
    const first = points[0], keep = [], moves = [];
    let end = null;
    for (let i = 1; i < points.length; i++) {
        if (points[i].type === TYPE.move) moves.push(points[i]);
        else { keep.push(points[i]); if (points[i].type === TYPE.end) end = points[i]; }
    }
    if (keep.length >= MAX_POINTS) return [first].concat(keep.slice(-(MAX_POINTS - 1)));
    const need = MAX_POINTS - keep.length - 1;
    let picked = [];
    if (end) for (const m of moves) if (end.t - m.t <= KEEP_BEFORE_CLICK) picked.push(m);
    const head = picked.slice(-need);
    let gap = need - head.length;
    for (let l = moves.length - 1; gap > 0 && l >= 0; l--) {
        if (head.indexOf(moves[l]) === -1) { head.unshift(moves[l]); gap--; }
    }
    return [first].concat(head, keep);
}

// ── 真实拖动进度曲线（从真人 td 里抽出来的）────────────────
// (u = 时间占比, v = 位移占比)，单调从 (0,0) 到 (1,1)。
// 这是那条真实轨迹的【位置/时间】关系 —— 重采样回同样的帧数就能复现
// 它的步长序列，连丢帧都会自动重现（滤波器面对同样的曲线做同样的取舍）。
//
// 为什么不用解析钟形：真实的曲线是「冲刺 + 长尾」的复合形状，任何单个
// 高斯都拟合不了 —— 要够到 18px 的峰就得把 σ 压窄，σ 一窄尾部就没了。
// 实测用 σ=0.15 的双峰余弦出来峰值只有 7px、sd 1.8（真实 18px / 13.62）。
const DRAG_CURVE = [
    [0.0000, 0.0000], [0.0823, 0.0051], [0.0969, 0.0204], [0.1115, 0.0561],
    [0.1261, 0.1173], [0.1407, 0.1939], [0.1552, 0.2857], [0.1698, 0.3673],
    [0.1844, 0.4439], [0.1990, 0.5102], [0.2136, 0.5561], [0.2290, 0.5918],
    [0.2479, 0.6122], [0.2753, 0.6224], [0.2907, 0.6327], [0.3062, 0.6429],
    [0.3208, 0.6684], [0.3370, 0.6990], [0.3516, 0.7245], [0.3671, 0.7551],
    [0.3817, 0.7755], [0.3980, 0.8010], [0.4126, 0.8265], [0.4288, 0.8469],
    [0.4434, 0.8673], [0.4571, 0.8878], [0.4743, 0.9184], [0.4897, 0.9388],
    [0.5051, 0.9490], [0.5206, 0.9592], [0.5412, 0.9694], [0.6149, 0.9796],
    [0.6990, 0.9847], [0.7419, 0.9949], [1.0000, 1.0000],
];

function curveAt(curve, u) {
    if (u <= curve[0][0]) return curve[0][1];
    const last = curve[curve.length - 1];
    if (u >= last[0]) return last[1];
    for (let i = 1; i < curve.length; i++) {
        if (u <= curve[i][0]) {
            const [u0, v0] = curve[i - 1], [u1, v1] = curve[i];
            return v0 + (v1 - v0) * (u - u0) / (u1 - u0);
        }
    }
    return 1;
}

// 时间轴扰动：u^k（k 单调 → 保序），让每条轨迹的节奏不一样。
// 不加这个，所有轨迹的冲刺时刻会一模一样。
const timeWarp = () => rand(0.86, 1.16);

// ── 速度曲线（靠近段用，拖动段已改用 DRAG_CURVE）───────────
// 返回长度 n 的权重数组，位置取权重的【累积和】。
function profile(n, kind) {
    const v = [];
    for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        let a;
        if (kind === 'drag') {
            a = Math.exp(-Math.pow((u - 0.24) / 0.15, 2))
                + 0.42 * Math.exp(-Math.pow((u - 0.56) / 0.13, 2))
                + 0.042;
        } else {
            a = Math.exp(-Math.pow((u - 0.42) / 0.30, 2)) + 0.05;
        }
        v.push(Math.max(a, 1e-4) * rand(0.80, 1.24));
    }
    return v;
}

// ── setLeft / userresponse / 实际拖动像素 ──────────────────
function slideParams(gapX, a) {
    a = a || SCALE_A;
    const dxCss = gapX * a;
    const setLeft = Math.trunc(dxCss);
    return { dxCss: dxCss, setLeft: setLeft, userresponse: setLeft / a + 2 };
}

/**
 * 造一条轨迹。返回 track.finish() 的产物（还没 gzip）
 * @param {object} opt
 *   setLeft   {number}  必须。CSS px 的拖动距离（整数）
 *   passtime  {number}  必须。毫秒，= e - s
 *   pressX/pressY {{number}} 可选，按下点（默认 45 / 228）
 *   trackW/trackH {{number}} 可选，覆盖 subitem 尺寸
 */
function buildTrack(opt) {
    const setLeft = Math.round(opt.setLeft);
    const passtime = Math.max(600, Math.round(opt.passtime));
    const W = opt.trackW || TRACK_W;
    const H = opt.trackH || TRACK_H;
    const pressX = opt.pressX != null ? opt.pressX : DEFAULT_PRESS.x;
    const pressY = opt.pressY != null ? opt.pressY : DEFAULT_PRESS.y;

    // ── 时间预算 ──
    // 真实样本：按下(1792ms, 60.6%) → 拖动+松手前停顿(1166ms, 39.4%)
    //   其中拖动本身 ~865ms，松手前停了 301ms。
    // 注意 dragFrac 和 endGapFrac 是【相加】构成后面那 39.4% 的，
    // 别把 dragFrac 直接当 0.39 —— 那样加上 endGap 会涨到 48%。
    const dragFrac = rand(0.29, 0.37);
    const endGapTarget = clamp(passtime * rand(0.03, 0.09), 120, 420);

    const nDrag = Math.max(4, Math.round(passtime * dragFrac / FRAME));
    const dragMs = nDrag * FRAME;
    const downT = Math.max(FRAME * 6, passtime - dragMs - endGapTarget);

    const raw = [];
    let t = 0;
    const add = (x, y, type) => raw.push({
        x: Math.round(x), y: Math.round(y), t: Math.round(t), type,
    });

    // ── 1. start：指针从图区中部进入（真实样本 y≈0.55*H，x 明显在按下点右侧）──
    const sx = clamp(pressX + rand(45, 115), 2, W - 2);
    const sy = clamp(pressY - rand(55, 105), 2, H - 2);
    add(sx, sy, TYPE.start);

    // ── 2. 靠近滑块：几次「短促移动 + 停顿」，不是匀速挪过去 ──
    //    真实样本 1792ms 里只记下 16 个点 → 85% 的帧手没动。
    //    匀速插值会凭空多出一倍的点（实测 86 vs 真实 50），且步长全都被
    //    磨成几百个 2~4px 的均匀小步。
    {
        const tx = pressX + rand(-4, 12);
        const ty = pressY + rand(-12, 6);
        const bursts = 2 + (Math.random() < 0.45 ? 1 : 0);
        // 停顿总预算：分给除最后一段之外的每个间隙
        const pauseTotal = downT * rand(0.25, 0.5);
        const pauses = [];
        for (let i = 0; i < bursts - 1; i++) pauses.push(rand(0.4, 1.6));
        const pSum = pauses.reduce((a, b) => a + b, 0) || 1;

        let cx = sx, cy = sy;
        for (let b = 0; b < bursts; b++) {
            const last = b === bursts - 1;
            const frames = 3 + Math.floor(Math.random() * 5);       // 3~7 帧
            const frac = last ? 1 : rand(0.35, 0.75);               // 走掉剩余距离的多少
            const nx = cx + (tx - cx) * frac;
            const ny = cy + (ty - cy) * frac;
            const v = profile(frames, 'approach');
            const sum = v.reduce((a, b) => a + b, 0);
            let acc = 0;
            for (let i = 0; i < frames; i++) {
                t += FRAME;
                acc += v[i] / sum;
                add(cx + (nx - cx) * acc + rand(-1.4, 1.4),
                    cy + (ny - cy) * acc + rand(-1.4, 1.4),
                    TYPE.move);
            }
            cx = nx; cy = ny;

            // 偶发「事件合并」跳变：页面卡顿时浏览器会把多帧 mousemove 合成
            // 一次派发，于是出现「长间隔 + 大位移」这个特征组合。
            // 真实样本里就有一次 —— 停了 333ms，一个点跳了 94px。
            // 只做匀速插值生成不出这种东西，而它恰恰是真实数据里最大的离群项。
            if (!last && b === 0 && Math.random() < 0.5) {
                t += Math.round(rand(140, 420));
                const jf = rand(0.5, 0.95);
                cx = cx + (tx - cx) * jf + rand(-6, 6);
                cy = cy + (ty - cy) * jf + rand(-6, 6);
                add(cx, cy, TYPE.move);
            }
            if (!last) t += Math.round(pauseTotal * pauses[b] / pSum);
        }
    }

    // ── 3. 按下（真实样本按下前停了 800ms）──
    //    直接钉在 downT，靠近段没用完的时间就自然变成这段悬停
    t = Math.max(t + FRAME, downT);
    add(pressX, pressY, TYPE.down);

    // ── 4. 拖动：按真实曲线重采样 ──
    const yDrift = rand(3, 15);           // 真实样本下移 12px
    const k = timeWarp();
    for (let i = 1; i <= nDrag; i++) {
        t += FRAME;
        const u = Math.pow(i / nDrag, k);
        const v = curveAt(DRAG_CURVE, u);
        let x = pressX + setLeft * v;
        if (Math.random() < 0.08) x -= rand(1, 2);              // 手抖回带
        const y = pressY + yDrift * Math.min(1, v * 1.7) + rand(-0.8, 0.8);
        add(x, y, TYPE.move);
    }

    // ── 5. 松手：直接把 e 钉在 passtime，中间空出来的就是「松手前停一下」──
    t = passtime;
    add(pressX + setLeft, pressY + yDrift, TYPE.end);

    // ── 6. 兜底：保证严格递增（dt 绝不能掉到 17 以下，会被滤波器误杀）──
    for (let i = 1; i < raw.length; i++) {
        if (raw[i].t - raw[i - 1].t < FRAME) raw[i].t = raw[i - 1].t + FRAME;
    }
    raw[raw.length - 1].t = passtime;

    // ── 7. 过采样过滤 ──
    const pts = [];
    for (const p of raw) if (passes(pts, p)) pts.push(p);

    // ── 8. 裁剪 + 序列化 ──
    const kept = trimMaxPoints(pts);

    // 时间戳：拖动"刚刚"结束，所以 e = now、s = now - passtime。
    // 造完要尽快发出去，搁久了 s/e 就明显偏旧了。
    const e = Date.now();
    const s = e - passtime;

    return {
        m: SOURCE_MOUSE,
        w: W,
        h: H,
        s: s,
        e: e,
        p: kept.map(q => [q.t, nrm(q.x, W), nrm(q.y, H), q.type]),
    };
}

/**
 * 从已生成的轨迹里把 setLeft / userresponse 读回来。
 * 这是唯一能保证「轨迹 ↔ setLeft ↔ userresponse」完全自洽的算法：
 *   浏览器里 setLeft = parseInt(真实拖动 px)，轨迹里记的是取整后的坐标，
 *   两者本来就差不到 1px，谁反推谁都会差那么一点点。干脆以轨迹为准。
 */
function slideParamsFromTrack(track, a) {
    a = a || SCALE_A;
    const p = track.p;
    const down = p.find(q => q[3] === TYPE.down);
    const end = p[p.length - 1];
    if (!down) throw new Error('轨迹里没有 down 点');
    const setLeft = Math.trunc((end[1] - down[1]) * track.w);
    return { setLeft: setLeft, userresponse: setLeft / a + 2, dxCss: (end[1] - down[1]) * track.w };
}

/**
 * 一步到位：给定缺口位置（背景图 px）
 * 造轨迹 + 反读 setLeft/userresponse
 * @returns {{ track, setLeft, userresponse, dxCss }}
 */
function makeSlide(opt) {
    const a = opt.a || SCALE_A;
    const dragPx = Math.round(opt.gapX * a);
    const track = buildTrack({
        setLeft: dragPx,
        passtime: opt.passtime,
        pressX: opt.pressX,
        pressY: opt.pressY,
        trackW: opt.trackW,
        trackH: opt.trackH,
    });
    const sp = slideParamsFromTrack(track, a);
    return {
        track: track,
        setLeft: sp.setLeft,
        userresponse: sp.userresponse,
        dxCss: sp.dxCss,
    };
}

module.exports = {
    buildTrack, makeSlide, slideParams, slideParamsFromTrack, profile,
    nrm, clamp, TYPE, TRACK_W, TRACK_H, SCALE_A, FRAME,
};
