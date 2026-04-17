import { describe, expect, it } from 'vitest';
import { formatDisplayAddress } from './address';

describe('formatDisplayAddress', () => {
  it('returns "Street Number, City" for a typical case', () => {
    expect(
      formatDisplayAddress({
        street: 'Herengracht',
        houseNumber: '1',
        city: 'Amsterdam',
      }),
    ).toBe('Herengracht 1, Amsterdam');
  });

  it('passes house-number suffixes through unchanged', () => {
    expect(
      formatDisplayAddress({
        street: 'Keizersgracht',
        houseNumber: '12A',
        city: 'Amsterdam',
      }),
    ).toBe('Keizersgracht 12A, Amsterdam');

    expect(
      formatDisplayAddress({
        street: 'Prinsengracht',
        houseNumber: '1-3',
        city: 'Utrecht',
      }),
    ).toBe('Prinsengracht 1-3, Utrecht');
  });

  it('does not normalise casing — whatever went in comes out', () => {
    expect(
      formatDisplayAddress({
        street: 'HERENGRACHT',
        houseNumber: '1',
        city: 'amsterdam',
      }),
    ).toBe('HERENGRACHT 1, amsterdam');
  });

  it('trims surrounding whitespace in each part', () => {
    expect(
      formatDisplayAddress({
        street: '  Herengracht  ',
        houseNumber: ' 1 ',
        city: ' Amsterdam ',
      }),
    ).toBe('Herengracht 1, Amsterdam');
  });

  it('omits parts that are empty or missing', () => {
    expect(
      formatDisplayAddress({ street: 'Herengracht', houseNumber: '', city: 'Amsterdam' }),
    ).toBe('Herengracht, Amsterdam');

    expect(
      formatDisplayAddress({ street: '', houseNumber: '1', city: 'Amsterdam' }),
    ).toBe('1, Amsterdam');

    expect(formatDisplayAddress({ street: '', houseNumber: '', city: '' })).toBe('');
  });
});
