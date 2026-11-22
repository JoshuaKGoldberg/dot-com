// Rhythm Nav: the four nav links are lanes. Notes rise to each link on the beat; tap along for a score.
import { createToy, roundRect, clamp } from "./_toy/toy.js";

const KEYS = { 1: 0, 2: 1, 3: 2, 4: 3, d: 0, f: 1, j: 2, k: 3 };
const BPM = 104;
const LEAD = 2.6;
const TRAVEL = 1.7;
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const PERFECT = 0.065;
const GOOD = 0.13;

function rng(seed) {
	return () => {
		seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function activate({ root, reducedMotion }) {
	let links = [];
	return createToy({
		root, reducedMotion, id: "rhythm-nav", name: "Rhythm Nav", startKey: "p", hz: 120, hudBottom: true,
		make(api) {
			let lanes, notes, t, combo, maxCombo, stats, pulses, beatPulse, pops, lastBeat, ended, laneFlash;
			const spb = 60 / BPM;

			function chart() {
				const r = rng(1999);
				const out = [];
				let prev = -1, prev2 = -2;
				for (let beat = 0; beat < 64; beat++) {
					const phraseEnd = beat % 8 === 7;
					for (const off of [0, 0.5]) {
						const p = off === 0 ? (beat % 4 === 0 ? 1 : 0.8) : phraseEnd ? 0.7 : 0.3;
						if (r() > p) continue;
						let lane;
						do { lane = Math.floor(r() * 4); } while (lane === prev && lane === prev2);
						prev2 = prev; prev = lane;
						out.push({ time: LEAD + (beat + off) * spb, lane, state: 0 });
					}
				}
				return out;
			}
			const ty = (l) => lanes[l].y;
			const noteY = (n) => ty(n.lane) + (n.time - t) * ((api.H - ty(n.lane)) / TRAVEL);

			function judge(lane) {
				// nearest unhit note in lane within the good window
				let best = null;
				for (const n of notes) {
					if (n.state || n.lane !== lane) continue;
					const d = Math.abs(n.time - t);
					if (d <= GOOD * 1.3 && (!best || d < best.d)) best = { n, d };
					if (n.time - t > 0.3) break;
				}
				laneFlash[lane] = 1;
				if (!best) { api.beep(100, 0.05, "square", 0.015); return; }
				const n = best.n;
				const perfect = best.d <= PERFECT;
				const good = best.d <= GOOD;
				if (!good) { n.state = 3; miss(lane); return; }
				n.state = perfect ? 1 : 2;
				combo++;
				maxCombo = Math.max(maxCombo, combo);
				stats[perfect ? "perfect" : "good"]++;
				api.add((perfect ? 100 : 50) * (1 + Math.min(Math.floor(combo / 8), 4)));
				api.beep(330 * 2 ** (SCALE[(lane * 2 + (n.time * 3 | 0)) % 8] / 12), 0.14, "triangle", 0.07);
				pops.push({ lane, text: perfect ? "Perfect" : "Good", age: 0, col: perfect ? api.c.toy2 : api.c.toy });
				pulses[lane] = 1;
				api.burst(lanes[lane].x, ty(lane), { n: perfect ? 14 : 7, color: perfect ? api.c.toy2 : api.c.toy, speed: 200, gravity: 120 });
				if (combo > 0 && combo % 10 === 0) api.shake(3);
			}
			function miss(lane) {
				combo = 0; stats.miss++;
				pops.push({ lane, text: "Miss", age: 0, col: api.c.muted });
				api.beep(90, 0.1, "sawtooth", 0.02);
			}
			function setLinks() {
				const els = [...root.querySelectorAll(".site-nav-link")].slice(0, 4);
				links = els;
				lanes = els.map((e) => { const r = api.rect(e); return { x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, h: r.h, el: e }; });
			}

			return {
				start() {
					api.scrollTo(0);
					api.measure();
					setLinks();
					notes = chart();
					t = 0; combo = 0; maxCombo = 0; stats = { perfect: 0, good: 0, miss: 0 }; pulses = [0, 0, 0, 0]; laneFlash = [0, 0, 0, 0]; beatPulse = 0; pops = []; lastBeat = -1; ended = false;
					api.say("Tap 1 2 3 4 (or D F J K) when a note reaches its link · or tap the lane · M for sound");
				},
				resize() { api.restart(); },
				stop() { for (const e of links) { e.style.removeProperty("transform"); if (!e.getAttribute("style")) e.removeAttribute("style"); } },
				key(k) { if (k in KEYS) judge(KEYS[k]); },
				down(x) {
					let best = 0, bd = 1e9;
					lanes.forEach((l, i) => { const d = Math.abs(l.x - x); if (d < bd) { bd = d; best = i; } });
					judge(best);
				},
				step(dt) {
					t += dt;
					beatPulse = Math.max(0, beatPulse - dt * 4);
					for (let i = 0; i < 4; i++) { pulses[i] = Math.max(0, pulses[i] - dt * 4); laneFlash[i] = Math.max(0, laneFlash[i] - dt * 6); }
					const beat = Math.floor((t - LEAD) / spb);
					if (t > 0 && beat !== lastBeat && t > LEAD - 4 * spb) {
						lastBeat = beat;
						beatPulse = 1;
						if (beat >= -4) api.beep(beat % 4 === 0 ? 70 : 50, 0.1, "sine", beat % 4 === 0 ? 0.14 : 0.08, -25);
					}
					for (const n of notes) if (!n.state && t - n.time > GOOD * 1.3) { n.state = 3; miss(n.lane); }
					// pulse the real nav links
					for (let i = 0; i < lanes.length; i++) {
						const k = reducedMotion ? 0 : 0.06 * beatPulse + 0.12 * pulses[i];
						lanes[i].el.style.transform = k ? `scale(${1 + k})` : "";
					}
					const endT = notes[notes.length - 1].time + 1.4;
					if (!ended && t > endT) {
						ended = true;
						const total = stats.perfect + stats.good + stats.miss;
						const acc = (stats.perfect + stats.good * 0.6) / Math.max(1, notes.length);
						const rank = acc > 0.93 ? "S" : acc > 0.82 ? "A" : acc > 0.65 ? "B" : "C";
						void total;
						api.beep(660, 0.4, "triangle", 0.07, 330);
						api.end(`Rank ${rank}: ${stats.perfect} perfect, ${stats.good} good, ${stats.miss} miss · max combo ${maxCombo}`);
					}
					for (const p of pops) p.age += dt;
					pops = pops.filter((p) => p.age < 0.7);
				},
				draw(g) {
					const c = api.c, H = api.H, W = api.W;
					g.fillStyle = c.dark ? "rgba(8,6,20,0.5)" : "rgba(250,247,255,0.55)";
					g.fillRect(0, 70, W, H - 70);
					lanes.forEach((l, i) => {
						// lane
						g.fillStyle = c.toy; g.globalAlpha = 0.07 + laneFlash[i] * 0.18;
						const lw = l.w + 8;
						g.fillRect(l.x - lw / 2, l.y + 18, lw, H - l.y);
						g.globalAlpha = 0.35; g.strokeStyle = c.toy; g.lineWidth = 1;
						g.beginPath(); g.moveTo(l.x - lw / 2, l.y + 18); g.lineTo(l.x - lw / 2, H); g.moveTo(l.x + lw / 2, l.y + 18); g.lineTo(l.x + lw / 2, H); g.stroke();
						g.globalAlpha = 1;
						// target ring around the link
						g.strokeStyle = c.toy2; g.lineWidth = 2 + pulses[i] * 3 + beatPulse * 0.8;
						roundRect(g, l.x - l.w / 2 - 10, l.y - l.h / 2 - 4, l.w + 20, l.h + 8, 14); g.stroke();
						g.fillStyle = c.toy; g.font = "800 12px sans-serif"; g.textAlign = "center";
						g.fillText(["1 · D", "2 · F", "3 · J", "4 · K"][i], l.x, H - 68);
					});
					for (const n of notes) {
						if (n.state === 1 || n.state === 2) continue;
						const y = noteY(n);
						if (y > H + 20 || y < -20) continue;
						const l = lanes[n.lane];
						g.globalAlpha = n.state === 3 ? 0.25 : 1;
						g.fillStyle = n.lane % 2 ? c.toy2 : c.toy;
						g.beginPath(); g.arc(l.x, y, 13, 0, 7); g.fill();
						g.fillStyle = c.bg; g.beginPath(); g.arc(l.x, y, 5, 0, 7); g.fill();
						g.globalAlpha = 1;
					}
					for (const p of pops) {
						const l = lanes[p.lane];
						g.globalAlpha = 1 - p.age / 0.7; g.fillStyle = p.col; g.font = "800 15px sans-serif"; g.textAlign = "center";
						g.fillText(p.text, l.x, l.y + l.h + 40 - p.age * 18);
						g.globalAlpha = 1;
					}
					if (combo >= 3) { g.fillStyle = c.strong; g.font = "900 34px sans-serif"; g.textAlign = "left"; g.fillText(`${combo}`, 24, H - 90); g.font = "700 13px sans-serif"; g.fillStyle = c.muted; g.fillText("COMBO", 24, H - 72); }
					if (t < LEAD) { g.fillStyle = c.toy; g.font = "900 44px sans-serif"; g.textAlign = "center"; g.fillText(t < LEAD - 3 * spb ? "Ready" : String(Math.max(1, Math.ceil((LEAD - t) / spb))), W / 2, H * 0.55); }
				},
			};
		},
	});
}
