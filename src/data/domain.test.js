import { describe, it, expect } from 'vitest';
import { DOCENTE_CATEGORIA_MAP, getDocenteCategoria } from './docenteCategoria.js';
import { getDocenteFacultad } from './docenteFacultad.js';
import { CATEGORIA_ORDER } from './constants.js';

describe('datos de dominio', () => {
  it('mapa de categorías tiene 81 docentes', () => {
    expect(Object.keys(DOCENTE_CATEGORIA_MAP).length).toBe(81);
  });
  it('resuelve categoría conocida y desconocida', () => {
    expect(getDocenteCategoria('Vargas Merino, Jorge Alberto')).toBe('Nombrado');
    expect(getDocenteCategoria('Nadie Inexistente')).toBe('Sin categoría');
  });
  it('facultad solo para Nombrado - OF', () => {
    expect(getDocenteFacultad('Pérez Palacios, Emma')).toBe('Facultad de Ciencias Económicas');
    expect(getDocenteFacultad('Vargas Merino, Jorge Alberto')).toBeNull();
  });
  it('orden de categorías', () => {
    expect(CATEGORIA_ORDER).toEqual(['Nombrado', 'Nombrado - OF', 'Contratado']);
  });
});
