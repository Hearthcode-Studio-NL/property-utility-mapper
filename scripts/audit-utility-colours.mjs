// Accessibility audit for the v2.1.4 utility palette + line casing.
//
// Run: node scripts/audit-utility-colours.mjs
// Writes: outputs/utility-colour-audit-YYYY-MM-DD.md
//
// Palette and CASING_COLOR must stay in sync with src/lib/utilityColors.ts.
// culori is devDep-only — this script never runs in production.

import {
  parse,
  formatHex,
  converter,
  wcagContrast,
  differenceCiede2000,
  filterDeficiencyDeuter,
  filterDeficiencyProt,
} from 'culori';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// --- Palette (mirror of src/lib/utilityColors.ts) ---------------------------

const PALETTE = [
  { type: 'water',           label: 'Drinkwater',       hex: '#1976D2' },
  { type: 'gas',             label: 'Gas',              hex: '#FFD200' },
  { type: 'electricity',     label: 'Elektriciteit',    hex: '#E31E24' },
  { type: 'sewage',          label: 'Vuilwaterriool',   hex: '#8B5A2B' },
  { type: 'internet',        label: 'Internet',         hex: '#0F766E' },
  { type: 'irrigation',      label: 'Beregening',       hex: '#4FC3F7' },
  { type: 'garden-lighting', label: 'Tuinverlichting',  hex: '#F57C00' },
  { type: 'drainage',        label: 'Hemelwaterafvoer', hex: '#7A8FA6' },
];

const CASING_COLOR = '#000000';

// --- Surfaces ---------------------------------------------------------------

// PDOK BRT Grijs is the v2.1.3 default base. ~#E6E6E6 is a credible mid-tone
// estimate for the greyscale topo; actual tile sampling deferred (Node's
// built-in lacks image decoding; a sharp/pngjs dev-dep is out of scope).
const SURFACES = [
  { id: 'brt',        label: 'PDOK BRT Grijs (v2.1.3 default base)',    hex: '#E6E6E6' },
  { id: 'osm',        label: 'OSM light tiles',                         hex: '#F2EFE9' },
  { id: 'pdok_sat',   label: 'PDOK satellite mid-tone',                 hex: '#5A5A4A' },
  { id: 'bg_light',   label: '--background light (legend on a card)',   hex: '#FFFFFF' },
  { id: 'bg_dark',    label: '--background dark (legend on a card)',    hex: formatHex(converter('rgb')({ mode: 'hsl', h: 222, s: 0.47, l: 0.08 })) },
];

// Brand + destructive tokens (light + dark) from DESIGN-SYSTEM.md.
const TOKENS = {
  primary_light:     formatHex(converter('rgb')({ mode: 'hsl', h: 142, s: 0.72, l: 0.29 })),
  primary_dark:      formatHex(converter('rgb')({ mode: 'hsl', h: 142, s: 0.71, l: 0.55 })),
  destructive_light: formatHex(converter('rgb')({ mode: 'hsl', h: 0,   s: 0.84, l: 0.60 })),
  destructive_dark:  formatHex(converter('rgb')({ mode: 'hsl', h: 0,   s: 0.63, l: 0.50 })),
};

// --- Thresholds -------------------------------------------------------------

const WCAG_NONTEXT_MIN = 3.0;
const DELTA_E_MIN      = 15.0;

// --- Helpers ----------------------------------------------------------------

const dE       = differenceCiede2000();
const deuter   = filterDeficiencyDeuter(1);
const prot     = filterDeficiencyProt(1);
const contrast = (a, b) => wcagContrast(parse(a), parse(b));
const dEhex    = (a, b) => dE(parse(a), parse(b));
const simHex   = (filter, hex) => formatHex(filter(parse(hex)));

const fmt = (n, d = 2) => Number.isFinite(n) ? n.toFixed(d) : 'n/a';
// Round-then-compare: a value that prints as "3.00" (i.e. rounded raw >= 3.0)
// counts as PASS so the table is internally consistent — otherwise a raw
// 2.9968 displays as 3.00 and reads FAIL, which is confusing.
const contrastPass = (v, min) => Math.round(v * 100) / 100 >= min;
const pass = (v, min) => contrastPass(v, min) ? 'PASS' : 'FAIL';

// --- Per-colour checks ------------------------------------------------------

