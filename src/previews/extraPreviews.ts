import type { PortraitName } from "~/portraits";

import { photosDescription } from "~/constants";

interface ExtraPreview {
	portrait: PortraitName;
	subtitle: string;
	title: string;
}

/** Preview images for pages that borrow another page's portrait. */
export const extraPreviews = {
	photos: {
		portrait: "speaking",
		subtitle: photosDescription,
		title: "Photos",
	},
} satisfies Record<string, ExtraPreview>;

export type ExtraPreviewName = keyof typeof extraPreviews;
