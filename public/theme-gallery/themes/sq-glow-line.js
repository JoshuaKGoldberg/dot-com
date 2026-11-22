import { activate as base } from "./rn-dark-tuned.js";
import { withSq } from "./_sq/sq.js";
import { SPECS } from "./_sq/specs.js";

// #473 sq-glow-line: #452 rn-dark-tuned, unchanged except for the link squiggles
export const activate = withSq(base, SPECS.glowLine);