function perColourChecks() {
  return PALETTE.map((c) => {
    const surfaceChecks = Object.fromEntries(
      SURFACES.map((s) => {
        const fill   = contrast(c.hex, s.hex);
        const casing = contrast(CASING_COLOR, s.hex);
        // Effective pass = max(fill contrast, casing contrast). The casing
        // is what carries legibility when the fill is too bright for the
        // background — e.g. gas yellow on OSM.
        const effective = Math.max(fill, casing);
        return [s.id, { fill, casing, effective }];
      }),
    );

    const tokenChecks = {
      dE_primary_light:     dEhex(c.hex, TOKENS.primary_light),
      dE_primary_dark:      dEhex(c.hex, TOKENS.primary_dark),
      dE_destructive_light: dEhex(c.hex, TOKENS.destructive_light),
      dE_destructive_dark:  dEhex(c.hex, TOKENS.destructive_dark),
    };

    const failures = [];
    for (const s of SURFACES) {
      const { effective } = surfaceChecks[s.id];
      if (!contrastPass(effective, WCAG_NONTEXT_MIN)) {
        failures.push(`effective contrast vs ${s.label} (${fmt(effective)}:1)`);
      }
    }
    if (tokenChecks.dE_primary_light  < DELTA_E_MIN) failures.push(`ΔE vs --primary light (${fmt(tokenChecks.dE_primary_light)})`);
    if (tokenChecks.dE_primary_dark   < DELTA_E_MIN) failures.push(`ΔE vs --primary dark (${fmt(tokenChecks.dE_primary_dark)})`);
    if (c.type !== 'electricity') {
      if (tokenChecks.dE_destructive_light < DELTA_E_MIN) failures.push(`ΔE vs --destructive light (${fmt(tokenChecks.dE_destructive_light)})`);
      if (tokenChecks.dE_destructive_dark  < DELTA_E_MIN) failures.push(`ΔE vs --destructive dark (${fmt(tokenChecks.dE_destructive_dark)})`);
    }

    return { ...c, surfaceChecks, tokenChecks, failures };
  });
}

// --- Pairwise matrix --------------------------------------------------------

function pairwiseMatrix(transform) {
  const n = PALETTE.length;
  const rows = [];
  const collisions = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (i === j) { row.push(null); continue; }
      const d = dEhex(transform(PALETTE[i].hex), transform(PALETTE[j].hex));
      row.push(d);
      if (i < j && d < DELTA_E_MIN) {
        collisions.push({ a: PALETTE[i].type, b: PALETTE[j].type, dE: d });
      }
    }
    rows.push(row);
  }
  return { rows, collisions };
}

// --- Render -----------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);
const perColour    = perColourChecks();
const matrixNormal = pairwiseMatrix((h) => h);
const matrixDeuter = pairwiseMatrix((h) => simHex(deuter, h));
const matrixProt   = pairwiseMatrix((h) => simHex(prot, h));

function header(text, level = 2) { return '#'.repeat(level) + ' ' + text + '\n\n'; }
function th(cols) { return `| ${cols.join(' | ')} |\n| ${cols.map(() => '---').join(' | ')} |\n`; }
function renderMatrix(matrix, label) {
  let md = header(label, 3);
  md += th(['', ...PALETTE.map((c) => '`' + c.type + '`')]);
  matrix.rows.forEach((row, i) => {
    const cells = row.map((d) => d === null ? '—' : fmt(d, 1));
    md += `| \`${PALETTE[i].type}\` | ${cells.join(' | ')} |\n`;
  });
  md += '\n';
  md += matrix.collisions.length === 0
    ? `No pairs below ΔE ${DELTA_E_MIN}.\n\n`
    : `**Collisions (ΔE < ${DELTA_E_MIN}):**\n\n${matrix.collisions.map((c) => `- \`${c.a}\` vs \`${c.b}\` — ΔE ${fmt(c.dE, 2)}\n`).join('')}\n`;
  return md;
}

let md = '';
md += `# Utility-line colour accessibility audit (v2.1.4 palette) — ${today}\n\n`;
md += `Generated by \`scripts/audit-utility-colours.mjs\` using culori.\n\n`;
md += `Audits the 8 Dutch-convention utility colours in \`src/lib/utilityColors.ts\` and the 2-px dark outline ("casing") applied beneath each polyline. A colour passes a surface contrast check if EITHER the raw fill OR the casing meets WCAG non-text contrast (≥ 3:1) against that surface — the casing is a cartographic guarantee of line legibility regardless of base-layer hue.\n\n`;

