// A tiny hand-written parser for a TypeScript-flavoured JavaScript subset.
// Produces ESTree-shaped nodes (type, start, end, ...children). Not a full parser:
// enough for the snippets in this gallery (functions, arrows, if/for/while, calls, members,
// object/array literals, type annotations kept as opaque TSTypeAnnotation nodes).

const KEYWORDS = new Set(["const", "let", "var", "function", "return", "if", "else", "for", "while", "of", "in", "await", "async", "throw", "new", "typeof", "break", "continue", "true", "false", "null", "undefined", "export", "import", "from", "type", "interface"]);
const PUNCT = ["===", "!==", "...", "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=", "/=", "{", "}", "(", ")", "[", "]", ";", ",", ".", ":", "?", "=", "+", "-", "*", "/", "%", "<", ">", "!", "|", "&"];

export function tokenize(src) {
	const toks = [];
	let i = 0;
	while (i < src.length) {
		const ch = src[i];
		if (/\s/.test(ch)) {
			i++;
		} else if (ch === "/" && src[i + 1] === "/") {
			while (i < src.length && src[i] !== "\n") i++;
		} else if (/[A-Za-z_$]/.test(ch)) {
			let j = i + 1;
			while (j < src.length && /[\w$]/.test(src[j])) j++;
			const v = src.slice(i, j);
			toks.push({ t: KEYWORDS.has(v) ? "kw" : "id", v, start: i, end: j });
			i = j;
		} else if (/\d/.test(ch)) {
			let j = i + 1;
			while (j < src.length && /[\d.]/.test(src[j])) j++;
			toks.push({ t: "num", v: src.slice(i, j), start: i, end: j });
			i = j;
		} else if (ch === '"' || ch === "'" || ch === "`") {
			let j = i + 1;
			while (j < src.length && src[j] !== ch) j += src[j] === "\\" ? 2 : 1;
			toks.push({ t: "str", v: src.slice(i, j + 1), start: i, end: j + 1 });
			i = j + 1;
		} else {
			const p = PUNCT.find((x) => src.startsWith(x, i));
			if (!p) {
				i++;
				continue;
			}
			toks.push({ t: "p", v: p, start: i, end: i + p.length });
			i += p.length;
		}
	}
	toks.push({ t: "eof", v: "", start: src.length, end: src.length });
	return toks;
}

