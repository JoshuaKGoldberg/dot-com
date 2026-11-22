import type { KnipConfig } from "knip";

export default {
	ignore: ["public/theme-gallery/**"],
	ignoreExportsUsedInFile: { interface: true, type: true },
	treatConfigHintsAsErrors: true,
	typescript: {
		config: ["tsconfig.json", "worker/tsconfig.json"],
	},
} satisfies KnipConfig;
