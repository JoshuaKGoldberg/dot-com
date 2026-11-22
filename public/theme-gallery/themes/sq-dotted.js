import { activate as base } from "./rn-dark-tuned.js";
import { withSq } from "./_sq/sq.js";
import { SPECS } from "./_sq/specs.js";

// #464 sq-dotted: #452 rn-dark-tuned, unchanged except for the link squiggles
export const activate = withSq(base, SPECS.dotted);
