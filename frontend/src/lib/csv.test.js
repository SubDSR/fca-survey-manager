import { describe, it, expect } from 'vitest';
import {
  stripAccents, normKey, docenteKey, titleCaseName, buildDocenteName, titleCaseFullName,
} from './csv.js';

describe('stripAccents / normKey', () => {
  it('quita acentos y normaliza espacios', () => {
    expect(stripAccents('Sección')).toBe('Seccion');
    expect(normKey('  Sección  Múltiple ')).toBe('seccion multiple');
  });
});

describe('docenteKey', () => {
  it('produce la misma clave para el nombre de display y las columnas crudas', () => {
    expect(docenteKey('Vargas Merino, Jorge Alberto')).toBe(docenteKey('VARGAS MERINO JORGE ALBERTO'));
  });
});

describe('titleCaseName / buildDocenteName', () => {
  it('respeta palabras de enlace en minúscula', () => {
    expect(titleCaseName('JUAN DE LA CRUZ')).toBe('Juan de la Cruz');
  });
  it('arma "Apellidos, Nombres" a partir de columnas separadas', () => {
    expect(buildDocenteName('GARCIA', 'LOPEZ', 'JUAN CARLOS')).toBe('Garcia Lopez, Juan Carlos');
  });
});

describe('titleCaseFullName', () => {
  it('convierte "APELLIDOS, NOMBRES" en mayúsculas al mismo formato Title Case', () => {
    expect(titleCaseFullName('GARCIA LOPEZ, JUAN CARLOS')).toBe('Garcia Lopez, Juan Carlos');
  });
});
