# FCA Survey Manager

Sistema de evaluación docente de la Unidad de Posgrado, Facultad de Ciencias
Administrativas (UNMSM). Centraliza la carga de encuestas de evaluación
(presenciales y virtuales), la gestión del catálogo académico (docentes,
programas, cursos) y el reporte de resultados por docente/curso/programa,
incluyendo la revisión de asignaciones docente-curso que quedan sin respaldo
oficial.

## Estructura del monorepo

```
fca-survey-manager/
├── frontend/     Dashboard React (Vite) — consume la API del backend
├── backend/      API Express — única pieza que habla con Supabase
├── docs/         Documentación de diseño, planes y esquema de base de datos
└── README.md
```

No hay un `package.json` raíz: `frontend/` y `backend/` son dos proyectos
Node independientes, cada uno con sus propias dependencias.

## Frontend

**Stack:** React 18 + Vite, React Router v7 (rutas reales, no un `useState`
de pestañas), Tailwind CSS v4 + CSS Modules por componente, Chart.js /
react-chartjs-2 y Recharts para gráficos, ExcelJS para exportar reportes,
lucide-react para iconos, Vitest para pruebas de la lógica de negocio.

Todo el procesamiento de datos ocurre en el backend: el frontend solo
consulta la API REST (`VITE_API_URL`) y nunca se conecta directamente a
Supabase.

```bash
cd frontend
npm install
npm run dev      # servidor de desarrollo, http://localhost:5173
npm run build    # build de producción
npm run preview  # previsualiza el build
npm test         # pruebas (Vitest)
```

### Vistas

- **Resumen General** (`/`) — filtros en cascada (Programa/Categoría/Ciclo/
  Sección/Docente/Estado), KPIs, promedio por criterio, cumplimiento de
  directivas, evolución por ciclo, tabla de detalle y alertas de docentes
  que requieren seguimiento.
- **Evaluación Docente** (`/evaluacion-docente`) — desempeño individual por
  criterio (radar vs. promedio del programa), cumplimiento de directivas,
  cursos dictados y detalle de encuestados.
- **Cursos y Programas** (`/cursos-y-programas`) — catálogo completo de
  cursos/programas (con o sin encuestas cargadas) y su desempeño agregado.
- **Gestión de Docentes** (`/gestion-docentes`) — ficha administrativa por
  docente (alta/edición, estado, historial), con series históricas.
- **Configuración** (`/configuracion`) — ver detalle abajo.
- **Reportes** — entrada de menú reservada, aún no implementada.

El submenú de **Configuración** agrupa:

- **Carga de Información** — subir un CSV de encuestas presenciales, o
  encuestas virtuales (un archivo individual o un lote en ZIP).
- **Docentes** — alta, edición y suspensión/reactivación (soft delete).
- **Catálogo de Cursos** — alta, edición y suspensión/reactivación.
- **Catálogo de Programas** — alta, edición y suspensión/reactivación.

Desde la campana de notificaciones del encabezado se accede a las
incidencias de asignación docente-curso pendientes de revisión (módulo
Revisiones del backend, ver más abajo), que se resuelven en un modal
dentro de Configuración.

## Backend

**Stack:** Node.js + Express 5, `@supabase/supabase-js` (con la
`service_role key`, nunca expuesta al frontend), `multer` + `adm-zip` para
subir CSV/ZIP, `csv-parse`, Swagger (`swagger-jsdoc` + `swagger-ui-express`)
para documentar la API.

```bash
cd backend
npm install
npm run dev      # con nodemon
npm start        # sin nodemon
```

Con el servidor corriendo, la documentación interactiva de cada endpoint
(parámetros, esquemas de respuesta) está disponible en `/docs` (Swagger UI).

### Qué expone (agrupado por módulo)

- **Docentes / Programas / Asignaturas** — catálogo académico: listar,
  crear, editar y suspender/reactivar (soft delete, nunca se borra la
  fila), más los catálogos auxiliares para los formularios de alta/edición.
