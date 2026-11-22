import lib, lib2, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
TMP = os.path.join(HERE, "tmp"); os.makedirs(TMP, exist_ok=True)
def write(n, s): open(os.path.join(OUT, n), "w").write(s)

def bake_one(name, s, w, h, q=88, scale=1):
    p = f"{TMP}/{name}.svg"; open(p, "w").write(s)
    lib.bake(p, f"{TMP}/{name}.png", w, h)
    if scale != 1:
        from PIL import Image
        Image.open(f"{TMP}/{name}.png").resize((int(w*scale), int(h*scale)), Image.LANCZOS).save(f"{TMP}/{name}.png")
    lib.to_webp(f"{TMP}/{name}.png", f"{OUT}/{name}.webp", q)
    print(name, os.path.getsize(f"{OUT}/{name}.webp"))

def aurora():
    bake_one("cor-a", lib2.corona(11, mix=(("green", 1),), nrays=1100, nbands=5, core=.5, hot=1.5), 2400, 1500, 80, .75)
    bake_one("cor-b", lib2.corona(22, mix=(("rose", 3), ("teal", 1)), nrays=900, nbands=4, hot=1.4, core=.9, solid=.2), 2400, 1500, 80, .75)
    bake_one("cor-c", lib2.corona(33, mix=(("teal", 2), ("green", 1)), nrays=800, nbands=6, hot=1.2, solid=.25), 2400, 1500, 80, .75)
    bake_one("hor-a", lib.curtain(41, palette="emerald", edge=.78, amp=.07, height=.6, hot=1, folds=3, id="h"), 2400, 800, 88)
    bake_one("hor-b", lib.curtain(42, palette="rose", edge=.7, amp=.08, height=.5, hot=.7, folds=4, lean=.2, id="i"), 2400, 800, 88)
    cs = [lib.curtain(raw=True, id="r", seed=41, palette="emerald", edge=.78, amp=.07, height=.6, hot=1, folds=3)]
    bake_one("refl", lib.reflection(cs, edge_y=.78), 2400, 520)

L = {
 "d": dict(far=[(0,"#0b2230",1),(1,"#12404a",1)], far_rim="rgba(110,255,200,.16)",
           mid=[(0,"#04101a",1),(1,"#030a12",1)], mid_rim="rgba(110,255,200,.28)",
           near=[(0,"#0a1a24",1),(1,"#030a10",1)], near_rim="rgba(150,255,215,.32)",
           trunk=[(0,"#9bb9b2",1),(1,"#5c7c7c",1)], mark="#04090f", mtrunk=[(0,"#6f908f",1),(1,"#3d5a5e",1)]),
 "l": dict(far=[(0,"#6a74ad",1),(1,"#8f8ab8",1)], far_rim="rgba(255,205,225,.5)",
           mid=[(0,"#34407a",1),(1,"#222c5c",1)], mid_rim="rgba(255,190,215,.5)",
           near=[(0,"#1c2552",1),(1,"#121843",1)], near_rim="rgba(255,190,220,.3)",
           trunk=[(0,"#f0e6f2",1),(1,"#c9c2de",1)], mark="#1a2050", mtrunk=[(0,"#c9bfdc",1),(1,"#9a95c4",1)]),
}
def land():
    for m, c in L.items():
        _,_,s = lib2.forest(7, 2400, 520, .985, 50, [("spruce",3,60,110,50),("pine",2,80,130,80)], c["far"], rim=c["far_rim"], rough=.6)
        write(f"far-{m}.svg", s)
        _,_,s = lib2.forest(21, 2400, 560, .965, 60, [("pine",2,300,420,150),("birch",3,260,400,90),("spruce",1,180,300,90)], c["mid"], rim=c["mid_rim"], trunk_stops=c["mtrunk"], mark=c["mark"], twig=.7)
        write(f"mid-{m}.svg", s)
        _,_,s = lib2.forest(33, 2400, 800, .975, 70, [("birch",3,600,760,170),("pine",2,620,780,260)], c["near"], rim=c["near_rim"], trunk_stops=c["trunk"], mark=c["mark"])
        write(f"near-{m}.svg", s)
        write(f"ice-{m}.svg", lib2.ice(5, mode=m))
        bake_one(f"ice-{m}", lib2.ice(5, mode=m), 2400, 560, 86)
        os.remove(f"{OUT}/ice-{m}.svg")
    write("stars-a.svg", lib.stars(3, 1200, 900, 150)); write("stars-b.svg", lib.stars(8, 1400, 900, 90))
    bake_one("mist-d", lib2.mist(2), 2400, 300, 85)
    bake_one("mist-l", lib2.mist(2, col="rgb(255,225,240)"), 2400, 300, 85)

if __name__ == "__main__":
    w = sys.argv[1:]
    if not w or "aur" in w: aurora()
    if not w or "land" in w: land()
