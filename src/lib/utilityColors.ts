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

export const UTILITY_META: Record<UtilityType, { label: string; color: string }> = {
  water: { label: 'Water', color: '#2563eb' },
  gas: { label: 'Gas', color: '#eab308' },
  electricity: { label: 'Elektriciteit', color: '#dc2626' },
  sewage: { label: 'Riolering', color: '#78350f' },
  internet: { label: 'Internet', color: '#0891b2' },
  irrigation: { label: 'Beregening', color: '#16a34a' },
  'garden-lighting': { label: 'Tuinverlichting', color: '#f59e0b' },
  drainage: { label: 'Drainage', color: '#64748b' },
};
