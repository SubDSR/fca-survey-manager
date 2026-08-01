import { describe, it, expect } from 'vitest';
import { matchDocentes } from './search.js';

const rows = [
  { docente: 'Aguilar Vargas, Karen' },
  { docente: 'Aguilar Vargas, Karen' }, // fila duplicada del mismo docente
  { docente: 'Beltrán Ríos, Carlos' },
  { docente: 'Chávez Soto, Ana' },
];

describe('matchDocentes', () => {
  it('filtra por coincidencia parcial, sin duplicados, case-insensitive', () => {
    const result = matchDocentes(rows, 'agui');
    expect(result).toEqual(['Aguilar Vargas, Karen']);
  });

  it('query vacío no devuelve nada', () => {
    expect(matchDocentes(rows, '')).toEqual([]);
    expect(matchDocentes(rows, '   ')).toEqual([]);
  });

  it('respeta el límite', () => {
    const many = [{ docente: 'A' }, { docente: 'AB' }, { docente: 'ABC' }];
    expect(matchDocentes(many, 'a', 2)).toHaveLength(2);
  });
});
