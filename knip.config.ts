import type { KnipConfig } from "knip";

export default {
	// Read by vite-css-modules in the build:css-types script
	entry: ["css-modules.config.ts"],
	ignoreExportsUsedInFile: { interface: true, type: true },
	treatConfigHintsAsErrors: true,
	typescript: {
		config: ["tsconfig.json", "worker/tsconfig.json"],
	},
} satisfies KnipConfig;
