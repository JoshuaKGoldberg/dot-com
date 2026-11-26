/** Where the photos' originals are hosted, so they don't bloat this repository. */
const photosOrigin =
	"https://raw.githubusercontent.com/JoshuaKGoldberg/talk-files/main/photos/";

export interface Photo {
	alt: string;

	/** Who took the photo, when they're known. */
	credit?: string;

	event: string;

	/** Pixel size of the original. */
	height: number;

	/** File name under {@link photosOrigin}, without its .jpg extension. */
	name: string;

	/**
	 * When the photo was taken, as an ISO timestamp in its camera's time zone.
	 * Photos that lost their metadata use when they were first posted instead.
	 */
	takenAt: string;

	/** Pixel size of the original. */
	width: number;
}

export function getPhotoUrl(photo: Photo) {
	return new URL(`${photo.name}.jpg`, photosOrigin).href;
}

/** Newest first. */
export const photos = (
	[
		{
			alt: "Josh grinning and waving in a purple Tinky Winky costume, holding his sticker-covered laptop",
			credit: "Ramsey Chappell Photography",
			event: "MagnoliaConf 2025",
			height: 5390,
			name: "2025-10-22-magnolia-conf-waving",
			takenAt: "2025-10-22T13:15:43-06:00",
			width: 3593,
		},
		{
			alt: "Josh smiling and pointing at the camera in a purple Tinky Winky costume, holding his sticker-covered laptop",
			credit: "Ramsey Chappell Photography",
			event: "MagnoliaConf 2025",
			height: 5204,
			name: "2025-10-22-magnolia-conf-pointing",
			takenAt: "2025-10-22T13:15:32-06:00",
			width: 3469,
		},
		{
			alt: "Josh smiling in profile on a podcast set under a MagnoliaConf banner, in a ghost-print shirt, beside a guest in a horror mask",
			credit: "Ramsey Chappell Photography",
			event: "MagnoliaConf 2025",
			height: 3648,
			name: "2025-10-22-magnolia-conf-podcast",
			takenAt: "2025-10-22T10:33:19-06:00",
			width: 5472,
		},
		{
			alt: "Josh on stage in a blue sweater covered in geese, grinning up at the screen while raising his clicker and holding a microphone",
			credit: "Vita Phoenix Events",
			event: "React Summit US 2026",
			height: 683,
			name: "2026-11-17-react-summit-us-pointing",
			takenAt: "2026-11-17T17:14:46-05:00",
			width: 1024,
		},
		{
			alt: "Josh mid-sentence into a microphone in a blue goose-patterned sweater, in front of a softly lit backdrop",
			credit: "Vita Phoenix Events",
			event: "React Summit US 2026",
			height: 1536,
			name: "2026-11-17-react-summit-us-speaking",
			takenAt: "2026-11-17T17:13:21-05:00",
			width: 1024,
		},
		{
			alt: "Josh smiling as he speaks into a microphone, clicker in hand, wearing a blue goose-patterned sweater",
			credit: "Vita Phoenix Events",
			event: "React Summit US 2026",
			height: 683,
			name: "2026-11-17-react-summit-us-smiling",
			takenAt: "2026-11-17T17:11:35-05:00",
			width: 1024,
		},
		{
			alt: "Josh seated on stage in a blue goose-patterned sweater, smiling during a Q&A beside a host in a yellow beanie",
			credit: "Vita Phoenix Events",
			event: "React Summit US 2026",
			height: 683,
			name: "2026-11-17-react-summit-us-q-and-a",
			takenAt: "2026-11-17T17:39:47-05:00",
			width: 1024,
		},
		{
			alt: "Josh in a silver space suit, microphone in hand, smirking at the camera during an on-stage conversation",
			credit: "Vita Phoenix Events",
			event: "React Summit US 2024",
			height: 683,
			name: "2024-11-19-react-summit-us-q-and-a",
			takenAt: "2024-11-19T14:26:27-05:00",
			width: 1024,
		},
		{
			alt: "Josh in a shiny silver space suit speaking into a microphone on a dark stage, with a host standing beside him",
			credit: "Vita Phoenix Events",
			event: "React Summit US 2024",
			height: 683,
			name: "2024-11-19-react-summit-us-space-suit",
			takenAt: "2024-11-19T14:02:18-05:00",
			width: 1024,
		},
		{
			alt: "Josh mid-sentence on stage under green lights in a light patterned shirt, beside the podium and his slides",
			event: "React Summit 2024",
			height: 1667,
			name: "2024-06-14-react-summit-green-lights",
			takenAt: "2024-06-14T14:54:19+01:00",
			width: 2500,
		},
		{
			alt: "Josh mid-talk on a dark stage with one hand raised high, beside the React Summit podium and a wall of sponsor logos",
			event: "React Summit 2024",
			height: 2500,
			name: "2024-06-14-react-summit-hand-up",
			takenAt: "2024-06-14T14:56:39+01:00",
			width: 1667,
		},
		{
			alt: "Josh throwing both fists up in triumph on a dark stage, grinning in a pink patterned shirt and an orange lanyard",
			credit: "revo.js",
			event: "revo.js 2023",
			height: 1066,
			name: "2023-10-06-revo-js-arms-up",
			takenAt: "2023-10-06T09:54:04+03:00",
			width: 1599,
		},
		{
			alt: "Josh smiling as he points up and out in front of a starry backdrop, in a green sweater over a plaid shirt",
			credit: "revo.js",
			event: "revo.js 2023",
			height: 1080,
			name: "2023-10-05-revo-js-pointing",
			takenAt: "2023-10-05T13:06:51+03:00",
			width: 810,
		},
		{
			alt: "Josh grinning with one arm flung up toward a giant screen of code, beside his sticker-covered laptop",
			credit: "JSDay IE",
			event: "JSDay IE 2023",
			height: 1365,
			name: "2023-09-26-jsday-ie-arm-up",
			takenAt: "2023-09-26T12:03:41+01:00",
			width: 2048,
		},
		{
			alt: "Josh smiling with his hands spread wide on a bright pink stage, in a dark patterned t-shirt",
			credit: "K. Adam White",
			event: "StaffPlus NYC 2023",
			height: 1915,
			name: "2023-03-16-staffplus-nyc-smiling",
			takenAt: "2023-03-16T14:50:15-04:00",
			width: 1915,
		},
	] satisfies Photo[]
).sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
