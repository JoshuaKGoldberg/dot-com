import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #406 Cormorant Garamond + Jost
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
