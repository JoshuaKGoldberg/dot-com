import { AuroraBand } from "./aurora/AuroraBand";
import { defineScenery } from "./defineScenery";
import { ActiveLinks } from "./links/ActiveLinks";
import { HeroPortrait } from "./portrait/HeroPortrait";
import { SquiggleOverlay } from "./squiggles/SquiggleOverlay";
import { StarField } from "./stars/StarField";

defineScenery("aurora-band", (host, signal) => new AuroraBand(host, signal));
defineScenery(
	"hero-portrait",
	(host, signal) => new HeroPortrait(host, signal),
);
defineScenery("squiggle-overlay", (host, signal) => {
	new ActiveLinks(signal);
	new SquiggleOverlay(host, signal);
});
defineScenery("star-field", (host, signal) => new StarField(host, signal));
