import { describe, it, expect } from 'vitest';
import { computeCriteriaAverages, computeDescriptiveStats, computeGroupStats } from './stats.js';

const mkRow = (scores, directivas = []) => ({
  scores,
  notaFinal: Math.round((scores.filter((s) => s != null).reduce((a, b) => a + b, 0) /
    scores.filter((s) => s != null).length) * 2 * 10) / 10,
  directivas,
});

describe('estadísticas', () => {
  it('promedio por criterio ignora null y escala a 20', () => {
    const rows = [mkRow([10, 8, null, 10, 10, 10]), mkRow([8, 10, 10, 10, 10, 10])];
    const avgs = computeCriteriaAverages(rows, 6);
    expect(avgs[0]).toBeCloseTo(18, 5); // (10+8)/2 = 9 -> *2 = 18
    expect(avgs[2]).toBeCloseTo(20, 5); // solo la 2da fila aportó -> 10 -> 20
  });
  it('descriptiva básica', () => {
    const d = computeDescriptiveStats([10, 20, 30]);
    expect(d.n).toBe(3);
    expect(d.avg).toBe(20);
    expect(d.min).toBe(10);
    expect(d.max).toBe(30);
  });
  it('computeGroupStats agrega nota media del grupo', () => {
    const rows = [mkRow([10, 10, 10, 10, 10, 10]), mkRow([9, 9, 9, 9, 9, 9])];
    const g = computeGroupStats(rows);
    expect(g.n).toBe(2);
    expect(g.nota).toBeCloseTo(19, 5); // (20 + 18)/2
  });
});
