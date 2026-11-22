import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #399 Gambetta + Host Grotesk
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdn.fontshare.com", "https://api.fontshare.com"] });
