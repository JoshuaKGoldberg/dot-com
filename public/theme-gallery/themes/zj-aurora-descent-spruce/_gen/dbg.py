import sys, json
from patchright.sync_api import sync_playwright
n, mode = sys.argv[1], sys.argv[2]
sels = sys.argv[3:]
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    pg = b.new_page(viewport={"width":1280,"height":800})
    pg.goto(f"http://localhost:4400/?theme={n}&mode={mode}&bar=0&motion=on"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{const s=document.getElementById('site'); s.scrollTop=s.scrollHeight}"); pg.wait_for_timeout(600)
    for s in sels:
        sel, ps = (s.split("@") + [""])[:2]
        r = pg.evaluate("""([sel,ps])=>{const e=document.querySelector(sel); const c=getComputedStyle(e,ps||null); return {top:c.top,height:c.height,translate:c.translate,opacity:c.opacity,transform:c.transform,an:c.animationName,bg:c.backgroundImage.slice(0,80), pos:c.position, z:c.zIndex, content:c.content, disp:c.display, vis:c.visibility, contain:c.contain, bottom:c.bottom, wc:c.willChange, rect: (()=>{try{return JSON.stringify(e.getBoundingClientRect())}catch(x){return ''}})(), w:c.width, left:c.left}}""", [sel, ps])
        print(s, json.dumps(r))
    b.close()
