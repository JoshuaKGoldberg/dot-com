export interface Wave {
	amplitude: number;
	phase: number;
	wavelength: number;
	width: number;
	y: number;
}

const pixelsPerPoint = 2;

export function drawWave({ amplitude, phase, wavelength, width, y }: Wave) {
	const count = Math.max(2, Math.ceil(width / pixelsPerPoint));
	const points = Array.from({ length: count + 1 }, (_, i) => {
		const x = (i / count) * width;
		const height = amplitude * Math.sin((x / wavelength) * Math.PI * 2 + phase);

		return `${x.toFixed(1)} ${(y - height).toFixed(2)}`;
	});

	return `M${points.join("L")}`;
}
