import type { KnipConfig } from "knip";

export default {
	ignoreExportsUsedInFile: { interface: true, type: true },
	treatConfigHintsAsErrors: true,
	typescript: {
		config: ["tsconfig.json", "worker/tsconfig.json"],
	},
} satisfies KnipConfig;
