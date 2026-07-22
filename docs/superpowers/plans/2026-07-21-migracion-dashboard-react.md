# Migración Dashboard Evaluación Docente a React + Vite — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el dashboard monolítico `reference/dashboard_evaluacion_docente.html` a un proyecto React + Vite (JSX) con CSS Modules, manteniendo réplica visual y funcional exacta.

**Architecture:** Lógica de negocio pura y sin React en `src/lib/` (portada 1:1 desde el `<script>` original, testeable con Vitest). Dataset cargado en un `DataContext`. Dos vistas (`DirectorView`, `DocenteView`) que consumen el context, aplican filtros vía custom hooks + `useMemo`, y renderizan componentes de presentación y gráficos `react-chartjs-2`. Export vía ExcelJS y `window.print()`.

**Tech Stack:** Vite, React 18 (JSX, sin TypeScript), CSS Modules, PapaParse, Chart.js + react-chartjs-2, ExcelJS, Vitest.

## Global Constraints

- **Sin TypeScript.** Todo el código es `.jsx` / `.js`.
- **Sin commits durante la implementación** (instrucción explícita del usuario). Cada tarea termina en un checkpoint de **verificación**, no en `git commit`. No ejecutar `git add`/`git commit`/`git push` en ningún paso.
- **Fuente de la verdad del comportamiento:** `reference/dashboard_evaluacion_docente.html` (líneas citadas en cada tarea). El comportamiento observable debe ser idéntico.
- **CSS Modules** por componente + `src/styles/global.css` para tokens `:root` (color UNMSM `--blue: #9C1F06`), reset y `@media print`.
- **Datos del dominio portados verbatim:** `DOCENTE_CATEGORIA_MAP` (81 docentes), `DOCENTE_FACULTAD_MAP` (6 docentes), `CATEGORIA_ORDER = ['Nombrado', 'Nombrado - OF', 'Contratado']`, `labelMap` P1–P9. Copiar exactamente, sin reescribir nombres ni acentos.
- **Anclas del `reference/dataset.csv`:** 1841 filas totales → **1649 válidas**, **192 excluidas**. Programas: DOCTORADO 97, GESTIÓN EMPRESARIAL 640, GESTIÓN PÚBLICA 952, MAESTRÍA EN GESTIÓN DE NEGOCIOS INTERNACIONALES 68, MARKETING 84.
- **Ejecutar comandos** desde la raíz `C:\ProyectosUniversidad\fca-survey-manager` (shell PowerShell; el Bash tool también está disponible).

---

### Task 1: Scaffold del proyecto Vite + React

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `.gitignore`
- Create: `src/main.jsx`, `src/App.jsx`, `src/styles/global.css`
- Create: `src/App.module.css`

**Interfaces:**
- Consumes: nada.
- Produces: `App` (default export de `src/App.jsx`), dev server funcional, Vitest configurado.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "fca-survey-manager",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chart.js": "^4.4.4",
    "exceljs": "^4.4.0",
    "papaparse": "^5.4.1",
    "react": "^18.3.1",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

Run: `npm install`
Expected: crea `node_modules/` y `package-lock.json` sin errores.

- [ ] **Step 3: Crear `.gitignore`**

```gitignore
node_modules
dist
.vite
*.local
.DS_Store
```