export function parse(src) {
	const toks = tokenize(src);
	let k = 0;
	const peek = (o = 0) => toks[Math.min(k + o, toks.length - 1)];
	const is = (v, o = 0) => peek(o).v === v && peek(o).t !== "str";
	const next = () => toks[k++];
	const eat = (v) => (is(v) ? next() : null);
	const node = (type, start, props = {}) => ({ type, start, end: toks[Math.max(0, k - 1)].end, ...props });
	const fin = (n) => {
		n.end = toks[Math.max(0, k - 1)].end;
		return n;
	};

	function parseType() {
		const s = peek().start;
		let depth = 0;
		let used = 0;
		while (peek().t !== "eof") {
			const v = peek().v;
			if (peek().t === "p") {
				if (v === "{" && depth === 0 && used > 0) break;
				if (v === "<" || v === "(" || v === "{" || v === "[") depth++;
				else if (v === ">" || v === ")" || v === "}" || v === "]") {
					if (depth === 0) break;
					depth--;
				} else if (depth === 0 && (v === "," || v === ";" || v === "=" || (v === "=>" && false))) break;
			}
			next();
			used++;
			if (depth === 0 && peek().t === "p" && peek().v === "=>") break;
		}
		return fin(node("TSTypeAnnotation", s));
	}

	function parseParams() {
		const out = [];
		eat("(");
		while (!is(")") && peek().t !== "eof") {
			const s = peek().start;
			const id = parseIdent();
			if (eat("?")) {
				/* optional */
			}
			if (eat(":")) id.typeAnnotation = parseType();
			out.push(fin({ ...id, start: s }));
			if (!eat(",")) break;
		}
		eat(")");
		return out;
	}

	function parseIdent() {
		const t = next();
		return { type: "Identifier", name: t.v, start: t.start, end: t.end };
	}

	function parseFunctionRest(type, s, id) {
		const params = parseParams();
		let returnType;
		if (eat(":")) returnType = parseType();
		const body = parseBlock();
		return fin(node(type, s, { id, params, returnType, body }));
	}

	function parseBlock() {
		const s = peek().start;
		eat("{");
		const body = [];
		while (!is("}") && peek().t !== "eof") body.push(parseStatement());
		eat("}");
		return fin(node("BlockStatement", s, { body }));
	}

	function parseStatement() {
		const s = peek().start;
		const v = peek().v;
		if (peek().t === "str") return exprStatement();
		if (v === "{") return parseBlock();
		if (v === "export") {
			next();
			return parseStatement();
		}
		if (v === "const" || v === "let" || v === "var") {
			const d = parseVarDecl();
			eat(";");
			return fin(d);
		}
		if (v === "async" && is("function", 1)) next();
		if (peek().v === "function") {
			next();
			const id = parseIdent();
			return parseFunctionRest("FunctionDeclaration", s, id);
		}
		if (v === "if") {
			next();
			eat("(");
			const test = parseExpr();
			eat(")");
			const consequent = parseStatement();
			const alternate = eat("else") ? parseStatement() : undefined;
			return fin(node("IfStatement", s, { test, consequent, alternate }));
		}
		if (v === "while") {
			next();
			eat("(");
			const test = parseExpr();
			eat(")");
			return fin(node("WhileStatement", s, { test, body: parseStatement() }));
		}
		if (v === "for") {
			next();
			eat("(");
			let init;
			if (is("const") || is("let")) init = parseVarDecl(true);
			else if (!is(";")) init = parseExpr();
			if (is("of") || is("in")) {
				const kind = next().v;
				const right = parseExpr();
				eat(")");
				return fin(node(kind === "of" ? "ForOfStatement" : "ForInStatement", s, { left: init, right, body: parseStatement() }));
			}
			eat(";");
			const test = is(";") ? undefined : parseExpr();
			eat(";");
			const update = is(")") ? undefined : parseExpr();
			eat(")");
			return fin(node("ForStatement", s, { init, test, update, body: parseStatement() }));
		}
		if (v === "return" || v === "throw") {
			next();
			const argument = is(";") || is("}") ? undefined : parseExpr();
			eat(";");
			return fin(node(v === "return" ? "ReturnStatement" : "ThrowStatement", s, { argument }));
		}
		if (v === "break" || v === "continue") {
			next();
			eat(";");
			return fin(node(v === "break" ? "BreakStatement" : "ContinueStatement", s));
		}
		return exprStatement();
	}

	function exprStatement() {
		const s = peek().start;
		const expression = parseExpr();
		eat(";");
		return fin(node("ExpressionStatement", s, { expression }));
	}

	function parseVarDecl(noSemi) {
		const s = peek().start;
		const kind = next().v;
		const declarations = [];
		do {
			const ds = peek().start;
			const id = parseIdent();
			if (eat(":")) id.typeAnnotation = parseType();
			fin(id);
			const init = eat("=") ? parseAssign() : undefined;
			declarations.push(fin(node("VariableDeclarator", ds, { id, init })));
		} while (eat(","));
		void noSemi;
		return fin(node("VariableDeclaration", s, { kind, declarations }));
	}

	function parseExpr() {
		return parseAssign();
	}

	function isArrowAhead() {
		if (!is("(")) return false;
		let d = 0;
		let j = k;
		for (; j < toks.length; j++) {
			if (toks[j].t === "p" && toks[j].v === "(") d++;
			else if (toks[j].t === "p" && toks[j].v === ")") {
				d--;
				if (d === 0) break;
			}
		}
		let a = toks[j + 1];
		if (a && a.v === ":") {
			// return type annotation, scan to =>
			let m = j + 2;
			while (m < toks.length && toks[m].v !== "=>" && toks[m].v !== ";" && toks[m].v !== "{") m++;
			a = toks[m];
		}
		return !!a && a.t === "p" && a.v === "=>";
	}

	function parseAssign() {
		const s = peek().start;
		if (is("async") && (is("(", 1) || peek(1).t === "id")) next();
		if (isArrowAhead() || (peek().t === "id" && is("=>", 1))) {
			const params = is("(") ? parseParams() : [fin(parseIdentNode())];
			if (eat(":")) parseType();
			eat("=>");
			const body = is("{") ? parseBlock() : parseAssign();
			return fin(node("ArrowFunctionExpression", s, { params, body }));
		}
		const left = parseCond();
		if (is("=") || is("+=") || is("-=") || is("*=")) {
			const operator = next().v;
			const right = parseAssign();
			return fin(node("AssignmentExpression", s, { operator, left, right }));
		}
		return left;
	}

	function parseIdentNode() {
		return parseIdent();
	}

	function parseCond() {
		const s = peek().start;
		const test = parseBin(0);
		if (is("?")) {
			next();
			const consequent = parseAssign();
			eat(":");
			const alternate = parseAssign();
			return fin(node("ConditionalExpression", s, { test, consequent, alternate }));
		}
		return test;
	}

	const LEVELS = [["??"], ["||"], ["&&"], ["===", "!==", "==", "!="], ["<", ">", "<=", ">=", "in"], ["+", "-"], ["*", "/", "%"]];
	function parseBin(level) {
		if (level >= LEVELS.length) return parseUnary();
		const s = peek().start;
		let left = parseBin(level + 1);
		while (LEVELS[level].includes(peek().v) && peek().t !== "str" && !(peek().v === "in" && false)) {
			const operator = next().v;
			const right = parseBin(level + 1);
			left = fin(node(operator === "&&" || operator === "||" || operator === "??" ? "LogicalExpression" : "BinaryExpression", s, { operator, left, right }));
		}
		return left;
	}

	function parseUnary() {
		const s = peek().start;
		if (["!", "-", "typeof", "await", "++", "--"].includes(peek().v) && peek().t !== "str") {
			const operator = next().v;
			const argument = parseUnary();
			return fin(node(operator === "await" ? "AwaitExpression" : "UnaryExpression", s, { operator, argument }));
		}
		if (is("new")) {
			next();
			const callee = parsePostfix(true);
			const args = is("(") ? parseArgs() : [];
			return fin(node("NewExpression", s, { callee, arguments: args }));
		}
		return parsePostfix();
	}

	function parseArgs() {
		const out = [];
		eat("(");
		while (!is(")") && peek().t !== "eof") {
			out.push(parseAssign());
			if (!eat(",")) break;
		}
		eat(")");
		return out;
	}

	function parsePostfix(noCall) {
		const s = peek().start;
		let e = parsePrimary();
		for (;;) {
			if (is(".") || is("?.")) {
				next();
				if (is("(")) {
					e = fin(node("CallExpression", s, { callee: e, arguments: parseArgs(), optional: true }));
					continue;
				}
				const property = parseIdent();
				e = fin(node("MemberExpression", s, { object: e, property, computed: false }));
			} else if (is("[")) {
				next();
				const property = parseExpr();
				eat("]");
				e = fin(node("MemberExpression", s, { object: e, property, computed: true }));
			} else if (is("(") && !noCall) {
				e = fin(node("CallExpression", s, { callee: e, arguments: parseArgs() }));
			} else if (is("++") || is("--")) {
				next();
				e = fin(node("UpdateExpression", s, { argument: e }));
			} else break;
		}
		return e;
	}

	function parsePrimary() {
		const t = peek();
		const s = t.start;
		if (t.t === "num" || t.t === "str") {
			next();
			return { type: "Literal", value: t.v, start: s, end: t.end };
		}
		if (t.t === "kw" && ["true", "false", "null", "undefined"].includes(t.v)) {
			next();
			return { type: "Literal", value: t.v, start: s, end: t.end };
		}
		if (t.t === "id" || t.t === "kw") {
			next();
			return { type: "Identifier", name: t.v, start: s, end: t.end };
		}
		if (t.v === "(") {
			next();
			const e = parseExpr();
			eat(")");
			return e;
		}
		if (t.v === "[") {
			next();
			const elements = [];
			while (!is("]") && peek().t !== "eof") {
				elements.push(parseAssign());
				if (!eat(",")) break;
			}
			eat("]");
			return fin(node("ArrayExpression", s, { elements }));
		}
		if (t.v === "{") {
			next();
			const properties = [];
			while (!is("}") && peek().t !== "eof") {
				const ps = peek().start;
				if (is("...")) {
					next();
					properties.push(fin(node("SpreadElement", ps, { argument: parseAssign() })));
				} else {
					const key = peek().t === "str" ? (next(), { type: "Literal", value: toks[k - 1].v, start: ps, end: toks[k - 1].end }) : parseIdent();
					if (is("(")) {
						const fn = parseFunctionRest("FunctionExpression", ps, undefined);
						properties.push(fin(node("Property", ps, { key, value: fn, method: true })));
					} else if (eat(":")) {
						properties.push(fin(node("Property", ps, { key, value: parseAssign() })));
					} else {
						properties.push(fin(node("Property", ps, { key, shorthand: true })));
					}
				}
				if (!eat(",")) break;
			}
			eat("}");
			return fin(node("ObjectExpression", s, { properties }));
		}
		next();
		return { type: "Identifier", name: t.v, start: s, end: t.end };
	}

	const body = [];
	while (peek().t !== "eof") {
		const before = k;
		body.push(parseStatement());
		if (k === before) k++;
	}
	return { type: "Program", start: 0, end: src.length, body, source: src };
}

