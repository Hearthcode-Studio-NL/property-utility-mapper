import type { Property } from '../types';

export type AddressParts = Pick<Property, 'street' | 'houseNumber' | 'city'>;

export function formatDisplayAddress(parts: AddressParts): string {
  const street = (parts.street ?? '').trim();
  const houseNumber = (parts.houseNumber ?? '').trim();
  const city = (parts.city ?? '').trim();

  const streetLine = [street, houseNumber].filter(Boolean).join(' ');
  return [streetLine, city].filter(Boolean).join(', ');
}
