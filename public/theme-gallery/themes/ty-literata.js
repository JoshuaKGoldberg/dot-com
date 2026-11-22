import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #391 Literata, one family across its axes
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