const CHILD_KEYS = ["id", "params", "typeAnnotation", "returnType", "declarations", "init", "key", "value", "left", "test", "callee", "object", "property", "argument", "arguments", "right", "consequent", "alternate", "update", "expression", "elements", "properties", "body"];

export function children(n) {
	const out = [];
	for (const key of CHILD_KEYS) {
		const v = n[key];
		if (!v) continue;
		if (Array.isArray(v)) out.push(...v.filter(Boolean));
		else if (typeof v === "object" && v.type) out.push(v);
	}
	return out;
}

export function walk(n, fn, parent = null, depth = 0) {
	fn(n, parent, depth);
	for (const c of children(n)) walk(c, fn, n, depth + 1);
}

export function countNodes(n) {
	let c = 0;
	walk(n, () => c++);
	return c;
}

// Real snippets from Josh's world.
export const SNIPPETS = {
	noEval: `const rule = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.name === "eval") {
          context.report({ node, messageId: "noEval" });
        }
      },
    };
  },
});`,
	clamp: `function clamp(n: number, min: number, max: number): number {
  if (n < min) {
    return min;
  }
  return n > max ? max : n;
}`,
	fib: `function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
const nums = [0, 1, 2, 3].map(fib);`,
	loop: `function sum(xs) {
  let total = 0;
  for (const x of xs) {
    if (x > 0) {
      total += x;
    }
  }
  return total;
}`,
	filter: `const evens = items
  .filter((item) => item.value % 2 === 0)
  .map((item) => ({ id: item.id, label: item.name }));`,
	gcd: `function gcd(a, b) {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}`,
	scopes: `const root = 1;
function outer(a) {
  const b = a + root;
  function middle(c) {
    const d = b * c;
    function inner(e) {
      const f = d + e;
      return f;
    }
    return inner(d);
  }
  return middle(b);
}`,
	cfg: `function visit(node, seen) {
  if (seen.has(node)) {
    return;
  }
  seen.add(node);
  for (const child of node.children) {
    if (child.skip) {
      continue;
    }
    visit(child, seen);
  }
  return node;
}`,
};
