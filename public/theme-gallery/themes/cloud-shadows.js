const W = 1024;
const H = 512;

function noiseMaskSvg({ freq, octaves, seed, k, t, w, h }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><filter id="f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${k} 0 0 0 ${-t}"/></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>`;
}

function loadSvg(svg) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
	});
}

function canvas(w, h) {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
}

// tile the mask 3x3 so blur/offset wrap seamlessly, then crop the centre
function tiled(img, w, h, blur) {
	const c = canvas(w * 3, h * 3);
	const x = c.getContext("2d");
	for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x.drawImage(img, i * w, j * h, w, h);
	if (!blur) return c;
	const d = canvas(w * 3, h * 3);
	const y = d.getContext("2d");
	y.filter = `blur(${blur}px)`;
	y.drawImage(c, 0, 0);
	return d;
}

function edge(mask, dx, dy, color, w, h) {
	const c = canvas(w * 3, h * 3);
	const x = c.getContext("2d");
	x.drawImage(mask, 0, 0);
	x.globalCompositeOperation = "destination-out";
	x.drawImage(mask, dx, dy);
	x.globalCompositeOperation = "source-in";
	x.fillStyle = color;
	x.fillRect(0, 0, w * 3, h * 3);
	return c;
}

function fill(mask, color, w, h) {
	const c = canvas(w * 3, h * 3);
	const x = c.getContext("2d");
	x.drawImage(mask, 0, 0);
	x.globalCompositeOperation = "source-in";
	x.fillStyle = color;
	x.fillRect(0, 0, w * 3, h * 3);
	return c;
}

function crop(src, w, h) {
	const c = canvas(w, h);
	c.getContext("2d").drawImage(src, w, h, w, h, 0, 0, w, h);
	return c;
}

const toUrl = (c) => new Promise((res) => c.toBlob((b) => res(URL.createObjectURL(b))));

async function cloudTile(dark) {
	const img = await loadSvg(noiseMaskSvg({ freq: "0.0042 0.0085", octaves: 5, seed: 8, k: 9, t: 4.15, w: W, h: H }));
	const m = tiled(img, W, H, 2.5);
	const body = dark ? "#6d6a9e" : "#fff4de";
	const shade = dark ? "#34336a" : "#e8c696";
	const rim = dark ? "rgba(211,162,242,0.8)" : "rgba(255,200,110,0.85)";
	const out = canvas(W * 3, H * 3);
	const x = out.getContext("2d");
	x.drawImage(fill(m, body, W, H), 0, 0);
	x.drawImage(edge(m, -7, -9, shade, W, H), 0, 0);
	x.drawImage(edge(m, 4, 5, rim, W, H), 0, 0);
	return crop(out, W, H);
}

async function shadowTile(dark) {
	const S = 512;
	const img = await loadSvg(noiseMaskSvg({ freq: "0.007", octaves: 4, seed: 21, k: 5.5, t: 2.3, w: S, h: S }));
	const m = tiled(img, S, S, 14);
	const c = fill(m, dark ? "rgba(8,4,30,0.5)" : "rgba(70,62,96,0.3)", S, S);
	return crop(c, S, S);
}

export function activate({ root }) {
	const dark = document.documentElement.classList.contains("dark");
	const b = root.querySelector(".site-scenery .scenery-b");
	const c = root.querySelector(".site-scenery .scenery-c");
	const urls = [];
	let dead = false;
	const clouds = document.createElement("div");
	clouds.className = "cs-layer cs-clouds";
	const shadows = document.createElement("div");
	shadows.className = "cs-layer cs-shadows";
	b.appendChild(clouds);
	c.appendChild(shadows);
	cloudTile(dark)
		.then(toUrl)
		.then((u) => {
			urls.push(u);
			if (!dead) clouds.style.backgroundImage = `url(${u})`;
		});
	shadowTile(dark)
		.then(toUrl)
		.then((u) => {
			urls.push(u);
			if (!dead) shadows.style.backgroundImage = `url(${u})`;
		});
	return () => {
		dead = true;
		urls.forEach(URL.revokeObjectURL);
	};
}
