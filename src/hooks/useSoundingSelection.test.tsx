import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import { useSoundingSelection } from './useSoundingSelection';

const FIRST_DATA_POINT = makeWeatherPoint({ time: '2026-03-27T08:00', cityName: 'A', hour: 8 });

const DATA = [
  FIRST_DATA_POINT,
  makeWeatherPoint({ time: '2026-03-27T09:00', cityName: 'A', hour: 9 }),
  makeWeatherPoint({ time: '2026-03-27T10:00', cityName: 'A', hour: 10 }),
];

function SoundingSelectionProbe() {
  const { activeSoundingItem, closeSounding, selectSoundingItem, soundingIndex, stepSounding } =
    useSoundingSelection(DATA);

  return (
    <div>
      <output aria-label="active-time">{activeSoundingItem?.time ?? ''}</output>
      <output aria-label="active-index">{soundingIndex}</output>
      <button type="button" onClick={() => selectSoundingItem(FIRST_DATA_POINT)}>
        select first
      </button>
      <button type="button" onClick={() => stepSounding(1)}>
        next
      </button>
      <button type="button" onClick={closeSounding}>
        close
      </button>
    </div>
  );
}

describe('useSoundingSelection', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('hydrates from the sounding query param and steps within data bounds', () => {
    window.history.replaceState({}, '', '/?sounding=2026-03-27T09:00');

    render(<SoundingSelectionProbe />);

    expect(screen.getByLabelText('active-time')).toHaveTextContent('2026-03-27T09:00');
    expect(screen.getByLabelText('active-index')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(screen.getByLabelText('active-time')).toHaveTextContent('2026-03-27T10:00');
    expect(window.location.search).toBe('?sounding=2026-03-27T10%3A00');

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    expect(screen.getByLabelText('active-time')).toHaveTextContent('2026-03-27T10:00');
    expect(screen.getByLabelText('active-index')).toHaveTextContent('2');
  });

  it('selects and clears sounding URL state', () => {
    render(<SoundingSelectionProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'select first' }));

    expect(screen.getByLabelText('active-time')).toHaveTextContent('2026-03-27T08:00');
    expect(window.location.search).toBe('?sounding=2026-03-27T08%3A00');

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(screen.getByLabelText('active-time')).toHaveTextContent('');
    expect(window.location.search).toBe('');
  });
});
