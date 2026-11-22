"""
Screenshot one gallery theme so you can look at it.

Usage:
  ~/.venvs/patchright/bin/python tools/shot.py <theme-id-or-number> [options]

Options:
  --mode light|dark      Color mode (default: the theme's first mode)
  --reduced              Simulate reduced motion
  --wait MS              Milliseconds to wait before the shot (default 1500)
  --scroll PX            Scroll the frame by this many pixels first
  --hover SELECTOR       Hover an element first (e.g. '.diagnostic[data-severity=error]')
  --size WxH             Viewport size (default 1280x800)
  --out PATH             Output file (default: tools/shots/<id>-<mode>.png)

The gallery must be served at http://localhost:4400 (python3 tools/serve.py).
Prints any console errors from the page.
"""

import argparse
import os
import sys

from patchright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("theme")
parser.add_argument("--mode")
parser.add_argument("--reduced", action="store_true")
parser.add_argument("--wait", type=int, default=1500)
parser.add_argument("--scroll", type=int, default=0)
parser.add_argument("--hover")
parser.add_argument("--size", default="1280x800")
parser.add_argument("--out")
args = parser.parse_args()

width, height = (int(part) for part in args.size.split("x"))
query = f"theme={args.theme}&bar=0&motion={'reduced' if args.reduced else 'on'}"
if args.mode:
    query += f"&mode={args.mode}"

out = args.out or os.path.join(
    os.path.dirname(__file__),
    "shots",
    f"{args.theme}-{args.mode or 'default'}{'-reduced' if args.reduced else ''}.png",
)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": width, "height": height})
    page.on(
        "console",
        lambda message: errors.append(message.text)
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"http://localhost:4400/?{query}")
    page.wait_for_timeout(400)
    if args.scroll:
        page.evaluate(
            """(px) => {
                const frame = document.querySelector('body[data-frame=editor]')
                    ? document.querySelector('.editor-content')
                    : document.querySelector('#site');
                frame.scrollTop = px;
            }""",
            args.scroll,
        )
    if args.hover:
        page.hover(args.hover)
    page.wait_for_timeout(args.wait)
    page.screenshot(path=out)
    browser.close()

relevant = [error for error in errors if "Failed to fetch dynamically imported module" not in error and "404" not in error]
for error in relevant:
    print(f"console error: {error}", file=sys.stderr)
print(out)