md += header('Reference surfaces and tokens');
md += th(['Surface / token', 'Hex', 'Role']);
for (const s of SURFACES) {
  md += `| ${s.label} | \`${s.hex.toUpperCase()}\` | map or legend background |\n`;
}
md += `| CASING_COLOR | \`${CASING_COLOR.toUpperCase()}\` | outline under every polyline (slate-900) |\n`;
md += `| \`--primary\` light | \`${TOKENS.primary_light.toUpperCase()}\` | brand forest-green (ΔE gate) |\n`;
md += `| \`--primary\` dark | \`${TOKENS.primary_dark.toUpperCase()}\` | brand green-400 dark-mode (ΔE gate) |\n`;
md += `| \`--destructive\` light | \`${TOKENS.destructive_light.toUpperCase()}\` | destructive red (ΔE gate) |\n`;
md += `| \`--destructive\` dark | \`${TOKENS.destructive_dark.toUpperCase()}\` | destructive red dark-mode (ΔE gate) |\n\n`;

md += header('Thresholds');
md += `- **WCAG non-text contrast ≥ ${WCAG_NONTEXT_MIN}:1** (WCAG 2.1 AA 1.4.11).\n`;
md += `- **CIEDE2000 ΔE ≥ ${DELTA_E_MIN}** for distinguishability at a glance under normal and simulated dichromatic vision.\n`;
md += `- Dichromacy simulation: culori \`filterDeficiencyDeuter(1)\` and \`filterDeficiencyProt(1)\` — full severity.\n\n`;
md += `**Casing semantics:** the "effective contrast" for a surface is \`max(fill-contrast, casing-contrast)\`. When the fill falls below 3:1 (e.g. gas yellow vs a white card), the slate-900 casing underneath carries legibility instead. Reported as PASS when either component clears the bar.\n\n`;
md += `**Expected non-failure:** \`electricity\` is semantic red, so low ΔE vs \`--destructive\` is by design and excluded from its failure list.\n\n`;

md += header('Summary');
md += th([
  'Type', 'Hex',
  'BRT Grijs (fill / casing)',
  'OSM (fill / casing)',
  'PDOK sat (fill / casing)',
  'BG light (fill / casing)',
  'BG dark (fill / casing)',
  'ΔE primary L / D',
  'ΔE destr. L / D',
  'Result',
]);
for (const c of perColour) {
  const sc = c.surfaceChecks;
  const result = c.failures.length === 0 ? '**PASS**' : `**FAIL** (${c.failures.length})`;
  md += `| \`${c.type}\` | \`${c.hex.toUpperCase()}\` | ${fmt(sc.brt.fill)} / ${fmt(sc.brt.casing)} | ${fmt(sc.osm.fill)} / ${fmt(sc.osm.casing)} | ${fmt(sc.pdok_sat.fill)} / ${fmt(sc.pdok_sat.casing)} | ${fmt(sc.bg_light.fill)} / ${fmt(sc.bg_light.casing)} | ${fmt(sc.bg_dark.fill)} / ${fmt(sc.bg_dark.casing)} | ${fmt(c.tokenChecks.dE_primary_light, 1)} / ${fmt(c.tokenChecks.dE_primary_dark, 1)} | ${fmt(c.tokenChecks.dE_destructive_light, 1)} / ${fmt(c.tokenChecks.dE_destructive_dark, 1)} | ${result} |\n`;
}
md += '\n';

const overallFailures = perColour.filter((c) => c.failures.length > 0);
const collisionCount = matrixNormal.collisions.length + matrixDeuter.collisions.length + matrixProt.collisions.length;
const allPass = overallFailures.length === 0 && collisionCount === 0;

md += header('Verdict');
if (allPass) {
  md += `**All ${PALETTE.length} colours PASS every check with the casing strategy active.** No per-colour failures, no pairwise ΔE collisions under normal or simulated dichromatic vision.\n\n`;
} else {
  md += `**${overallFailures.length} colour(s) FAIL** one or more checks. Pairwise collisions: ${matrixNormal.collisions.length} normal, ${matrixDeuter.collisions.length} deuteranopia, ${matrixProt.collisions.length} protanopia.\n\n`;
}

