# Diseño: Migración del Dashboard de Evaluación Docente a React + Vite

**Fecha:** 2026-07-21
**Estado:** Aprobado (diseño)

## Contexto

Existe un dashboard client-side de evaluación docente entregado como un único archivo
`dashboard_evaluacion_docente.html` (~455 KB, ~3145 líneas) más un `dataset.csv` de
ejemplo (1841 filas de encuestas). Todo el procesamiento ocurre en el navegador.

El objetivo es migrar ese HTML monolítico a un proyecto **React + Vite (JSX, JavaScript
plano, sin TypeScript)** con **CSS Modules**, manteniendo una **réplica visual y funcional
exacta**, pero con el código internamente bien estructurado en componentes, hooks y una
capa de lógica pura.

El directorio de trabajo (`C:\ProyectosUniversidad\fca-survey-manager`) está vacío salvo
`.git` y `.claude` — se monta el proyecto desde cero.

## Decisiones tomadas (brainstorming)

1. **Carga de datos:** precargar automáticamente el `dataset.csv` incluido al iniciar,
   y además permitir que el usuario suba otro CSV que lo reemplace.
2. **Estilos:** CSS Modules por componente + un `global.css` con los tokens de tema
   (`:root`), reset y estilos de impresión.
3. **Fidelidad:** réplica visual/funcional exacta con código bien estructurado.
4. **Gráficos:** `react-chartjs-2` (wrapper oficial de Chart.js) en lugar de instancias
   manuales de Chart.js.
5. **Sin TypeScript, sin Redux.** Estado con React Context + custom hooks.

## Descripción funcional del original (a preservar)

La app tiene dos vistas conmutables mediante un toggle en la barra superior (oculto hasta
que hay datos cargados):

### Vista Director de Carrera
- Barra de filtros: Programa, Ciclo, Sección, Aula, Docente + botón "Limpiar filtros".
- Banner de alerta con enlace a modal de "docentes que requieren seguimiento".
- Grid de KPIs.
- Gráfico de barras "Promedio por criterio evaluado".
- Gráfico "Cumplimiento de directivas académicas".
- Gráfico de línea "Evolución de Nota Promedio y Cumplimiento por Ciclo" (con línea
  punteada de nota mínima = 11).
- Tabla "Detalle por docente / curso" con búsqueda y ordenamiento por columnas.

### Vista Docente Individual
- Selectores: Programa, Categoría, Docente, Curso + checkboxes de Estado
  (Aprobados / Desaprobados).
- Tarjeta de cabecera del docente.
- Tabs: "Resumen de Evaluación" y "Detalle de Encuestados".
- Tab Resumen: radar "Desempeño por criterio" (vs promedio del programa) con panel "Más
  información"; checklist + pie de "Cumplimiento de directivas"; pie "Distribución de
  Encuestas"; tabla "Cursos dictados por el docente".
- Tab Respuestas: tabla de encuestados individuales (E1, E2, E3…).
- Barra inferior: "Descargar Excel (Formato Oficial)" e "Imprimir / Exportar a PDF".

### Modales
- Docentes que requieren seguimiento (nota Dim. I < 11, o ≥30% de respuestas "No").
- Detalle de desempeño por criterio.
- Encuestas de un curso específico.
- Registros excluidos del análisis (por falta de datos).

### Lógica de negocio (a portar 1:1)
- Detección automática de roles de columnas del CSV (`detectColumnRoles`, alias de campos
  de identificación, columnas de criterios numéricos vs. directivas Sí/No).
- Normalización de valores (acentos, números con coma/punto, valores directivos).
- Mapas hardcodeados: docente → categoría (`DOCENTE_CATEGORIA_MAP`) y docente → facultad
  (`DOCENTE_FACULTAD_MAP`), con orden de categorías.
- Cálculo de estadísticas: promedios por grupo, promedios por criterio, conteos y desglose
  de directivas, estadística descriptiva (media, varianza, etc.).
- Agrupación de filas por docente/curso y detección de grupos que requieren seguimiento.
- Exportación a Excel con formato oficial (ExcelJS) incluyendo configuraciones de gráficos.
- Logos institucionales embebidos como base64 (webp).

## Arquitectura propuesta

### Stack / dependencias
- `react`, `react-dom`, `vite`, `@vitejs/plugin-react`
- `papaparse` (parseo CSV)
- `chart.js` + `react-chartjs-2` (gráficos)
- `exceljs` (export Excel)
- Fuente Inter vía `<link>` en `index.html`

