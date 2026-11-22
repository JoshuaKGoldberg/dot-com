import { makeHp } from "./_hp/hp.js";
import { fadeBg } from "./_hp/fx-bg.js";

// #481 hp-fade-bg: #479 sq-favorite with only the hero portrait replaced
export const activate = makeHp(fadeBg);