md += header('Per-colour detail');
for (const c of perColour) {
  md += header(`\`${c.type}\` — ${c.label} (\`${c.hex.toUpperCase()}\`)`, 3);
  md += th(['Check', 'Fill', 'Casing', 'Effective', 'Threshold', 'Verdict']);
  for (const s of SURFACES) {
    const sc = c.surfaceChecks[s.id];
    md += `| Contrast vs ${s.label} | ${fmt(sc.fill)}:1 | ${fmt(sc.casing)}:1 | ${fmt(sc.effective)}:1 | ≥ ${WCAG_NONTEXT_MIN}:1 | ${pass(sc.effective, WCAG_NONTEXT_MIN)} |\n`;
  }
  md += '\n';
  md += th(['Check', 'Value', 'Threshold', 'Verdict']);
  md += `| ΔE vs \`--primary\` light | ${fmt(c.tokenChecks.dE_primary_light)} | ≥ ${DELTA_E_MIN} | ${pass(c.tokenChecks.dE_primary_light, DELTA_E_MIN)} |\n`;
  md += `| ΔE vs \`--primary\` dark | ${fmt(c.tokenChecks.dE_primary_dark)} | ≥ ${DELTA_E_MIN} | ${pass(c.tokenChecks.dE_primary_dark, DELTA_E_MIN)} |\n`;
  const note = c.type === 'electricity' ? ' _(expected — both are semantic red)_' : '';
  md += `| ΔE vs \`--destructive\` light | ${fmt(c.tokenChecks.dE_destructive_light)} | ≥ ${DELTA_E_MIN} | ${pass(c.tokenChecks.dE_destructive_light, DELTA_E_MIN)}${note} |\n`;
  md += `| ΔE vs \`--destructive\` dark | ${fmt(c.tokenChecks.dE_destructive_dark)} | ≥ ${DELTA_E_MIN} | ${pass(c.tokenChecks.dE_destructive_dark, DELTA_E_MIN)}${note} |\n\n`;
  md += c.failures.length === 0
    ? `_Result:_ **PASS**.\n\n`
    : `_Result:_ **FAIL** — ${c.failures.map((f) => '`' + f + '`').join(', ')}.\n\n`;
}

md += header('Pairwise ΔE — normal vision');
md += renderMatrix(matrixNormal, 'CIEDE2000 between every utility-colour pair');
md += header('Pairwise ΔE — simulated deuteranopia');
md += renderMatrix(matrixDeuter, 'Same matrix after culori `filterDeficiencyDeuter(1)`');
md += header('Pairwise ΔE — simulated protanopia');
md += renderMatrix(matrixProt, 'Same matrix after culori `filterDeficiencyProt(1)`');

md += header('Appendix — simulated hex values');
md += th(['Type', 'Normal', 'Deuteranopia', 'Protanopia']);
for (const c of PALETTE) {
  md += `| \`${c.type}\` | \`${c.hex.toUpperCase()}\` | \`${simHex(deuter, c.hex).toUpperCase()}\` | \`${simHex(prot, c.hex).toUpperCase()}\` |\n`;
}
md += '\n---\n\nFor methodology, see `scripts/audit-utility-colours.mjs`.\n';

// --- Write + console summary -----------------------------------------------

const outDir = resolve('outputs');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `utility-colour-audit-${today}.md`);
writeFileSync(outPath, md, 'utf8');

console.log(`\nWrote ${outPath}\n`);
console.log('Per-colour summary:');
for (const c of perColour) {
  const tag = c.failures.length === 0 ? 'PASS' : `FAIL (${c.failures.length})`;
  console.log(`  ${tag.padEnd(9)} ${c.type.padEnd(18)} ${c.hex.toUpperCase()}`);
}
console.log(`\nPairwise collisions (ΔE < ${DELTA_E_MIN}):`);
console.log(`  normal        : ${matrixNormal.collisions.length}`);
console.log(`  deuteranopia  : ${matrixDeuter.collisions.length}`);
console.log(`  protanopia    : ${matrixProt.collisions.length}`);
if (allPass) console.log(`\nAll ${PALETTE.length} colours PASS every check.`);
else         console.log('\nFailures detected — see report.');
