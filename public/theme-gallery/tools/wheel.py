"""
Check that the mouse wheel scrolls the page over margins, center, and text for each theme.

Usage: ~/.venvs/patchright/bin/python tools/wheel.py [1-235]
"""

import argparse

from patchright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("range", nargs="?", default="1-235")
args = parser.parse_args()
start, end = (int(part) for part in (args.range.split("-") + [args.range])[:2])
points = [(40, 420), (1240, 300), (640, 470), (900, 650), (200, 700)]

bad = 0
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    for number in range(start, end + 1):
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"http://localhost:4400/?theme={number}&mode=dark&bar=0&motion=on")
        page.wait_for_timeout(1500)
        stuck = []
        for x, y in points:
            page.evaluate("() => { document.getElementById('site').scrollTop = 0; }", isolated_context=False)
            page.wait_for_timeout(100)
            page.mouse.move(x, y)
            page.mouse.wheel(0, 300)
            page.wait_for_timeout(350)
            top = page.evaluate("() => document.getElementById('site').scrollTop", isolated_context=False)
            if top < 50:
                stuck.append((x, y))
        if stuck:
            bad += 1
            print(f"#{number}: wheel blocked at {stuck}", flush=True)
        page.close()
    browser.close()
print(f"done; {bad} themes trap the wheel")
