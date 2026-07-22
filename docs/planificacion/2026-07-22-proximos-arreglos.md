# Plan de incorporación — Próximos arreglos

**Fuente:** `Proximos arreglos.docx` (comparativas HTML original vs. versión actual +
pendientes + sugerencias de Gemini).
**Fecha de análisis:** 2026-07-22.

> **Terminología:** en el documento fuente, *"granulado"* se refiere a la **versión
> actual en React + Vite** (modularizada/"granular"), y *"HTML"* al dashboard original
> monolítico que sirvió de referencia (`reference/dashboard_evaluacion_docente.html`).

El objetivo es incorporar los cambios **poco a poco**, en fases ordenadas por
riesgo/dependencia. Cada tarea incluye archivos probables, criterio de aceptación,
esfuerzo estimado y riesgo.

**Leyenda** · Esfuerzo: **S** (horas) · **M** (1–2 días) · **L** (varios días / requiere backend).
Prioridad: 🔴 alta · 🟠 media · 🟢 baja.

---

## Resumen de fases

| Fase | Tema | Naturaleza | Prioridad |
|------|------|-----------|-----------|
| 1 | Paridad visual con el HTML original (3 sugerencias) | Solo frontend | 🟠 |
| 2 | Corrección del selector/buscador de docentes | Frontend (lógica) | 🔴 |
| 3 | Exportación de la Vista Director (general) | Frontend | 🟠 |
| 4 | Persistencia entre encuestas y ciclos + envío de correos | **Requiere backend** | 🔴 (estratégico) |
| 5 | Rendimiento y análisis (sugerencias de Gemini) | Frontend / analítica | 🟢 |

**Secuencia recomendada:** Fase 1 → Fase 2 → Fase 3 → (Fase 4 en paralelo, es la de mayor
alcance) → Fase 5. Las fases 1–3 son autocontenidas y de bajo riesgo; la fase 4 cambia la
arquitectura (deja de ser 100% cliente) y conviene diseñarla aparte.

---

## Fase 1 — Paridad visual con el HTML original

Diferencias visuales detectadas entre el HTML original y la versión actual. Son cambios
acotados, solo de presentación, ideales para empezar.

### 1.1 · KPIs con tarjeta de fondo blanco 🟠 · Esfuerzo: **S**
- **Problema:** en el HTML, los 4 indicadores (Promedio general, % Cumplimiento, Total de
  encuestas, Total de docentes) van en **tarjetas blancas** individuales; en la versión
  actual aparecen sueltos sobre el fondo, sin tarjeta.
- **Archivos:** `src/components/common/KpiCard.jsx`, `src/components/common/KpiCard.module.css`
  (y/o `src/components/director/DirectorView.module.css` → `.kpiGrid`).
- **Aceptación:** cada KPI se muestra dentro de una tarjeta blanca con borde/sombra suaves,
  igual que las demás cards del dashboard, manteniendo la grilla de 4 columnas.
- **Riesgo:** bajo. Referencia: `reference/...html` (renderKPIs, markup de la sección KPI).

### 1.2 · Acotación al pie de la Vista Docente Individual 🟠 · Esfuerzo: **S**
- **Problema:** en el HTML, bajo los botones *Descargar Excel / Imprimir*, aparece la nota:
  *"Los porcentajes y promedios se calculan sobre las encuestas que cumplen los filtros
  activos. Verifique siempre el N° de encuestas antes de interpretar un resultado."* — no
  está en la versión actual.
- **Archivos:** `src/components/docente/DocenteView.jsx` (zona de `printBar`),
  `src/components/docente/DocenteView.module.css`.
- **Aceptación:** la acotación aparece al pie de la Vista Docente Individual, con estilo
  discreto (texto atenuado), visible en pantalla y en el PDF.
- **Nota:** valorar replicar la misma acotación en la Vista Director (coherencia).

### 1.3 · Énfasis en negrita solo del promedio obtenido (PDF/impresión) 🟠 · Esfuerzo: **S–M**
- **Problema:** al exportar a PDF, el HTML pone en **negrita solo el promedio final obtenido**
  ("Su promedio"); la versión actual pone en negrita **todas** las notas, diluyendo el énfasis.
- **Archivos:** `src/components/docente/PrintStatBox.jsx`,
  `src/components/docente/RawResponsesTable.jsx`, reglas `@media print` en
  `src/styles/global.css`.
- **Aceptación:** en la vista de impresión/PDF, solo la columna/valor "Su promedio" queda en
  negrita; el resto (Prom. programa, Diferencia, Rango, N°) en peso normal.
- **Riesgo:** bajo; validar con una exportación real a PDF.

---

## Fase 2 — Corrección del selector/buscador de docentes 🔴

Es el problema **funcional más importante**: afecta la correcta interpretación de los datos
para docentes que dictan el mismo curso en varios ciclos/secciones/aulas, o varios cursos.

### Contexto del problema
- Al navegar desde la **Vista Director** (clic en un docente con un ciclo/sección concretos,
  p. ej. *Ciclo III, Sección 6*), la Vista Docente cae por defecto en la **primera opción**
  del selector de curso (p. ej. *Ciclo IV, Sección 6*), perdiendo el contexto elegido.
- En la Vista Docente **no existe la opción "Todos los cursos"**: solo se ve el promedio y el
  N° de encuestas de un curso/sección, excluyendo el resto (en el ejemplo muestra 1 encuesta
  cuando el total del docente serían 23).
- La **Vista Director sí muestra la información agregada correctamente** → es la referencia a
  replicar.

