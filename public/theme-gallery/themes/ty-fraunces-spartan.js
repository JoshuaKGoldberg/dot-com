import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #405 Fraunces (SOFT) + League Spartan
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
