"""
Measure main-thread cost of every theme, in both modes.

Usage:
  ~/.venvs/patchright/bin/python tools/perf.py [1-90] [--modes light,dark] [--headed]

For each theme: load it, then report
  longtask: total ms of long tasks (>50ms) in the first 3s
  worst:    the single longest task
  fps:      frames per second over the following 2s (rAF count)
  scrollFps / worstFrame: frame rate and worst frame gap while scrolling for 2s
Flags anything with worst > 150ms, fps < 50, scrollFps < 50, or worstFrame > 100ms.
Run it alone (not in parallel with other heavy jobs) for trustworthy numbers.
"""

import argparse
import json

from patchright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("range", nargs="?", default="1-90")
parser.add_argument("--modes", default="light,dark")
parser.add_argument("--headed", action="store_true", help="ignored: always headless so no windows pop up")
args = parser.parse_args()

start, end = (int(part) for part in args.range.split("-"))

MEASURE = """async () => {
  const longs = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longs.push(entry.duration);
  }).observe({ type: "longtask", buffered: true });
  await new Promise((r) => setTimeout(r, 3000));
  const long = longs.slice();
  let frames = 0;
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      frames++;
      if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  const fps = frames / ((performance.now() - t0) / 1000);
  const site = document.getElementById("site");
  const gaps = [];
  let last = performance.now();
  const s0 = last;
  await new Promise((resolve) => {
    const tick = () => {
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      site.scrollTop += 10;
      if (now - s0 < 2000) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  const scrollFps = gaps.length / ((performance.now() - s0) / 1000);
  return {
    scrollFps: Math.round(scrollFps),
    worstFrame: Math.round(Math.max(...gaps.slice(1))),
    long: Math.round(long.reduce((a, b) => a + b, 0)),
    worst: Math.round(Math.max(0, ...long)),
    fps: Math.round(fps),
    nodes: document.getElementsByTagName("*").length,
  };
}"""

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        headless=True,
        args=["--enable-gpu-rasterization", "--ignore-gpu-blocklist"],
    )
    for number in range(start, end + 1):
        for mode in args.modes.split(","):
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.goto(f"http://localhost:4400/?theme={number}&mode={mode}&motion=on")
            try:
                result = page.evaluate(MEASURE)
            except Exception as error:  # noqa: BLE001
                result = {"error": str(error)[:120]}
            page.close()
            result.update(n=number, mode=mode)
            results.append(result)
            flag = (
                "  <-- SLOW"
                if "error" in result
                or result["worst"] > 150
                or result["fps"] < 50
                or result["scrollFps"] < 50
                or result["worstFrame"] > 100
                else ""
            )
            print(json.dumps(result) + flag, flush=True)
    browser.close()