- [ ] **Step 4: Crear `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 5: Crear `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
```

- [ ] **Step 6: Crear `index.html`** (raíz del proyecto)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reporte de Encuesta Docente</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 7: Crear `src/styles/global.css`** — portar el bloque `:root`, reset e Inter desde `reference/...html` líneas 14-39. Contenido inicial:

```css
:root{
  --bg:#F4F7FB; --card:#FFFFFF; --border:#E0E6ED; --text:#334155; --text-soft:#64748B;
  --blue:#9C1F06; --blue-light:#F8E9E7; --green:#34A853; --green-bg:#E6F4EA;
  --yellow:#FBBC05; --yellow-bg:#FEF7E0; --red:#EA4335; --red-bg:#FCE8E6; --radius:8px;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{background:var(--bg); color:var(--text);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;}
h1,h2,h3,h4{margin:0;font-weight:700;}
p{margin:0;}
```

- [ ] **Step 8: Crear `src/main.jsx`**

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Crear `src/App.jsx` y `src/App.module.css`** (placeholder mínimo verificable)

```jsx
import styles from './App.module.css';

export default function App() {
  return <main className={styles.shell}>Dashboard en construcción</main>;
}
```

```css
.shell{max-width:1280px; margin:0 auto; padding:20px 24px 60px;}
```

- [ ] **Step 10: Verificar**

Run: `npm run dev` y abrir el navegador en la URL indicada.
Expected: se ve "Dashboard en construcción" con la fuente y fondo aplicados; sin errores en consola. Detener el server (Ctrl+C).

---

### Task 2: Datos del dominio y assets

**Files:**
- Create: `src/data/constants.js`, `src/data/docenteCategoria.js`, `src/data/docenteFacultad.js`
- Create: `src/assets/logos.js`
- Create: `public/dataset.csv` (copia de `reference/dataset.csv`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `constants.js`: `ID_FIELDS`, `ID_ALIASES`, `LABEL_MAP`, `CATEGORIA_ORDER`.
  - `docenteCategoria.js`: `DOCENTE_CATEGORIA_MAP` (objeto), `getDocenteCategoria(name) → string`.
  - `docenteFacultad.js`: `DOCENTE_FACULTAD_MAP` (objeto), `getDocenteFacultad(name) → string|null`, `normDocenteName(s) → string`.
  - `logos.js`: `LOGO_UNMSM` (data URI base64 string).

- [ ] **Step 1: Copiar el dataset a `public/`**

Run (Bash tool): `cp reference/dataset.csv public/dataset.csv`
Expected: `public/dataset.csv` existe (~280 KB).

- [ ] **Step 2: Crear `src/data/constants.js`** — portar `ID_FIELDS` (ref línea 886), `ID_ALIASES` (916-924), `labelMap` (1118-1128), `CATEGORIA_ORDER` (1063).

```js
export const ID_FIELDS = ['programa', 'ciclo', 'seccion', 'aula', 'docente', 'curso', 'codigo'];

export const ID_ALIASES = {
  programa: ['programa'],
  ciclo: ['ciclo'],
  seccion: ['seccion', 'sección', 'grupo'],
  aula: ['aula', 'salon', 'salón'],
  docente: ['docente', 'profesor', 'docentes', 'profesora'],
  curso: ['curso', 'asignatura', 'materia'],
  codigo: ['codigo', 'código', 'cod. encuesta', 'codigo encuesta'],
};

export const LABEL_MAP = {
  p1: 'Calidad expositiva del docente',
  p2: 'Nivel de conocimiento del docente',
  p3: 'Capacidad del profesor para relacionar los objetivos del curso ofrecido',
  p4: 'Cumplimiento de los objetivos del curso ofrecido',
  p5: 'Satisfacción con la metodología de enseñanza aplicada por el docente',
  p6: 'Apreciación general del contenido en relación con sus expectativas',
  p7: 'Puntualidad y Asistencia del Docente',
  p8: 'Entrega del Sílabus en el Aula Virtual',
  p9: 'Disponibilidad Anticipada del Material del Curso',
};

export const CATEGORIA_ORDER = ['Nombrado', 'Nombrado - OF', 'Contratado'];
```

- [ ] **Step 3: Crear `src/data/docenteFacultad.js`** — portar `DOCENTE_FACULTAD_MAP` (1074-1081), `normDocenteName` (1087-1092), `getDocenteFacultad` (1083-1085) verbatim.

```js
export const DOCENTE_FACULTAD_MAP = {
  'Collazos Paucar, Edwin': 'Contabilidad',
  'Farfán Muñoz, Ivar Rodrigo': 'Facultad de Ciencias Contables',
  'Olivares Taipe, Paulo César': 'Facultad de Ingeniería de Sistemas e Informática',
  'Pérez Palacios, Emma': 'Facultad de Ciencias Económicas',
  'Revolledo Novoa, Álvaro Arturo': 'Facultad de Derecho y Ciencia Política',
  'Vargas Salazar, Ivonne Yanete': 'Facultad de Educación',
};

export function normDocenteName(s) {
  return String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

export function getDocenteFacultad(docenteName) {
  return DOCENTE_FACULTAD_MAP[normDocenteName(docenteName)] || null;
}
```

- [ ] **Step 4: Crear `src/data/docenteCategoria.js`** — portar `DOCENTE_CATEGORIA_MAP` verbatim desde `reference/...html` líneas 979-1061 (los 81 pares nombre→categoría, respetando acentos y apóstrofes como `Dell\'erba Ugolini, Italo`). Luego:

```js
import { normDocenteName } from './docenteFacultad.js';
// export const DOCENTE_CATEGORIA_MAP = { ...copiar 979-1061 verbatim... };
export function getDocenteCategoria(docenteName) {
  return DOCENTE_CATEGORIA_MAP[normDocenteName(docenteName)] || 'Sin categoría';
}
export function categoriaSlug(categoria) {
  return String(categoria || '').toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');
}
```

- [ ] **Step 5: Crear `src/assets/logos.js`** — extraer el data URI base64 del logo de `reference/...html` línea 554 (`<img src="data:image/webp;base64,....">`). Exportar como string:

```js
export const LOGO_UNMSM = 'data:image/webp;base64,UklGRl...'; // pegar el valor completo de la línea 554
```

- [ ] **Step 6: Verificar** — test de humo de los datos del dominio.

Create `src/data/domain.test.js`:

```js
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
```

Run: `npm test -- src/data/domain.test.js`
Expected: PASS (4 tests). Si el conteo no es 81, revisar que se copiaron todos los pares de 979-1061.

---

### Task 3: Lógica de parseo CSV (`src/lib/csv.js`)

**Files:**
- Create: `src/lib/csv.js`
- Test: `src/lib/csv.test.js`

**Interfaces:**
- Consumes: `ID_FIELDS`, `ID_ALIASES`, `LABEL_MAP` de `data/constants.js`.
- Produces:
  - `stripAccents(str) → string`, `normKey(str) → string`, `normalizeDirectiveValue(raw) → 'Sí'|'No'|'A veces'|null`, `toNumberOrNull(raw) → number|null`.
  - `detectColumnRoles(fields, sampleRows) → { idMap, criteriaCols[], directiveCols[] }`.
  - `buildRowsFromCSV(data, fields) → { rows, criteriaLabels, directiveLabels, shortCriteriaLabels, totalParsed, excludedRows } | null`.
  - Forma de cada `row`: `{ programa, ciclo, seccion, aula, docente, curso, codigo, scores:number[], notaFinal:number, directivas:[{label,value}] }`.

- [ ] **Step 1: Escribir el test que falla** — `src/lib/csv.test.js`. Usa el CSV real vía PapaParse para anclar a las cifras verificadas.

```js
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
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `npm test -- src/lib/csv.test.js`
Expected: FAIL (módulo `./csv.js` no existe / funciones indefinidas).

- [ ] **Step 3: Implementar `src/lib/csv.js`** — portar verbatim desde `reference/...html`: `stripAccents` (890-895), `normKey` (897-899), `normalizeDirectiveValue` (901-908), `toNumberOrNull` (910-914), `detectColumnRoles` (929-968), `buildRowsFromCSV` (1104-1182). Reemplazar la llamada a `alert(...)` de las líneas 1109-1115 por `return null;` (el manejo de UI se hace en el hook, Task 6). Añadir `import { ID_FIELDS, ID_ALIASES, LABEL_MAP } from '../data/constants.js';` y usar `LABEL_MAP` donde el original usa el `labelMap` local. Exportar todas las funciones nombradas.

Puntos exactos a preservar:
- Umbrales de detección: `directiveHits/total >= 0.6` → directiva; `numericHits/total >= 0.6` → criterio.
- `criteriaCols.slice(0, 6)`, `directiveCols.slice(0, 3)`.
- Requisito mínimo: `criteriaCols.length < 6 || directiveCols.length < 3` → `return null`.
- Exclusión: `validScores.length === 0`.
- `notaFinal: Math.round(promedio * 2 * 10) / 10`.

- [ ] **Step 4: Ejecutar para ver que pasa**

Run: `npm test -- src/lib/csv.test.js`
Expected: PASS (todos). Si `rows.length` no es 1649, revisar `toNumberOrNull` y el filtro de exclusión.

- [ ] **Step 5: Verificación (sin commit)** — dejar el test verde. No commitear.

---

### Task 4: Lógica de estadísticas (`src/lib/stats.js`)

**Files:**
- Create: `src/lib/stats.js`
- Test: `src/lib/stats.test.js`

**Interfaces:**
- Consumes: filas producidas por `buildRowsFromCSV`.
- Produces:
  - `computeCriteriaAverages(rows, nCrit) → number[]` (promedio por criterio en escala 20; ignora null).
  - `computeGroupStats(rows) → { nota, cumplimiento, n, criteriaAvgs }` (deriva `nCrit` de `rows[0].scores.length`; usa `computeDirectiveCounts` y `computeCriteriaAverages`).
  - `computeDirectiveCounts(rows) → { si, no, av, total, pctSi, pctNo, pctAv }` (agregado plano, sin `directiveLabels`, verbatim ref 1337-1353).
  - `computeDirectiveBreakdown(rows, directiveLabels) → [{ label, si, no, av, total, pctSi, pctNo, pctAv }]` (verbatim ref 1356-1374; `STATE.directiveLabels` → parámetro).
  - `computeDescriptiveStats(values) → { n, sum, avg, stddev, max, min }` (verbatim ref 1376-1389; SIN campos extra `variance`/`std`).

- [ ] **Step 1: Escribir el test que falla** — `src/lib/stats.test.js`.

```js
import { describe, it, expect } from 'vitest';
import { computeCriteriaAverages, computeDescriptiveStats, computeGroupStats } from './stats.js';

const mkRow = (scores, directivas = []) => ({
  scores,
  notaFinal: Math.round((scores.filter((s) => s != null).reduce((a, b) => a + b, 0) /
    scores.filter((s) => s != null).length) * 2 * 10) / 10,
  directivas,
});

describe('estadísticas', () => {
  it('promedio por criterio ignora null y escala a 20', () => {
    const rows = [mkRow([10, 8, null, 10, 10, 10]), mkRow([8, 10, 10, 10, 10, 10])];
    const avgs = computeCriteriaAverages(rows, 6);
    expect(avgs[0]).toBeCloseTo(18, 5); // (10+8)/2 = 9 -> *2 = 18
    expect(avgs[2]).toBeCloseTo(20, 5); // solo la 2da fila aportó -> 10 -> 20
  });
  it('descriptiva básica', () => {
    const d = computeDescriptiveStats([10, 20, 30]);
    expect(d.n).toBe(3);
    expect(d.avg).toBe(20);
    expect(d.min).toBe(10);
    expect(d.max).toBe(30);
  });
  it('computeGroupStats agrega nota media del grupo', () => {
    const rows = [mkRow([10, 10, 10, 10, 10, 10]), mkRow([9, 9, 9, 9, 9, 9])];
    const g = computeGroupStats(rows);
    expect(g.n).toBe(2);
    expect(g.nota).toBeCloseTo(19, 5); // (20 + 18)/2
  });
});
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `npm test -- src/lib/stats.test.js`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/lib/stats.js`** — portar verbatim desde `reference/...html`: `computeGroupStats` (1312-1324), `computeCriteriaAverages` (1325-1336), `computeDirectiveCounts` (1337-1355), `computeDirectiveBreakdown` (1356-1375), `computeDescriptiveStats` (1376-1391). Parametrizar `nCrit`/`directiveLabels` en lugar de leer del `STATE` global (recibirlos como argumentos). Exportar todas.

- [ ] **Step 4: Ejecutar para ver que pasa**

Run: `npm test -- src/lib/stats.test.js`
Expected: PASS.

---

### Task 5: Agrupación y seguimiento (`src/lib/groups.js`)

**Files:**
- Create: `src/lib/groups.js`
- Test: `src/lib/groups.test.js`

**Interfaces:**
- Consumes: filas de `buildRowsFromCSV`; `computeGroupStats` y `computeDirectiveCounts` de `stats.js`.
- Produces:
  - `groupKey(row) → string` — verbatim ref 1293-1295: `[programa, ciclo, seccion, aula, docente, curso].join('|||')`.
  - `buildGroups(rows) → [{ programa, ciclo, seccion, aula, docente, curso, rows, nota, cumplimiento, n, criteriaAvgs }]` — verbatim ref 1297-1310 (`Object.assign(g, computeGroupStats(g.rows))`; SIN campo `key`).
  - `needsFollowUp(group) → boolean` — `group.nota < 11 || computeDirectiveCounts(group.rows).pctNo >= 30`. NO recibe `directiveLabels` (el conteo es label-agnóstico).
  - `getFollowUpGroups(groups) → flaggedGroups[]` — replica `renderAlertBanner` (ref 1516-1536): por cada grupo con motivos, empuja `{ docente, programa, ciclo, seccion, aula, curso, nota, pctNo, n, reasons }`; `reasons` = `[{ label, level }]` (nota<11 → `'red'`; pctNo≥30 → `'yellow'` si <45, `'red'` si ≥45); ordenado por `nota` ascendente.

- [ ] **Step 1: Escribir el test que falla** — `src/lib/groups.test.js`.

```js
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
});
```

- [ ] **Step 2: Ejecutar para ver que falla**

Run: `npm test -- src/lib/groups.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/lib/groups.js`** — importar `computeGroupStats, computeDirectiveCounts` de `./stats.js`. Portar `groupKey` (ref 1293-1295) y `buildGroups` (ref 1297-1310) VERBATIM. Para el seguimiento, extraer la lógica de `renderAlertBanner` (ref 1516-1536) — que es solo cálculo, sin DOM: por cada grupo calcular `pctNo` con `computeDirectiveCounts(g.rows)`, construir `reasons` (nota<11 → `{label:'Nota Dim. I: '+g.nota.toFixed(1)+' (< 11)', level:'red'}`; pctNo≥30 → `{label:'% de "No": '+Math.round(pctNo)+'% (≥ 30%)', level: pctNo>=45?'red':'yellow'}`), y si `reasons.length` empujar el objeto flagged; ordenar por `nota` ascendente. `needsFollowUp(group)` = `group.nota < 11 || computeDirectiveCounts(group.rows).pctNo >= 30`. NO tocar DOM ni `STATE`.

- [ ] **Step 4: Ejecutar para ver que pasa**

Run: `npm test -- src/lib/groups.test.js`
Expected: PASS.

---

### Task 6: DataContext + carga de CSV (`useCsvLoader`)

**Files:**
- Create: `src/context/DataContext.jsx`
- Create: `src/hooks/useCsvLoader.js`
- Test: `src/hooks/useCsvLoader.test.jsx` (opcional; ver Step 5)

**Interfaces:**
- Consumes: `buildRowsFromCSV` (csv.js), PapaParse.
- Produces:
  - `DataProvider` (componente wrapper).
  - `useData()` → `{ rows, criteriaLabels, directiveLabels, shortCriteriaLabels, csvMeta, excludedRows, status, error, loadFromFile(file), reload() }`.
  - `status`: `'idle' | 'loading' | 'ready' | 'empty' | 'error'`.
  - `csvMeta`: `{ fileName, totalParsed, validCount, excludedCount }`.

- [ ] **Step 1: Implementar `src/context/DataContext.jsx`**

```jsx
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
```

- [ ] **Step 2: Crear `src/hooks/useCsvLoader.js`** — helper para el `<input type=file>`:

```js
import { useData } from '../context/DataContext.jsx';

