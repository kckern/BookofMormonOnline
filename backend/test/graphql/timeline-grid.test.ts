import { describe, expect, it } from 'vitest';
import { mediamiscResolvers } from '../../src/graphql/resolvers/mediamisc.js';

const grid = (mediamiscResolvers.Event as any).grid;

describe('Event.grid resolver', () => {
  it('maps grid_* including anchor/tier/dir/icon', () => {
    expect(
      grid({
        grid_row: 5, grid_col: 3, grid_w: 2, grid_h: 1, grid_bg: '#123456',
        label_anchor: 'start', grid_tier: 1, grid_dir: 'r', grid_icon: 'battle',
      })
    ).toEqual({
      row: 5, col: 3, rowSpan: 1, colSpan: 2, bg: '#123456',
      anchor: 'start', tier: 1, dir: 'r', icon: 'battle',
    });
  });
  it('nulls the new fields when columns are absent (pre-migration)', () => {
    expect(grid({ grid_row: 5, grid_col: 3, grid_w: 1, grid_h: 1, grid_bg: null }))
      .toEqual({ row: 5, col: 3, rowSpan: 1, colSpan: 1, bg: null, anchor: null, tier: null, dir: null, icon: null });
  });
  it('returns null with no placement', () => {
    expect(grid({ grid_row: null })).toBeNull();
  });
});
