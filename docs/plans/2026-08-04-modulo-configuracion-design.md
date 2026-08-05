# Diseño técnico: módulo de Configuración (4 tabs)

> Solo diseño — nada de esto está implementado. Ver `docs/db-schema.md` para el esquema de referencia.

## 0. Hallazgo previo que condiciona todo el diseño

**`GestionView.jsx` (vista "Gestión" del sidebar, no del menú Configuración) ya implementa ~80% de lo que pide el tab "Docentes"**: directorio con buscador, cards de docente (nombre, facultad, condición con chip de color), panel de perfil con datos personales/académicos, cursos asignados y gráfico de evolución histórica. Incluso tiene un botón **"Editar Perfil" ya maquetado pero sin `onClick`** (`GestionView.jsx:195-197`) — es decir, la UI ya "pide" el endpoint de edición que este documento diseña en la sección 5.

Diferencia real con lo que pide esta tarea: `GestionView` filtra por `activeDocenteIds` (solo docentes con carga en la campaña actual — se lo pasa `App.jsx`) y es de solo lectura; el tab "Docentes" de Configuración necesita ver **todos** los docentes (activos e inactivos) y poder crear/editar/suspender.

**Decisión confirmada (2026-08-04): opción (c).** `GestionView.jsx` sigue existiendo tal cual, como vista de solo-consulta en contexto de campaña — no se toca en este trabajo ni en el siguiente. El tab "Docentes" de Configuración es una vista administrativa **nueva y distinta**, con su propio componente de card (ver sección 3.1, rediseñada) y su propio hook de datos (`useEntityCrud`, sección 1.3) — no reutiliza ni el JSX ni el CSS de `GestionView`, solo puede coincidir en qué endpoint de listado consume (`GET /api/docentes`) porque ya existía. El botón "Editar Perfil" de `GestionView` queda tal como está (sin `onClick`) — engancharlo es una decisión aparte que no corresponde a este documento ni a esta implementación.

## 1. Arquitectura general

### 1.1 Patrón de navegación
El proyecto no usa router (no hay `react-router` en `frontend/package.json`) — `App.jsx` alterna vistas con un simple `useState('director'|'docente'|'cursos'|'gestion'|'config')`. Las tabs internas de Configuración deben seguir el mismo patrón local, sin URL propia:

```jsx
// ConfigView.jsx
const [tab, setTab] = useState('carga'); // 'carga' | 'docentes' | 'programas' | 'cursos'
```

Un `<TabBar>` horizontal simple (4 botones) arriba del contenido actual, reutilizando las clases de `styles.card`/`styles.cardHeader` ya existentes para mantener consistencia visual con el resto de `ConfigView.module.css`.

### 1.2 Reorganización de `ConfigView.jsx`
El archivo actual (803 líneas) mezcla Períodos + Campaña + Upload + Historial en un solo componente. Con 4 tabs se vuelve inmanejable en un archivo. Propuesta de estructura de archivos:

```
frontend/src/components/config/
  ConfigView.jsx                 # shell: TabBar + switch de tab
  ConfigView.module.css          # estilos compartidos (ya existe)
  tabs/
    CargaTab.jsx                 # todo el bloque actual de Períodos+Campaña+Upload+Historial
    DocentesTab.jsx
    ProgramasTab.jsx
    CursosTab.jsx
  shared/
    EntityCard.jsx                # card genérica (ver 3.1) reutilizada por las 3 tabs de catálogo
    EntityFormModal.jsx           # modal de alta/edición genérico, parametrizado por schema de campos
    useEntityCrud.js              # hook: list/create/update/toggleActivo contra un endpoint base
```

`CargaTab.jsx` es un corte-y-pega del cuerpo actual de `ConfigView` sin cambios de lógica — el único trabajo real ahí es el de la sección 2. Los períodos (`BLOQUE 1`) se quedan dentro de esta tab tal como están hoy: seleccionar período es un prerrequisito para subir, así que separarlos en tabs distintas obligaría a saltar entre tabs para una sola acción.

### 1.3 Por qué una card genérica y no 3 implementaciones distintas
Docentes/Programas/Cursos comparten el mismo esqueleto (buscador → grid de cards → modal de detalle/edición → soft delete), solo cambian los campos mostrados y el endpoint. Un componente `EntityCard` + `useEntityCrud(baseUrl)` evita triplicar la lógica de paginación/búsqueda/loading que ya existe (de hecho, `GestionView.jsx` ya la reimplementa una vez más con su propio `useState` de página/búsqueda — buena razón adicional para no escribir una cuarta copia).

