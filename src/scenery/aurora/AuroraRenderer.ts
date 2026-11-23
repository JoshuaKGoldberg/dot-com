import { fragmentShader, vertexShader } from "./shader";

export interface AuroraUniforms {
	uCursor: number;
	uDark: boolean;
	uDwell: number;
	uFlip: boolean;
	uFlow: number;
	uPalette: readonly number[];
	uPresence: number;
	uSize: [number, number];
	uStir: number;
	uTime: number;
}

/** A fraction of a pixel per pixel: upscaling is what softens the light. */
const resolution = 0.2;

/** Draws auroras with WebGL, if it's available. */
export class AuroraRenderer {
	readonly canvas = document.createElement("canvas");

	/** Null once it's known to be unavailable. */
	#context: null | undefined | WebGLRenderingContext;
	readonly #locations = new Map<string, null | WebGLUniformLocation>();
	#program: undefined | WebGLProgram;

	constructor() {
		this.canvas.addEventListener("webglcontextlost", (event) => {
			event.preventDefault();
			this.#program = undefined;
		});
		this.canvas.addEventListener("webglcontextrestored", () => {
			this.#initialize();
		});
	}

	/** @returns Whether anything could be drawn. */
	draw(uniforms: AuroraUniforms) {
		if (this.#context === undefined) {
			this.#initialize();
		}

		const gl = this.#context;
		if (!gl || !this.#program) {
			return false;
		}

		const { canvas } = this;
		const width = Math.max(1, Math.round(uniforms.uSize[0] * resolution));
		const height = Math.max(1, Math.round(uniforms.uSize[1] * resolution));

		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}

		gl.uniform2f(this.#locate("uResolution"), width, height);
		gl.uniform3fv(this.#locate("uPalette"), uniforms.uPalette);
		gl.uniform2fv(this.#locate("uSize"), uniforms.uSize);
		gl.uniform1i(this.#locate("uDark"), Number(uniforms.uDark));
		gl.uniform1i(this.#locate("uFlip"), Number(uniforms.uFlip));

		for (const name of [
			"uCursor",
			"uDwell",
			"uFlow",
			"uPresence",
			"uStir",
			"uTime",
		] as const) {
			gl.uniform1f(this.#locate(name), uniforms[name]);
		}

		gl.drawArrays(gl.TRIANGLES, 0, 3);

		return true;
	}

	#initialize() {
		this.#context ??= this.canvas.getContext("webgl", {
			antialias: false,
			depth: false,
			powerPreference: "low-power",
			premultipliedAlpha: true,
			stencil: false,
		});

		const gl = this.#context;
		if (!gl) {
			return;
		}

		const program = createProgram(gl);
		if (!program) {
			return;
		}

		this.#locations.clear();
		this.#program = program;
		gl.useProgram(program);

		// A single triangle that's large enough to cover the whole canvas
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 3, -1, -1, 3]),
			gl.STATIC_DRAW,
		);

		const position = gl.getAttribLocation(program, "aPosition");
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
	}

	#locate(name: "uResolution" | keyof AuroraUniforms) {
		let location = this.#locations.get(name);

		if (location === undefined) {
			location =
				this.#program && this.#context
					? this.#context.getUniformLocation(this.#program, name)
					: null;
			this.#locations.set(name, location);
		}

		return location;
	}
}

function createProgram(gl: WebGLRenderingContext) {
	const program = gl.createProgram();

	for (const [type, source] of [
		[gl.FRAGMENT_SHADER, fragmentShader],
		[gl.VERTEX_SHADER, vertexShader],
	] as const) {
		const shader = gl.createShader(type);
		if (!shader) {
			return undefined;
		}

		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		gl.attachShader(program, shader);
	}

	gl.linkProgram(program);

	return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : undefined;
}
