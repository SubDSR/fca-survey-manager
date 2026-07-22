import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { buildRowsFromCSV } from '../lib/csv.js';
import { buildRoster, enrichRowsWithRoster } from '../data/roster.js';

const DataContext = createContext(null);
const EMPTY = { rows: [], criteriaLabels: [], directiveLabels: [], shortCriteriaLabels: [], excludedRows: [] };

export function DataProvider({ children }) {
  const [dataset, setDataset] = useState(EMPTY);
  const [csvMeta, setCsvMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  // Roster de docentes (categoría/facultad) cargado desde public/docentes.csv.
  // Se guarda en un ref para que el enriquecimiento sea síncrono al aplicar un
  // dataset, tanto en la precarga como al subir un CSV.
  const rosterRef = useRef(new Map());

  const applyResult = useCallback((result, fileName) => {
    if (!result) { setStatus('error'); setError('No se detectaron las 6 columnas de criterios y/o 3 de directivas.'); return; }
    const rows = enrichRowsWithRoster(result.rows, rosterRef.current);
    setDataset({
      rows, criteriaLabels: result.criteriaLabels,
      directiveLabels: result.directiveLabels, shortCriteriaLabels: result.shortCriteriaLabels,
      excludedRows: result.excludedRows,
    });
    setCsvMeta({ fileName, totalParsed: result.totalParsed, validCount: rows.length, excludedCount: result.excludedRows.length });
    setError(null);
    setStatus(rows.length ? 'ready' : 'empty');
  }, []);

  const parseText = useCallback((text, fileName) => {
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    applyResult(buildRowsFromCSV(parsed.data, parsed.meta.fields || []), fileName);
  }, [applyResult]);

  const loadFromFile = useCallback((file) => {
    setStatus('loading');
    Papa.parse(file, { header: true, skipEmptyLines: true,
      complete: (res) => applyResult(buildRowsFromCSV(res.data, res.meta.fields || []), file.name),
      error: () => { setStatus('error'); setError('No se pudo leer el archivo.'); },
    });
  }, [applyResult]);

  const reload = useCallback(() => {
    setStatus('loading');
    fetch('/dataset.csv').then((r) => r.text()).then((t) => parseText(t, 'dataset.csv'))
      .catch(() => { setStatus('error'); setError('No se pudo cargar el dataset incluido.'); });
  }, [parseText]);

  // Carga inicial: primero el roster de docentes y luego el dataset, de modo que
  // las filas ya se puedan enriquecer con categoría/facultad. Si el roster falla,
  // se continúa igual (los docentes quedarán como "Sin categoría").
  useEffect(() => {
    let cancelled = false;
    fetch('/docentes.csv')
      .then((r) => r.text())
      .then((t) => {
        if (cancelled) return;
        const parsed = Papa.parse(t, { header: true, skipEmptyLines: true });
        rosterRef.current = buildRoster(parsed.data, parsed.meta.fields || []);
      })
      .catch(() => { /* sin roster: se degrada a "Sin categoría" */ })
      .finally(() => { if (!cancelled) reload(); });
    return () => { cancelled = true; };
  }, [reload]);

  return (
    <DataContext.Provider value={{ ...dataset, csvMeta, status, error, loadFromFile, reload }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}
