import type { Element, ElementContent, Parents, Root } from "hast";

/** Words and inline elements before references short enough to keep on the same lines as them. */
const maximumTakenLength = 25;

/** Elements that can go inside a paragraph, as footnotes' popovers are put next to their references. */
const phrasing = new Set([
	"a",
	"abbr",
	"b",
	"br",
	"cite",
	"code",
	"del",
	"em",
	"i",
	"img",
	"kbd",
	"mark",
	"q",
	"s",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"u",
]);

/** Elements whose text is used elsewhere or that can't hold buttons, so references in them stay as links. */
const keepsLinks = new Set([
	"a",
	"button",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"label",
	"summary",
]);

interface Reference {
	link: Element;
	parent: Parents;
	sup: Element;
}

/**
 * Lets each footnote reference open its footnote in a popover beside it,
 * rather than sending readers down to the bottom of the page and back.
 * The footnotes stay listed at the bottom of the page too, such as for printing.
 * @see https://jakearchibald.com/2025/give-footnotes-the-boot
 */
export function rehypeFootnotePopovers() {
	return (tree: Root) => {
		const definitions = new Map<string, Element>();
		const references: Reference[] = [];

		visit(tree, [], (node, ancestors) => {
			// GFM puts each reference's link in a <sup>
			const link = node.children.at(0);
			const parent = ancestors.at(-1);

			if (
				node.tagName === "sup" &&
				link?.type === "element" &&
				link.properties.dataFootnoteRef !== undefined &&
				parent &&
				!ancestors.some((ancestor) => keepsLinks.has(getTagName(ancestor)))
			) {
				references.push({ link, parent, sup: node });
			} else if (
				node.tagName === "li" &&
				typeof node.properties.id === "string"
			) {
				definitions.set(node.properties.id, node);
			}
		});

		for (const [index, { link, parent, sup }] of references.entries()) {
			const definition = definitions.get(String(link.properties.href).slice(1));
			const content = definition && createPopoverContent(definition);

			if (!content) {
				continue;
			}

			const [leading, trailing] = takeNeighbors(parent, sup);
			const number = String(index + 1);
			const anchorName = `--footnote-${number}`;
			const label = toText(link);
			const popoverId = `${String(link.properties.id)}-popover`;

			// The id stays on what's always shown, for the links back from the bottom of the page to focus
			replace(sup, link.properties.id, [
				...leading,
				h(
					"a",
					{
						ariaDescribedBy: link.properties.ariaDescribedBy,
						dataFootnoteFallback: "",
						href: link.properties.href,
					},
					[text(label)],
				),
				h(
					"button",
					{
						ariaLabel: `Footnote ${label}`,
						dataFootnoteRef: "",
						popoverTarget: popoverId,
						style: `anchor-name: ${anchorName}`,
						type: "button",
					},
					[text(label)],
				),
				h(
					"span",
					{
						dataFootnotePopover: "",
						id: popoverId,
						popover: "",
						role: "note",
						style: `position-anchor: ${anchorName}`,
					},
					[
						// Content scrolls inside of the popover, so its close button doesn't scroll away
						h("span", { dataFootnoteContent: "" }, content),
						h(
							"button",
							{
								ariaLabel: `Close footnote ${label}`,
								dataFootnoteClose: "",
								popoverTarget: popoverId,
								popoverTargetAction: "hide",
								type: "button",
							},
							[text("×")],
						),
					],
				),
				...trailing,
			]);
		}
	};
}

/**
 * Copies phrasing content, or returns undefined if there's anything else.
 * That includes MDX's JSX and expressions, which this doesn't know how to copy.
 */
function copyPhrasing(nodes: ElementContent[]): ElementContent[] | undefined {
	const copies: ElementContent[] = [];

	for (const node of nodes) {
		// Other plugins can add node types that hast's types don't know of
		const type: string = node.type;

		if (type === "comment") {
			continue;
		}

		if (node.type === "text") {
			copies.push({ ...node });
			continue;
		}

		if (node.type !== "element") {
			return undefined;
		}

		// Links back to the reference are the button that opened the popover
		if (node.properties.dataFootnoteBackref !== undefined) {
			continue;
		}

		if (!phrasing.has(node.tagName)) {
			return undefined;
		}

		const children = copyPhrasing(node.children);
		if (!children) {
			return undefined;
		}

		// Ids are already used by the footnotes at the bottom of the page
		const properties = { ...node.properties };
		delete properties.id;

		copies.push({ ...node, children, properties });
	}

	return copies;
}

