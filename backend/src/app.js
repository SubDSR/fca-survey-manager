import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './config/swagger.js';
import docentesRouter from './routes/docentes.js';
import encuestasRouter from './routes/encuestas.js';
import programasRouter from './routes/programas.js';
import asignaturasRouter from './routes/asignaturas.js';
import periodosRouter from './routes/periodos.js';
import cargasRouter from './routes/cargas.js';
import revisionesRouter from './routes/revisiones.js';
import auditLogRouter from './routes/auditLog.js';
import politicaEvaluacionRouter from './routes/politicaEvaluacion.js';
import catalogoRouter from './routes/catalogo.js';
import asignacionesRouter from './routes/asignaciones.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', proyecto: 'fca-survey-manager' });
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/docentes', docentesRouter);
app.use('/api/encuestas', encuestasRouter);
app.use('/api/programas', programasRouter);
app.use('/api/asignaturas', asignaturasRouter);
app.use('/api/periodos', periodosRouter);
app.use('/api/cargas', cargasRouter);
app.use('/api/revisiones', revisionesRouter);
app.use('/api/audit-log', auditLogRouter);
app.use('/api/politica-evaluacion', politicaEvaluacionRouter);
app.use('/api/catalogo', catalogoRouter);
app.use('/api/asignaciones', asignacionesRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
