/** Longest that images may hold up a new page. */
const patience = 300;

/**
 * Gets a new page's most important images ready to be shown the moment that it is.
 * Any that take too long will ease in on the page instead, as on a full page load.
 */
export async function decodeReveals(page: Document) {
	const decoding = Promise.all(
		Array.from(
			page.querySelectorAll<HTMLElement>("[data-reveal]"),
			async (reveal) => {
				const image = reveal.querySelector("img");
				if (!image) {
					return;
				}

				const preloaded = new Image();
				preloaded.srcset = image.srcset;
				preloaded.src = image.src;

				try {
					await preloaded.decode();
					image.decoding = "sync";
					reveal.dataset.reveal = "ready";
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
