/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
	interface Locals {
		/** Whether the page has already rendered a labeled image. */
		hasLabeledImage?: boolean;
	}
}