/**
 * Copies a footnote's paragraphs as blocks of phrasing content, as they'll be inside a paragraph.
 * Footnotes with anything else, such as lists or code blocks, keep linking to the bottom of the page.
 */
function createPopoverContent(definition: Element) {
	const content: ElementContent[] = [];

	for (const child of definition.children) {
		if (child.type !== "element") {
			continue;
		}

		if (child.tagName !== "p") {
			return undefined;
		}

		const children = copyPhrasing(child.children);
		if (!children) {
			return undefined;
		}

		content.push(h("span", { dataFootnoteParagraph: "" }, trimEnd(children)));
	}

	return content.length ? content : undefined;
}

/** Gets the tag name of an element, including those written as JSX in MDX. */
function getTagName(node: Parents) {
	return node.type === "element"
		? node.tagName
		: "name" in node && typeof node.name === "string"
			? node.name
			: "";
}

function h(
	tagName: string,
	properties: Element["properties"],
	children: ElementContent[],
): Element {
	return { children, properties, tagName, type: "element" };
}

/** Whether a node is a reference or a short inline element that can be kept on its line. */
function isTakeable(node: Parents["children"][number] | undefined) {
	return (
		node?.type === "element" &&
		(node.properties.dataFootnoteReference !== undefined ||
			(phrasing.has(node.tagName) &&
				node.tagName !== "br" &&
				toText(node).length <= maximumTakenLength))
	);
}

function replace(
	node: Element,
	id: string | undefined,
	replacements: ElementContent[],
) {
	node.tagName = "span";
	node.properties = { dataFootnoteReference: "", id, tabIndex: -1 };
	node.children = replacements;
}

/**
 * Takes what's right before and any punctuation after, so references don't wrap onto their own lines.
 * That's the word before, or a short inline element or reference right before.
 */
function takeNeighbors(parent: Parents, node: Element) {
	const leading: ElementContent[] = [];
	const trailing: ElementContent[] = [];
	let index = parent.children.indexOf(node);

	const at = (offset: number) =>
		index + offset >= 0 ? parent.children.at(index + offset) : undefined;

	const take = () => {
		const [taken] = parent.children.splice(index - 1, 1) as ElementContent[];
		leading.unshift(taken);
		index -= 1;
	};

	const before = at(-1);

	if (before?.type === "text" && !before.value.trim() && isTakeable(at(-2))) {
		// Such as the space in "[^a] [^b]" or "`code` [^a]"
		take();
		take();
	} else if (before?.type === "text") {
		const [, word = "", space = ""] = /(\S*)(\s*)$/.exec(before.value) ?? [];
		// Long words, such as package names, need to wrap on narrow screens
		const taken = word.length > maximumTakenLength ? space : word + space;
		before.value = before.value.slice(0, before.value.length - taken.length);
		leading.push(text(taken));
	} else if (isTakeable(before)) {
		take();
	}

	const after = at(1);

	if (after?.type === "text") {
		const punctuation = /^[!),.:;?\]…]*/.exec(after.value)?.[0] ?? "";
		after.value = after.value.slice(punctuation.length);
		trailing.push(text(punctuation));
	}

	return [leading, trailing];
}

function text(value: string) {
	return { type: "text", value } as const;
}

function toText(node: ElementContent): string {
	return node.type === "text"
		? node.value
		: "children" in node
			? node.children.map(toText).join("")
			: "";
}

/** Removes the space that was before the links back to references. */
function trimEnd(nodes: ElementContent[]) {
	let last = nodes.at(-1);

	while (last?.type === "text") {
		last.value = last.value.trimEnd();

		if (last.value) {
			break;
		}

		nodes.pop();
		last = nodes.at(-1);
	}

	return nodes;
}

function visit(
	node: Parents,
	ancestors: Parents[],
	callback: (node: Element, ancestors: Parents[]) => void,
) {
	const inside = [...ancestors, node];

	for (const child of node.children) {
		if (child.type === "element") {
			callback(child, inside);
		}

		// MDX's JSX elements, such as <details>, have children too
		if ("children" in child) {
			visit(child, inside, callback);
		}
	}
}
