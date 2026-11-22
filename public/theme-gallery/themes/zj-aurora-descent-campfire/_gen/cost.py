import sys, json, os
START = os.environ.get('START', '0')
from patchright.sync_api import sync_playwright
PHASES = {"style": ("UpdateLayoutTree", "RecalculateStyles"), "layout": ("Layout",), "prepaint": ("PrePaint",), "paint": ("Paint", "PaintImage", "Decode Image"), "raster": ("RasterTask",), "layerize": ("Layerize", "UpdateLayer", "CompositeLayers")}
n, mode = sys.argv[1], sys.argv[2]
css = sys.argv[3] if len(sys.argv) > 3 else ""
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--enable-gpu-rasterization", "--ignore-gpu-blocklist"])
    res = []
    for run in range(3):
        page = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=2)
        page.goto(f"http://localhost:4400/?theme={n}&mode={mode}&bar=0&motion=on"); page.wait_for_timeout(1500)
        if css: page.add_style_tag(content=css)
        page.wait_for_timeout(800)
        cdp = page.context.new_cdp_session(page); events = []; done = []
        cdp.on("Tracing.dataCollected", lambda d: events.extend(d["value"])); cdp.on("Tracing.tracingComplete", lambda d: done.append(1))
        cdp.send("Tracing.start", {"categories": "devtools.timeline,disabled-by-default-devtools.timeline", "transferMode": "ReportEvents"})
        frames = page.evaluate("""async () => { const site = document.getElementById('site'); site.scrollTop = (site.scrollHeight-site.clientHeight)*START; await new Promise(r=>setTimeout(r,400)); let f = 0; const t0 = performance.now();
          await new Promise(r => { const t = () => { f++; site.scrollTop += 12; if (performance.now()-t0 < 2000) requestAnimationFrame(t); else r(); }; requestAnimationFrame(t); }); return f; }""".replace("START", START))
        cdp.send("Tracing.end")
        while not done: page.wait_for_timeout(100)
        tot = {k: 0.0 for k in PHASES}
        for e in events:
            if e.get("ph") != "X" or "dur" not in e: continue
            for k, names in PHASES.items():
                if e.get("name") in names: tot[k] += e["dur"] / 1000
        per = {k: round(v / max(frames, 1), 2) for k, v in tot.items()}
        res.append(per); page.close()
    avg = {k: round(sum(r[k] for r in res) / len(res), 2) for k in PHASES}
    print(n, mode, "TOTAL", round(sum(avg.values()), 2), avg, "runs:", [round(sum(r.values()), 2) for r in res])
