import { disposer, mountBase } from "./_dl-b/base.js";
import { filings } from "./_dl-b/filings.js";

export function activate({ root, reducedMotion }) {
	const d = disposer();
	const { dark } = mountBase({ root, reducedMotion, d });
	filings(root, d, { dark, reducedMotion });
	return () => d.run();
}
