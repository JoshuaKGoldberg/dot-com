export const fadeMilliseconds = 350;
const startingGraceMilliseconds = 100;

export const maximumFadeMilliseconds =
	fadeMilliseconds + startingGraceMilliseconds;

const timing = `${fadeMilliseconds.toString()}ms ease-in-out`;

/** Text is quicker, as partway through it's the same color as what's behind it. */
const textTiming = "150ms linear 100ms";

const textProperty =
	/^--(?:astro-code|color(?!Background|Subtle)|font|icon|lit)/;

/** Only custom properties that are registered with their types can transition. */
const types = [
	{ initialValue: "0", matches: isNumber, syntax: "<number>" },
	{ initialValue: "transparent", matches: isColor, syntax: "<color>" },
];

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
		transition = createTransition(getComputedStyle(root));

		// Values from before registering can't be transitioned from, so this computes new ones
		getComputedStyle(root).getPropertyValue("--colorBackground");
	}

	root.dataset.themeFading = "";
	root.style.transition = transition;
	root.style.transitionBehavior = "allow-discrete";

	clearTimeout(timer);
	timer = setTimeout(() => {
		delete root.dataset.themeFading;
		root.style.removeProperty("transition");
	}, maximumFadeMilliseconds);
}

function createTransition(styles: CSSStyleDeclaration) {
	// Reading is slow after registering, so everything's read first
	const properties = getThemedProperties()
		.map((name) => ({ name, value: styles.getPropertyValue(name) }))
		.filter(({ name, value }) => register(name, value))
		.map(({ name }) => name);

	return [
		`color-scheme ${timing}`,
		...properties.map(
			(name) => `${name} ${textProperty.test(name) ? textTiming : timing}`,
		),
	].join(", ");
}

function getRules(rules: CSSRuleList): CSSStyleRule[] {
	return Array.from(rules).flatMap((rule) =>
		rule instanceof CSSStyleRule
			? rule
			: rule instanceof CSSGroupingRule
				? getRules(rule.cssRules)
				: [],
	);
}

function getThemedProperties() {
	return Array.from(document.styleSheets)
		.filter(({ href }) => !href || new URL(href).origin === location.origin)
		.flatMap((sheet) => getRules(sheet.cssRules))
		.filter((rule) => rule.selectorText === "html.dark")
		.flatMap((rule) => Array.from(rule.style))
		.filter((name) => name.startsWith("--"));
}

function isColor(value: string) {
	return CSS.supports("color", value);
}

function isNumber(value: string) {
	return !Number.isNaN(Number(value));
}

function register(name: string, value: string) {
	const type = types.find(({ matches }) => matches(value));
	if (!type) {
		return false;
	}

	const { initialValue, syntax } = type;

	CSS.registerProperty({ inherits: true, initialValue, name, syntax });

	return true;
}
