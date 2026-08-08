
import { Router } from 'express';
import { listarAsignaciones, actualizarAsignacion } from '../controllers/asignaciones.js';

const router = Router();

router.get('/', listarAsignaciones);
router.put('/:id', actualizarAsignacion);

export default router;
