create trigger tg_curso_grupo_docente_audit after insert or update on curso_grupo_docente
  for each row execute function fn_audit_log();
