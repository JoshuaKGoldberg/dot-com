import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #401 Cormorant Garamond + Albert Sans + IBM Plex Mono
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