## 2. Tab "Carga de Información"

### 2.1 Estado actual
`ConfigView.jsx` asume un único formato fijo (`EXPECTED_HEADERS`, línea 10) validado tanto en frontend (`parseAndSet`) como en backend (`COLUMNAS_ESPERADAS` en `cargas.js`). El CSV siempre trae `Docente` como texto libre, y `importarEncuestas.js` resuelve todo (programa/grupo/asignatura/docente/curso_grupo_docente) fila por fila.

### 2.2 Dos formatos
| | Presencial (actual) | Virtual (nuevo) |
|---|---|---|
| Columnas | `Programa,Ciclo,Seccion,Aula,Codigo,Docente,Curso,P1..P9` | Sin `Docente` ni `Curso` como texto libre — vienen de una selección hecha en la UI antes de subir el archivo. Formato exacto de columnas pendiente de que el usuario provea un CSV real de ejemplo (no se puede diseñar el parser sin verlo) |
| Cómo se resuelve el docente/curso | Texto libre → `resolverDocente`/`resolverAsignatura` (match exacto hoy, fuzzy en la sección 4) | El usuario los selecciona explícitamente antes de subir — no hay ambigüedad que resolver |
| `curso_grupo_docente_id` | Se resuelve por fila (puede haber varias combinaciones docente+curso en un mismo archivo) | Es **el mismo para todas las filas del archivo** (un CSV virtual = una sesión de encuesta de una sola sección) |

### 2.3 Flujo de UI propuesto

```
┌─ Paso 1: Tipo de encuesta ──────────────────────────┐
│  ( ) Presencial   ( ) Virtual                        │
└───────────────────────────────────────────────────────┘
```

**Rama Presencial**: exactamente el flujo actual (dropzone → preview de columnas → confirmar). Sin cambios.

**Rama Virtual**:
```
Paso 2: Selección de contexto (reemplaza a la columna Docente/Curso del CSV)
  [Select: Programa]  → filtra
  [Select: Docente]   → (buscar entre docentes con curso_grupo_docente activo)
  [Select: Curso]     → cursos que ese docente dicta (curso_grupo_docente del docente)
  [Select: Ciclo/Sección] → autocompletado en cuanto se elige el curso (viene de grupo)

Paso 3: Dropzone (mismo componente, valida columnas del formato "virtual")

Paso 4: Preview — igual que hoy, pero el preview muestra también el contexto
        fijo elegido en el Paso 2 como un banner ("Vas a cargar N respuestas
        para: Pérez Gómez, Juan · Base de Datos II · Ciclo V · Sección 1")

Paso 5: Confirmar carga
```

El Select de Docente/Curso reutiliza `GET /api/docentes` (ya existe) y necesita un endpoint nuevo para listar los `curso_grupo_docente` de un docente (ver sección 5 — hoy solo existe embebido dentro de `GET /api/docentes/:id`, que sirve para esto sin cambios).

### 2.4 Cambios de backend necesarios
- `cargas.js` → `subirCarga`: aceptar un campo adicional `tipo` (`'presencial'|'virtual'`) y, si es virtual, `curso_grupo_docente_id` explícito en el `multipart/form-data`.
- Nueva función `importarEncuestasVirtual(filas, cursoGrupoDocenteId, campaniaId, cargaId)` en un archivo nuevo `backend/src/services/importarEncuestasVirtual.js` — **no meter un `if` gigante dentro de `importarFilasCsv`**, son dos pipelines con muy poco en común (el presencial resuelve 5 entidades por fila, el virtual ya las tiene fijas y solo necesita resolver/crear el `encuestado` + insertar `respuesta`). Reutilizar sí: `resolverEncuestado` (sin cambios) y `construirRespuestas` (sin cambios, ya es agnóstico al origen).
- `carga_csv` necesita una columna para saber qué tipo de carga fue (auditoría / para que el historial de la UI pueda mostrar un badge "Virtual"). Propuesta: `carga_csv.origen text NOT NULL DEFAULT 'presencial' CHECK (origen IN ('presencial','virtual'))` — nombre `origen` para no chocar con `encuesta.origen` (que ya existe y significa otra cosa: `WEB|PAPEL|IMPORTACION`) sería confuso; mejor `modalidad_carga text CHECK (modalidad_carga IN ('presencial','virtual'))`.

