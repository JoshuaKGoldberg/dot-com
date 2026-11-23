/** How long it takes for anything other than text to change themes. */
export const fadeMilliseconds = 350;

/** Text is quicker, as partway through it's the same color as what's behind it. */
const textTiming = "150ms linear 100ms";
const timing = `${fadeMilliseconds.toString()}ms ease-in-out`;

/** Time after a fade before styles stop expecting one, as it doesn't start right away. */
const grace = 100;

const textProperties = {
	"<color>": [
		"--astro-code-color-deleted",
		"--astro-code-color-inserted",
		"--astro-code-color-text",
		"--astro-code-token-comment",
		"--astro-code-token-constant",
		"--astro-code-token-function",
		"--astro-code-token-keyword",
		"--astro-code-token-link",
		"--astro-code-token-parameter",
		"--astro-code-token-punctuation",
		"--astro-code-token-string",
		"--astro-code-token-string-expression",
		"--colorEmphasized",
		"--colorFaint",
		"--colorForeground",
		"--colorForegroundExtra",
		"--colorMuted",
	],
	"<length>": ["--letterSpacing"],
	"<number>": ["--fontWeightLight", "--iconInversion", "--lineHeightParagraph"],
};

const otherProperties = {
	"<color>": [
		"--auroraCornflower",
		"--auroraJade",
		"--auroraRose",
		"--auroraWisteria",
		"--colorBackground",
		"--colorSubtle",
		"--curtainCornflower",
		"--curtainJade",
		"--curtainRose",
		"--curtainWisteria",
		"--discBottom",
		"--discGlow",
		"--discMiddle",
		"--discTop",
		"--ringCornflower",
		"--ringJade",
		"--ringRose",
		"--ringShine",
		"--ringWisteria",
		"--squiggleEnd",
		"--squiggleHighlight",
		"--squiggleMiddle",
		"--squiggleStart",
	],
	"<number>": ["--curtainSaturation", "--curtainStrength", "--haloStrength"],
};

const initialValues: Record<string, string> = {
	"<color>": "transparent",
	"<length>": "0px",
	"<number>": "0",
};

let timer: ReturnType<typeof setTimeout> | undefined;
let transition: string | undefined;

/**
 * Makes the theme change that's about to happen a gradual one.
 *
 * The root's custom properties are what transition, rather than each element that
 * uses them, so that everything on the page changes in unison.
 */
export function fadeTheme() {
	const root = document.documentElement;

	if (!transition) {
		transition = createTransition();

		// Nothing transitions from values that were from before it was registered
		getComputedStyle(root).getPropertyValue("--colorBackground");
	}

	root.dataset.themeFading = "";
	root.style.transition = transition;

	clearTimeout(timer);
	timer = setTimeout(() => {
		delete root.dataset.themeFading;
		root.style.removeProperty("transition");
	}, fadeMilliseconds + grace);
}

/** Only custom properties with known types can transition, so this registers them. */
function createTransition() {
	return [
		...register(otherProperties).map((name) => `${name} ${timing}`),
		...register(textProperties).map((name) => `${name} ${textTiming}`),
	].join(", ");
}

function register(properties: Record<string, string[]>) {
	return Object.entries(properties).flatMap(([syntax, names]) => {
		for (const name of names) {
			CSS.registerProperty({
				inherits: true,
				initialValue: initialValues[syntax],
				name,
				syntax,
			});
		}

		return names;
	});
}
