import { panel, h } from "./_sensor/kit.js";

const LABEL = { rich: "Rich: full visuals", lite: "Lite: flat, no decoration", text: "Text only: images on request" };

export function activate({ root }) {
	const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
	const portrait = root.querySelector(".site-portrait");
	const imgs = [...portrait.querySelectorAll("img")];
	const stash = imgs.map((img) => img.getAttribute("src"));
	const load = h("button", { class: "sd-load", type: "button" }, "Image: Josh's half-smiling happy face. Tap to load.");
	portrait.after(load);

	let choice = "auto"; // auto | 4g | 3g | 2g | save
	const tierOf = (c) => {
		if (c.saveData || c.type === "2g" || c.type === "slow-2g") return "text";
		if (c.type === "3g") return "lite";
		return "rich";
	};
	const detected = () => ({ type: conn?.effectiveType ?? "4g", saveData: !!conn?.saveData });
	const effective = () => {
		if (choice === "auto") return detected();
		if (choice === "save") return { type: "4g", saveData: true };
		return { type: choice, saveData: false };
	};

	function setImages(on) {
		imgs.forEach((img, i) => {
			if (on) {
				if (!img.getAttribute("src")) img.setAttribute("src", stash[i]);
			} else img.removeAttribute("src");
		});
	}

	function apply() {
		const c = effective();
		const tier = tierOf(c);
		const was = root.dataset.tier;
		root.dataset.tier = tier;
		if (tier === "text") {
			if (was !== "text") {
				delete root.dataset.img;
				setImages(false);
			}
		} else setImages(true);
		const d = detected();
		const real = conn
			? `Your connection: ${d.type}${conn.downlink ? `, ${conn.downlink} Mbps` : ""}${conn.rtt != null ? `, ${conn.rtt} ms RTT` : ""}${d.saveData ? ", Save-Data on" : ""}.`
			: "Network Information API not available here (Safari, Firefox); assuming a fast connection.";
		readout.textContent = real;
		ui.status("");
		status.innerHTML = "";
		status.append(h("span", { class: "sd-tier" }, LABEL[tier]), choice === "auto" ? "" : " (simulated)");
	}

	load.addEventListener("click", () => {
		setImages(true);
		root.dataset.img = "1";
	});

	const ui = panel(root, {
		title: "Save-Data",
		statusIdle: "",
		privacy: "Connection hints are read locally. Nothing is sent anywhere.",
		simLabel: "Simulate connection",
		controls: [
			{
				type: "buttons", id: "net", label: "Connection", value: "auto",
				options: [{ value: "auto", label: "Auto" }, { value: "4g", label: "4G" }, { value: "3g", label: "3G" }, { value: "2g", label: "2G" }, { value: "save", label: "Save-Data" }],
				onPick: (v) => { choice = v; apply(); },
			},
		],
	});
	const status = ui.el.querySelector(".sx-status");
	const readout = h("p", { class: "sd-readout" });
	status.after(readout);

	conn?.addEventListener?.("change", apply);
	apply();
	return () => {
		conn?.removeEventListener?.("change", apply);
		ui.destroy();
	};
}
