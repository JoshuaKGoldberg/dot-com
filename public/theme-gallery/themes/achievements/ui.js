export function create({ root, defs, reducedMotion, getUnlocked, getProgress, onReset, onToggle }) {
	const drawer = document.createElement("aside");
	drawer.className = "ac-drawer";
	drawer.setAttribute("aria-label", "Trophy drawer");
	drawer.inert = true;
	drawer.innerHTML =
		'<div class="ac-head"><h2>Trophies <span class="ac-sum"></span></h2><button class="ac-x" type="button" aria-label="Close trophy drawer">×</button></div>' +
		'<div class="ac-bar"><i></i></div><ul class="ac-list"></ul><button class="ac-reset" type="button">Reset progress</button>';
	const stack = document.createElement("div");
	stack.className = "ac-toasts";
	stack.setAttribute("role", "status");
	root.append(drawer, stack);
	const list = drawer.querySelector(".ac-list");
	let open = false;

	function refresh() {
		const got = getUnlocked();
		const prog = getProgress();
		drawer.querySelector(".ac-sum").textContent = `${got.size}/${defs.length}`;
		drawer.querySelector(".ac-bar i").style.width = (got.size / defs.length) * 100 + "%";
		list.innerHTML = "";
		for (const d of defs) {
			const has = got.has(d.id);
			const li = document.createElement("li");
			li.className = has ? "is-got" : "";
			const p = prog[d.id];
			li.innerHTML = `<span class="ac-ico" aria-hidden="true"></span><span><b></b><small></small></span>`;
			li.querySelector(".ac-ico").textContent = has ? d.icon : "🔒";
			li.querySelector("b").textContent = d.title;
			li.querySelector("small").textContent = d.desc + (p && !has ? ` (${p[0]}/${p[1]})` : "");
			list.append(li);
		}
	}
	function toggle(force) {
		open = force ?? !open;
		drawer.classList.toggle("is-open", open);
		drawer.inert = !open;
		onToggle(open);
		if (open) {
			refresh();
			drawer.querySelector(".ac-x").focus({ preventScroll: true });
		}
	}
	function toast(d) {
		const t = document.createElement("div");
		t.className = "ac-toast";
		t.innerHTML = '<span class="ac-ico" aria-hidden="true"></span><span><small>Achievement unlocked</small><b></b></span>';
		t.querySelector(".ac-ico").textContent = d.icon;
		t.querySelector("b").textContent = d.title;
		stack.append(t);
		while (stack.children.length > 3) stack.firstChild.remove();
		const kill = () => t.remove();
		if (reducedMotion) setTimeout(kill, 4200);
		else {
			t.addEventListener("animationend", (e) => e.animationName === "ac-out" && kill());
		}
	}
	drawer.addEventListener("click", (e) => {
		if (e.target.closest(".ac-x")) toggle(false);
		else if (e.target.closest(".ac-reset")) {
			onReset();
			refresh();
		}
	});
	const onKey = (e) => e.key === "Escape" && open && toggle(false);
	document.addEventListener("keydown", onKey);
	refresh();
	return {
		toast,
		toggle,
		refresh: () => open && refresh(),
		destroy() {
			document.removeEventListener("keydown", onKey);
		},
	};
}
