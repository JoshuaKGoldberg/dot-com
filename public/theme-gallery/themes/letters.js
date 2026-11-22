const NS = "http://www.w3.org/2000/svg";

function postmarkSVG(dateText) {
	return `<svg class="lt-postmark" viewBox="0 0 208 112" aria-hidden="true" fill="none" stroke="currentColor">
		<defs><path id="lt-ring" d="M 56 56 m -38 0 a 38 38 0 1 1 76 0 a 38 38 0 1 1 -76 0"/></defs>
		<circle cx="56" cy="56" r="50" stroke-width="2.2"/>
		<circle cx="56" cy="56" r="26" stroke-width="1.2"/>
		<text font-family="Cormorant Garamond, serif" font-size="10.5" font-weight="700" letter-spacing="2.6" fill="currentColor" stroke="none">
			<textPath href="#lt-ring" startOffset="0" textLength="234" lengthAdjust="spacing">BOSTON \u00b7 MASS \u00b7 TYPESCRIPT \u00b7</textPath>
		</text>
		<text x="56" y="52" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">${dateText.split("|")[0]}</text>
		<text x="56" y="65" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">${dateText.split("|")[1]}</text>
		<g stroke-width="2.4" stroke-linecap="round">
			<path d="M112 36 q10 -8 20 0 t20 0 t20 0 t20 0"/>
			<path d="M112 50 q10 -8 20 0 t20 0 t20 0 t20 0"/>
			<path d="M112 64 q10 -8 20 0 t20 0 t20 0 t20 0"/>
			<path d="M112 78 q10 -8 20 0 t20 0 t20 0 t20 0"/>
		</g>
	</svg>`;
}

function stampSVG() {
	return `<svg class="lt-stamp" viewBox="0 0 72 88" aria-hidden="true">
		<rect x="2" y="2" width="68" height="84" fill="var(--paper)" stroke="var(--siteAccent)" stroke-width="2" stroke-dasharray="3 2.4"/>
		<rect x="9" y="9" width="54" height="70" fill="none" stroke="var(--siteAccent)" stroke-width="1"/>
		<path d="M14 50 q6 -9 12 0 t12 0 t12 0 t10 0" stroke="var(--siteAccent)" stroke-width="3" fill="none" stroke-linecap="round"/>
		<text x="36" y="30" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="14" font-weight="700" fill="var(--siteAccent)">TS</text>
		<text x="36" y="70" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="7.5" font-weight="700" letter-spacing="0.5" fill="var(--siteAccent)">FIRST CLASS</text>
	</svg>`;
}

export function activate({ root }) {
	const page = root.querySelector(".site-page");
	const header = root.querySelector(".site-header");
	const hero = root.querySelector(".site-hero");
	const about = root.querySelector(".site-about");
	const footer = root.querySelector(".site-footer");
	const main = root.querySelector(".site-main");

	const now = new Date();
	const long = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
	const mon = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
	const ring = `${mon} ${now.getDate()}|${now.getFullYear()}`;

	const head = document.createElement("div");
	head.className = "lt-head";
	head.innerHTML = `<div class="lt-mono" aria-hidden="true">JG</div>
		<div class="lt-name">Josh Goldberg<span class="lt-sub">OPEN SOURCE CORRESPONDENT · BOSTON, MASSACHUSETTS</span></div>
		${stampSVG()}`;
	page.prepend(head);
	head.after(header);

	const dateline = document.createElement("div");
	dateline.className = "lt-dateline";
	dateline.innerHTML = `<div class="lt-date">${long}</div>${postmarkSVG(ring)}`;
	header.after(dateline);

	const salute = document.createElement("p");
	salute.className = "lt-salute";
	salute.textContent = "Dear visitor,";
	dateline.after(salute);

	// Section titles become run-in lines of the letter.
	const phrases = {
		"site-posts": "Lately I’ve been writing,",
		"site-projects": "and I’ve been building,",
		"site-talks": "and I’ve been out talking, in person and otherwise:",
	};
	for (const [cls, text] of Object.entries(phrases)) {
		const t = root.querySelector(`.${cls} .site-section-title`);
		if (t) t.textContent = text;
	}
	root.querySelector(".site-posts .site-section-title").textContent = "Lately I’ve been writing:";
	root.querySelector(".site-projects .site-section-title").textContent = "I’ve also been building:";

	const close = document.createElement("div");
	close.className = "lt-close";
	close.innerHTML = `<p>Thank you for stopping by. Do write back.</p>
		<p style="margin-top:1.3rem">Yours in types,</p>
		<span class="lt-sign">Josh</span>
		<p class="lt-ps"><b>P.S.</b> SquiggleConf is on the horizon — a conference for the people who love their types and their tooling. Do come along; I’ll save you a seat. <a class="site-link" href="#">squiggleconf.com</a></p>`;
	main.append(close);

	// socials into the footer
	const socials = hero.querySelector(".site-socials");
	if (socials) {
		const line = document.createElement("p");
		line.innerHTML = "Also found on: ";
		[...socials.querySelectorAll("a")].forEach((a, i, arr) => {
			line.append(a);
			if (i < arr.length - 1) line.append(", ");
		});
		footer.prepend(line);
	}
}
