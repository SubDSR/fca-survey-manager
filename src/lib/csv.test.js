import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import Papa from 'papaparse';
import {
  normalizeDirectiveValue, toNumberOrNull, detectColumnRoles, buildRowsFromCSV,
} from './csv.js';

function loadCsv() {
  const text = fs.readFileSync('reference/dataset.csv', 'utf8').replace(/^﻿/, '');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return { data: parsed.data, fields: parsed.meta.fields };
}

describe('normalización', () => {
  it('directivas', () => {
    expect(normalizeDirectiveValue('Sí')).toBe('Sí');
    expect(normalizeDirectiveValue('no')).toBe('No');
    expect(normalizeDirectiveValue('A veces')).toBe('A veces');
    expect(normalizeDirectiveValue('')).toBeNull();
  });
  it('números con coma', () => {
    expect(toNumberOrNull('10,0')).toBe(10);
    expect(toNumberOrNull('')).toBeNull();
    expect(toNumberOrNull('abc')).toBeNull();
  });
});

describe('detectColumnRoles', () => {
  it('detecta 6 criterios (P1-P6) y 3 directivas (P7-P9)', () => {
    const { data, fields } = loadCsv();
    const roles = detectColumnRoles(fields, data.slice(0, 50));
    expect(roles.criteriaCols).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
    expect(roles.directiveCols).toEqual(['P7', 'P8', 'P9']);
    expect(roles.idMap.docente).toBe('Docente');
  });
});

describe('buildRowsFromCSV', () => {
  it('produce 1649 filas válidas y 192 excluidas', () => {
    const { data, fields } = loadCsv();
    const res = buildRowsFromCSV(data, fields);
    expect(res.rows.length).toBe(1649);
    expect(res.excludedRows.length).toBe(192);
    expect(res.totalParsed).toBe(1841);
  });
  it('notaFinal = promedio de criterios * 2 (escala 20), redondeo 1 decimal', () => {
    const { data, fields } = loadCsv();
    const res = buildRowsFromCSV(data, fields);
    const r0 = res.rows[0]; // primera fila: P1..P6 = 10.0 -> promedio 10 -> nota 20
    expect(r0.notaFinal).toBe(20);
    expect(r0.criterioLabelsSanity ?? res.criteriaLabels[0]).toBe('Calidad expositiva del docente');
  });
});
