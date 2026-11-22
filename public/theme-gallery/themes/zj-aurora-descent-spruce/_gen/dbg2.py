import sys
from patchright.sync_api import sync_playwright
n, mode, css, out = sys.argv[1:5]
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    pg = b.new_page(viewport={"width":1280,"height":800})
    pg.goto(f"http://localhost:4400/?theme={n}&mode={mode}&bar=0&motion=on"); pg.wait_for_timeout(1200)
    pg.add_style_tag(content=css)
    pg.evaluate("()=>{const s=document.getElementById('site'); s.scrollTop=s.scrollHeight}"); pg.wait_for_timeout(800)
    pg.screenshot(path=out); b.close()