### 2.1 · Opción "Todos los cursos" (agregado del docente) 🔴 · Esfuerzo: **M**
- **Descripción:** añadir al filtro **Curso** la opción *"Todos los cursos"* (valor por
  defecto) que agregue todas las filas del docente (todos los cursos/ciclos/secciones) y
  muestre el **promedio general** y el **total de encuestas** del docente.
- **Archivos:** `src/hooks/useDocenteSelection.js` (cálculo de `cursoRows`/opciones de curso),
  `src/components/docente/Selectors.jsx`, `src/components/docente/DocenteHeader.jsx`
  (KPIs del header), `src/components/docente/CoursePieChart.jsx` (distribución).
- **Aceptación:** con "Todos los cursos" seleccionado, el header y los paneles reflejan el
  agregado del docente (mismos totales que la Vista Director).

### 2.2 · Preservar el contexto ciclo/sección/curso en la navegación 🔴 · Esfuerzo: **M**
- **Descripción:** al hacer clic en una fila específica de la tabla de detalle del Director,
  la Vista Docente debe abrir **ese** curso/ciclo/sección, no la primera opción.
- **Archivos:** `src/App.jsx` (`handleSelectDocente`/`pendingDocenteSelection`),
  `src/components/director/DetailTable.jsx` (pasar ciclo/sección/aula del grupo),
  `src/hooks/useDocenteSelection.js` (aceptar y aplicar ese contexto).
- **Aceptación:** clic en *Ciclo III · Sección 6* abre exactamente ese grupo en la Vista
  Docente.

### 2.3 · Consultar un ciclo/sección específico dentro del docente 🟠 · Esfuerzo: **M**
- **Descripción:** manteniendo el agregado por defecto (2.1), permitir **desglosar** por
  ciclo/sección/aula (p. ej. subfiltros o que el selector de curso incluya la variante
  ciclo/sección). Replicar el comportamiento correcto que ya se ve para docentes con un solo
  curso y varias secciones (total correcto + posibilidad de mirar una sección puntual).
- **Archivos:** `src/hooks/useDocenteSelection.js`, `src/components/docente/Selectors.jsx`.
- **Aceptación:** el usuario puede ver el agregado y, opcionalmente, filtrar a un
  ciclo/sección concreto sin perder el total.

---

## Fase 3 — Exportación de la Vista Director (general) 🟠 · Esfuerzo: **M–L**
- **Descripción:** generar **Excel y PDF de la vista general** del Director (actualmente la
  exportación existe solo en la Vista Docente Individual).
- **Archivos:** `src/lib/excel.js` (nueva función de exportación general),
  `src/components/director/DirectorView.jsx` (botones + `window.print()` con plantilla de
  impresión), reglas `@media print`.
- **Aceptación:** el Director puede descargar un Excel/PDF con KPIs, gráficos y tabla de
  detalle del alcance filtrado.
- **Dependencia:** conviene después de Fase 1.3 (criterio de negrita/impresión ya afinado).

---

## Fase 4 — Persistencia entre encuestas y ciclos + correos 🔴 (estratégico) · Esfuerzo: **L**

> **Cambio de arquitectura:** hoy la app es **100% cliente** (parsea CSV en el navegador, sin
> backend ni base de datos). Estas funciones **requieren un backend** (API + almacenamiento) y
> deben diseñarse en un documento aparte (modelo de datos, autenticación, hosting). Se listan
> aquí para tenerlas en el roadmap.

### 4.1 · Acumular encuestas dentro del ciclo (2026-1)
- Guardar la primera carga y **acumular** las siguientes encuestas del mismo ciclo académico
  (en vez de reemplazar el dataset en memoria).

### 4.2 · Histórico entre ciclos
- Persistir las encuestas de cada ciclo y poder **consultarlas en ciclos posteriores**
  (comparativas ciclo a ciclo).

### 4.3 · Envío de correos
- Envío de reportes/resultados a los correos (de los docentes/dirección). Requiere backend y
  servicio de correo; definir plantillas y disparadores.

**Sugerencia de enfoque:** empezar por definir el modelo de datos (ciclo → docente → curso →
encuesta) y un backend mínimo (API + BD) antes de tocar 4.1–4.3.

---

## Fase 5 — Rendimiento y análisis (sugerencias de Gemini) 🟢

### 5.1 · Paginación o "virtual scrolling" en la tabla del Director · Esfuerzo: **M**
- **Descripción:** con muchos docentes, la `DetailTable` puede volverse pesada. Implementar
  **paginación** (p. ej. 20 por página) o *infinite scroll* para mejorar el rendimiento.
- **Archivos:** `src/components/director/DetailTable.jsx`, `src/components/common/DataTable.jsx`.
- **Aceptación:** la tabla renderiza fluido con cientos de filas; mantiene búsqueda y orden.

### 5.2 · Panel "Riesgo de Desempeño" · Esfuerzo: **M**
- **Descripción:** en la Vista Director, un panel que liste automáticamente los *"Top 5
  docentes con mayor caída de desempeño respecto al ciclo anterior"*.
- **Dependencia:** **requiere el histórico entre ciclos (Fase 4.2)** para comparar contra el
  ciclo previo. Sin histórico, no es calculable.
- **Archivos:** nuevo componente en `src/components/director/`, lógica en `src/lib/stats.js`.

---

## Notas transversales
- Las fases 1–3 y 5.1 son **frontend puro** y no dependen de backend → se pueden incorporar de
  inmediato, una tarea por rama (gitflow), con verificación en navegador.
- La fase 4 (y por dependencia la 5.2) marca el salto a **cliente + servidor**; recomendable un
  spec de arquitectura propio antes de implementar.
- Cada tarea debería entrar como su propia rama `feature/*` o `fix/*` desde `develop`, con
  commits atómicos (Conventional Commits).