### Estructura de carpetas
```
fca-survey-manager/
├─ index.html
├─ package.json
├─ vite.config.js
├─ public/
│  └─ dataset.csv                 ← incluido, auto-precarga al iniciar
├─ src/
│  ├─ main.jsx
│  ├─ App.jsx                     ← layout, toggle de vista, estado vacío
│  ├─ assets/logos.js             ← logos base64 extraídos del HTML
│  ├─ styles/
│  │  ├─ global.css               ← tokens :root, reset, estilos de impresión
│  │  └─ *.module.css             ← por componente
│  ├─ data/
│  │  ├─ docenteCategoria.js      ← DOCENTE_CATEGORIA_MAP
│  │  ├─ docenteFacultad.js       ← DOCENTE_FACULTAD_MAP
│  │  └─ constants.js             ← labels, ID_ALIASES, CATEGORIA_ORDER, ID_FIELDS
│  ├─ lib/                         ← lógica pura (sin React, testeable)
│  │  ├─ csv.js                   ← detectColumnRoles, buildRowsFromCSV, normalización
│  │  ├─ stats.js                 ← computeGroupStats, criteriaAverages, descriptiveStats
│  │  ├─ groups.js                ← buildGroups, groupKey, detección de seguimiento
│  │  └─ excel.js                 ← exportToExcel
│  ├─ context/
│  │  └─ DataContext.jsx          ← dataset cargado (rows, labels, csvMeta, excludedRows)
│  ├─ hooks/
│  │  ├─ useCsvLoader.js          ← precarga fetch + upload
│  │  ├─ useDirectorFilters.js
│  │  └─ useDocenteSelection.js
│  └─ components/
│     ├─ common/                  ← Card, Modal, DataTable, Select, KpiCard, EmptyState
│     ├─ charts/                  ← BarChart, RadarChart, PieChart, LineChart
│     ├─ director/                ← DirectorView, Filters, KpiGrid, AlertBanner,
│     │                             CriteriaChart, DirectivesChart, CicloTrendChart, DetailTable
│     ├─ docente/                 ← DocenteView, Selectors, Header, Tabs, RadarPanel,
│     │                             DirectivesChecklist, CoursesTable, RawResponsesTable
│     └─ modals/                  ← SeguimientoModal, CriteriaInfoModal,
│                                    CursoDetailModal, ExcludedModal
```

**Principio de aislamiento:** `lib/` contiene lógica de negocio pura portada 1:1 desde el
`<script>` original, sin dependencias de React ni del DOM, para que sea testeable de forma
aislada. Los componentes solo componen UI y consumen esa lógica.

### Manejo de estado
El objeto global `STATE` del original se descompone en:
- **DataContext** — dataset cargado una vez: `rows`, `criteriaLabels`,
  `shortCriteriaLabels`, `directiveLabels`, `csvMeta`, `excludedRows`. Función `loadData`
  y `loadFromFile` para reemplazar el dataset.
- **Estado local por vista** vía custom hooks:
  - `useDirectorFilters` → `{ programa, ciclo, seccion, aula, docente }`, `search`,
    `sortKey`, `sortDir`.
  - `useDocenteSelection` → `{ programa, categoria, selected, curso, estado }`.
- **`useMemo`** para todos los cálculos derivados (filtrado, agrupación, stats), que
  reemplaza las funciones imperativas `renderDirectorView()` / `renderDocenteView()`.

### Flujo de datos
1. Al montar, `useCsvLoader` hace `fetch('/dataset.csv')` → PapaParse →
   `buildRowsFromCSV` → puebla el DataContext.
2. Un CSV subido por el usuario pasa por el mismo pipeline y reemplaza el Context.
3. Cada vista consume el Context, aplica sus filtros vía hooks + `useMemo`, y pasa datos a
   componentes de presentación y a los gráficos `react-chartjs-2`.
4. Export: `lib/excel.js` (ExcelJS) y `window.print()` con estilos `@media print`.

### Gráficos
Cada gráfico es un componente en `components/charts/` que envuelve el componente
correspondiente de `react-chartjs-2` (`Bar`, `Radar`, `Pie`, `Line`) recibiendo `data` y
`options` ya calculados. Registro de los módulos de Chart.js necesarios una sola vez.

## Alcance / no-objetivos
- **No** se cambia el diseño visual, colores, textos ni comportamiento observable.
- **No** se añade TypeScript, Redux, ni router.
- **No** se añaden funcionalidades nuevas más allá de la auto-precarga del CSV incluido.
- Los mapas hardcodeados de docentes se portan tal cual (son datos del dominio).

## Estrategia de verificación
- La lógica pura de `lib/` se valida contra el `dataset.csv` de ejemplo, comparando
  salidas clave (nº de filas válidas/excluidas, promedios, grupos de seguimiento) con las
  del HTML original.
- Verificación visual: `npm run dev` y comparación lado a lado de ambas vistas, filtros,
  gráficos, modales, export Excel e impresión, contra el HTML original abierto en el
  navegador.
