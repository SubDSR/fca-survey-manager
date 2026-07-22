# FCA Survey Manager — Dashboard de Evaluación Docente

Aplicación web para analizar los resultados de las encuestas de evaluación docente
de la Unidad de Posgrado, Facultad de Ciencias Administrativas (UNMSM). Migración del
dashboard original (un único archivo HTML) a **React + Vite** con **CSS Modules**,
manteniendo una réplica visual y funcional exacta.

Todo el procesamiento ocurre en el navegador: se carga un CSV de encuestas y se
generan indicadores, gráficos, tablas y reportes exportables (Excel / PDF).

## Stack

- **React 18** (JSX, sin TypeScript) + **Vite**
- **CSS Modules** por componente + `src/styles/global.css` para los tokens de tema
- **PapaParse** (parseo CSV), **Chart.js** + **react-chartjs-2** (gráficos), **ExcelJS** (export)
- **Vitest** para las pruebas de la lógica de negocio

## Puesta en marcha

```bash
npm install
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm run build    # build de producción
npm run preview  # previsualiza el build
npm test         # ejecuta las pruebas (Vitest)
```

Al iniciar, la app precarga automáticamente `public/dataset.csv`. Puedes reemplazarlo
en cualquier momento con el botón **Cargar CSV**.

## Estructura

```
src/
├─ lib/          Lógica de negocio pura (parseo, estadísticas, agrupación, Excel) — testeada
├─ data/         Datos de dominio (mapas docente→categoría/facultad, constantes, logo)
├─ context/      DataContext (dataset cargado, precarga + upload)
├─ hooks/        Hooks por vista (filtros Director, selección Docente, carga CSV)
├─ components/
│  ├─ common/    Card, Modal, DataTable, FilterSelect, KpiCard, Topbar, EmptyState, PrintHeader
│  ├─ charts/    Envoltorios de react-chartjs-2 (Bar, Radar, Pie, Line)
│  ├─ director/  Vista Director de Carrera (filtros, KPIs, gráficos, tabla, banner)
│  ├─ docente/   Vista Docente Individual (radar, directivas, cursos, encuestados)
│  └─ modals/    Seguimiento, Detalle de Criterios, Detalle de Curso, Registros Excluidos
└─ styles/       global.css (tokens :root, reset, @media print)
```

## Funcionalidad

- **Vista Director de Carrera**: filtros en cascada, KPIs, promedio por criterio,
  cumplimiento de directivas, evolución por ciclo, tabla de detalle con búsqueda/orden
  y alertas de docentes que requieren seguimiento.
- **Vista Docente Individual**: desempeño por criterio (radar vs. promedio del programa),
  cumplimiento de directivas, cursos dictados y detalle individual de encuestados.
- **Exportación**: reporte oficial en Excel (con gráficos embebidos) e impresión / PDF.

## Documentación

El diseño y el plan de implementación están en `docs/superpowers/`. Los archivos
originales de referencia (HTML + CSV) están en `reference/`.
