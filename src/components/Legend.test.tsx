import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Legend from './Legend';
import { UTILITY_META, UTILITY_TYPES } from '../lib/utilityColors';

describe('Legend', () => {
  it('renders a row for every utility type', () => {
    render(<Legend />);
    for (const type of UTILITY_TYPES) {
      expect(screen.getByText(UTILITY_META[type].label)).toBeInTheDocument();
    }
  });

  it('is collapsed by default and expands on summary click', async () => {
    const user = userEvent.setup();
    const { container } = render(<Legend />);
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');

    await user.click(screen.getByText(/Legenda/i));
    expect(details).toHaveAttribute('open');
  });
});
