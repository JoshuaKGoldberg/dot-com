import { el, lighthouseScore, state, subscribe } from "./_perf/kit.js";

// A lighthouse whose beam brightness and reach follow a Lighthouse-style performance score that is computed
// live from this page's real measurements: FCP (Paint Timing), LCP, CLS (PerformanceObserver) and Total
// Blocking Time (Long Tasks after FCP). Weights 10/25/30/25 and the same log-normal scoring curves Lighthouse
// uses; Speed Index is not measured, so it is left out and the weights renormalised. It is an approximation
// of a Lighthouse run, not one. Until FCP exists the lamp is dim ("measuring").

const TOWER = `
<svg class="lh-svg" viewBox="0 0 120 400" aria-hidden="true" focusable="false">
	<defs>
		<clipPath id="lh-tower"><path d="M36 392 L84 392 L74 132 L46 132 Z"/></clipPath>
		<linearGradient id="lh-shade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".0"/><stop offset=".6" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
	</defs>
	<g clip-path="url(#lh-tower)">
		<rect x="30" y="120" width="60" height="280" class="lh-white"/>
		<rect x="30" y="160" width="60" height="42" class="lh-red"/>
		<rect x="30" y="244" width="60" height="42" class="lh-red"/>
		<rect x="30" y="328" width="60" height="42" class="lh-red"/>
		<rect x="30" y="120" width="60" height="280" fill="url(#lh-shade)"/>
	</g>
	<rect x="38" y="126" width="44" height="7" rx="1.5" class="lh-deck"/>
	<rect x="52" y="96" width="16" height="30" class="lh-glass"/>
	<rect x="52" y="96" width="16" height="30" class="lh-mullion" fill="none"/>
	<line x1="60" y1="96" x2="60" y2="126" class="lh-mullion"/>
	<path d="M48 97 Q60 70 72 97 Z" class="lh-roof"/>
	<line x1="60" y1="72" x2="60" y2="60" class="lh-mullion"/>
	<path class="lh-base" d="M6 400 Q26 378 58 384 Q92 372 116 400Z"/>
	<rect x="54" y="206" width="5" height="9" rx="2" class="lh-window"/>
	<rect x="62" y="290" width="5" height="9" rx="2" class="lh-window"/>
</svg>`;

export function activate({ root }) {
	const scenery = root.querySelector(".scenery-b");
	const beamLayer = root.querySelector(".scenery-c");
	const overlay = root.querySelector(".overlay-a");

	// Rocky shore (static SVG, drawn once).
	const shore = el("div", { class: "lh-shore" });
	shore.innerHTML = `<svg viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
		<path class="lh-sea-far" d="M0 120 Q150 100 300 118 T600 116 T900 120 T1200 112 V220 H0Z"/>
		<path class="lh-rock" d="M0 220 V140 Q40 118 90 126 Q130 80 190 96 Q250 90 280 128 Q330 118 370 150 Q420 170 470 220Z"/>
		<path class="lh-rock lh-rock2" d="M0 220 V176 Q60 160 120 176 Q200 160 260 190 Q300 200 340 220Z"/>
		<path class="lh-sea" d="M360 220 Q420 170 520 178 Q700 160 900 176 Q1100 164 1200 172 V220Z"/>
	</svg>`;
	scenery.append(shore);

	const lighthouse = el("div", { class: "lh" });
	lighthouse.innerHTML = TOWER;
	const beam = el("div", { class: "lh-beam" });
	const beam2 = el("div", { class: "lh-beam lh-beam-back" });
	const halo = el("div", { class: "lh-halo" });
	lighthouse.append(beam2, beam, halo);
	beamLayer.append(lighthouse);

	// Score plaque.
	const ring = el("div", { class: "lh-ring", style: "--score:0" }, el("b", { text: "--" }));
	const parts = el("ul", { class: "lh-parts" });
	const note = el("div", { class: "lh-note", text: "Measuring..." });
	const plaque = el("div", { class: "lh-plaque" }, el("div", { class: "lh-heading" }, ring, el("div", {}, el("div", { class: "lh-title", text: "Lighthouse-style score" }), note)), parts);
	overlay.append(plaque);

	function update() {
		const result = lighthouseScore();
		if (!result) {
			lighthouse.style.setProperty("--beam", "0.18");
			plaque.dataset.band = "pending";
			return;
		}
		const { score } = result;
		const band = score >= 90 ? "good" : score >= 50 ? "ok" : "poor";
		plaque.dataset.band = band;
		ring.style.setProperty("--score", String(score));
		ring.firstChild.textContent = String(score);
		lighthouse.style.setProperty("--beam", (0.2 + 0.8 * (score / 100)).toFixed(3));
		lighthouse.style.setProperty("--reach", (0.55 + 0.45 * (score / 100)).toFixed(3));
		note.textContent = `from FCP, LCP, CLS and TBT measured on this page (${state.longTasks.length} long task${state.longTasks.length === 1 ? "" : "s"})`;
		parts.replaceChildren(
			...result.parts.map((part) =>
				el("li", { style: `--p:${Math.round(part.score * 100)}%` }, el("span", { text: part.key }), el("i"), el("b", { text: part.label })),
			),
		);
	}

	const unsubscribe = subscribe(update);
	update();
	return unsubscribe;
}
