# FCA Survey Manager

Monorepo del sistema de evaluación docente de la Unidad de Posgrado, Facultad de
Ciencias Administrativas (UNMSM).

```
fca-survey-manager/
├── frontend/     Aplicación React (Vite) — dashboard de evaluación docente
├── backend/      API Node.js (por implementar) — procesos que usan la service_role key de Supabase
└── README.md
```

## frontend/

Dashboard React + Vite. Todo el procesamiento actual ocurre en el navegador (carga de
CSV, cálculo de indicadores, exportación a Excel/PDF). Detalles de stack, estructura y
funcionalidad en [`frontend/README.md`](frontend/README.md).

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

## backend/

Todavía no tiene framework ni lógica; por ahora solo existe `backend/package.json`
(`fca-survey-manager-backend`). Se conectará a Supabase (PostgreSQL) usando la
`service_role key` para operaciones que no deben exponerse al frontend: carga masiva
de datos, procesos ETL y reportes pesados.

- Proyecto Supabase: `https://tqhqizvfehatfvmvwtsb.supabase.co`

```bash
cd backend
npm install
```

## Base de datos

Supabase (PostgreSQL), ya creada y migrada. El frontend usa la clave pública (anon)
para lecturas normales; el backend usará la `service_role key` para las operaciones
privilegiadas mencionadas arriba. Ninguna de las dos claves debe compartirse entre
carpetas ni subirse al repositorio.

## Documentación

El diseño y el historial de planes de implementación están en `docs/superpowers/`.
