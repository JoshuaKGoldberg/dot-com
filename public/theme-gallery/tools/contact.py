"""
Build contact sheets of many themes at once, for quick review.

Usage:
  ~/.venvs/patchright/bin/python tools/contact.py 1-30 --mode dark
Writes tools/shots/contact-<range>-<mode>-<page>.png, 6 themes per sheet.
"""

import argparse
import io
import os

from patchright.sync_api import sync_playwright
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument("range")
parser.add_argument("--mode", default="light")
parser.add_argument("--wait", type=int, default=2500)
parser.add_argument("--scroll", type=int, default=0)
parser.add_argument("--per", type=int, default=6)
args = parser.parse_args()

start, end = (int(part) for part in args.range.split("-"))
numbers = list(range(start, end + 1))
shots = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    for number in numbers:
        page.goto(f"http://localhost:4400/?theme={number}&bar=0&mode={args.mode}&motion=on")
        page.wait_for_timeout(args.wait)
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
            page.wait_for_timeout(600)
        shots.append((number, Image.open(io.BytesIO(page.screenshot()))))
    browser.close()

out_dir = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(out_dir, exist_ok=True)

for sheet_index in range(0, len(shots), args.per):
    batch = shots[sheet_index : sheet_index + args.per]
    thumb_w, thumb_h = 640, 400
    cols = 2
    rows = (len(batch) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + 24)), "white")
    draw = ImageDraw.Draw(sheet)
    for i, (number, image) in enumerate(batch):
        x = (i % cols) * thumb_w
        y = (i // cols) * (thumb_h + 24)
        draw.text((x + 8, y + 6), f"#{number}", fill="black")
        sheet.paste(image.resize((thumb_w, thumb_h)), (x, y + 24))
    path = os.path.join(
        out_dir,
        f"contact-{args.range}-{args.mode}{'-s' if args.scroll else ''}-{sheet_index // args.per + 1}.png",
    )
    sheet.save(path)
    print(path)
