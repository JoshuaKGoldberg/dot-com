import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #402 Specimen: Cormorant Garamond + Source Serif 4 + Courier Prime
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
