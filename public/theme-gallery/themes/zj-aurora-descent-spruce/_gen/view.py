import sys
from patchright.sync_api import sync_playwright
src, out = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv)>3 else 1600
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    pg = b.new_page(viewport={"width":w,"height":int(w*0.34)})
    pg.goto("http://localhost:4400/site.css"); pg.set_content(f"<body style='margin:0;background:#06101c'><img src='http://localhost:4400/{src}' width={w}>")
    pg.wait_for_timeout(500); pg.screenshot(path=out); b.close()
