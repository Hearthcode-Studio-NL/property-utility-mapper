import type { UtilityType } from '../types';

export const UTILITY_TYPES: UtilityType[] = [
  'water',
  'gas',
  'electricity',
  'sewage',
  'internet',
  'irrigation',
  'garden-lighting',
  'drainage',
];

/**
 * The 8 data-semantic utility-line colours.
 *
 * v2.1.4 adopted the Dutch cartographic convention: gas=yellow, electricity=red,
 * sewer (foul water)=brown, telecom=green, irrigation (clean water for the
 * garden)=light blue, garden lighting=orange, drainage (stormwater)=grey-blue,
 * drinking-water supply=deep blue. The three-colour split between foul sewer
 * (`sewage`), stormwater (`drainage`), and clean irrigation (`irrigation`) is
 * deliberate — homeowners need the separation.
 *
 * These colours are fixed across light / dark mode — semantic meaning must
 * survive a theme flip. Every line drawn on the map is rendered with a
 * `CASING_COLOR` outline underneath (see `CASING_COLOR` below + the Line /
 * Drawing / Editable / Sketch layers) so the bright fill remains legible
 * against both OSM cream and PDOK satellite imagery.
 */
export const UTILITY_META: Record<UtilityType, { label: string; color: string }> = {
  water:             { label: 'Drinkwater',       color: '#1976D2' },
  gas:               { label: 'Gas',              color: '#FFD200' },
  electricity:       { label: 'Elektriciteit',    color: '#E31E24' },
  sewage:            { label: 'Vuilwaterriool',   color: '#8B5A2B' },
  internet:          { label: 'Internet',         color: '#0F766E' },
  irrigation:        { label: 'Beregening',       color: '#4FC3F7' },
  'garden-lighting': { label: 'Tuinverlichting',  color: '#F57C00' },
  drainage:          { label: 'Hemelwaterafvoer', color: '#7A8FA6' },
};

/**
 * The dark outline rendered under every utility-line fill. Pure black: the
 * casing is a pure data colour (intentionally fixed across light/dark mode)
 * and its job is to carry legibility against any map surface — including
 * mid-grey aerial imagery where slate-900 fell below 3:1. Pure black clears
 * the bar (≥ 3:1 against every surface we draw on).
 */
export const CASING_COLOR = '#000000';
