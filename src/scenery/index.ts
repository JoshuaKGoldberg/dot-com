import { AuroraBand } from "./aurora/AuroraBand";
import { defineScenery } from "./defineScenery";
import { LitLinks } from "./links/LitLinks";
import { HeroPortrait } from "./portrait/HeroPortrait";
import { SquiggleOverlay } from "./squiggles/SquiggleOverlay";
import { StarField } from "./stars/StarField";

defineScenery("aurora-band", (host, signal) => new AuroraBand(host, signal));
defineScenery(
	"hero-portrait",
	(host, signal) => new HeroPortrait(host, signal),
);
defineScenery("squiggle-overlay", (host, signal) => {
	new LitLinks(signal);
	new SquiggleOverlay(host, signal);
});
defineScenery("star-field", (host, signal) => new StarField(host, signal));
