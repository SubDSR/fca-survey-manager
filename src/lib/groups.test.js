import { describe, it, expect } from 'vitest';
import { groupKey, buildGroups, needsFollowUp, getFollowUpGroups } from './groups.js';

const mkRow = (over = {}) => ({
  programa: 'P', ciclo: 'I', seccion: '1', aula: '10', docente: 'Doc A', curso: 'Curso X',
  codigo: 'C1', scores: [10, 10, 10, 10, 10, 10], notaFinal: 20,
  directivas: [{ label: 'D1', value: 'Sí' }], ...over,
});

describe('agrupación', () => {
  it('agrupa por programa/ciclo/seccion/aula/docente/curso', () => {
    const rows = [mkRow(), mkRow(), mkRow({ curso: 'Curso Y' })];
    const groups = buildGroups(rows);
    expect(groups.length).toBe(2);
    const gx = groups.find((g) => g.curso === 'Curso X');
    expect(gx.rows.length).toBe(2);
  });
  it('groupKey estable y con separador |||', () => {
    expect(groupKey(mkRow())).toBe(groupKey(mkRow()));
    expect(groupKey(mkRow())).toBe('P|||I|||1|||10|||Doc A|||Curso X');
  });
  it('marca seguimiento por nota < 11', () => {
    const g = buildGroups([mkRow({ notaFinal: 10, scores: [5, 5, 5, 5, 5, 5] })])[0];
    expect(needsFollowUp(g)).toBe(true);
  });
  it('marca seguimiento por >=30% de No', () => {
    const rows = [
      mkRow({ directivas: [{ label: 'D1', value: 'No' }] }),
      mkRow({ directivas: [{ label: 'D1', value: 'No' }] }),
      mkRow({ directivas: [{ label: 'D1', value: 'Sí' }] }),
    ];
    const g = buildGroups(rows)[0];
    expect(needsFollowUp(g)).toBe(true);
  });
  it('no marca grupos sanos', () => {
    const g = buildGroups([mkRow()])[0];
    expect(needsFollowUp(g)).toBe(false);
  });
  it('getFollowUpGroups: solo marcados, con reasons, ordenados por nota asc', () => {
    const bajo = mkRow({ docente: 'Doc Bajo', notaFinal: 8, scores: [4, 4, 4, 4, 4, 4] });
    const sano = mkRow({ docente: 'Doc Sano' });
    const flagged = getFollowUpGroups(buildGroups([sano, bajo]));
    expect(flagged.map((f) => f.docente)).toEqual(['Doc Bajo']);
    expect(flagged[0].reasons.some((r) => /< 11/.test(r.label) && r.level === 'red')).toBe(true);
    expect(flagged[0].n).toBe(1);
  });
  it('getFollowUpGroups: ordena múltiples marcados por nota asc', () => {
    const notaMedia = mkRow({ docente: 'Doc Media', notaFinal: 10, scores: [5, 5, 5, 5, 5, 5] });
    const notaBaja = mkRow({ docente: 'Doc Baja', notaFinal: 6, scores: [3, 3, 3, 3, 3, 3] });
    const flagged = getFollowUpGroups(buildGroups([notaMedia, notaBaja]));
    expect(flagged.map((f) => f.docente)).toEqual(['Doc Baja', 'Doc Media']);
  });
  it('getFollowUpGroups: reason de %No con nivel yellow (30% <= pctNo < 45%)', () => {
    // 1 "No" de 3 respuestas = 33.3% -> yellow; nota alta para aislar el motivo pctNo
    const rows = [
      mkRow({ directivas: [{ label: 'D1', value: 'No' }] }),
      mkRow({ directivas: [{ label: 'D1', value: 'Sí' }] }),
      mkRow({ directivas: [{ label: 'D1', value: 'Sí' }] }),
    ];
    const flagged = getFollowUpGroups(buildGroups(rows));
    expect(flagged.length).toBe(1);
    const pctNoReason = flagged[0].reasons.find((r) => /No/.test(r.label));
    expect(pctNoReason.level).toBe('yellow');
  });
});