### 2.5 Nota a futuro (NO diseñar en detalle ahora, solo dejar constancia)
El usuario mencionó que a futuro se quiere que las encuestas presenciales también se autogestionen desde el sistema, con un docente supervisor autenticado y alumnos asignados respondiendo directamente (sin CSV intermedio). Esto implica autenticación de usuarios (hoy no existe — ver el TODO en `docentes.js:6-10`) y un modelo de "sesión de encuesta" nuevo. Fuera de alcance de este documento; se anota como dependencia futura del módulo de Configuración, no algo que bloquee lo de aquí.

## 3. Tabs "Docentes", "Programas", "Cursos"

### 3.1 Layout de card (compartido) — minimalista, sin menú `⋮`

Card compacta, no el perfil expandido de `GestionView`. Sin menú contextual — las 3 acciones van siempre visibles:

```
┌───────────────────────────┐
│           ( 👤 )           │  ← avatar circular genérico (ícono, no foto)
│    RODRÍGUEZ MARTÍNEZ,     │  ← nombre completo, negrita
│         JUAN               │
│        12345678             │  ← DNI / identificador secundario
│      ● Nombrado             │  ← punto de color + condición/estado
│                             │
│  [Editar] [Ver] [Suspender] │  ← 3 acciones siempre visibles
└───────────────────────────┘
```

Si `activo = false`: la card entera se muestra atenuada (opacidad reducida, `filter: grayscale(0.4)` o similar) y agrega un chip gris "Suspendido" junto al punto de color; el tercer botón pasa a decir "Reactivar".

Grid de 3 columnas en desktop (`repeat(auto-fill, minmax(220px, 1fr))` o similar), colapsando a 1-2 columnas en pantallas chicas — igual criterio responsive que `.uploadGrid` en `ConfigView.module.css`. Estilo (bordes, radios, tipografía, sombra) tomado de `styles.card`/`--border`/`--radius`/`--text-soft` ya definidos en `ConfigView.module.css` — sin colores nuevos salvo los puntos de condición (sección 3.2).

Campos por tipo de entidad (ya confirmados contra columnas reales de `docs/db-schema.md`):

| Entidad | Fuente | Campos en la card |
|---|---|---|
| Docente | `docente` + joins (igual que `v_docente_ficha`) | `nombre_completo`, `numero_documento`, `condicion_docente.nombre`, `activo` |
| Programa | `programa` + `nivel_programa` | `nombre_corto`, `nivel_programa.nombre`, `activo` |
| Curso (= `asignatura`) | `asignatura` + `plan_estudios` + `programa` | `nombre`, `programa.nombre_corto` (vía `plan_estudios_id`), `ciclo`, `creditos`, `activo` |

*(Nota: "Curso" en la redacción de la tarea corresponde a la tabla `asignatura` — el catálogo de materias, no `curso_grupo` que es una oferta/sección concreta por período. Créditos y ciclo son columnas de `asignatura`, no de `curso_grupo`, así que el mapeo es inequívoco.)*

### 3.2 Operaciones
- **Ver detalle** ("Visualizar"): modal de solo lectura (reutilizar `components/common/Modal.jsx`).
- **Editar**: modal con el mismo formulario que "Agregar", precargado.
- **Suspender/Reactivar** — botón siempre presente, nunca "Borrar", nunca ejecuta un `DELETE`:
  - `activo = true` → texto **"Suspender"**, ícono `UserX` (Docentes) / `ToggleRight` (Programas, Cursos — interruptor en posición "encendido", se hace clic para apagar).
  - `activo = false` → texto **"Reactivar"**, ícono `UserCheck` (Docentes) / `ToggleLeft` (Programas, Cursos — interruptor "apagado", se hace clic para encender).
  - **Decisión confirmada (2026-08-04, tarea de "Cursos y Programas" + filtro de condición en Docentes): para Programas/Cursos el ícono es `ToggleLeft`/`ToggleRight`** de `lucide-react` (no `Eye`/`EyeOff`, no `Power`) — mismo criterio de "ícono cambia según `activo`, texto Suspender/Reactivar, nunca Borrar" que Docentes, pero con un interruptor genérico en vez de uno ligado al concepto de visibilidad (que ya significa otra cosa en `ConfigView.jsx:685-695`, el toggle de `visible` en cargas CSV — reutilizar `Eye`/`EyeOff` ahí habría sido confuso). Reemplaza la recomendación anterior de `EyeOff`/`Eye` de este documento. Programas/Cursos siguen sin implementarse — esto solo queda registrado para cuando se aborden.
  - Antes de ejecutar, `Modal.jsx` de confirmación: *"¿Suspender a {nombre}? Podrás reactivarlo cuando quieras."* / *"¿Reactivar a {nombre}?"* (sin confirmación adicional para reactivar, ya que es la acción reversible/segura — pero se mantiene el mismo modal por consistencia, no una omisión: reactivar sin diálogo también sería válido, se prefiere el modal simétrico para no tener dos flujos de interacción distintos en el mismo botón).
  - Llama a `PATCH .../:id/activo { activo: boolean }` — mismo patrón exacto que `PATCH /api/cargas/:id/visibilidad` (`cargas.js:131-142`), solo cambia tabla/columna.
