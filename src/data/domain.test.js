import { describe, it, expect } from 'vitest';
import { CATEGORIA_ORDER, categoriaSlug } from './constants.js';
import { buildDocenteName, docenteKey } from '../lib/csv.js';
import { buildRoster, enrichRowsWithRoster } from './roster.js';

// Fixture con la misma forma que public/docentes.csv.
const ROSTER_FIELDS = ['Facultad', 'Condición', 'Apellido Paterno', 'Apellido Materno', 'Nombres', 'Correo', 'Grado Académico'];
const ROSTER_RECORDS = [
  { Facultad: 'Ciencias Administrativas', 'Condición': 'Nombrado', 'Apellido Paterno': 'VARGAS', 'Apellido Materno': 'MERINO', Nombres: 'JORGE ALBERTO', Correo: '', 'Grado Académico': 'Doctor' },
  { Facultad: 'Ciencias Administrativas', 'Condición': 'Contratado', 'Apellido Paterno': 'FUCHS', 'Apellido Materno': 'ANGELES', Nombres: 'ROSA MARÍA', Correo: '', 'Grado Académico': 'Doctor' },
  { Facultad: 'Ingeniería Industrial', 'Condición': 'Nombrado - OF', 'Apellido Paterno': 'PÉREZ', 'Apellido Materno': 'PALACIOS', Nombres: 'EMMA', Correo: 'eperezp@unmsm.edu.pe', 'Grado Académico': 'Doctor' },
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
  const roster = buildRoster(ROSTER_RECORDS, ROSTER_FIELDS);

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
