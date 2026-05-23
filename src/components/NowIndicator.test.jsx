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

function parseLocalTime(timeStr) {
  const [datePart, timePart] = timeStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

function getLocalNowMs() {
  const now = new Date();
  return new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), now.getMinutes(), 0, 0
  ).getTime();
}

function computeExpectedPosition(data, fakeNowDate) {
  const nowMs = getLocalNowMsAt(fakeNowDate);
  for (let i = 0; i < data.length; i++) {
    const itemTimeMs = parseLocalTime(data[i].time);
    if (i === 0 && nowMs < itemTimeMs) return null;
    if (i < data.length - 1) {
      const nextTimeMs = parseLocalTime(data[i + 1].time);
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

/** Same as getLocalNowMs but at a fixed date */
function getLocalNowMsAt(date) {
  return new Date(
    date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours(), date.getMinutes(), 0, 0
  ).getTime();
}

describe('NowIndicator', () => {
  // ── basic visibility ────────────────────────────────────────────────

  it('renders line and label when now is within data range', () => {
    vi.setSystemTime(new Date('2026-05-23T12:30:00'));
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const label = container.querySelector('.now-indicator-label');

    expect(line).not.toBeNull();
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('现在');

    vi.useRealTimers();
  });

  it('returns null when now is before the first data point', () => {
    vi.setSystemTime(new Date('2026-05-23T08:00:00'));
    const start = new Date('2026-05-23T10:00');
    const data = makeData(24, start);

    const { container } = render(<NowIndicator data={data} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();

    vi.useRealTimers();
  });

  it('returns null when now is after the last data point + 1 hour', () => {
    vi.setSystemTime(new Date('2026-05-24T01:00:00'));
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start); // last item at 23:00, extends to 24:00

    const { container } = render(<NowIndicator data={data} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();

    vi.useRealTimers();
  });

  it('returns null for empty data array', () => {
    const { container } = render(<NowIndicator data={[]} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();
  });

  it('returns null for data with fewer than 2 items', () => {
    vi.setSystemTime(new Date('2026-05-23T00:30:00'));
    const data = makeData(1, new Date('2026-05-23T00:00'));

    const { container } = render(<NowIndicator data={data} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();

    vi.useRealTimers();
  });

  it('returns null when data is null', () => {
    const { container } = render(<NowIndicator data={null} />);
    expect(container.querySelector('.now-indicator-line')).toBeNull();
  });

  // ── position calculation ────────────────────────────────────────────

  it('positions line correctly at exact hour boundary', () => {
    const fakeNow = new Date('2026-05-23T10:00:00');
    vi.setSystemTime(fakeNow);
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const expectedPx = computeExpectedPosition(data, fakeNow);

    expect(line.style.left).toBe(`${expectedPx}px`);

    vi.useRealTimers();
  });

  it('positions line correctly between two hours (interpolation)', () => {
    const fakeNow = new Date('2026-05-23T05:15:00');
    vi.setSystemTime(fakeNow);
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const expectedPx = computeExpectedPosition(data, fakeNow);

    expect(line.style.left).toBe(`${expectedPx}px`);
    // Verify interpolation is working (should be between index 5 and 6 centers)
    const i5center = LEGEND_WIDTH + (5 + 0.5) * COL_WIDTH; // 48 + 5.5*22 = 169
    const i6center = LEGEND_WIDTH + (6 + 0.5) * COL_WIDTH; // 48 + 6.5*22 = 191
    expect(parseFloat(line.style.left)).toBeGreaterThan(i5center);
    expect(parseFloat(line.style.left)).toBeLessThan(i6center);

    vi.useRealTimers();
  });

  it('positions line at the last item when now is just after it', () => {
    const fakeNow = new Date('2026-05-23T04:30:00');
    vi.setSystemTime(fakeNow);
    const start = new Date('2026-05-23T00:00');
    const data = makeData(5, start); // 00:00 to 04:00

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    expect(line).not.toBeNull();

    const expectedPx = computeExpectedPosition(data, fakeNow);
    expect(line.style.left).toBe(`${expectedPx}px`);

    vi.useRealTimers();
  });

  // ── label ───────────────────────────────────────────────────────────

  it('renders "现在" label at the same x position', () => {
    vi.setSystemTime(new Date('2026-05-23T14:00:00'));
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const label = container.querySelector('.now-indicator-label');

    expect(label.style.left).toBe(line.style.left);
    expect(label.style.transform).toBe('translateX(-50%)');

    vi.useRealTimers();
  });

  // ── edge: data spanning midnight / multiple days ────────────────────

  it('works correctly with multi-day data', () => {
    const fakeNow = new Date('2026-05-23T08:30:00');
    vi.setSystemTime(fakeNow);
    const start = new Date('2026-05-22T00:00');
    const data = makeData(48, start); // two full days

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');
    const expectedPx = computeExpectedPosition(data, fakeNow);

    expect(line).not.toBeNull();
    expect(line.style.left).toBe(`${expectedPx}px`);

    vi.useRealTimers();
  });

  // ── styling ─────────────────────────────────────────────────────────

  it('line has correct inline styles for visual appearance', () => {
    vi.setSystemTime(new Date('2026-05-23T12:00:00'));
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);

    const { container } = render(<NowIndicator data={data} />);
    const line = container.querySelector('.now-indicator-line');

    expect(line.style.position).toBe('absolute');
    expect(line.style.width).toBe('0px');
    expect(line.style.borderLeft).toBe('1px dashed rgba(190, 45, 35, 0.25)');
    expect(line.style.pointerEvents).toBe('none');
    expect(parseInt(line.style.zIndex)).toBeGreaterThanOrEqual(100);

    vi.useRealTimers();
  });

  it('label has correct visual styles', () => {
    vi.setSystemTime(new Date('2026-05-23T12:00:00'));
    const start = new Date('2026-05-23T00:00');
    const data = makeData(24, start);

    const { container } = render(<NowIndicator data={data} />);
    const label = container.querySelector('.now-indicator-label');

    expect(label.style.position).toBe('absolute');
    expect(label.textContent).toBe('现在');
    expect(label.style.fontSize).toBe('9px');
    expect(label.style.fontWeight).toBe('500');
    expect(label.style.pointerEvents).toBe('none');
    expect(parseInt(label.style.zIndex)).toBe(101);

    vi.useRealTimers();
  });
});
