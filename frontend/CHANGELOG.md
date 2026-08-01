# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [0.1.0] - 2026-07-22

Primer release: migración del dashboard de evaluación docente de un único
archivo HTML a una aplicación React + Vite.

### Añadido

- Migración completa del dashboard a **React 18 + Vite** con **CSS Modules** y
  tokens de tema, manteniendo una réplica visual y funcional del original.
- **Vista Director de Carrera**: filtros en cascada (programa, ciclo, sección,
  aula, docente), KPIs, promedio por criterio, cumplimiento de directivas
  académicas, evolución de nota y cumplimiento por ciclo, y tabla de detalle
  por docente/curso con búsqueda, ordenamiento y alertas de seguimiento.
- **Vista Docente Individual**: desempeño por criterio (radar vs. promedio del
  programa), cumplimiento de directivas, cursos dictados y detalle de
  encuestados.
- Navegación desde la tabla de detalle: el nombre del docente lleva a la Vista
  Docente Individual con ese profesor preseleccionado.
- Carga de datos: precarga automática de `dataset.csv` y carga manual de un CSV
  desde el navegador.
- Exportación a **Excel** (formato oficial con gráficos embebidos) e impresión
  / exportación a **PDF**.
- Modales de seguimiento, detalle de criterios, detalle de curso y registros
  excluidos.
- Pruebas de la lógica de negocio (parseo, estadísticas, agrupación) con
  **Vitest**.

[0.1.0]: https://github.com/SubDSR/fca-survey-manager/releases/tag/v0.1.0
