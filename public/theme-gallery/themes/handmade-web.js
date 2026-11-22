const BADGES = [
	["hm-b1", "TS", "made with TypeScript"],
	["hm-b2", "◉", "best viewed with eyes"],
	["hm-b3", "✓", "lint free"],
	["hm-b5", "☕", "powered by coffee"],
	["hm-b6", "∞", "any browser"],
	["hm-b4", "✎", "hand coded"],
	["hm-b8", "0", "zero trackers"],
	["hm-b7", "♥", "made in Boston"],
	["hm-b9", "RSS", "feed me"],
	["hm-b3", "?", "no cookies here"],
];

export function activate({ root, reducedMotion }) {
	const main = root.querySelector(".site-main");
	const footer = root.querySelector(".site-footer");
	const reduced = reducedMotion || document.documentElement.classList.contains("reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;

	const wall = document.createElement("section");
	wall.className = "site-section hm-badges";
	wall.innerHTML = `<h2 class="site-section-title">Badges &amp; Buttons</h2>
		<div class="hm-wall">${BADGES.map(([c, g, t]) => `<a class="hm-badge ${c}" href="#" title="${t}" aria-label="${t}"><b aria-hidden="true">${g}</b><span>${t}</span></a>`).join("")}</div>
		<p class="hm-note">Collected over many years. Please do not hotlink.</p>`;
	main.append(wall);

	const ring = document.createElement("div");
	ring.className = "hm-webring";
	ring.innerHTML = `<div class="hm-ring" role="navigation" aria-label="Webring"><a href="#">« prev</a> <span aria-hidden="true">·</span> <em>TypeScript Webring</em> <span aria-hidden="true">·</span> <a href="#">random</a> <span aria-hidden="true">·</span> <a href="#">next »</a></div>`;
	const counter = document.createElement("div");
	counter.className = "hm-counter";
	const value = "0042917";
	counter.innerHTML = `<span>You are visitor number</span><span class="hm-digits" role="img" aria-label="${Number(value)}">${[...value].map(() => `<span class="hm-digit" aria-hidden="true"><span class="hm-reel">${"0123456789".split("").map((d) => `<i>${d}</i>`).join("")}</span></span>`).join("")}</span>`;
	const small = document.createElement("p");
	small.className = "hm-small";
	small.textContent = "Last updated whenever I felt like it. Best viewed at any resolution.";
	footer.prepend(ring, counter);
	footer.append(small);

	const reels = [...counter.querySelectorAll(".hm-reel")];
	const set = (i, d, animate) => {
		const reel = reels[i];
		if (!animate) { reel.style.transition = "none"; }
		reel.style.transform = `translateY(${-d * 24}px)`;
	};
	reels.forEach((_, i) => set(i, 0, false));
	let timer = 0;
	const roll = () => {
		reels.forEach((reel, i) => {
			if (reduced) { set(i, +value[i], false); return; }
			reel.style.transition = `transform ${1.2 + i * 0.35}s cubic-bezier(.2,.8,.2,1)`;
			set(i, +value[i], true);
		});
	};
	if (reduced) roll();
	else timer = setTimeout(() => requestAnimationFrame(roll), 120);
	return () => clearTimeout(timer);
}
