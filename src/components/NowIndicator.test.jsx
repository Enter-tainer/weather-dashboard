import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import NowIndicator from './NowIndicator';

const COL_WIDTH = 22;
const LEGEND_WIDTH = 48;

/**
 * Helper: build mock data array with hourly timestamps.
 * @param {number} hours — number of hourly entries
 * @param {Date}   start — first timestamp
 * @param {string} cityName
 */
function makeData(hours, start, cityName = '测试城') {
  const items = [];
  const msPerHour = 3600000;
  const startMs = start.getTime();
  for (let i = 0; i < hours; i++) {
    const d = new Date(startMs + i * msPerHour);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    items.push({
      cityName,
      time: `${y}-${m}-${dd}T${hh}:00`,
      hour: d.getHours(),
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Position calculation helper (same logic as component)
// ---------------------------------------------------------------------------
const ONE_HOUR_MS = 3600000;

function computeExpectedPosition(data, nowMs) {
  for (let i = 0; i < data.length; i++) {
    const itemTimeMs = new Date(data[i].time).getTime();
    if (i === 0 && nowMs < itemTimeMs) return null;
    if (i < data.length - 1) {
      const nextTimeMs = new Date(data[i + 1].time).getTime();
      if (nowMs >= itemTimeMs && nowMs < nextTimeMs) {
        const interval = nextTimeMs - itemTimeMs;
        const fraction = interval > 0 ? (nowMs - itemTimeMs) / interval : 0;
        return LEGEND_WIDTH + (i + 0.5 + fraction) * COL_WIDTH;
      }
    } else {
      if (nowMs >= itemTimeMs && nowMs < itemTimeMs + ONE_HOUR_MS) {
        const fraction = (nowMs - itemTimeMs) / ONE_HOUR_MS;
        return LEGEND_WIDTH + (i + 0.5 + fraction) * COL_WIDTH;
      }
    }
  }
  return null;
}

describe('NowIndicator', () => {
  let dateNowSpy;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now');
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  // ── basic visibility ────────────────────────────────────────────────

  it('renders line and label when now is within data range', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);
    // now is at 12:30 — halfway through index 12
    dateNowSpy.mockReturnValue(new Date('2026-05-23T12:30').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const label = container.querySelector('.now-indicator-label');

    expect(line).not.toBeNull();
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('现在');
  });

  it('returns null when now is before the first data point', () => {
    const start = new Date('2026-05-23T10:00');
    const data = makeData(24, start);
    dateNowSpy.mockReturnValue(new Date('2026-05-23T08:00').getTime());

    const { container } = render(<NowIndicator data={data} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();
  });

  it('returns null when now is after the last data point + 1 hour', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start); // last item at 23:00, extends to 24:00
    dateNowSpy.mockReturnValue(new Date('2026-05-24T01:00').getTime());

    const { container } = render(<NowIndicator data={data} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();
  });

  it('returns null for empty data array', () => {
    const { container } = render(<NowIndicator data={[]} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();
  });

  it('returns null for data with fewer than 2 items', () => {
    const data = makeData(1, new Date('2026-05-23T00:00'));
    dateNowSpy.mockReturnValue(new Date('2026-05-23T00:30').getTime());
    const { container } = render(<NowIndicator data={data} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();
  });

  it('returns null when data is null', () => {
    const { container } = render(<NowIndicator data={null} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();
  });

  // ── position calculation ────────────────────────────────────────────

  it('positions line correctly at exact hour boundary', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);
    // now = exactly 10:00 → item index 10, fraction 0
    dateNowSpy.mockReturnValue(new Date('2026-05-23T10:00').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const expectedPx = computeExpectedPosition(data, new Date('2026-05-23T10:00').getTime());

    expect(line.style.left).toBe(`${expectedPx}px`);
  });

  it('positions line correctly between two hours (interpolation)', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);
    // now = 05:15 — 25% between index 5 and 6
    dateNowSpy.mockReturnValue(new Date('2026-05-23T05:15').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const expectedPx = computeExpectedPosition(data, new Date('2026-05-23T05:15').getTime());

    expect(line.style.left).toBe(`${expectedPx}px`);
    // Verify interpolation is working (should be between index 5 and 6 centers)
    const i5center = LEGEND_WIDTH + (5 + 0.5) * COL_WIDTH; // 48 + 5.5*22 = 169
    const i6center = LEGEND_WIDTH + (6 + 0.5) * COL_WIDTH; // 48 + 6.5*22 = 191
    expect(parseFloat(line.style.left)).toBeGreaterThan(i5center);
    expect(parseFloat(line.style.left)).toBeLessThan(i6center);
  });

  it('positions line at the last item when now is just after it', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(5, start); // 00:00 to 04:00
    // now = 04:30 — past index 4 but within 1 hour extension
    dateNowSpy.mockReturnValue(new Date('2026-05-23T04:30').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    expect(line).not.toBeNull();

    const expectedPx = computeExpectedPosition(data, new Date('2026-05-23T04:30').getTime());
    expect(line.style.left).toBe(`${expectedPx}px`);
  });

  // ── label ───────────────────────────────────────────────────────────

  it('renders "现在" label at the same x position', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);
    dateNowSpy.mockReturnValue(new Date('2026-05-23T14:00').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const label = container.querySelector('.now-indicator-label');

    expect(label.style.left).toBe(line.style.left);
    expect(label.style.transform).toBe('translateX(-50%)');
  });

  // ── edge: data spanning midnight / multiple days ────────────────────

  it('works correctly with multi-day data', () => {
    const start = new Date('2026-05-22T00:00');
    const data = makeData(48, start); // two full days
    // now is May 23 at 08:30 → index 32.5
    dateNowSpy.mockReturnValue(new Date('2026-05-23T08:30').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const expectedPx = computeExpectedPosition(data, new Date('2026-05-23T08:30').getTime());

    expect(line).not.toBeNull();
    expect(line.style.left).toBe(`${expectedPx}px`);
  });

  // ── styling ─────────────────────────────────────────────────────────

  it('line has correct inline styles for visual appearance', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);
    dateNowSpy.mockReturnValue(new Date('2026-05-23T12:00').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');

    expect(line.style.position).toBe('absolute');
    expect(line.style.width).toBe('0px');
    expect(line.style.borderLeft).toBe('1px dashed rgba(190, 45, 35, 0.25)');
    expect(line.style.pointerEvents).toBe('none');
    expect(parseInt(line.style.zIndex)).toBeGreaterThanOrEqual(100);
  });

  it('label has correct visual styles', () => {
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);
    dateNowSpy.mockReturnValue(new Date('2026-05-23T12:00').getTime());

    const { container } = render(<NowIndicator data={data} />);
    const label = container.querySelector('.now-indicator-label');

    expect(label.style.position).toBe('absolute');
    expect(label.textContent).toBe('现在');
    expect(label.style.fontSize).toBe('9px');
    expect(label.style.fontWeight).toBe('500');
    expect(label.style.pointerEvents).toBe('none');
    expect(parseInt(label.style.zIndex)).toBe(101);
  });
});
