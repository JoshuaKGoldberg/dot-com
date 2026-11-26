import { patchCssModules } from "vite-css-modules";

// Only read by `pnpm build:css-types`, which writes a .d.ts next to each CSS module.
// Its CSS modules options should match any `vite.css.modules` options in astro.config.ts.
export default {
	plugins: [patchCssModules({ exportMode: "default" })],
};
