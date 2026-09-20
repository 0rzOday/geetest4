#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
极验4 完整流程：/load → 下图 → ddddocr 定位 → 拼 target → node w.js → /verify

用法:
    python run_verify.py           # 走完全程，发 /verify
    python run_verify.py --dry     # 只到生成 w 为止，不发请求
"""
import sys, os, io, re, json, math, time, random, uuid, subprocess

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import cv2
import numpy as np
import ddddocr
from requests import session

JS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js部分")
DRY = "--dry" in sys.argv

STATIC = "https://static.geetest.com/"
CAPTCHA_ID_FALLBACK = "54088bb07d2df3c46b79f80300b0abbe"


def log(*a):
    print(*a, flush=True)


# ─────────────────────────── 1. /load ───────────────────────────
def do_load(s):
    r = s.get("https://gt4.geetest.com/", timeout=20)
    m = re.search(r'captcha_id\s*:\s*[\'"]([^\'"]+)[\'"]', r.text)
    captcha_id = m.group(1) if m else CAPTCHA_ID_FALLBACK

    callback = "geetest_" + str(int(time.time() * 1000))
    challenge = str(uuid.uuid4())
    params = {
        "callback": callback,
        "captcha_id": captcha_id,
        "challenge": challenge,
        "client_type": "web",
        "risk_type": "slide",
        "lang": "zh",
    }
    r = s.get("https://gcaptcha4.geetest.com/load", params=params, timeout=20)
    t = r.text
    data = json.loads(t[t.find("{"): t.rfind("}") + 1])["data"]
    log(f"[load] captcha_id={captcha_id}")
    log(f"[load] lot_number={data.get('lot_number')}")
    log(f"[load] pt={data.get('pt')}  pow_detail={data.get('pow_detail')}")
    return captcha_id, callback, data


# ─────────────────────────── 2. 下图 + 定位 ───────────────────────────
def get_setleft(s, data):
    for name, path in [("滑块.png", data["slice"]), ("背景图.png", data["bg"])]:
        resp = s.get(STATIC + path, timeout=20)
        resp.raise_for_status()
        with open(name, "wb") as f:
            f.write(resp.content)

    def imread(p, flags=cv2.IMREAD_UNCHANGED):
        return cv2.imdecode(np.fromfile(p, dtype=np.uint8), flags)

    slider = imread("滑块.png")
    bg = imread("背景图.png", cv2.IMREAD_COLOR)

    ocr = ddddocr.DdddOcr(det=False, ocr=False)
    with open("滑块.png", "rb") as f:
        tgt = f.read()
    with open("背景图.png", "rb") as f:
        bimg = f.read()
    res = ocr.slide_match(tgt, bimg, simple_target=False)

    mask = (slider[:, :, 3] >= 250).astype(np.uint8)
    ys, xs = np.where(mask > 0)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    h, w = slider.shape[:2]

    # ddddocr 的 target_x/y 给的是【匹配到的整张切片 png 的中心】，不是左上角。
    # 标定依据：拿一组已知答案的图（bg3/sl3，真实通过包 setLeft=172、缺口本体左边缘≈183、
    # 本体中心≈212.5）喂进去，ddddocr 回的是 (210, 59) —— 210 贴着本体中心 212.5，
    # 59 贴着本体上边缘 31 + 半高 26 = 57。所以： setLeft = target_x - 切片半宽。
    # 切片本体在 png 里本来就居中（sl3 本体 (11,14)+59x52 -> 中心 (40.5,40)；另一组
    # (15,15)+50x50 -> 中心 (40,40)），半宽直接用 png 的 w//2 = 40，不要再加 x0。
    # 旧写法 target_x - w//2 + x0 等于少减一个 x0(11~15px)，每次都偏右 11~15px。
    x = res["target_x"] - w // 2
    log(f"[ocr] conf={res['confidence']:.3f}  中心点=({res['target_x']},{res['target_y']})  本体内缩=({x0},{y0})")
    log(f"[ocr] => setLeft = {x}")
    return x, bg, (x, res["target_y"] - h // 2, x1 - x0, y1 - y0)


# ─────────────────────────── 4. 拼 target + 造轨迹 + 生成 w/td ───────────────────────────
def build(captcha_id, data, gapX, passtime=None):
    """
    轨迹、setLeft、userresponse 三者的自洽关系由 track.js 保证 —— 它是从
    已生成的轨迹里反读 setLeft，而不是先定 setLeft 再反推轨迹（那样凑不齐，
    坐标是整数 px + 4 位小数归一化，来回一趟必然差不到 1px）。
    所以这里只把缺口位置丢给 node，别在 Python 里自己拼 setLeft。
    """
    pd = data["pow_detail"]
    inp = {
        "captcha_id": captcha_id,
        "lot_number": data["lot_number"],
        "pow_detail": {
            "version": str(pd.get("version", "1")),
            "bits": int(pd.get("bits", 8)),
            "hashfunc": pd.get("hashfunc", "sha256"),
            "datetime": pd["datetime"],
        },
        "gapX": gapX,
        "pt": str(data.get("pt", "1")),
    }
    if passtime:
        inp["passtime"] = passtime
    r = subprocess.run(
        ["node", "build_w.js"],
        cwd=JS_DIR, input=json.dumps(inp),
        capture_output=True, text=True, encoding="utf-8",
    )
    if r.returncode != 0:
        log("[node stderr]\n" + (r.stderr or ""))
        raise SystemExit("build_w.js 失败")
    if r.stderr.strip():
        log("[node warn] " + r.stderr.strip())
    return json.loads(r.stdout)


# ─────────────────────────── 5. /verify ───────────────────────────
def do_verify(s, captcha_id, callback, data, w, td=None):
    # 参数表照【真实抓包】逐项对齐，顺序也照抄。
    # 注意这里【没有 challenge】：SDK 源码里 verify 的入参对象确实写了
    #   challenge: options.challenge
    # 但线上真包不带它 —— 说明 makeURL 那层有白名单，把非白名单键滤掉了。
    # 以线上为准，别再照源码往里加。
    params = {
        "callback": callback,
        "captcha_id": captcha_id,
        "client_type": "web",
        "lot_number": data["lot_number"],
        "risk_type": "slide",
        "payload": data["payload"],
        "process_token": data["process_token"],
        "payload_protocol": str(data.get("payload_protocol", 1)),
        "pt": str(data.get("pt", "1")),
        "w": w,
    }
    # td = gzip 后的 new_track（base64url 无填充），和 target 里的 td_sign
    # 是配对的：td_sign = HMAC-SHA256(key=lot_number, msg=td)。
    # 浏览器那边它俩一起走 —— td 挂在 query 上，td_sign 在 w 里加密。
    if td:
        params["td"] = td
    r = s.get("https://gcaptcha4.geetest.com/verify", params=params, timeout=30)
    return r.text


def main():
    s = session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": "https://gt4.geetest.com/",
    })

    captcha_id, callback, data = do_load(s)
    gapX, bg, box = get_setleft(s, data)
    passtime = random.randint(700, 1500)
    log(f"[drag] 缺口 x={gapX}  passtime={passtime}")

    # 轨迹是此刻现造的（s = now - passtime），造完就发，别在中间磨蹭太久
    out = build(captcha_id, data, gapX, passtime)
    target, w, td = out["target"], out["w"], out["td"]
    sl = out.get("slide") or {}
    log(f"[drag] setLeft={sl.get('setLeft')}  userresponse={sl.get('userresponse')}")
    log(f"[track] 点数={len((out.get('track') or {}).get('p', []))}")
    log(f"\n[target] {json.dumps(target, ensure_ascii=False)}")
    log(f"\n[td] {td}")
    log(f"[td] 长度={len(td or '')}")
    log(f"\n[w] {w}")
    log(f"[w] 长度={len(w)}  (1664=pt1 RSA / 1632=pt2 SM2)")

    if DRY:
        log("\n--dry，不发 /verify")
        return

    log("\n>>> GET /verify")
    txt = do_verify(s, captcha_id, callback, data, w, td)
    log("[resp] " + txt)
    try:
        j = json.loads(txt[txt.find("{"): txt.rfind("}") + 1])
        log("[resp.data] " + json.dumps(j.get("data"), ensure_ascii=False))
    except Exception as e:
        log("[resp 解析失败] " + str(e))


if __name__ == "__main__":
    main()
