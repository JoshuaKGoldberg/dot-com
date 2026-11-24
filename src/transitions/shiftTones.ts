type Color = readonly number[];

const namespace = "http://www.w3.org/2000/svg";

/** Farthest that a channel is brightened or darkened, so that people stay recognizable. */
const maximumGain = 2.2;

/**
 * Shifts the colors of people between pages, as one transitions into another.
 * The old one's become the new one's, which start off as the old one's, so that
 * they're of the same average color the whole way through.
 */
export function shiftTones(
	oldPage: Document,
	newPage: Document,
	transition: ViewTransition,
) {
	const from = getTone(oldPage);
	const to = getTone(newPage);

	if (!from || !to) {
		return;
	}

	transition.ready.then(
		() => {
			animateShift(getGains(from, to), transition);
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

function animateShift(gains: Color, transition: ViewTransition) {
	const animation = document
		.getAnimations()
		.find(
			({ effect }) =>
				effect instanceof KeyframeEffect &&
				effect.pseudoElement === "::view-transition-old(portrait-figure)",
		);

	if (!animation) {
		return;
	}

	const root = document.documentElement;
	const filters = document.createElementNS(namespace, "svg");
	const setNew = addFilter(filters, "tone-new");
	const setOld = addFilter(filters, "tone-old");
	let frame = 0;

	const step = () => {
		const progress = animation.effect?.getComputedTiming().progress ?? 1;

		setOld(gains.map((gain) => gain ** progress));
		setNew(gains.map((gain) => gain ** (progress - 1)));
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
	root.dataset.shiftingTones = "";
	step();
	transition.finished.then(stop, stop);
}

function getGains(from: Color, to: Color): Color {
	return from.map((channel, index) =>
		Math.min(
			maximumGain,
			Math.max(1 / maximumGain, to[index] / Math.max(1, channel)),
		),
	);
}

function getTone(page: Document): Color | undefined {
	return page
		.querySelector<HTMLElement>("[data-layer=figure]")
		?.dataset.tone?.split(" ")
		.map(Number);
}
