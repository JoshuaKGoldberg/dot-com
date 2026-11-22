const SVG = "http://www.w3.org/2000/svg";

export function activate({ root, reducedMotion }) {
	const page = root.querySelector(".site-page");
	if (!page) {
		return;
	}

	// Ink spread: displacement only, applied to headings by CSS.
	const svg = document.createElementNS(SVG, "svg");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("width", "0");
	svg.setAttribute("height", "0");
	svg.style.position = "absolute";
	svg.innerHTML = `<filter id="ink-spread" x="-2%" y="-5%" width="104%" height="110%">
		<feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="5" result="noise"/>
		<feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
	</filter>`;
	root.append(svg);

	const marks = document.createElement("div");
	marks.className = "proof-marks";
	marks.setAttribute("aria-hidden", "true");
	marks.innerHTML = `
		<i class="crop tl"></i><i class="crop tr"></i><i class="crop bl"></i><i class="crop br"></i>
		<i class="reg top"></i><i class="reg bottom"></i>
		<span class="slug top">Proof no. 53 · Pulled on 300gsm cotton</span>
		<span class="slug top right">J. K. Goldberg · Sheet 1 of 1</span>
		<span class="slug left">Black ink · Four faces · Not for distribution</span>
		<span class="folio foot">— 1 —</span>`;
	page.prepend(marks);

	root.querySelectorAll(".site-section-title").forEach((title, index) => {
		title.dataset.folio = String(index + 2);
	});

	for (const item of root.querySelectorAll(".site-project")) {
		const name = item.querySelector(".site-item-title")?.textContent.trim() ?? "A";
		const letter = name[0] ?? "A";
		item.dataset.glyph = letter.toUpperCase() + letter.toLowerCase();
	}

	for (const item of root.querySelectorAll(".site-talk")) {
		const meta = item.querySelector(".site-item-meta");
		const time = meta.querySelector("time");
		const date = document.createElement("span");
		date.className = "talk-date";
		date.textContent = time?.textContent ?? "Podcast";
		const rest = meta.textContent.replace(time?.textContent ?? "", "").replace(/^\s*·\s*/, "").trim();
		meta.textContent = time ? rest : "Recorded for broadcast";
		item.prepend(date);
	}

	return () => {};
}
