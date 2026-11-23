/** Longest that images may hold up a new page. */
const patience = 300;

/**
 * Gets the images of a new page's portrait ready to be shown the moment that it is.
 * Any that take too long will show up on the page instead, as on a full page load.
 */
export async function decodePortrait(page: Document) {
	const decoding = Promise.all(
		Array.from(
			page.querySelectorAll<HTMLImageElement>("[data-layer] img"),
			async (image) => {
				const preloaded = new Image();
				preloaded.srcset = image.srcset;
				preloaded.src = image.src;

				try {
					await preloaded.decode();
					image.decoding = "sync";
				} catch {
					// The page itself will show it in whatever way it can
				}
			},
		),
	);

	await Promise.race([
		decoding,
		new Promise((resolve) => setTimeout(resolve, patience)),
	]);
}
