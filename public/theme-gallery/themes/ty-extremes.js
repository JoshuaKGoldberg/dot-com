import { activate as base } from "./gd-bloom.js";
import { withType } from "./_type/with-type.js";

// #390 Anybody: weight and width extremes in one variable family
export const activate = withType(base, { preconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
