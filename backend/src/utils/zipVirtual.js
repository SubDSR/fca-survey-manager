import AdmZip from 'adm-zip';
import { normalizarTexto } from './normalizar.js';

// Descomprime un ZIP de carga de encuestas virtuales (ver tarea "carga por
// lote") y separa sus entradas en CSVs válidos para procesar vs. archivos
// ignorados (carpetas, ocultos/basura del SO, no-CSV) -- el ZIP no se asume
// prolijo: puede traer .DS_Store, __MACOSX/, o carpetas anidadas.
export function extraerCsvsDeZip(buffer) {
  const zip = new AdmZip(buffer);
  const archivos = [];
  const ignorados = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const nombreCompleto = entry.entryName;
    const base = nombreCompleto.split('/').pop();

    if (!base || base.startsWith('.') || nombreCompleto.includes('__MACOSX/')) {
      continue; // basura de SO (.DS_Store, ._archivo, __MACOSX/*) -- ni se cuenta como ignorado
    }
    if (!base.toLowerCase().endsWith('.csv')) {
      ignorados.push({ nombre: nombreCompleto, motivo: 'No es un archivo .csv' });
      continue;
    }

    archivos.push({ nombreArchivo: base, contenido: entry.getData() });
  }

  return { archivos, ignorados };
}

// Cruce de validación (ver tarea): el nombre del ZIP/carpeta (ej. "Recursos
// Humanos") NO es un dato estructural obligatorio -- solo una señal de
// alerta si el programa que detectó automáticamente un archivo interno no
// tiene ninguna relación textual con él. Nunca bloquea la carga, solo
// produce una advertencia visible (se guarda en carga_csv.advertencias,
// igual que las demás advertencias del pipeline existente).
const PALABRA_MINIMA = 4; // ignora conectores cortos (de, la, en...) al comparar

export function advertenciaProgramaZip(nombreZipSinExtension, programaNombre) {
  if (!nombreZipSinExtension || !programaNombre) return null;
  const zipNorm = normalizarTexto(nombreZipSinExtension) || '';
  const progNorm = normalizarTexto(programaNombre) || '';
  if (!zipNorm || !progNorm) return null;
  if (zipNorm.includes(progNorm) || progNorm.includes(zipNorm)) return null;

  const palabrasZip = zipNorm.split(' ').filter((p) => p.length >= PALABRA_MINIMA);
  const palabrasPrograma = new Set(progNorm.split(' ').filter((p) => p.length >= PALABRA_MINIMA));
  const hayCoincidencia = palabrasZip.some((p) => palabrasPrograma.has(p));
  if (hayCoincidencia) return null;

  return `El programa detectado ("${programaNombre}") no coincide con el nombre del lote ("${nombreZipSinExtension}").`;
}
