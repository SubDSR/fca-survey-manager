import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';
import { buildRowsFromCSV } from '../lib/csv.js';

const DataContext = createContext(null);
const EMPTY = { rows: [], criteriaLabels: [], directiveLabels: [], shortCriteriaLabels: [], excludedRows: [] };

export function DataProvider({ children }) {
  const [dataset, setDataset] = useState(EMPTY);
  const [csvMeta, setCsvMeta] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const applyResult = useCallback((result, fileName) => {
    if (!result) { setStatus('error'); setError('No se detectaron las 6 columnas de criterios y/o 3 de directivas.'); return; }
    setDataset({
      rows: result.rows, criteriaLabels: result.criteriaLabels,
      directiveLabels: result.directiveLabels, shortCriteriaLabels: result.shortCriteriaLabels,
      excludedRows: result.excludedRows,
    });
    setCsvMeta({ fileName, totalParsed: result.totalParsed, validCount: result.rows.length, excludedCount: result.excludedRows.length });
    setError(null);
    setStatus(result.rows.length ? 'ready' : 'empty');
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

  useEffect(() => { reload(); }, [reload]);

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
