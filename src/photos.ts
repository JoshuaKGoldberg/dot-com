/** Where the photos' originals are hosted, so they don't bloat this repository. */
const photosOrigin =
	"https://raw.githubusercontent.com/JoshuaKGoldberg/talk-files/main/photos/";

export interface Photo {
	alt: string;

	/** Who took the photo, when they're known. */
	credit?: string;

	/** When the photo was taken, as an ISO date. */
	date: string;

	event: string;

	/** Pixel size of the original. */
	height: number;

	/** File name under {@link photosOrigin}, without its .jpg extension. */
	name: string;

	/** Pixel size of the original. */
	width: number;
}

export function getPhotoUrl(photo: Photo) {
	return new URL(`${photo.name}.jpg`, photosOrigin).href;
}

/** Newest first. */
export const photos: Photo[] = [
	{
		alt: "Josh on stage in a blue sweater covered in geese, grinning up at the screen while raising his clicker and holding a microphone",
		credit: "Vita Phoenix Events",
		date: "2026-11-17",
		event: "React Summit US 2026",
		height: 683,
		name: "2026-11-17-react-summit-us-pointing",
		width: 1024,
	},
	{
		alt: "Josh mid-sentence into a microphone in a blue goose-patterned sweater, in front of a softly lit backdrop",
		credit: "Vita Phoenix Events",
		date: "2026-11-17",
		event: "React Summit US 2026",
		height: 1536,
		name: "2026-11-17-react-summit-us-speaking",
		width: 1024,
	},
	{
		alt: "Josh smiling as he speaks into a microphone, clicker in hand, wearing a blue goose-patterned sweater",
		credit: "Vita Phoenix Events",
		date: "2026-11-17",
		event: "React Summit US 2026",
		height: 683,
		name: "2026-11-17-react-summit-us-smiling",
		width: 1024,
	},
	{
		alt: "Josh seated on stage in a blue goose-patterned sweater, smiling during a Q&A beside a host in a yellow beanie",
		credit: "Vita Phoenix Events",
		date: "2026-11-17",
		event: "React Summit US 2026",
		height: 683,
		name: "2026-11-17-react-summit-us-q-and-a",
		width: 1024,
	},
	{
		alt: "Josh in a silver space suit, microphone in hand, smirking at the camera during an on-stage conversation",
		credit: "Vita Phoenix Events",
		date: "2024-11-19",
		event: "React Summit US 2024",
		height: 683,
		name: "2024-11-19-react-summit-us-q-and-a",
		width: 1024,
	},
	{
		alt: "Josh in a shiny silver space suit speaking into a microphone on a dark stage, with a host standing beside him",
		credit: "Vita Phoenix Events",
		date: "2024-11-19",
		event: "React Summit US 2024",
		height: 683,
		name: "2024-11-19-react-summit-us-space-suit",
		width: 1024,
	},
	{
		alt: "Josh mid-sentence on stage under green lights in a light patterned shirt, beside the podium and his slides",
		date: "2024-06-14",
		event: "React Summit 2024",
		height: 1667,
		name: "2024-06-14-react-summit-green-lights",
		width: 2500,
	},
	{
		alt: "Josh mid-talk on a dark stage with one hand raised high, beside the React Summit podium and a wall of sponsor logos",
		date: "2024-06-14",
		event: "React Summit 2024",
		height: 2500,
		name: "2024-06-14-react-summit-hand-up",
		width: 1667,
	},
	{
		alt: "Josh throwing both fists up in triumph on a dark stage, grinning in a pink patterned shirt and an orange lanyard",
		credit: "revo.js",
		date: "2023-10-06",
		event: "revo.js 2023",
		height: 1066,
		name: "2023-10-06-revo-js-arms-up",
		width: 1599,
	},
	{
		alt: "Josh smiling as he points up and out in front of a starry backdrop, in a green sweater over a plaid shirt",
		credit: "revo.js",
		date: "2023-10-05",
		event: "revo.js 2023",
		height: 1080,
		name: "2023-10-05-revo-js-pointing",
		width: 810,
	},
	{
		alt: "Josh grinning with one arm flung up toward a giant screen of code, beside his sticker-covered laptop",
		credit: "JSDay IE",
		date: "2023-09-26",
		event: "JSDay IE 2023",
		height: 1365,
		name: "2023-09-26-jsday-ie-arm-up",
		width: 2048,
	},
	{
		alt: "Josh beaming and waving at the audience from beside the podium, with code on the projector screen behind him",
		credit: "Tiffany Marie Photo",
		date: "2023-06-22",
		event: "KCDC 2023",
		height: 3523,
		name: "2023-06-22-kcdc-waving",
		width: 5285,
	},
	{
		alt: "Josh smiling with his hands spread wide on a bright pink stage, in a dark patterned t-shirt",
		credit: "K. Adam White",
		date: "2023-03-16",
		event: "StaffPlus NYC 2023",
		height: 1915,
		name: "2023-03-16-staffplus-nyc-smiling",
		width: 1915,
	},
];
