import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setSearchParam } from '../services/urlState';
import { useSearchParam } from './useSearchParam';

function SearchParamProbe({ name }) {
  const value = useSearchParam(name);
  return <output aria-label={name}>{value ?? ''}</output>;
}

describe('useSearchParam', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('reacts to URL updates made through urlState helpers', () => {
    render(<SearchParamProbe name="compact" />);

    expect(screen.getByLabelText('compact')).toHaveTextContent('');

    act(() => setSearchParam('compact', '1'));
    expect(screen.getByLabelText('compact')).toHaveTextContent('1');

    act(() => setSearchParam('compact', null));
    expect(screen.getByLabelText('compact')).toHaveTextContent('');
  });

  it('reacts to browser navigation events', () => {
    render(<SearchParamProbe name="sounding" />);

    act(() => {
      window.history.pushState({}, '', '/?sounding=2026-03-27T09:00');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByLabelText('sounding')).toHaveTextContent('2026-03-27T09:00');
  });
});
