import { Dwell } from "./Dwell";

/**
 * How long the pointer has lingered near the start of the page.
 *
 * The top aurora advances this as it brightens, and the header's lit links
 * change their colors to stay readable in front of it.
 */
export const headerDwell = new Dwell();