export function useCsvLoader() {
  const { loadFromFile, csvMeta, status, error } = useData();
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFromFile(file);
    e.target.value = '';
  };
  return { onFileChange, csvMeta, status, error };
}
```

- [ ] **Step 3: Envolver App con el provider** — en `src/main.jsx`, importar `DataProvider` y envolver `<App />`:

```jsx
import { DataProvider } from './context/DataContext.jsx';
// ...
<React.StrictMode>
  <DataProvider><App /></DataProvider>
</React.StrictMode>
```

- [ ] **Step 4: Consumir estado en App temporalmente** — en `src/App.jsx`, mostrar el estado de carga:

```jsx
import styles from './App.module.css';
import { useData } from './context/DataContext.jsx';

export default function App() {
  const { status, csvMeta } = useData();
  return (
    <main className={styles.shell}>
      Estado: {status}{csvMeta ? ` — ${csvMeta.validCount} válidas, ${csvMeta.excludedCount} excluidas` : ''}
    </main>
  );
}
```

- [ ] **Step 5: Verificar en el navegador**

Run: `npm run dev`
Expected: tras cargar muestra `Estado: ready — 1649 válidas, 192 excluidas`. Sin errores de consola. Detener el server.

---

### Task 7: Layout — Topbar, EmptyState y toggle de vista

**Files:**
- Create: `src/components/common/Topbar.jsx` + `Topbar.module.css`
- Create: `src/components/common/EmptyState.jsx` + `EmptyState.module.css`
- Modify: `src/App.jsx`, `src/App.module.css`

**Interfaces:**
- Consumes: `useData()`, `useCsvLoader()`, `LOGO_UNMSM`.
- Produces:
  - `Topbar({ view, onViewChange, showToggle })`.
  - `EmptyState()`.
  - `App` renderiza Topbar + (EmptyState si `status !== 'ready'`) + vista activa.

- [ ] **Step 1: Portar estilos de topbar/empty-state** — copiar de `reference/...html` líneas 41-102 a los `.module.css` respectivos (renombrando selectores a clases locales: `.topbar`, `.brand`, `.viewToggle`, `.uploadBtn`, `.emptyState`).

- [ ] **Step 2: Implementar `Topbar.jsx`** — logo (`LOGO_UNMSM`), título "Reporte de Encuesta Docente" / subtítulo "Unidad de Posgrado · Facultad de Ciencias Administrativas", toggle de 2 botones (Vista Director de Carrera / Vista Docente Individual) visible solo si `showToggle`, y el bloque de carga CSV (`<label>` + `<input type=file hidden>` + estado del archivo) usando `useCsvLoader`. Estructura HTML de referencia: líneas 552-568.

- [ ] **Step 3: Implementar `EmptyState.jsx`** — SVG + textos de bienvenida y botón "Seleccionar Archivo CSV". Referencia: líneas 590-598.

- [ ] **Step 4: Reescribir `App.jsx`** — estado `view` (`'director' | 'docente'`), leer `status` de `useData`. Render: `<Topbar showToggle={status==='ready'} view=... onViewChange=... />`; si `status !== 'ready'` → `<EmptyState/>` (o mensaje de error si `status==='error'`); si `ready` → placeholder de la vista activa (se completa en Tasks 10-11).

- [ ] **Step 5: Verificar en navegador**

Run: `npm run dev`
Expected: se ve la topbar con logo, y como el dataset auto-carga, el toggle aparece y se muestra el placeholder de la vista Director. Al no haber datos (simular error temporal) se vería el EmptyState. Detener server.

---

### Task 8: Componentes comunes de presentación

**Files:**
- Create: `src/components/common/Card.jsx` (+ css), `Modal.jsx` (+ css), `DataTable.jsx` (+ css), `FilterSelect.jsx` (+ css), `KpiCard.jsx` (+ css)

**Interfaces:**
- Produces:
  - `Card({ title, note, children, className })`.
  - `Modal({ open, title, subtitle, onClose, children, wide })` — overlay + caja; cierra con botón `×` y click en overlay; **no** usa `window.confirm`/`alert`.
  - `DataTable({ columns, rows, sort, onSort, renderRow })` — thead con `data-key` para ordenar; tbody vía `renderRow`.
  - `FilterSelect({ label, value, options, onChange })`.
  - `KpiCard({ label, value, tone })`.

- [ ] **Step 1: Portar estilos** — de `reference/...html`: `.card`/`.section-title` (80-86), filtros/`select` (104-130), tablas (`.table-*`, `thead`, `th`, `td`, buscar en el `<style>` bloques de tabla), `.kpi-grid`/`.kpi-*`, y modales (`.modal-overlay`, `.modal-box`, `.modal-header`, `.modal-body`, `.modal-close`, `.modal-box-wide`). Copiar cada bloque al `.module.css` del componente correspondiente.

- [ ] **Step 2: Implementar los 5 componentes** — presentacionales puros (sin lógica de negocio). `Modal` renderiza `null` si `!open`; `onClose` en botón y en click del overlay (no en el click de la caja). `DataTable` invoca `onSort(key)` al click en `th[data-key]` y muestra indicador de `sort.dir`.

- [ ] **Step 3: Verificar** — montar temporalmente cada componente en `App.jsx` con datos dummy, `npm run dev`, comprobar que Card, un Select, una KpiCard, una tabla ordenable y un Modal (abrir/cerrar) se ven y funcionan. Quitar el montaje temporal después. Detener server.

---

### Task 9: Wrappers de gráficos (react-chartjs-2)

**Files:**
- Create: `src/components/charts/registerCharts.js`
- Create: `src/components/charts/BarChart.jsx`, `RadarChart.jsx`, `PieChart.jsx`, `LineChart.jsx`

**Interfaces:**
- Consumes: `chart.js`, `react-chartjs-2`.
- Produces: 4 componentes que reciben `{ data, options }` y renderizan el gráfico correspondiente. `registerCharts.js` registra los controladores/escala/elementos necesarios una sola vez.

- [ ] **Step 1: Crear `registerCharts.js`**

```js
import {
  Chart as ChartJS, CategoryScale, LinearScale, RadialLinearScale,
  BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler,
);
```

- [ ] **Step 2: Implementar los 4 wrappers** — p.ej. `BarChart.jsx`:

```jsx
import './registerCharts.js';
import { Bar } from 'react-chartjs-2';
export default function BarChart({ data, options }) {
  return <Bar data={data} options={options} />;
}
```

Análogo con `Radar`, `Pie`, `Line`.

- [ ] **Step 3: Verificar** — montar temporalmente un `BarChart` con `data`/`options` mínimos en App, `npm run dev`, confirmar que renderiza sin errores de registro de Chart.js. Quitar el montaje. Detener server.

---

### Task 10: Vista Director completa

**Files:**
- Create: `src/hooks/useDirectorFilters.js`
- Create: `src/components/director/DirectorView.jsx` (+ css)
- Create: `src/components/director/Filters.jsx`, `KpiGrid.jsx`, `AlertBanner.jsx`, `CriteriaChart.jsx`, `DirectivesChart.jsx`, `CicloTrendChart.jsx`, `DetailTable.jsx`
- Create: `src/lib/chartConfigs.js` (builders de `data`/`options` para cada gráfico)

**Interfaces:**
- Consumes: `useData()`, `lib/stats.js`, `lib/groups.js`, componentes de charts y comunes.
- Produces:
  - `useDirectorFilters(rows)` → `{ filters, setFilter, reset, search, setSearch, sort, setSort, filteredRows, options }` donde `options` = valores únicos dependientes para cada select.
  - `DirectorView({ onOpenSeguimiento, onOpenCurso })`.
  - `chartConfigs.js`: `criteriaBarConfig(criteriaAvgs, labels)`, `directivesBarConfig(breakdown)`, `cicloTrendConfig(rowsByciclo)` → `{ data, options }`.

- [ ] **Step 1: Implementar `useDirectorFilters.js`** — estado de filtros `{ programa, ciclo, seccion, aula, docente }`, `search`, `sort {key,dir}`. `filteredRows` vía `useMemo` aplicando los filtros activos (cascada como en `getDirectorFilteredRows`, ref ~2996-3030). `options` = listas únicas para cada select dependientes de los filtros previos. `reset` limpia todo. Ordenar `filteredRows` por `sort`.

- [ ] **Step 2: Implementar los subcomponentes de presentación:**
  - `Filters` — 5 `FilterSelect` + botón "Limpiar filtros" (ref 601-628).
  - `KpiGrid` — usa `renderKPIs` (ref 1484-1515) reescrito como cálculo + `KpiCard[]`.
  - `AlertBanner` — usa `getFollowUpGroups`; texto y enlace "Ver detalle →" que llama `onOpenSeguimiento` (ref 1516-1552, 630-634).
  - `CriteriaChart` — `Card` + `BarChart` con `criteriaBarConfig` (ref 1607-1639).
  - `DirectivesChart` — `Card` + `BarChart` con `directivesBarConfig` (ref 1640-1686).
  - `CicloTrendChart` — `Card` + `LineChart` con `cicloTrendConfig`, línea punteada en 11 (ref 1687-1764).
  - `DetailTable` — `Card` + búsqueda + `DataTable` de grupos con columnas docente/programa/ciclo/sección/aula/curso/nota/%cumpl/N; fila clickeable → `onOpenCurso(group)` (ref 1765-1826, 636-668).

- [ ] **Step 3: Implementar `chartConfigs.js`** — portar las configuraciones de Chart.js desde `renderCriteriaChart`, `renderDirectivesChart`, `renderCicloTrendChart`, devolviendo objetos `{ data, options }` (colores del tema: `--blue` #9C1F06, verde/amarillo/rojo). Mantener escalas (criterios 1–20) y tooltips equivalentes.

- [ ] **Step 4: Ensamblar `DirectorView.jsx`** — instancia `useDirectorFilters(rows)`, arma layout: Filters → AlertBanner → KpiGrid → grid de CriteriaChart/DirectivesChart → CicloTrendChart → DetailTable. Portar `.filters-bar`, `.charts-grid`, `.kpi-grid`, `.alert-banner` a `DirectorView.module.css`.

- [ ] **Step 5: Conectar en App** — al seleccionar vista 'director' renderizar `<DirectorView .../>`.

- [ ] **Step 6: Verificar contra el original** — `npm run dev` en paralelo con `reference/...html` abierto (cargándole el mismo `dataset.csv`). Comparar KPIs, ambos gráficos, la tendencia por ciclo y la tabla; probar filtros y búsqueda. Deben coincidir valores y comportamiento. Detener server.

---

### Task 11: Vista Docente completa

**Files:**
- Create: `src/hooks/useDocenteSelection.js`
- Create: `src/components/docente/DocenteView.jsx` (+ css)
- Create: `src/components/docente/Selectors.jsx`, `DocenteHeader.jsx`, `DocenteTabs.jsx`, `RadarPanel.jsx`, `DirectivesChecklist.jsx`, `CoursesTable.jsx`, `RawResponsesTable.jsx`

**Interfaces:**
- Consumes: `useData()`, `lib/stats.js`, `lib/groups.js`, charts, `getDocenteCategoria`, `getDocenteFacultad`, `CATEGORIA_ORDER`.
- Produces:
  - `useDocenteSelection(rows)` → `{ sel, setSel, reset, options, docenteRows, cursoRows }` con `sel = { programa, categoria, selected, curso, estado:{aprobado,desaprobado} }`.
  - `DocenteView({ onOpenCriteriaInfo, onOpenCurso })`.

- [ ] **Step 1: Implementar `useDocenteSelection.js`** — selección `programa → categoria → docente → curso` + checkboxes estado (aprobado ≥11 / desaprobado <11). `options` dependientes (categoría vía `getDocenteCategoria`, orden `CATEGORIA_ORDER`). `docenteRows` = filas del docente seleccionado (filtradas por estado); `cursoRows` = filtradas también por curso. Ref: `setupDocenteSelectors` (3031-3066), `renderDocenteView` (2453-2548).

- [ ] **Step 2: Implementar subcomponentes:**
  - `Selectors` — 4 selects + checkboxes de estado (ref 673-703).
  - `DocenteHeader` — tarjeta con nombre, categoría (+ facultad si Nombrado-OF), programa, totales (ref `renderDocenteHeader` 1900-1975, 705).
  - `DocenteTabs` — tabs "Resumen de Evaluación" / "Detalle de Encuestados" (ref 711-716).
  - `RadarPanel` — `Card` + `RadarChart` (su promedio vs promedio del programa) + botón "Más información ▾" que llama `onOpenCriteriaInfo` (ref `renderRadarChart` 1976-2032, `buildCriteriaInfoHtml` 2375-2417).
  - `DirectivesChecklist` — checklist + `PieChart` de directivas (ref 2033-2106).
  - `CoursesTable` — `DataTable` de cursos del docente; fila → `onOpenCurso(group)` (ref 2173-2232).
  - `RawResponsesTable` — tabla de encuestados individuales E1, E2… (ref 2306-2359).

- [ ] **Step 3: Ensamblar `DocenteView.jsx`** — `useDocenteSelection`, tab activo en estado local; Tab Resumen: grid RadarPanel + DirectivesChecklist, pie "Distribución de Encuestas", CoursesTable; Tab Respuestas: RawResponsesTable. Barra inferior con botones Excel/Imprimir (los handlers se conectan en Tasks 12-13). Portar estilos `.docente-*`, `.directives-list`, `.estado-checks` desde el `<style>`.

- [ ] **Step 4: Conectar en App** — vista 'docente' → `<DocenteView .../>`.

- [ ] **Step 5: Verificar contra el original** — `npm run dev` vs `reference`. Seleccionar el mismo docente/curso en ambos y comparar header, radar, checklist, pie, tablas y ambos tabs. Detener server.

---

### Task 12: Modales

**Files:**
- Create: `src/components/modals/SeguimientoModal.jsx`, `CriteriaInfoModal.jsx`, `CursoDetailModal.jsx`, `ExcludedModal.jsx`
- Modify: `src/App.jsx` (estado de modales abierto/cerrado y wiring)

**Interfaces:**
- Consumes: `Modal` común, `getFollowUpGroups`, `computeDescriptiveStats`, `csvMeta.excludedRows`.
- Produces: 4 componentes de modal que reciben `{ open, onClose, ...datosEspecíficos }`.

- [ ] **Step 1: Implementar los 4 modales** usando `Modal` común:
  - `SeguimientoModal` — lista de grupos de `getFollowUpGroups` con motivo (nota<11 / %No≥30) (ref `renderSeguimientoModal` 1553-1606, markup 848-858 aprox modal seguimiento).
  - `CriteriaInfoModal` — detalle por criterio (media/desv vs programa) (ref `buildCriteriaInfoHtml` 2375-2417).
  - `CursoDetailModal` — encuestas individuales de un curso/sección (ref `renderCursoDetailModal` 2233-2305).
  - `ExcludedModal` — registros excluidos (ref `renderExcludedModal` 1233-1266).

- [ ] **Step 2: Elevar estado de modales a App** — `App` mantiene `{ modal: null|'seguimiento'|'criteria'|'curso'|'excluded', payload }` y pasa `onOpen*`/`onClose` a las vistas y al `fileStatus` (enlace a excluidos). Renderizar los 4 modales al final del árbol.

- [ ] **Step 3: Verificar** — `npm run dev`, abrir cada modal desde su disparador (banner de alerta, "Más información", fila de curso, enlace de excluidos) y cerrar con `×` y overlay. Comparar contenido con el original. Detener server.

---

### Task 13: Exportación a Excel

**Files:**
- Create: `src/lib/excel.js`
- Modify: `src/components/docente/DocenteView.jsx` (conectar botón Excel)

**Interfaces:**
- Consumes: `exceljs`, filas del docente/curso seleccionados, stats.
- Produces: `exportToExcel({ docente, rows, criteriaLabels, directiveLabels, ... }) → Promise<void>` que genera y descarga el `.xlsx`.

- [ ] **Step 1: Implementar `src/lib/excel.js`** — portar `exportToExcel` (2609-2900 aprox) y sus helpers `buildCriteriaChartConfigForExport` (2549-2568), `buildDirectivesPieConfigForExport` (2569-2589), `buildCoursesNotaChartConfigForExport` (2590-2608). Sustituir accesos a `STATE`/DOM por parámetros. Mantener el formato oficial de columnas y la descarga (`workbook.xlsx.writeBuffer()` → `Blob` → enlace de descarga).

- [ ] **Step 2: Conectar el botón** — en `DocenteView`, `onClick` del botón "Descargar Excel" → `exportToExcel(...)` con la selección actual.

- [ ] **Step 3: Verificar** — `npm run dev`, seleccionar un docente, descargar el Excel y abrirlo; comparar estructura y valores con el export del original para el mismo docente. Detener server.

---

### Task 14: Impresión / PDF y estilos de impresión

**Files:**
- Create: `src/components/common/PrintHeader.jsx` (cabecera y pie de impresión)
- Modify: `src/styles/global.css` (bloque `@media print`), `DocenteView.jsx` (botón Imprimir)

**Interfaces:**
- Consumes: `window.print`, `csvMeta`, selección de docente.
- Produces: cabecera/pie de impresión + reglas `@media print` que ocultan controles y muestran solo el reporte.

- [ ] **Step 1: Portar estilos de impresión** — copiar todo el bloque `@media print { ... }` del `<style>` original a `global.css`, adaptando selectores a las clases nuevas (ocultar topbar, filtros, botones; mostrar `.print-header`, `.print-footer`, `.print-stat-box`).

- [ ] **Step 2: Implementar `PrintHeader.jsx`** y el pie — con logo, título "Reporte Oficial de Evaluación Docente", subtítulo, fecha y alcance (ref 573-585). Renderizar dentro de `DocenteView` (ocultos en pantalla, visibles al imprimir). Rellenar fecha/alcance como en `preparePrintMeta` (3095-3113).

- [ ] **Step 3: Conectar botón Imprimir** — `onClick` → `window.print()`.

- [ ] **Step 4: Verificar** — `npm run dev`, con un docente seleccionado usar la vista previa de impresión del navegador; confirmar que se ocultan los controles y aparece el reporte con cabecera/pie, comparable al original. Detener server.

---

### Task 15: Verificación de paridad final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite de tests** — Run: `npm test`. Expected: todas las suites de `lib/` y `data/` en verde.

- [ ] **Step 2: Build de producción** — Run: `npm run build` y luego `npm run preview`. Expected: build sin errores; el preview funciona igual que `dev`.

- [ ] **Step 3: Checklist de paridad manual** (app React vs `reference/...html`, mismo `dataset.csv`):
  - Auto-precarga muestra 1649 válidas / 192 excluidas.
  - Subir otro CSV reemplaza los datos.
  - Vista Director: filtros en cascada, KPIs, 3 gráficos, tabla con búsqueda/orden, banner y modal de seguimiento.
  - Vista Docente: selectores, header, radar, checklist+pie, pie distribución, ambos tabs, modal de criterios y de curso.
  - Export Excel abre correctamente; Imprimir muestra el reporte formateado.
  - Modal de registros excluidos accesible desde el estado del archivo.

- [ ] **Step 4: Reporte** — resumir al usuario qué se verificó y cualquier diferencia detectada. (Sin commits, según la restricción global.)

---

## Self-Review (cobertura del spec)

- Precarga + upload → Task 6. ✔
- CSS Modules + tokens globales → Tasks 1, 7-14. ✔
- Réplica exacta, código estructurado → separación `lib`/`data`/`hooks`/`components`. ✔
- react-chartjs-2 → Task 9. ✔
- Lógica pura testeable (csv/stats/groups/excel) → Tasks 3,4,5,13. ✔
- Dos vistas, gráficos, 4 modales, Excel, impresión → Tasks 10-14. ✔
- Mapas de dominio verbatim → Task 2. ✔
- Sin TypeScript, sin Redux, sin commits → Global Constraints. ✔
