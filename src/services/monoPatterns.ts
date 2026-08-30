export type MonoPatternId =
  | 'empty'
  | 'dots-1'
  | 'dots-2'
  | 'dots-3'
  | 'diagonal-1'
  | 'diagonal-2'
  | 'horizontal'
  | 'crosshatch'
  | 'solid';

export type MonoPatternClass = `eink-pattern-${MonoPatternId}`;

export function monoPatternClass(id: MonoPatternId): MonoPatternClass {
  return `eink-pattern-${id}`;
}

type PatternPoint = readonly [x: number, y: number];

const PATTERN_POINTS: Record<Exclude<MonoPatternId, 'empty' | 'solid'>, readonly PatternPoint[]> = {
  'dots-1': [[1, 1]],
  'dots-2': [
    [1, 1],
    [5, 5],
  ],
  'dots-3': [
    [1, 1],
    [3, 3],
    [5, 1],
    [7, 3],
    [1, 5],
    [3, 7],
    [5, 5],
    [7, 7],
  ],
  'diagonal-1': [
    [0, 0],
    [4, 4],
  ],
  'diagonal-2': [
    [0, 0],
    [2, 2],
    [4, 4],
    [6, 6],
  ],
  horizontal: [
    [0, 1],
    [2, 1],
    [4, 1],
    [6, 1],
    [0, 5],
    [2, 5],
    [4, 5],
    [6, 5],
  ],
  crosshatch: [
    [0, 0],
    [2, 2],
    [4, 4],
    [6, 6],
    [6, 0],
    [4, 2],
    [2, 4],
    [0, 6],
  ],
};

const patternCache = new WeakMap<
  CanvasRenderingContext2D,
  Map<MonoPatternId, CanvasPattern | null>
>();

/** Create a small binary tile. Patterns are cached per 2D context. */
export function getMonoPattern(
  ctx: CanvasRenderingContext2D,
  id: MonoPatternId,
): CanvasPattern | string {
  if (id === 'empty') return '#ffffff';
  if (id === 'solid') return '#000000';
  if (typeof document === 'undefined') return '#ffffff';

  let cache = patternCache.get(ctx);
  if (!cache) {
    cache = new Map();
    patternCache.set(ctx, cache);
  }
  if (cache.has(id)) return cache.get(id) ?? '#ffffff';

  const tile = document.createElement('canvas');
  tile.width = 8;
  tile.height = 8;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) {
    cache.set(id, null);
    return '#ffffff';
  }

  tileCtx.fillStyle = '#ffffff';
  tileCtx.fillRect(0, 0, tile.width, tile.height);
  tileCtx.fillStyle = '#000000';
  for (const [x, y] of PATTERN_POINTS[id]) tileCtx.fillRect(x, y, 1, 1);

  const pattern = ctx.createPattern(tile, 'repeat');
  cache.set(id, pattern);
  return pattern ?? '#ffffff';
}

export function monoPatternForUnit(value: number | null | undefined): MonoPatternId {
  if (value == null || value <= 0) return 'empty';
  if (value < 0.25) return 'dots-1';
  if (value < 0.5) return 'dots-2';
  return 'dots-3';
}
