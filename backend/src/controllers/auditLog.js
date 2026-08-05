import { supabase } from '../config/supabase.js';

// GET /api/audit-log?tabla=docente&registro_id=<id> -- historial de cambios
// de un registro puntual, alimentado por los triggers de la migración
// 2026-08-04-audit-log.sql (fn_audit_log, sobre docente/programa/asignatura/
// encuesta/revision_asignacion). `usuario` queda NULL en todas las filas
// hasta que el proyecto tenga autenticación real (limitación conocida,
// documentada en esa misma migración).
export async function listarAuditLog(req, res) {
  const { tabla, registro_id: registroId } = req.query;
  if (!tabla || !registroId) {
    return res.status(400).json({ error: 'Faltan los parámetros "tabla" y "registro_id".' });
  }

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, tabla, registro_id, accion, datos_anteriores, datos_nuevos, usuario, created_at')
    .eq('tabla', tabla)
    .eq('registro_id', registroId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
