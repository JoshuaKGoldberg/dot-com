import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #387 Source Serif 4 + Source Sans 3
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