- **Buscador**: client-side sobre la lista ya cargada (176 docentes / 9 programas / 111 asignaturas son volúmenes triviales). `GestionView.jsx` ya hace esto con `normKey()`, pero como la decisión de la sección 0 es no compartir código con `GestionView`, `useEntityCrud` implementa su propia normalización equivalente (misma técnica: `normalize('NFD')` + strip de diacríticos + `toLowerCase()`) en vez de importarla desde allá.
- **Agregar**: mismo modal que "Editar" pero vacío + `POST`.

### 3.3 Tabla `audit_log` — propuesta refinada

```sql
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla text NOT NULL,
  registro_id bigint NOT NULL,
  accion text NOT NULL CHECK (accion IN ('INSERT','UPDATE','SUSPEND','REACTIVATE')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  usuario text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_audit_log_registro ON audit_log (tabla, registro_id, created_at DESC);
CREATE INDEX ix_audit_log_fecha ON audit_log (created_at DESC);
```

Cambios respecto a la propuesta original del usuario: los dos índices (uno para "historial de este registro puntual", otro para "actividad reciente global") y el `CHECK` sobre `accion` (mismo estilo que el resto del esquema — todos los `estado`/`tipo` del proyecto están acotados con `CHECK ... = ANY (ARRAY[...])`, ver `docs/db-schema.md`).

**Mecanismo: trigger de base de datos, no logging desde el controlador.** El proyecto ya tiene una convención establecida de triggers `BEFORE UPDATE` con funciones `fn_*` para mantener `updated_at` en `asignatura`, `docente`, `programa`, etc. (`tg_docente_updated_at` → `fn_set_updated_at()`, confirmado vía `information_schema.triggers`). Un trigger `AFTER INSERT OR UPDATE` con una función genérica `fn_audit_log()` sigue la misma convención y tiene una ventaja real sobre loguear desde Express: **no se puede saltar** — cualquier `UPDATE` a `docente`/`programa`/`asignatura`, venga del backend, del SQL Editor de Supabase o de una migración futura, queda registrado. La alternativa (loguear manualmente en cada controlador) se rompe en cuanto alguien escribe una migración de datos a mano y se olvida de insertar en `audit_log`.

