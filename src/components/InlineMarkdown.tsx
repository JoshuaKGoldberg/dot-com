import type { JSX } from "solid-js";

import { Lexer, type MarkedToken, type Token } from "marked";

import styles from "./InlineMarkdown.module.css";

export interface InlineMarkdownProps {
	/** Renders links as only their text, as links can't be nested */
	insideLink?: boolean;
	text: string;
}

const safeProtocols = new Set(["http:", "https:", "mailto:"]);

/**
 * Renders Markdown's inline syntax, such as `code` and _emphasis_, in text.
 * Block syntax isn't parsed, and raw HTML is shown as text rather than injected.
 */
export function InlineMarkdown(props: InlineMarkdownProps) {
	return <>{renderTokens(lexInlineMarkdown(props.text), props.insideLink)}</>;
}

/** Removes Markdown's inline syntax from text, for places that can't show HTML. */
export function inlineMarkdownToText(text: string) {
	return tokensToText(lexInlineMarkdown(text));
}

function isSafeHref(href: string) {
	const url = URL.parse(href, "https://www.joshuakgoldberg.com");

	return !!url && safeProtocols.has(url.protocol);
}

function lexInlineMarkdown(text: string) {
	// GFM would turn plain text into links and strikethrough, such as "~400ms ... ~700ms"
	return Lexer.lexInline(text, { gfm: false });
}

function renderToken(
	token: MarkedToken,
	insideLink: boolean | undefined,
): JSX.Element {
	switch (token.type) {
		case "codespan":
			return <code class={styles.code}>{token.text}</code>;

		case "em":
			return <em>{renderTokens(token.tokens, insideLink)}</em>;

		case "link":
			return insideLink || !isSafeHref(token.href) ? (
				renderTokens(token.tokens, insideLink)
			) : (
				<a href={token.href}>{renderTokens(token.tokens, true)}</a>
			);

		case "strong":
			return <strong>{renderTokens(token.tokens, insideLink)}</strong>;

		default:
			return tokenToText(token);
	}
}

function renderTokens(tokens: Token[], insideLink: boolean | undefined) {
	const rendered: JSX.Element[] = [];

	for (const token of tokens) {
		const element = renderToken(token as MarkedToken, insideLink);
		const previous = rendered.at(-1);

		// Solid separates adjacent strings with HTML comments, so they're joined instead
		if (typeof element === "string" && typeof previous === "string") {
			rendered[rendered.length - 1] = previous + element;
		} else {
			rendered.push(element);
		}
	}

	return rendered;
}

function tokensToText(tokens: Token[]): string {
	return tokens.map(tokenToText).join("");
}

function tokenToText(token: Token): string {
	const known = token as MarkedToken;

	switch (known.type) {
		case "br":
			return " ";

		case "em":
		case "link":
		case "strong":
			return tokensToText(known.tokens);

		// Everything else, including raw HTML and images, is shown as its text
		default:
			return "text" in known ? known.text : known.raw;
	}
}
