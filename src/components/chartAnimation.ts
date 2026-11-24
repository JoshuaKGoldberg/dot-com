export const chartAnimation = {
	duration: () =>
		document.documentElement.dataset.motion === "playing" ? 1000 : 0,
};