Función genérica (bosquejo, no para aplicar todavía):
```sql
CREATE OR REPLACE FUNCTION fn_audit_log() RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_log (tabla, registro_id, accion, datos_anteriores, datos_nuevos)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'INSERT'
      WHEN TG_OP = 'UPDATE' AND OLD.activo AND NOT NEW.activo THEN 'SUSPEND'
      WHEN TG_OP = 'UPDATE' AND NOT OLD.activo AND NEW.activo THEN 'REACTIVATE'
      ELSE 'UPDATE'
    END,
    to_jsonb(OLD), to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Aplicado a `docente`, `programa`, `asignatura` (las 3 tablas con CRUD nuevo). **No** a las 30 tablas restantes — no hay UI de edición para ellas todavía, y agregar el trigger a todo el esquema "por si acaso" es exactamente el tipo de sobre-ingeniería que conviene evitar.

**Limitación pendiente, a documentar explícitamente**: la columna `usuario` no tiene de dónde salir todavía — el proyecto no tiene autenticación (mismo TODO ya anotado en `docentes.js`). Hasta que exista un sistema de login, `usuario` quedará `NULL` o con un valor fijo tipo `'backend'`. El trigger no puede resolver esto por sí solo (no tiene acceso a "quién" hizo la request HTTP) — necesitaría que el backend haga `SET LOCAL app.current_user = '...'` al inicio de cada request autenticada y que `fn_audit_log()` lea `current_setting('app.current_user', true)`. Diseño correcto, pero **no vale la pena implementarlo antes de tener autenticación real** — dejarlo como `NULL` por ahora y no bloquear el resto del módulo por esto.

### 3.4 Endpoint de consulta de auditoría
`GET /api/audit-log?tabla=docente&registro_id=66` para un futuro tab "Historial" dentro del modal de detalle. No es parte del MVP de este módulo (el usuario no lo pidió explícitamente, solo pidió la tabla) — se documenta el endpoint para que quede claro que la tabla no es "solo para forense manual por SQL", pero no hace falta construir la UI de historial en la primera iteración.

## 4. Fuzzy matching para la carga de CSV

### 4.1 Por qué hace falta
`resolverDocente` (`importarEncuestas.js:157-179`) y `resolverAsignatura` (línea 119-144) hacen **match exacto** contra `clave_busqueda` (columna generada con `fn_normaliza_texto`: minúsculas, sin tildes, espacios colapsados). Cualquier diferencia que `fn_normaliza_texto` no neutraliza — una coma faltante en "Apellidos Nombres" vs "Apellidos, Nombres" (que si cambia el orden de parseo en `parsearNombreDocente` sí produce apellido_materno distinto), un espacio de más entre palabras que no sea whitespace simple, un typo — no matchea y crea un docente/asignatura duplicado silenciosamente. Ya hay evidencia de esto en la propia BD: `docente.id = 153` (`MACAZANA FERNÁNDE, DANTE MANUEL Z`, ver Parte 1.3 de este mismo trabajo) es exactamente el tipo de fila que un fuzzy match con revisión humana habría atajado en vez de dejarla pasar con el apellido roto.

### 4.2 Funciones de Postgres
- **`pg_trgm`** ya está instalado (`extversion 1.6`, confirmado vía `pg_extension`) y ya hay índices GIN listos para esto: `ix_docente_clave_busqueda_trgm`, `ix_asignatura_busqueda_trgm` (`docs/db-schema.md`) — **no hace falta crear ningún índice nuevo**, ya están.
- `similarity(text, text) returns real` — score 0..1.
- El operador `%` (usa el GUC `pg_trgm.similarity_threshold`, default 0.3) es lo que activa el uso del índice GIN. Para que el umbral sea el que pide la tarea (0.6 configurable) sin depender de un GUC de sesión que otro código podría cambiar, la recomendación es fijar el umbral con `SET LOCAL` dentro de la misma transacción, justo antes de la consulta — así el índice se sigue usando (el `%` sigue funcionando con el umbral bajo por defecto como pre-filtro barato) y el corte real de 0.6/0.85 se aplica con `similarity(...) >=` explícito en el `WHERE`, no implícito en un GUC.
- No hace falta la extensión `unaccent` (no está instalada) — la comparación se hace sobre `clave_busqueda`, que **ya** viene sin tildes por `fn_normaliza_texto`, así que el trigram nunca ve un acento.

### 4.3 Integración con el flujo actual — dos funciones SQL nuevas, expuestas por RPC
El proyecto ya llama funciones de Postgres desde el backend vía `supabase.rpc(...)` (`cargas.js:160`, `fn_eliminar_carga`) — mismo patrón para esto, en vez de armar el `%`/`SET LOCAL` a mano con SQL crudo desde `supabase-js` (que no lo soporta bien vía el query builder).

```sql
CREATE OR REPLACE FUNCTION fn_buscar_docente_similar(
  p_clave text, p_umbral numeric DEFAULT 0.6, p_limite int DEFAULT 5
) RETURNS TABLE (id bigint, nombre_completo text, similitud real)
LANGUAGE sql STABLE AS $$
  SET LOCAL pg_trgm.similarity_threshold = p_umbral;
  SELECT d.id, d.nombre_completo, similarity(d.clave_busqueda, p_clave)
  FROM docente d
  WHERE d.clave_busqueda % p_clave
  ORDER BY similarity(d.clave_busqueda, p_clave) DESC
  LIMIT p_limite;
