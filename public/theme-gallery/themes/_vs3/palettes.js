// _vs3/palettes.js: the five light-mode palettes. sky = top / mid / horizon; ridges far -> nearest (each a little darker than the sky,
// with atmospheric perspective); water = under the horizon / bottom; aurora = four pastel stops (low -> high); mist = fog veil tint.
export const LIGHT = {
	dawn: { // rose-peach dawn over lilac ridges and silver water
		sky: ["#fbe6ea", "#f9d2cf", "#fbd9bd"], ridges: { far: "#e8d2de", mid: "#dcc3d6", near: "#d0b5cf", nearest: "#c4a9c5" },
		water: ["#e5d8e2", "#c6c3d5"], aurora: ["#4fbfb8", "#9a86dc", "#ee7fa0", "#eeb458"], mist: "#fff0ec", tint: [1, 1, 1],
	},
	blueMorning: { // cool misty blue morning, slate-lilac ridges, pale aqua aurora
		sky: ["#dfecf8", "#cadff0", "#e6f3f6"], ridges: { far: "#c3cfe3", mid: "#b2bfd9", near: "#a3afce", nearest: "#949fc2" },
		water: ["#c0d9e7", "#a2c3d8"], aurora: ["#3fbcc9", "#6fd3cf", "#6a9fe6", "#9f8de0"], mist: "#f0f7fb", tint: [1, 1, 1],
	},
	golden: { // warm cream and sage golden hour, gold-green aurora
		sky: ["#fbf2dc", "#f6e4b9", "#f8dfa6"], ridges: { far: "#d2d8b3", mid: "#c0cba2", near: "#adba92", nearest: "#9aaa82" },
		water: ["#e3dfb4", "#b8c498"], aurora: ["#9cc95e", "#dcc455", "#62bf98", "#eba663"], mist: "#fff6df", tint: [1, 1, 1],
	},
	winter: { // icy blue-white, snow-toned ridges, cyan aurora
		sky: ["#e6f3fb", "#d2e7f6", "#edf8fd"], ridges: { far: "#d9e7f2", mid: "#cbdcea", near: "#bdd1e3", nearest: "#aec6db" },
		water: ["#c8e1ef", "#9cc6de"], aurora: ["#2fc3de", "#76dce4", "#74a4ee", "#b0a2ee"], mist: "#f3faff", tint: [1, 1, 1],
	},
	blueHour: { // periwinkle blue hour, indigo-tinted ridges
		sky: ["#dcddf6", "#c6caef", "#e0d6f0"], ridges: { far: "#b9bde3", mid: "#a7acd7", near: "#959bca", nearest: "#848bbb" },
		water: ["#b6bbe5", "#9ea5dc"], aurora: ["#68a0f0", "#9686ee", "#c284de", "#68cfe0"], mist: "#eceeff", tint: [1, 1, 1],
	},
};
