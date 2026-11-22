import sys, json, collections
from patchright.sync_api import sync_playwright
n, mode = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--enable-gpu-rasterization", "--ignore-gpu-blocklist"])
    page = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=2)
    cdp = page.context.new_cdp_session(page); events = []; done = []
    cdp.on("Tracing.dataCollected", lambda d: events.extend(d["value"])); cdp.on("Tracing.tracingComplete", lambda d: done.append(1))
    cdp.send("Tracing.start", {"categories": "devtools.timeline,blink.animations,disabled-by-default-devtools.timeline", "transferMode": "ReportEvents"})
    page.goto(f"http://localhost:4400/?theme={n}&mode={mode}&bar=0&motion=on"); page.wait_for_timeout(2500)
    page.evaluate("()=>{const s=document.getElementById('site'); s.scrollTop=400}"); page.wait_for_timeout(600)
    cdp.send("Tracing.end")
    while not done: page.wait_for_timeout(100)
    import itertools
    for e in [e for e in events if e.get('name')=='Animation'][:6]: print(json.dumps(e)[:400])
    seen = {}
    for e in events:
        if e.get("name") == "Animation" and e.get("ph") in ("b","n","e"):
            d = e.get("args", {}).get("data", {})
            if "compositeFailed" in d or "unsupportedProperties" in d:
                seen[(d.get("displayName") or d.get("name") or e.get("id"))] = (d.get("compositeFailed"), d.get("unsupportedProperties"), d.get("state"))
    for k, v in list(seen.items())[:40]: print(k, v)
    print(len(seen))
    nm = collections.Counter(e.get("name") for e in events if e.get("name") == "Animation")
    print(nm)
    b.close()
