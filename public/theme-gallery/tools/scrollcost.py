"""
Trace the real per-frame cost of scrolling each theme (style, layout, paint, raster).

Usage: ~/.venvs/patchright/bin/python tools/scrollcost.py 158,206-235 [--mode dark]
Prints ms per scrolled frame for each phase; anything over ~8ms/frame total will jank on real hardware.
"""

import argparse
import json

from patchright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("themes")
parser.add_argument("--mode", default="dark")
parser.add_argument("--dpr", type=float, default=2)
args = parser.parse_args()

numbers = []
for part in args.themes.split(","):
    if "-" in part:
        a, b = (int(x) for x in part.split("-"))
        numbers += list(range(a, b + 1))
    else:
        numbers.append(int(part))

PHASES = {
    "style": ("UpdateLayoutTree", "RecalculateStyles"),
    "layout": ("Layout",),
    "prepaint": ("PrePaint",),
    "paint": ("Paint", "PaintImage", "Decode Image"),
    "raster": ("RasterTask",),
    "layerize": ("Layerize", "UpdateLayer", "CompositeLayers"),
}

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True, args=["--enable-gpu-rasterization", "--ignore-gpu-blocklist"])
    for number in numbers:
        page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=args.dpr)
        page.goto(f"http://localhost:4400/?theme={number}&mode={args.mode}&bar=0&motion=on")
        page.wait_for_timeout(2000)
        cdp = page.context.new_cdp_session(page)
        events = []
        cdp.on("Tracing.dataCollected", lambda data: events.extend(data["value"]))
        done = []
        cdp.on("Tracing.tracingComplete", lambda data: done.append(True))
        cdp.send("Tracing.start", {"categories": "devtools.timeline,disabled-by-default-devtools.timeline", "transferMode": "ReportEvents"})
        frames = page.evaluate(
            """async () => {
                const site = document.getElementById('site');
                let frames = 0;
                const t0 = performance.now();
                await new Promise((resolve) => {
                    const tick = () => {
                        frames++;
                        site.scrollTop += 12;
                        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
                        else resolve();
                    };
                    requestAnimationFrame(tick);
                });
                return frames;
            }""",
            isolated_context=False,
        )
        cdp.send("Tracing.end")
        while not done:
            page.wait_for_timeout(100)
        totals = {k: 0.0 for k in PHASES}
        for event in events:
            if event.get("ph") != "X" or "dur" not in event:
                continue
            for key, names in PHASES.items():
                if event.get("name") in names:
                    totals[key] += event["dur"] / 1000
        per = {k: round(v / max(frames, 1), 2) for k, v in totals.items()}
        total = round(sum(per.values()), 2)
        flag = "  <-- JANKY" if total > 8 else ""
        print(f"#{number} total {total}ms/frame {json.dumps(per)}{flag}", flush=True)
        page.close()
    browser.close()
