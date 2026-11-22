import lib, time
from patchright.sync_api import sync_playwright
s = lib.curtain(11, palette="emerald")
a = lib.curtain(23, palette="rose", edge=0.66, amp=0.08, height=0.5, hot=.7, id="d")
html = f"<body style='margin:0;background:linear-gradient(#02040d,#0a1a2c)'><div style='position:relative;width:2400px;height:800px'>{s}<div style='position:absolute;inset:0'>{a}</div></div>"
t=time.time()
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    pg = b.new_page(viewport={"width":2400,"height":800})
    pg.set_content(html); pg.screenshot(path="t1.png"); b.close()
print(time.time()-t, len(s))
