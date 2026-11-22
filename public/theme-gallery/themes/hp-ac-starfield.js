import { makeHp } from "./_hp/hp.js";
import { acStarfield } from "./_hp/ac.js";

// #518 hp-ac-starfield: #517 with #514 constellation nodes (more, smaller) and a slow time-scale ramp
export const activate = makeHp(acStarfield);