$$;
```
*(`fn_buscar_asignatura_similar(p_plan_estudios_id, p_clave, ...)` análoga, con `WHERE plan_estudios_id = p_plan_estudios_id AND clave_busqueda % p_clave` — el scope por plan ya lo hace `resolverAsignatura` hoy con el cache por `planEstudiosId`, se mantiene igual.)*

Nota técnica a validar al implementar: `SET LOCAL` dentro de una función `STABLE`/`SQL` plana puede requerir volverla `PLPGSQL` (SQL-language functions no siempre aceptan `SET LOCAL` como primera sentencia de la misma manera) — es un detalle de implementación, no cambia el diseño.

### 4.4 Árbol de decisión (por fila, en `resolverDocente`/`resolverAsignatura`)

```
1. Match exacto por clave_busqueda (como hoy)
   → HIT: usar ese id, sin cambios de comportamiento.
2. MISS exacto → llamar fn_buscar_*_similar(clave, 0.6, 5)
   a. 0 candidatos            → crear nuevo (comportamiento actual, sin cambios)
   b. 1 candidato, sim >= 0.85 → usar ese id + advertencia:
        "Docente 'X' → matched como 'Y' con similitud 0.NN"
      (mismo array `advertencias` que ya existe en el resultado de carga)
   c. 1 candidato con 0.6<=sim<0.85, O 2+ candidatos con sim>=0.6
                               → NO insertar la fila todavía; encolar en
                                 `carga_pendiente` (tabla nueva, sección 4.5)
   d. sim < 0.6 para todos     → crear nuevo (igual que (a))
```

### 4.5 Nueva tabla `carga_pendiente` (no JSONB suelto)
`carga_csv` ya tiene `errores`/`omitidas`/`advertencias` como JSONB — pero esos tres son *terminales* (la fila ya no se puede recuperar sin resubir el CSV). Un caso "pendiente de revisión" es distinto: necesita una **acción humana** (elegir un candidato, o forzar alta nueva) antes de poder insertarse, y esa acción tiene que poder ejecutarse días después desde la UI, no solo quedar anotada en un JSON de lectura. Por eso una tabla propia, no un cuarto array JSONB:

```sql
CREATE TABLE carga_pendiente (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  carga_id bigint NOT NULL REFERENCES carga_csv(id) ON DELETE CASCADE,
  fila_numero int NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('docente','asignatura')),
  valor_csv text NOT NULL,          -- lo que vino en el CSV
  fila_completa jsonb NOT NULL,     -- la fila entera, para poder insertarla al resolver
  candidatos jsonb NOT NULL,        -- [{id, nombre, similitud}, ...]
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','resuelta','descartada')),
  resuelto_como_id bigint,          -- id de docente/asignatura elegido, o el recién creado
  resuelto_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_carga_pendiente_carga ON carga_pendiente (carga_id) WHERE estado = 'pendiente';
```

Al resolver (endpoint en sección 5), el backend re-ejecuta la inserción de esa fila puntual con el `docente_id`/`asignatura_id` ya decidido, usando el mismo camino que `importarFilasCsv` (no una segunda implementación) — se extrae `procesarFila(fila, contexto)` como función reusable de `importarFilasCsv` para esto.

### 4.6 Impacto en la UI de resultados de carga
`ConfigView.jsx` ya tiene 3 contadores en el banner de éxito (`filas_insertadas`, `filas_omitidas`, `filas_error`) y una sección expandible de detalle por carga (`detailGroup`/`detailBadge`, líneas 707-746). Se agrega un cuarto:

```
"Se insertaron 38 filas, 2 omitidas por duplicado, 1 con error, 3 pendientes de revisión."
```
con su propio `detailBadge` (color ámbar, distinto del rojo de error y el gris de omitidas) y, en vez de una lista de solo texto como errores/omitidas, cada pendiente es una fila con botones inline: **[Usar "Tassara Salviati, Carlos Francisco Jose" (92%)]** · **[Crear como nuevo]** · **[Descartar]** — o un modal si la lista de candidatos no entra en una fila.

## 5. Inventario de endpoints

### 5.1 Ya existen
| Método | Ruta | Usado por |
|---|---|---|
| GET | `/api/docentes` | Listado (Gestión, DataContext) |
| GET | `/api/docentes/:id` | Perfil (Gestión) — incluye `cursos` embebidos, sirve también para el selector de curso en la carga virtual (2.3) |
| GET | `/api/programas` | — (no se ve consumido activamente hoy, ver hallazgo de `docs/db-schema.md`) |
| GET/POST | `/api/periodos`, PATCH `/api/periodos/:id/activar`, GET `/api/periodos/:id/campania-activa` | ConfigView (tab Carga) |
| GET/POST/PATCH/DELETE | `/api/cargas...` | ConfigView (tab Carga) |

### 5.2 Faltan — Docentes
| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/docentes?activo=&search=` | Extender el listado actual con query params (hoy `listarDocentes` no acepta ninguno) |
| POST | `/api/docentes` | Alta manual (`resolverDocente` ya tiene la lógica de parseo de nombre — extraerla a un helper compartido en vez de reimplementarla) |
| PATCH | `/api/docentes/:id` | Edición de campos — este es el que destraba el botón "Editar Perfil" ya maquetado en `GestionView.jsx:195-197` |
| PATCH | `/api/docentes/:id/activo` | Suspender/reactivar — mismo patrón que `cambiarVisibilidad` de cargas |

