const properties = [
	"--auroraJade",
	"--auroraCornflower",
	"--auroraWisteria",
	"--auroraRose",
];

/** Reads the current theme's aurora colors, as red, green, and blue from 0 to 1. */
export function readPalette() {
	const context = document.createElement("canvas").getContext("2d");
	const styles = getComputedStyle(document.documentElement);

	return properties.flatMap((property) => {
		if (!context) {
			return [0, 0, 0];
		}

		// Canvases normalize any opaque CSS color to #rrggbb
		context.fillStyle = styles.getPropertyValue(property);

		const hex = context.fillStyle;

		return [1, 3, 5].map(
			(start) => parseInt(hex.slice(start, start + 2), 16) / 255,
		);
	});
}
