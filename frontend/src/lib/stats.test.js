import { describe, it, expect } from 'vitest';
import { computeCriteriaAverages, computeDescriptiveStats, computeGroupStats, classifyDocentesByEstado, computeDocenteVsPrograma } from './stats.js';

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

describe('classifyDocentesByEstado', () => {
  // rows son grupos docente+asignatura+ciclo+sección (GET /api/encuestas/
  // consolidado), cada uno con su propio n -- el promedio por docente debe
  // ponderarse por n, igual que computeDocenteVsPrograma.
  it('clasifica aprobado (promedio ponderado >= 14) y desaprobado (< 14) por docente', () => {
    const rows = [
      { docente: 'Ana', notaFinal: 16, n: 5 },
      { docente: 'Ana', notaFinal: 14, n: 5 },
      { docente: 'Beto', notaFinal: 10, n: 5 },
      { docente: 'Beto', notaFinal: 12, n: 5 },
    ];
    const result = classifyDocentesByEstado(rows);
    expect(result.get('Ana')).toBe('aprobado');
    expect(result.get('Beto')).toBe('desaprobado');
  });

  it('el umbral exacto 14 cuenta como aprobado', () => {
    const rows = [{ docente: 'Cati', notaFinal: 14, n: 3 }];
    expect(classifyDocentesByEstado(rows).get('Cati')).toBe('aprobado');
  });

  it('pondera por n: una sección con más encuestas pesa más que una con pocas', () => {
    const rows = [
      { docente: 'Dora', notaFinal: 20, n: 1 }, // pesa poco
      { docente: 'Dora', notaFinal: 10, n: 9 }, // pesa mucho -> promedio ponderado 11
    ];
    expect(classifyDocentesByEstado(rows).get('Dora')).toBe('desaprobado');
  });
});

describe('computeDocenteVsPrograma', () => {
  // cursoRows/programaRows son ahora filas de GET /api/encuestas/consolidado
  // (una por grupo docente+asignatura+ciclo+sección, con notaFinal=nota_promedio
  // y n=n_encuestas de ese grupo) en vez de una fila por encuesta individual
  // -- el promedio debe ponderarse por n, no ser un promedio simple de grupos.
  it('calcula nota del docente, del programa, delta y aprobado (grupos con igual peso)', () => {
    const cursoRows = [{ notaFinal: 16, n: 5 }, { notaFinal: 14, n: 5 }]; // avg 15
    const programaRows = [{ notaFinal: 12, n: 5 }, { notaFinal: 12, n: 5 }]; // avg 12
    const result = computeDocenteVsPrograma(cursoRows, programaRows);
    expect(result.notaDocente).toBeCloseTo(15, 5);
    expect(result.notaPrograma).toBeCloseTo(12, 5);
    expect(result.delta).toBeCloseTo(3, 5);
    expect(result.aprobado).toBe(true);
    expect(result.n).toBe(10);
  });

  it('pondera por n: un grupo con más encuestas pesa más en el promedio', () => {
    const cursoRows = [{ notaFinal: 20, n: 1 }, { notaFinal: 10, n: 9 }]; // (20*1 + 10*9)/10 = 11
    const result = computeDocenteVsPrograma(cursoRows, []);
    expect(result.notaDocente).toBeCloseTo(11, 5);
    expect(result.n).toBe(10);
  });

  it('programaRows vacío no rompe (notaPrograma = 0)', () => {
    const result = computeDocenteVsPrograma([{ notaFinal: 10, n: 3 }], []);
    expect(result.notaPrograma).toBe(0);
    expect(result.aprobado).toBe(false);
  });
});
