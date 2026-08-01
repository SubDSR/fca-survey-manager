import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './config/swagger.js';
import docentesRouter from './routes/docentes.js';
import encuestasRouter from './routes/encuestas.js';
import programasRouter from './routes/programas.js';

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

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
