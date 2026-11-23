type Color = readonly number[];

const namespace = "http://www.w3.org/2000/svg";

/** Farthest that a channel is brightened or darkened, so that people stay recognizable. */
const maximumGain = 2.2;

/** Roughly how opaque scenes are over portraits' backdrops. */
const sceneOpacity = 0.8;

/** Parts of portraits that transition separately, and how to find their average color. */
const layers = { backdrop: getBackdropColor, figure: getTone };

interface Shift {
	gains: Color;
	layer: string;
}

/**
 * Shifts the colors of portraits between pages, as one transitions into another.
 * The old one's become the new one's, which start off as the old one's, so that
 * they're of the same average color the whole way through.
 */
export function shiftTones(
	oldPage: Document,
	newPage: Document,
	transition: ViewTransition,
) {
	const shifts = Object.entries(layers).flatMap(
		([layer, getColor]): Shift[] => {
			const from = getColor(findLayer(oldPage, layer), oldPage);
			const to = getColor(findLayer(newPage, layer), oldPage);

			return from && to ? [{ gains: getGains(from, to), layer }] : [];
		},
	);

	if (!shifts.length) {
		return;
	}

	transition.ready.then(
		() => {
			animateShifts(shifts, transition);
		},
		() => {
			// Transitions that were skipped don't have any colors to shift
		},
	);
}

function addFilter(filters: SVGElement, id: string) {
	const filter = document.createElementNS(namespace, "filter");
	const transfer = document.createElementNS(namespace, "feComponentTransfer");
	const channels = (["feFuncR", "feFuncG", "feFuncB"] as const).map((name) => {
		const channel = document.createElementNS(namespace, name);

		channel.setAttribute("type", "linear");

		return channel;
	});

	filter.id = id;
	filter.setAttribute("color-interpolation-filters", "sRGB");
	transfer.append(...channels);
	filter.append(transfer);
	filters.append(filter);

	return (gains: Color) => {
		for (const [index, channel] of channels.entries()) {
			channel.setAttribute("slope", gains[index].toFixed(3));
		}
	};
}

function animateShifts(shifts: Shift[], transition: ViewTransition) {
	const animation = document
		.getAnimations()
		.find(
			({ effect }) =>
				effect instanceof KeyframeEffect &&
				effect.pseudoElement === "::view-transition-old(portrait)",
		);

	if (!animation) {
		return;
	}

	const root = document.documentElement;
	const filters = document.createElementNS(namespace, "svg");
	const setters = shifts.map(({ gains, layer }) => ({
		gains,
		setNew: addFilter(filters, `tone-new-${layer}`),
		setOld: addFilter(filters, `tone-old-${layer}`),
	}));
	let frame = 0;

	const step = () => {
		const progress = animation.effect?.getComputedTiming().progress ?? 1;

		for (const { gains, setNew, setOld } of setters) {
			setOld(gains.map((gain) => gain ** progress));
			setNew(gains.map((gain) => gain ** (progress - 1)));
		}

		frame = requestAnimationFrame(step);
	};

	const stop = () => {
		cancelAnimationFrame(frame);
		filters.remove();
		delete root.dataset.shiftingTones;
	};

	filters.ariaHidden = "true";
	filters.style.height = "0";
	filters.style.position = "absolute";
	filters.style.width = "0";
	document.body.append(filters);
	root.dataset.shiftingTones = shifts.map(({ layer }) => layer).join(" ");
	step();
	transition.finished.then(stop, stop);
}

function findLayer(page: Document, layer: string) {
	return page.querySelector<HTMLElement>(`[data-layer=${layer}]`);
}

/** Only pages that have been shown have styles, but backdrops are the same on each. */
function getBackdropColor(element: HTMLElement | null, shownPage: Document) {
	const backdrop = findLayer(shownPage, "backdrop");
	if (!backdrop || !element) {
		return undefined;
	}

	const color = getComputedStyle(backdrop).backgroundColor.match(/[\d.]+/g);
	const scene = getTone(element);

	return color
		?.slice(0, 3)
		.map((channel, index) =>
			scene
				? Number(channel) * (1 - sceneOpacity) + scene[index] * sceneOpacity
				: Number(channel),
		);
}

function getGains(from: Color, to: Color): Color {
	return from.map((channel, index) =>
		Math.min(
			maximumGain,
			Math.max(1 / maximumGain, to[index] / Math.max(1, channel)),
		),
	);
}

function getTone(element: HTMLElement | null): Color | undefined {
	return element?.dataset.tone?.split(" ").map(Number);
}
