import lib, os, sys
OUT = "/Users/josh/repos/dot-com-theme-gallery/themes/zj-aurora-descent-spruce"
TMP = "/private/tmp/claude-501/-Users-josh-repos-dot-com/4db80127-f1c9-44f6-9d98-8e927dbb8cb0/scratchpad/gen/tmp"
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)

def write(name, s): open(os.path.join(OUT, name), "w").write(s)

def bake_curtains(only=None):
    specs = {
      "aur-a": dict(seed=101, palette="teal", edge=.70, amp=.07, height=.55, hot=.55, folds=2, step=3.2),
      "aur-b": dict(seed=102, palette="violet", edge=.64, amp=.09, height=.5, hot=.5, folds=3, step=3.4, glow=True),
      "aur-c": dict(seed=103, palette="emerald", edge=.76, amp=.10, height=.66, hot=1.0, folds=3),
      "aur-d": dict(seed=104, palette="rose", edge=.60, amp=.08, height=.5, hot=.8, folds=4, lean=.25),
      "aur-e": dict(seed=105, palette="emerald", edge=.80, amp=.06, height=.52, hot=.85, folds=5, step=2.8, lean=-.2),
      "aur-f": dict(seed=106, palette="teal", edge=.56, amp=.1, height=.42, hot=.7, folds=2, step=3, lean=.3),
    }
    for k, kw in specs.items():
        if only and k not in only: continue
        s = lib.curtain(id=k[-1], **kw)
        p = f"{TMP}/{k}.svg"; open(p, "w").write(s)
        lib.bake(p, f"{TMP}/{k}.png", 2400, 800)
        lib.to_webp(f"{TMP}/{k}.png", f"{OUT}/{k}.webp", 90)
        print(k, os.path.getsize(f"{OUT}/{k}.webp"))
    if not only or "refl" in only:
        cs = [lib.curtain(raw=True, id=i, **specs[k]) for i, k in zip("cde", ["aur-c","aur-d","aur-e"])]
        # shift ids unique
        s = lib.reflection(cs, edge_y=.78)
        p = f"{TMP}/refl.svg"; open(p, "w").write(s)
        lib.bake(p, f"{TMP}/refl.png", 2400, 520)
        lib.to_webp(f"{TMP}/refl.png", f"{OUT}/refl.webp", 88)
        print("refl", os.path.getsize(f"{OUT}/refl.webp"))

def silhouettes():
    L = {
     "d": dict(far=("#0a1c30", "#1d4d57"), far_rim="rgba(110,255,200,.14)", mid=("#05111c", "#030a12"), mid_rim="rgba(110,255,200,.30)", near=("#030912", "#020509"), near_rim="rgba(120,255,210,.16)"),
     "l": dict(far=("#56689f", "#8b86b5"), far_rim="rgba(255,205,225,.5)", mid=("#2f3b72", "#222c5c"), mid_rim="rgba(255,190,215,.5)", near=("#1a2250", "#121843"), near_rim="rgba(255,190,220,.3)"),
    }
    for m, c in L.items():
        s, _ = lib.peaks(7, 2400, 520, .985, 330, c["far"], rim=c["far_rim"], rough=.6)
        write(f"ridge-far-{m}.svg", s)
        mid = lambda mirror: lib.ridge_with_spruce(21, 2400, 420, .965, 70, 150, 50, 1.5, rim=c["mid_rim"], fill=c["mid"], mirror=mirror)
        write(f"ridge-mid-{m}.svg", mid(False))
        write(f"refl-mid-{m}.svg", mid(True))
        write(f"shore-{m}.svg", lib.ridge_with_spruce(33, 2400, 800, .985, 40, 560, 150, .33, rim=c["near_rim"], fill=c["near"]))
    write("stars-a.svg", lib.stars(3, 1200, 900, 150))
    write("stars-b.svg", lib.stars(8, 1400, 900, 90))

if __name__ == "__main__":
    what = sys.argv[1:] 
    if "sil" in what or not what: silhouettes()
    if "aur" in what or not what: bake_curtains()
    else: bake_curtains(set(w for w in what if w != "sil"))