- **Períodos** — períodos académicos (año/semestre) y su campaña de
  evaluación asociada.
- **Encuestas** — resultados consolidados por sección oficial, docentes
  que requieren seguimiento, promedio por criterio, cumplimiento de
  directivas y respuestas individuales — la fuente de todas las vistas de
  reporte del frontend.
- **Cargas** — el pipeline de importación de CSV:
  - **Presencial**: el archivo trae Programa/Docente/Curso/Ciclo/Sección
    por fila; el backend resuelve cada fila contra el catálogo con
    coincidencia difusa (fuzzy matching) y, cuando hay ambigüedad, la
    encola para que un humano la resuelva (usar un candidato existente,
    crear uno nuevo, o descartar la fila).
  - **Virtual**: todo el archivo pertenece a un único docente/curso
    elegido en la UI, o bien se detecta automáticamente a partir del
    nombre del archivo (docente, curso, ciclo, sección).
  - **Virtual por lote (ZIP)**: varios CSV virtuales en un solo ZIP, cada
    uno detectado y procesado por separado, agrupados por un `lote_id`
    común para mostrar el progreso ("archivo X de N") en el historial.
- **Revisiones** — incidencias de asignaciones docente-curso sin respaldo
  oficial (encuestas que no calzan con ningún curso del catálogo con
  suficiente confianza); cada incidencia se resuelve reasignando,
  confirmando como correcta, o descartando.
- **Catálogo** — herramientas de diagnóstico y mantenimiento: registros
  huérfanos, secciones dispersas sin encuestas, y consolidación
  automática de secciones bajo demanda.
- **Política de Evaluación** — umbrales de aprobación/seguimiento vigentes,
  fuente única para que frontend y backend no dupliquen esos valores.
- **Audit Log** — historial de cambios (alta/edición/suspensión) por
  registro, para docentes, programas, asignaturas, encuestas e
  incidencias de revisión.

## Base de datos

Postgres, alojado en **Supabase**. Solo el backend se conecta a la base de
datos (con la `service_role key`, que bypasea RLS); el frontend nunca
habla con Supabase directamente.

Row Level Security (RLS) está activo en la gran mayoría de las tablas del
esquema `public`. Los cambios de esquema viven versionados como archivos
`.sql` en `backend/migrations/` (más de 20 migraciones desde el arranque
del proyecto) y se aplican contra el proyecto de Supabase directamente. El
esquema completo (tablas, vistas, funciones, triggers, políticas RLS) está
documentado en `docs/db-schema-2026-08-06.md` — es una foto en el tiempo
tomada consultando la base real, así que conviene regenerarla cuando el
esquema avance y no asumir que sigue vigente sin comparar contra las
migraciones más recientes.

## Despliegue

- **Frontend**: Vercel.
- **Base de datos**: Supabase (Postgres).
- **Backend**: una VM de Oracle Cloud.

No hay URLs, IPs ni IDs de proyecto en este repositorio — cada quien
configura su propia instancia de cada plataforma y sus propias variables
de entorno (ver siguiente sección).

## Variables de entorno

**Backend** (`backend/.env`, ver `backend/.env.example`):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto de Supabase, ej. `https://<tu-proyecto>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key del proyecto (bypasea RLS — nunca exponer al frontend) |
| `PORT` | Puerto del servidor Express (por defecto `3000`) |
| `FRONTEND_URL` | Origen permitido por CORS, ej. `http://localhost:5173` |

**Frontend** (`frontend/.env`, ver `frontend/.env.example`):

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API del backend, ej. `http://localhost:3000` |

## Documentación adicional

- `docs/db-schema-2026-08-06.md` — esquema completo de la base de datos
  (última foto disponible).
- `docs/superpowers/` — diseño e historial de planes de implementación.
- `docs/planificacion/` y `docs/plans/` — planificación de features
  puntuales.
