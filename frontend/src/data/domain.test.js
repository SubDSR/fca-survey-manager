import { describe, it, expect } from 'vitest';
import { CATEGORIA_ORDER, categoriaSlug } from './constants.js';
import { buildDocenteName, docenteKey } from '../lib/csv.js';
import { buildRosterFromApi, enrichRowsWithRoster } from './roster.js';

// Fixture con la misma forma que devuelve GET /api/docentes.
const ROSTER_RECORDS = [
  { id: 1, nombre_completo: 'Vargas Merino, Jorge Alberto', condicion: 'Nombrado', facultad: 'Ciencias Administrativas', grado_academico: 'Doctor', correo_institucional: '' },
  { id: 2, nombre_completo: 'Fuchs Angeles, Rosa María', condicion: 'Contratado', facultad: 'Ciencias Administrativas', grado_academico: 'Doctor', correo_institucional: '' },
  { id: 3, nombre_completo: 'Pérez Palacios, Emma', condicion: 'Nombrado - OF', facultad: 'Ingeniería Industrial', grado_academico: 'Doctor', correo_institucional: 'eperezp@unmsm.edu.pe' },
];

describe('nombres de docente', () => {
  it('arma el nombre de display en Title Case: "Apellidos, Nombres"', () => {
    expect(buildDocenteName('VARGAS', 'MERINO', 'JORGE ALBERTO')).toBe('Vargas Merino, Jorge Alberto');
    expect(buildDocenteName('FUCHS', 'ANGELES', 'ROSA MARÍA')).toBe('Fuchs Angeles, Rosa María');
  });

  it('la clave normalizada coincide entre display y columnas crudas', () => {
    expect(docenteKey('Vargas Merino, Jorge Alberto')).toBe(docenteKey('VARGAS MERINO JORGE ALBERTO'));
    // insensible a acentos y comas
    expect(docenteKey('Pérez Palacios, Emma')).toBe('perez palacios emma');
  });
});

describe('roster de docentes', () => {
  const roster = buildRosterFromApi(ROSTER_RECORDS);

  it('indexa por clave de docente con categoría y facultad', () => {
    const info = roster.get(docenteKey('Vargas Merino, Jorge Alberto'));
    expect(info.categoria).toBe('Nombrado');
    expect(info.facultad).toBe('Ciencias Administrativas');
  });

  it('enriquece las filas con categoría y facultad', () => {
    const rows = [
      { docente: 'Vargas Merino, Jorge Alberto' },
      { docente: 'Pérez Palacios, Emma' },
      { docente: 'Nadie Inexistente' },
    ];
    const enriched = enrichRowsWithRoster(rows, roster);
    expect(enriched[0].categoria).toBe('Nombrado');
    expect(enriched[1].categoria).toBe('Nombrado - OF');
    expect(enriched[1].facultad).toBe('Ingeniería Industrial');
    // docente ausente del roster: degrada sin romper
    expect(enriched[2].categoria).toBe('Sin categoría');
    expect(enriched[2].facultad).toBeNull();
  });
});

describe('constantes de categoría', () => {
  it('orden de categorías', () => {
    expect(CATEGORIA_ORDER).toEqual(['Nombrado', 'Nombrado - OF', 'Contratado']);
  });
  it('slug para clase CSS', () => {
    expect(categoriaSlug('Nombrado - OF')).toBe('nombrado-of');
    expect(categoriaSlug('Contratado')).toBe('contratado');
  });
});
