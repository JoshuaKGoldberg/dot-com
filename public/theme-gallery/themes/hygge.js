const LAMP = `<svg class="hy-lamp" viewBox="0 0 28 40" aria-hidden="true">
	<ellipse class="hy-halo" cx="14" cy="13" rx="13" ry="13" fill="#ffb454" opacity=".28"/>
	<g class="hy-flame-wrap"><g class="hy-flame">
		<path d="M14 2 C 19 9, 20.5 13, 14 19.5 C 7.5 13, 9 9, 14 2 Z" fill="#ffb347"/>
		<path class="hy-flame-inner" d="M14 8 C 17 12, 17.5 14.5, 14 18 C 10.5 14.5, 11 12, 14 8 Z" fill="#fff1c2"/>
	</g></g>
	<path d="M14 19.5 V23" stroke="#5a3d2b" stroke-width="1.3" stroke-linecap="round"/>
	<rect x="8" y="23" width="12" height="14" rx="2.5" fill="#e9d9bd" stroke="#b8694a" stroke-width="1.2"/>
	<path d="M8.5 27 q3 2.5 6 0 t5 .5" stroke="#d9c4a1" stroke-width="1.2" fill="none" stroke-linecap="round"/>
	<rect x="5.5" y="36" width="17" height="2.4" rx="1.2" fill="#b8694a"/>
</svg>`;

export function activate({ root }) {
	const html = document.documentElement;
	const toggle = root.querySelector(".site-theme-toggle");
	toggle.innerHTML = LAMP;
	const sync = () => {
		const candle = root.dataset.lamp === "candle";
		toggle.setAttribute("aria-pressed", String(candle));
		toggle.setAttribute("aria-label", candle ? "Candlelit. Switch to daylight" : "Daylight. Light a candle");
		toggle.title = candle ? "Blow out the candle" : "Light the candle";
	};
	const set = (value) => { root.dataset.lamp = value; sync(); };
	set(html.classList.contains("dark") ? "candle" : "day");

	const onClick = () => set(root.dataset.lamp === "candle" ? "day" : "candle");
	toggle.addEventListener("click", onClick);
	let was = html.classList.contains("dark");
	const observer = new MutationObserver(() => {
		const now = html.classList.contains("dark");
		if (now !== was) { was = now; set(now ? "candle" : "day"); }
	});
	observer.observe(html, { attributes: true, attributeFilter: ["class"] });
	return () => { observer.disconnect(); toggle.removeEventListener("click", onClick); };
}
