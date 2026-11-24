const maximumWaitMilliseconds = 300;

/**
 * Gets the images of a new page's portrait ready to be shown the moment that it is.
 * Any that fail or take too long show up whenever they can, as on a full page load.
 */
export async function decodePortrait(page: Document) {
	const decoding = Promise.all(
		Array.from(
			page.querySelectorAll<HTMLImageElement>("[data-layer] img"),
			async (image) => {
				const preloaded = new Image();
				preloaded.sizes = image.sizes;
				preloaded.srcset = image.srcset;
				preloaded.src = image.src;

				await preloaded.decode();
				image.decoding = "sync";
			},
		),
	).catch(() => undefined);

	await Promise.race([
		decoding,
		new Promise((resolve) => setTimeout(resolve, maximumWaitMilliseconds)),
	]);
}
