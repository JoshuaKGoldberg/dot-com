/**
 * Curtains of light hanging from an edge of the page.
 *
 * Every layer is light(x) * exp(-y / length(x)), so however they're stirred, their
 * brightness can only fall away from the edge: never gathering in front of text.
 */
export const fragmentShader = `
precision highp float;

uniform float uCursor;
uniform bool uDark;
uniform float uDwell;
uniform bool uFlip;
uniform float uFlow;
uniform vec3 uPalette[4];
uniform float uPresence;
uniform vec2 uResolution;
uniform vec2 uSize;
uniform float uStir;
uniform float uTime;

const float tau = 6.2832;

float hash(vec2 p) {
	p = fract(p * vec2(.1031, .1030));
	p += dot(p, p.yx + 33.33);
	return fract((p.x + p.y) * p.x);
}

vec3 palette(float t) {
	vec3 color = mix(uPalette[0], uPalette[1], smoothstep(0., .35, t));
	color = mix(color, uPalette[2], smoothstep(.3, .7, t));
	return mix(color, uPalette[3], smoothstep(.65, 1.1, t) * (uDark ? .5 : 1.));
}

void main() {
	vec2 position = gl_FragCoord.xy / uResolution * uSize;
	float x = position.x;
	float y = uFlip ? position.y : uSize.y - position.y;

	// Everything about the cursor depends only on x, so as to only affect x
	float offset = x - uCursor;
	float near = uPresence * exp(-pow(offset / 300., 2.));
	float breath = near * (.5 + .5 * sin(uTime * .62));
	float swayed = x + uStir * near * 34. * sin(offset / 95. + uTime * .3);
	swayed += uFlow * (16. * sin(uTime * .33 + x / 210.) + near * 26. * sin(abs(offset) / 68. - uTime * 1.3));
	float lean = clamp(-offset / 220., -1., 1.) * near * .06;
	float u = (swayed + lean * y) / uSize.x * tau;
	float time = uTime * .25;

	float light = 0.;
	float length0 = 0.;

	for (int i = 0; i < 3; i++) {
		float layer = float(i);
		float wave1 = sin(u * (1.1 + .35 * layer) + time * (1.6 + .4 * layer) + layer * 2.3);
		float wave2 = sin(u * (2.3 + .5 * layer) - time * (1.2 + .3 * layer) + layer * 4.1 + 1.7 * wave1);
		float wave3 = sin(u * .55 + time * .9 + layer * 1.3);
		float billow = .5 + .5 * clamp(.7 * wave1 + .45 * wave2 + .3 * wave3, -1., 1.);
		float length = (26. + 150. * billow * billow) * (1. + .5 * near) * (1. - .2 * layer) * (1. + .6 * breath);
		float softness = .4 + .6 * (.5 + .5 * sin(u * (.8 + .3 * layer) - time * 1.1 + layer * 3.));

		if (i == 0) {
			length0 = length;
		}

		light += exp(-pow(y / length, 1.5)) * softness * (1. - .2 * layer);
	}

	light *= exp(-y / 150.) * (1. + 1.7 * near) * (1. + .4 * breath);
	light *= 1. - smoothstep(.5 * uSize.y, uSize.y, y);

	float hue = clamp(y / (length0 * 2.4), 0., 1.) + .24 * near + uFlow * .15 * sin(x / 190. + uTime * .42);
	vec3 color = palette(hue);
	float luminance = dot(color, vec3(.2126, .7152, .0722));
	color = max(vec3(0.), mix(vec3(luminance), color, 1. + near * (uDark ? 1.1 : .1)));

	float amount = light * (uDark ? .4 : .7);
	float alpha = (1. - exp(-amount * (uDark ? 1. : 1.7))) * (uDark ? .62 : .78);
	vec4 result = vec4(clamp(color, 0., 1.) * (uDark ? alpha * 1.48 : alpha), alpha);

	// Dithered, as gradients this faint would otherwise be visibly banded
	result += (hash(gl_FragCoord.xy + fract(uTime)) - .5) / 255. * step(.002, alpha);
	gl_FragColor = clamp(result, 0., 1.) * uDwell;
}
`;

export const vertexShader = `
attribute vec2 aPosition;

void main() {
	gl_Position = vec4(aPosition, 0., 1.);
}
`;
