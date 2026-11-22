import json,sys
from patchright.sync_api import sync_playwright
JS="""()=>{
const site=document.querySelector('#site');
const out=[];
function path(el){
  const parts=[];
  while(el&&el!==site){
    let p=el.parentElement;
    const idx=[...p.children].indexOf(el)+1;
    const cls=[...el.classList].find(c=>c.startsWith('site-')&&!['site-link'].includes(c));
    parts.unshift(el.tagName.toLowerCase()+':nth-child('+idx+')');
    el=p;
  }
  return '.site>'+parts.join('>');
}
for(const el of site.querySelectorAll('*')){
  if(el.closest('.site-scenery')||el.tagName==='IMG'||el.tagName==='BR'||el.tagName==='SOURCE')continue;
  const r=el.getBoundingClientRect();
  const direct=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  out.push({sel:path(el),tag:el.tagName.toLowerCase(),cls:el.className,direct,kids:el.children.length,
   x:(r.left+r.width/2)/innerWidth,y:(r.top+r.height/2)/innerHeight,w:r.width,h:r.height,depth:path(el).split('>').length});
}
return out;}"""
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome",headless=True)
    pg=b.new_page(viewport={"width":1280,"height":800})
    pg.goto("http://localhost:4400/?theme=zj-aurora&bar=0&mode=dark")
    pg.wait_for_timeout(800)
    d=pg.evaluate(JS)
    json.dump(d,open(sys.argv[1],"w"),indent=0)
    print(len(d))
    b.close()
