"""
Sweep themes for runtime errors (including ones thrown later in rAF loops or promises).

Usage: ~/.venvs/patchright/bin/python tools/errors.py [1-205] [--wait 2500]
"""

import argparse

from patchright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("range", nargs="?", default="1-205")
parser.add_argument("--wait", type=int, default=2500)
args = parser.parse_args()
start, end = (int(part) for part in (args.range.split("-") + [args.range])[:2])

HOOK = """() => {
  window.__errs = [];
  addEventListener('error', (e) => __errs.push(String(e.error?.stack || e.message).split('\\n').slice(0, 2).join(' | ')));
  addEventListener('unhandledrejection', (e) => __errs.push('rejection: ' + String(e.reason?.stack || e.reason).split('\\n').slice(0, 2).join(' | ')));
}"""

bad = 0
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    for number in range(start, end + 1):
        for mode in ("light", "dark"):
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            page.add_init_script(script=HOOK.replace("() => {", "").rstrip("}"))
            page.goto(f"http://localhost:4400/?theme={number}&mode={mode}&bar=0&motion=on")
            page.wait_for_timeout(args.wait)
            page.mouse.move(400, 300)
            page.mouse.move(900, 500, steps=8)
            page.evaluate("() => { document.getElementById('site').scrollTop = 900; }", isolated_context=False)
            page.wait_for_timeout(700)
            errs = page.evaluate("() => [...(window.__errs || ['(hook missing)']), ...[...document.querySelectorAll('.gallery-info-error')].map((n) => 'gallery: ' + n.textContent)]", isolated_context=False)
            errs = [e for e in errs if "favicon" not in e]
            if errs:
                bad += 1
                print(f"#{number} {mode}: {errs[:3]}", flush=True)
            page.close()
    browser.close()
print(f"done; {bad} theme-mode combos with errors")
