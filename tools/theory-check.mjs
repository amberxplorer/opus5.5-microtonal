// Asserts the music-theory facts the piece shows on screen.
//   node tools/theory-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = globalThis;
for (const f of ['js/core/util.js', 'js/theory/tuning.js', 'js/theory/chords.js']) {
  vm.runInThisContext(readFileSync(path.join(root, f), 'utf8'), { filename: f });
}
const { T, C, U } = globalThis.XEN;

let fails = 0, passes = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++; else { fails++; console.log(`FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
function near(label, got, want, tol = 0.01) {
  const ok = Math.abs(got - want) <= tol;
  if (ok) passes++; else { fails++; console.log(`FAIL ${label}: got ${got}, want ${want} ±${tol}`); }
}

const e = (n) => T.edo(n);
// 31-EDO: septimal meantone
eq('31 val', e(31).val, [31, 49, 72, 87, 107, 115]);
eq('31 tempers 81/80', e(31).mapRatio('81/80'), 0);
eq('31 tempers 126/125', e(31).mapRatio('126/125'), 0);
eq('31 lesser diesis is one step', e(31).mapRatio('128/125'), 1);
near('31 7/4 error', e(31).approx('7/4').error, -1.08, 0.01);
near('31 5/4 error', e(31).approx('5/4').error, 0.78, 0.01);
// 19-EDO
eq('19 minor third', e(19).mapRatio('6/5'), 5);
near('19 6/5 error', e(19).approx('6/5').error, 0.15, 0.01);
eq('19 E# = F-flat', [e(19).spell(7, 'E'), e(19).spell(7, 'F')], ['E♯', 'F♭']);
eq('19 C# != D-flat', [e(19).spell(1, 'C'), e(19).spell(2, 'D')], ['C♯', 'D♭']);
eq('gcd(5,19)', U.gcd(5, 19), 1);
// 22-EDO
eq('22 tempers 250/243 (porcupine)', e(22).mapRatio('250/243'), 0);
eq('22 tempers 50/49 (pajara)', e(22).mapRatio('50/49'), 0);
eq('22 tempers 64/63 (superpyth)', e(22).mapRatio('64/63'), 0);
eq('22 does not temper 81/80', e(22).mapRatio('81/80') !== 0, true);
eq('22 10/9 step', e(22).mapRatio('10/9'), 3);
eq('22 7/5 = half octave', e(22).mapRatio('7/5'), 11);
near('22 fifth', e(22).approx('3/2').cents, 709.09, 0.01);
// 53-EDO
eq('53 5/4 vs 81/64', [e(53).mapRatio('5/4'), e(53).mapRatio('81/64')], [17, 18]);
near('53 fifth error', e(53).approx('3/2').error, -0.07, 0.005);
near('Mercator comma', 53 * T.ratioCents('3/1') - 84 * 1200, 3.615, 0.001);
eq('53 D major spelled', C.make(e(53), 9, 'maj').notes.map((n) => n.name), ['D', '↓F♯', 'A']);
eq('53 Hicaz-like tetrachord 5+12+5 = 4/3', [5 + 12 + 5, e(53).mapRatio('4/3')], [22, 22]);
eq('53 9/8 = 9 steps', e(53).mapRatio('9/8'), 9);
// other EDO subtitle claims
eq('15 tempers 256/243', e(15).mapRatio('256/243'), 0);
eq('27 tempers 64/63', e(27).mapRatio('64/63'), 0);
eq('34 tempers 15625/15552', e(34).mapRatio('15625/15552'), 0);
near('26 7/4 error small', e(26).approx('7/4').error, 0.4, 0.05);
eq('26 fifth flat', e(26).approx('3/2').error < -5, true);
eq('17 neutral third', e(17).mapRatio('5/4'), 5);
near('41 fifth error', e(41).approx('3/2').error, 0.48, 0.01);
near('19 near 1/3-comma meantone fifth', e(19).approx('3/2').cents, 694.79, 0.1);
eq('46 fifth sharp', e(46).approx('3/2').error > 0, true);
// Bohlen–Pierce
const bp = T.bp();
eq('BP 5/3 7/3 7/5 9/7 9/5', ['5/3', '7/3', '7/5', '9/7', '9/5'].map((r) => bp.mapRatio(r)), [6, 10, 4, 3, 7]);
near('BP step', bp.stepCents, 146.30, 0.005);
near('BP tritave', bp.periodCents, 1901.96, 0.005);
// Just intonation / HEJI-lite names
const nm = (r) => T.jiName(T.monzo(r));
eq('HEJI names', ['5/3', '10/9', '40/27', '50/27', '4/3', '80/81', '125/64'].map(nm),
  ['A↓', 'D↓', 'G↓', 'B↓↓', 'F', 'C↓', 'B♯↓↓↓']);
near('syntonic comma', T.ratioCents('81/80'), 21.506, 0.001);
near('lesser diesis', T.ratioCents('128/125'), 41.059, 0.001);
near('4 commas', -4 * T.ratioCents('81/80'), -86.02, 0.01);
near('pump lap closes 81/80 flat', T.monzoCents(T.monzo('80/81')), -21.506, 0.001);
// harmonic series facts shown in section I
near('partial 7 deviation', 1200 * Math.log2(7) - 3400, -31.17, 0.01);
near('partial 11 in octave', U.mod(1200 * Math.log2(11), 1200), 551.32, 0.01);
near('partial 13 in octave', U.mod(1200 * Math.log2(13), 1200), 840.53, 0.01);
// chords
eq('31 D# h7 steps', C.make(e(31), 7, 'h7').notes.map((n) => n.steps), [7, 17, 25, 32]);
eq('h9 in 5-EDO', C.make(e(5), 0, 'h9').notes.map((n) => n.steps), [0, 2, 3, 4, 6]);
eq('5-EDO h9 spelled', C.make(e(5), 0, 'h9').notes.map((n) => n.name), ['C', 'E', 'G', 'B♭', 'D']);

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
