import { describe, it, expect } from 'vitest';
import { sampleReplyShape, replyLengthInstruction } from '../../src/bots/replyShape.js';

function sequence(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.99;
}

describe('sampleReplyShape', () => {
  it('maps draws into a broad five-band, right-skewed distribution', () => {
    expect(sampleReplyShape(sequence([0.10, 0.5, 0.9])).band).toBe('micro');
    expect(sampleReplyShape(sequence([0.30, 0.5, 0.9])).band).toBe('short');
    expect(sampleReplyShape(sequence([0.65, 0.5, 0.9])).band).toBe('medium');
    expect(sampleReplyShape(sequence([0.90, 0.5, 0.9])).band).toBe('long');
    expect(sampleReplyShape(sequence([0.98, 0.5, 0.9])).band).toBe('extended');
  });

  it('produces a long tail with substantially more spread than the old sentence histogram', () => {
    let state = 0x12345678;
    const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 0x100000000);
    const samples = Array.from({ length: 20_000 }, () => sampleReplyShape(random).targetWords).sort((a, b) => a - b);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const median = samples[Math.floor(samples.length / 2)]!;
    const p10 = samples[Math.floor(samples.length * 0.1)]!;
    const p90 = samples[Math.floor(samples.length * 0.9)]!;
    expect(mean).toBeGreaterThan(median);
    expect(p90 / p10).toBeGreaterThan(5);
    expect(samples.filter((value) => value >= 131).length / samples.length).toBeCloseTo(0.05, 1);
  });

  it('retries a target too close to recent thread replies', () => {
    const shape = sampleReplyShape(sequence([
      0.30, 0.5, // short, about 30: rejected against prior 30
      0.90, 0.5, // long, about 103: accepted
      0.9,       // no link
    ]), [30]);
    expect(shape.band).toBe('long');
    expect(shape.targetWords).toBeGreaterThan(75);
  });

  it('samples scripture linking independently', () => {
    expect(sampleReplyShape(sequence([0.3, 0.5, 0.1])).wantsLink).toBe(true);
    expect(sampleReplyShape(sequence([0.3, 0.5, 0.9])).wantsLink).toBe(false);
  });
});

describe('replyLengthInstruction', () => {
  it('communicates a bounded word range and optional scripture link', () => {
    const shape = sampleReplyShape(sequence([0.65, 0.5, 0.1]));
    const instruction = replyLengthInstruction(shape);
    expect(instruction).toContain(`${shape.minWords}-${shape.maxWords} words`);
    expect(instruction).toContain('OVERRIDES');
    expect(instruction).toContain('additional supporting scripture');
  });
});
