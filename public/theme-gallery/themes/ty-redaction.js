import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #392 Redaction + Commit Mono + Hanken Grotesk
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"] });
