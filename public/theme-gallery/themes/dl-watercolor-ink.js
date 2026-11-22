import { disposer, mountBase } from "./_dl-b/base.js";
import { ink } from "./_dl-b/ink.js";
import { pigmentBleed } from "./_dl-b/squiggles.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const { dark } = mountBase({ root, reducedMotion, d });
	pigmentBleed(root, d, { dark, reducedMotion });
	ink(root, d, { dark, reducedMotion });
	return () => d.run();
}
