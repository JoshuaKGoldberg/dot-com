import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #398 Mona Sans: the headline breaks into two deliberate lines
export const activate = withType(base, {
	title: "<span class=\"ty-l\">Hello.</span> <span class=\"ty-l\">I’m Josh.</span>",
	preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"],
});
