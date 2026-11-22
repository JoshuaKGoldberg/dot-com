"""usage: shots.py <n> [--mode dark|light] [--size 1280x800] [--pcts 0,25,50,75,100] [--reduced]"""
import argparse, os, base64
from patchright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument("n"); ap.add_argument("--mode", default="dark"); ap.add_argument("--size", default="1280x800")
ap.add_argument("--pcts", default="0,25,50,75,100"); ap.add_argument("--reduced", action="store_true"); ap.add_argument("--dpr", type=float, default=1)
a = ap.parse_args()
w, h = map(int, a.size.split("x"))
D = os.path.dirname(os.path.abspath(__file__)) + "/shots"; os.makedirs(D, exist_ok=True)
pcts = [int(x) for x in a.pcts.split(",")]
files = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=a.dpr)
    errs = []
    pg.on("response", lambda r: errs.append("404 "+r.url) if r.status==404 else None)
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://localhost:4400/?theme={a.n}&mode={a.mode}&bar=0&motion={'reduced' if a.reduced else 'on'}")
    pg.wait_for_timeout(1800)
    for pc in pcts:
        pg.evaluate("(pc)=>{const s=document.getElementById('site'); s.scrollTop=(s.scrollHeight-s.clientHeight)*pc/100}", pc, isolated_context=False) if False else pg.evaluate("(pc)=>{const s=document.getElementById('site'); s.scrollTop=(s.scrollHeight-s.clientHeight)*pc/100}", pc)
        pg.wait_for_timeout(700)
        f = f"{D}/{a.n}-{a.mode}-{w}-{pc}{'-r' if a.reduced else ''}.png"; pg.screenshot(path=f); files.append(f)
    b.close()
print("errors:", errs)
# contact sheet
cols = 3 if w > 700 else 5
tw = 640 if w > 700 else 260
th = int(tw * h / w)
html = "<body style='margin:0;background:#444;display:grid;grid-template-columns:repeat(%d,%dpx);gap:4px'>" % (cols, tw) + "".join(f"<img src='data:image/png;base64,{base64.b64encode(open(f,'rb').read()).decode()}' width={tw}>" for f in files)
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    rows = -(-len(files) // cols)
    pg = b.new_page(viewport={"width": cols * (tw + 4), "height": rows * (th + 4)})
    pg.set_content(html); pg.wait_for_timeout(300)
    out = f"{D}/sheet-{a.n}-{a.mode}-{w}{'-r' if a.reduced else ''}.png"; pg.screenshot(path=out); b.close()
print(out)
