import { describe, expect, it } from 'vitest';
import { makeWeatherPoint } from '../test-utils/weather';
import { getPrecipitationPointForCell } from './timelineTime';

describe('timeline time semantics', () => {
  it('places preceding-hour precipitation in the cell that the interval covers', () => {
    const data = [0, 1, 2].map((hour) =>
      makeWeatherPoint({
        time: `2026-07-11T0${hour}:00:00Z`,
        timeUtcMs: Date.parse(`2026-07-11T0${hour}:00:00Z`),
        hour,
        precipitation: 10 + hour,
        precipitationInterval: 'preceding-hour',
      }),
    );

    expect(getPrecipitationPointForCell(data, 0)?.precipitation).toBe(11);
    expect(getPrecipitationPointForCell(data, 1)?.precipitation).toBe(12);
    expect(getPrecipitationPointForCell(data, 2)).toBeNull();
  });

  it('keeps already normalized cell precipitation in its own cell', () => {
    const item = makeWeatherPoint({ precipitation: 2.5, precipitationInterval: 'cell' });
    expect(getPrecipitationPointForCell([item], 0)).toBe(item);
  });
});
