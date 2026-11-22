# joshuakgoldberg.com theme gallery

Local prototypes of 90 theme ideas for joshuakgoldberg.com, flippable in one page.

```sh
cd ~/repos/dot-com-theme-gallery
python3 tools/serve.py
open http://localhost:4400
```

## Controls

| Key        | Action                                       |
| ---------- | -------------------------------------------- |
| ← / →      | Previous / next theme                        |
| T or ⌘K    | Theme palette (type to filter by name/group) |
| D          | Light / dark (when the theme supports both)  |
| M          | Simulate reduced motion                      |
| I          | Concept notes for the current theme          |
| H          | Hide / show the gallery bar                  |

The URL hash (`#61-adirondack-editor`) remembers the current theme, so you can link straight to one.

## Layout

- `index.html`: gallery bar plus two frames: `#site` (homepage) for #1–60 and `#editor` (site-as-code-editor) for #61–90.
- `site.css`, `editor.css`: base frame styles.
- `themes/themes.js`: metadata for all 90 themes.
- `themes/<id>.css` / `.js`: each prototype. See [CONTRACT.md](./CONTRACT.md).
- `tools/shot.py`: screenshot a theme (`~/.venvs/patchright/bin/python tools/shot.py 61 --mode dark`).