### 5.3 Faltan — Programas
| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/programas/:id` | No existe hoy (solo el listado plano) |
| POST | `/api/programas` | Alta |
| PATCH | `/api/programas/:id` | Edición |
| PATCH | `/api/programas/:id/activo` | Suspender/reactivar |

### 5.4 Faltan — Cursos (`asignatura`)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/asignaturas?programa_id=&activo=&search=` | No existe ningún endpoint de asignatura hoy — el import las toca directo por Supabase client, nunca se expusieron por API |
| GET | `/api/asignaturas/:id` | |
| POST | `/api/asignaturas` | |
| PATCH | `/api/asignaturas/:id` | Aquí es donde eventualmente se resolvería, con revisión manual, el caso `A3S2B1A4` de la Parte 1 — pero eso se decide aparte, no es parte de este diseño |
| PATCH | `/api/asignaturas/:id/activo` | |

### 5.5 Faltan — Carga virtual y pendientes (sección 2 y 4)
| Método | Ruta | Notas |
|---|---|---|
| POST | `/api/cargas` (extendido) | Aceptar `tipo` + `curso_grupo_docente_id` cuando `tipo=virtual` |
| GET | `/api/cargas/:id/pendientes` | Lista de `carga_pendiente` de una carga |
| POST | `/api/cargas/pendientes/:pendienteId/resolver` | `{ accion: 'usar_existente'\|'crear_nuevo'\|'descartar', docente_id?, asignatura_id? }` |

### 5.6 Faltan — Auditoría
| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/audit-log?tabla=&registro_id=` | No bloqueante para el MVP (sección 3.4) |

## 6. Cambios de esquema necesarios (resumen para migraciones futuras)

Ninguno de estos está aplicado — es la lista de lo que haría falta migrar cuando se decida implementar:

1. **Nada nuevo para soft-delete**: `docente.activo`, `programa.activo` y `asignatura.activo` **ya existen** en el esquema (confirmado en `docs/db-schema.md`) — el CRUD de las 3 tabs de catálogo no necesita ninguna columna nueva para esto, solo endpoints que las usen.
2. `audit_log` (tabla nueva, sección 3.3) + `fn_audit_log()` + 3 triggers (`docente`, `programa`, `asignatura`).
3. `carga_csv.modalidad_carga text CHECK (... IN ('presencial','virtual')) DEFAULT 'presencial'` (sección 2.4).
4. `carga_pendiente` (tabla nueva, sección 4.5).
5. `fn_buscar_docente_similar()`, `fn_buscar_asignatura_similar()` (funciones nuevas, sección 4.3).

## 7. Orden de implementación sugerido (no pedido explícitamente, pero útil para no bloquear todo en un solo PR)

1. Endpoints CRUD de Docentes/Programas/Cursos (secciones 3, 5.2-5.4) — valor inmediato, desbloquea el botón ya maquetado en `GestionView`.
2. `audit_log` + triggers (sección 3.3) — barato, se engancha solo al CRUD del paso 1.
3. Fuzzy matching (sección 4) — el de mayor riesgo/esfuerzo, y el único que toca el pipeline de import que ya está en producción con datos reales.
4. Carga virtual (sección 2) — depende de tener un CSV de ejemplo real del usuario, que todavía no se proveyó.
