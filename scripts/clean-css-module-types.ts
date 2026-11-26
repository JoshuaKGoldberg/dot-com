// Removes generated .d.ts files for CSS modules that no longer exist, such as after
// deleting, renaming, or switching branches, so imports of them don't still type check.
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

for (const file of readdirSync("src", {
	recursive: true,
	withFileTypes: true,
})) {
	if (
		file.name.endsWith(".module.css.d.ts") &&
		!existsSync(join(file.parentPath, file.name.slice(0, -".d.ts".length)))
	) {
		rmSync(join(file.parentPath, file.name));
	}
}
