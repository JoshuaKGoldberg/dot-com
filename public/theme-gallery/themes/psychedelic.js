const NS = "http://www.w3.org/2000/svg";

export function activate({ root, reducedMotion }) {
	const reduced = reducedMotion || document.documentElement.classList.contains("reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches;

	// shared melt filter for headings
	const defs = document.createElementNS(NS, "svg");
	defs.setAttribute("width", "0");
	defs.setAttribute("height", "0");
	defs.setAttribute("aria-hidden", "true");
	defs.style.position = "absolute";
	defs.innerHTML = `
		<defs>
			<filter id="psy-melt" x="-10%" y="-20%" width="125%" height="150%" color-interpolation-filters="sRGB">
				<feTurbulence type="fractalNoise" baseFrequency="0.011 0.034" numOctaves="2" seed="7" result="n">
					${reduced ? "" : '<animate attributeName="baseFrequency" dur="22s" values="0.011 0.034;0.016 0.026;0.011 0.034" repeatCount="indefinite"/>'}
				</feTurbulence>
				<feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
			</filter>
			<filter id="psy-melt-big" x="-10%" y="-25%" width="125%" height="160%" color-interpolation-filters="sRGB">
				<feTurbulence type="fractalNoise" baseFrequency="0.008 0.022" numOctaves="2" seed="3" result="n">
					${reduced ? "" : '<animate attributeName="baseFrequency" dur="26s" values="0.008 0.022;0.012 0.016;0.008 0.022" repeatCount="indefinite"/>'}
				</feTurbulence>
				<feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/>
			</filter>
		</defs>`;
	root.prepend(defs);

	// warped-path title
	const h1 = root.querySelector(".site-title");
	const label = h1.textContent;
	h1.textContent = "";
	const sr = document.createElement("span");
	sr.className = "psy-sr";
	sr.textContent = label;
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("class", "psy-title");
	svg.setAttribute("viewBox", "0 0 480 250");
	svg.setAttribute("aria-hidden", "true");
	const layers = [
		{ dx: 10, dy: 10, fill: "var(--purple)", stroke: "var(--purple)" },
		{ dx: 6, dy: 6, fill: "var(--magenta)", stroke: "var(--magenta)" },
		{ dx: 3, dy: 3, fill: "var(--acid)", stroke: "var(--acid)" },
		{ dx: 0, dy: 0, fill: "var(--orange)", stroke: "var(--purple)" },
	];
	const g = document.createElementNS(NS, "g");
	g.setAttribute("filter", "url(#psy-melt-big)");
	const paths = [
		{ id: "psy-p1", d: "M10 100 C 100 70, 170 118, 250 96 S 390 76, 468 100", text: "Hi! I'm" },
		{ id: "psy-p2", d: "M16 228 C 100 196, 190 250, 270 226 S 380 206, 450 232", text: "Josh." },
	];
	const pdefs = document.createElementNS(NS, "defs");
	for (const p of paths) {
		const path = document.createElementNS(NS, "path");
		path.setAttribute("id", p.id);
		path.setAttribute("d", p.d);
		pdefs.append(path);
	}
	svg.append(pdefs);
	for (const l of layers) {
		const grp = document.createElementNS(NS, "g");
		grp.setAttribute("transform", `translate(${l.dx} ${l.dy})`);
		for (const p of paths) {
			const t = document.createElementNS(NS, "text");
			t.setAttribute("font-family", "Shrikhand, serif");
			t.setAttribute("font-size", "100");
			t.setAttribute("fill", l.fill);
			t.setAttribute("stroke", l.stroke);
			t.setAttribute("stroke-width", l.dx === 0 ? "3" : "5");
			t.setAttribute("stroke-linejoin", "round");
			t.setAttribute("paint-order", "stroke"); t.setAttribute("letter-spacing", "3");
			const tp = document.createElementNS(NS, "textPath");
			tp.setAttribute("href", `#${p.id}`);
			tp.textContent = p.text;
			t.append(tp);
			grp.append(t);
		}
		g.append(grp);
	}
	svg.append(g);
	h1.style.filter = "none";
	h1.style.textShadow = "none";
	h1.append(sr, svg);
	root.querySelector(".site-hero").classList.add("psy-hero");

	return () => {};
}
