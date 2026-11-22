import lib, lib2, lib3, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
TMP = os.path.join(HERE, "tmp"); os.makedirs(TMP, exist_ok=True)
def write(n, s): open(os.path.join(OUT, n), "w").write(s)
def bake_one(name, s, w, h, q=88):
    p = f"{TMP}/{name}.svg"; open(p, "w").write(s)
    lib.bake(p, f"{TMP}/{name}.png", w, h); lib.to_webp(f"{TMP}/{name}.png", f"{OUT}/{name}.webp", q)
    print(name, os.path.getsize(f"{OUT}/{name}.webp"))

SPECS = {
  "aur-a": dict(seed=201, palette="teal", edge=.70, amp=.08, height=.52, hot=.6, folds=2, step=3.2, lean=.3),
  "aur-b": dict(seed=202, palette="violet", edge=.62, amp=.10, height=.5, hot=.55, folds=3, step=3.4, lean=-.2),
  "aur-c": dict(seed=203, palette="emerald", edge=.76, amp=.11, height=.66, hot=1.0, folds=3),
  "aur-d": dict(seed=204, palette="rose", edge=.58, amp=.09, height=.5, hot=.8, folds=4, lean=.3),
  "aur-e": dict(seed=205, palette="emerald", edge=.80, amp=.07, height=.55, hot=.9, folds=5, step=2.8, lean=-.25),
}
def aurora(only=None):
    for k, kw in SPECS.items():
        bake_one(k, lib.curtain(id=k[-1], **kw), 2400, 800, 86)
    cs = [lib.curtain(raw=True, id=i, **SPECS[k]) for i, k in zip("cde", ["aur-c", "aur-d", "aur-e"])]
    bake_one("refl", lib.reflection(cs, edge_y=.78), 2400, 520, 86)

L = {
 "d": dict(far=("#0a1c30", "#1d4d57"), far_rim="rgba(120,255,210,.20)", snow="rgb(190,235,255)",
           sum=[(0,"#12303e",1),(.5,"#0e2a36",1),(1,"#0a202b",1)], sum_rim="rgba(130,255,205,.42)", win="rgb(255,196,110)", tower="#02070c",
           tree=[(0,"#020a10",1),(1,"#01040a",1)], tree_rim="rgba(120,255,210,.42)", trunk=[(0,"#6f8f90",1),(1,"#3d5a5e",1)], mark="#03080e"),
 "l": dict(far=("#56689f", "#8b86b5"), far_rim="rgba(255,205,225,.55)", snow="rgb(255,236,246)",
           sum=[(0,"#4a548f",1),(.5,"#2b3570",1),(1,"#1c2458",1)], sum_rim="rgba(255,205,225,.65)", win="rgb(255,226,150)", tower="#161c4a",
           tree=[(0,"#2f3b72",1),(1,"#141a48",1)], tree_rim="rgba(255,190,215,.5)", trunk=[(0,"#cfc4e0",1),(1,"#9892c4",1)], mark="#1a2050"),
}
def land():
    for m, c in L.items():
        s, _ = lib.peaks(11, 2400, 560, .99, 400, c["far"], rim=c["far_rim"], snow=c["snow"], rough=.62)
        write(f"peaks-{m}.svg", s)
        s, _ = lib3.summit(7, 2400, 900, .985, 200, 2232, 470, 300, c["sum"], c["sum_rim"], c["snow"], c["win"], 300, c["tower"])
        write(f"summit-{m}.svg", s)
        defs, body, s = lib2.forest(33, 2400, 600, .975, 40, [("spruce", 6, 170, 330, 34), ("pine", 1, 260, 380, 240), ("birch", 1, 200, 320, 260)], c["tree"], rim=c["tree_rim"], trunk_stops=c["trunk"], mark=c["mark"], twig=.7)
        write(f"trees-{m}.svg", s)
        write(f"refl-trees-{m}.svg", lib2.mirror(defs, body, 2400, 600, seed=4))
    write("stars-a.svg", lib.stars(13, 1200, 900, 150)); write("stars-b.svg", lib.stars(18, 1400, 900, 90))

if __name__ == "__main__":
    w = sys.argv[1:]
    if not w or "aur" in w: aurora()
    if not w or "land" in w: land()
