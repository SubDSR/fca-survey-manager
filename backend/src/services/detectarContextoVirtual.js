import { supabase } from '../config/supabase.js';
import { normalizarTexto, cicloDesdeRomano } from '../utils/normalizar.js';

// Mismo umbral de "autoaceptar" que ya usa el fuzzy matching de la carga
// presencial (ver importarEncuestas.js) -- una sola noción de "confianza
// alta" en todo el proyecto, no dos umbrales distintos para el mismo
// concepto.
const UMBRAL_CONFIANZA = 0.85;

// Separa "COMPORTAMIENTO ORGANIZACIONAL - JOHANNES SCHMIDT URDANIVIA - I
// CICLO - SECCIÓN 2" en segmentos ["COMPORTAMIENTO ORGANIZACIONAL",
// "JOHANNES SCHMIDT URDANIVIA", "I CICLO", "SECCIÓN 2"]. Si el nombre trae
// los espacios convertidos a "_" (pasa según navegador/SO al descargar de
// Google Forms), se normalizan a espacio antes de separar. Solo hay UN
// archivo real de muestra -- esto es un patrón best-effort, no una regla
// garantizada para todo archivo futuro. Si la segmentación no rinde nada
// útil, el resto de esta función simplemente deja los campos sin detectar
// (nunca lanza, nunca inventa un valor).
function segmentarNombreArchivo(nombreSinExtension) {
  let texto = nombreSinExtension;
  if (!/ - /.test(texto) && /_/.test(texto)) texto = texto.replace(/_/g, ' ');
  return texto.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);
}

// Se compara sobre normalizarTexto(segmento) en vez de una clase de
// caracteres [OÓ]/regex con acentos: un literal "Ó" en el código puede no
// coincidir por bytes con la Ó que llega en la query string si el cliente
// la manda en forma NFD (O + acento combinante) en vez de NFC -- mismo
// riesgo ya documentado para este proyecto. normalizarTexto ya colapsa
// todos los acentos de forma consistente en todo el resto del código.
function extraerCiclo(segmento) {
  const norm = normalizarTexto(segmento) || '';
  if (!/\bciclo\b/.test(norm)) return null;
  const m = norm.match(/\b(x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/);
  return m ? cicloDesdeRomano(m[1]) : null;
}

function extraerSeccion(segmento) {
  const norm = normalizarTexto(segmento) || '';
  const m = norm.match(/seccion\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function mejorCandidatoDocente(clave) {
  const { data, error } = await supabase.rpc('fn_buscar_docente_similar', {
    p_clave: clave, p_umbral: 0.5, p_limite: 1,
  });
  if (error) throw error;
  return (data && data[0]) || null;
}

// Detecta Docente/Curso/Ciclo/Sección/Programa a partir del nombre de un
// archivo de encuestas virtuales, para prellenar los 5 boxes de "Información
// detectada del archivo" (ver SubirVirtualPage.jsx). Nunca decide por sí
// sola qué se sube -- solo sugiere; el usuario confirma o corrige vía el
// selector manual ya existente antes de que cualquier fila se inserte.
//
// Estrategia (ver tarea "detección real de contexto virtual"):
//   1. Segmentar el nombre por sus delimitadores " - ".
//   2. Extraer ciclo (numeral romano junto a "CICLO") y sección
//      ("SECCIÓN"/"SECCION" + número) de los segmentos que los contengan.
//   3. De los segmentos restantes, el que mejor matchea contra
//      docente.clave_busqueda (fn_buscar_docente_similar, sin acotar) es
//      el docente -- no se asume por posición.
//   4. Con el docente ya identificado con confianza, sus cursos oficiales
//      (curso_grupo_docente con es_carga_oficial=true) son la verdad de
//      terreno: el segmento restante se compara contra ESOS cursos
//      (fn_buscar_asignatura_similar sin acotar por plan, luego cruzado
//      contra la lista real del docente) en vez de contra TODAS las
//      asignaturas del sistema -- evita quedarse con el primer resultado
//      de un empate entre asignaturas homónimas de otros programas.
//   5. Si el docente dicta el mismo curso (mismo nombre) en más de un
//      programa/sección, se usa el ciclo/sección parseados del nombre del
//      archivo para desambiguar cuál de esas ofertas es.
//   6. Programa/ciclo/sección reales SIEMPRE salen de la BD (nunca del
//      nombre del archivo) una vez resuelto el curso_grupo_docente --
//      "Programa" ni siquiera se intenta parsear del nombre.
//   7. Cruce de validación: ciclo/sección parseados vs. los reales de la
//      BD. Cualquier discrepancia, o cualquier paso sin confianza
//      suficiente (umbral 0.85), deja badge='warning' con el motivo
//      explicado -- nunca se resuelve "a medias" en silencio.
export async function detectarContextoVirtual(nombreArchivo) {
  const sinExtension = String(nombreArchivo || '').replace(/\.csv$/i, '');
  const segmentos = segmentarNombreArchivo(sinExtension);
  const motivos = [];

  let cicloDetectado = null;
  let seccionDetectada = null;
  let segCiclo = null;
  let segSeccion = null;
  for (const seg of segmentos) {
    if (cicloDetectado === null) {
      const c = extraerCiclo(seg);
      if (c !== null) { cicloDetectado = c; segCiclo = seg; }
    }
    if (seccionDetectada === null) {
      const s = extraerSeccion(seg);
      if (s !== null) { seccionDetectada = s; segSeccion = seg; }
    }
  }
  if (cicloDetectado === null) motivos.push('No se pudo identificar el ciclo en el nombre del archivo.');
  if (seccionDetectada === null) motivos.push('No se pudo identificar la sección en el nombre del archivo.');

  const restantes = segmentos.filter((s) => s !== segCiclo && s !== segSeccion);

  let docenteCandidato = null;
  let segDocente = null;
  if (restantes.length > 0) {
    const evaluados = await Promise.all(restantes.map(async (seg) => ({
      seg,
      candidato: await mejorCandidatoDocente(normalizarTexto(seg)),
    })));
    evaluados.sort((a, b) => (b.candidato?.similitud || 0) - (a.candidato?.similitud || 0));
    if (evaluados[0]?.candidato) {
      docenteCandidato = evaluados[0].candidato;
      segDocente = evaluados[0].seg;
    }
  }

  const docenteConfiable = !!docenteCandidato && docenteCandidato.similitud >= UMBRAL_CONFIANZA;
  if (!docenteConfiable) {
    motivos.push(docenteCandidato
      ? `El docente detectado no alcanza suficiente confianza (${Math.round(docenteCandidato.similitud * 100)}%).`
      : 'No se pudo identificar el docente en el nombre del archivo.');
  }

  let curso = null;
  let cursoGrupoDocente = null;

  if (docenteConfiable) {
    const { data: oficiales, error: errorOficiales } = await supabase
      .from('curso_grupo_docente')
      .select('id, curso_grupo:curso_grupo_id(asignatura:asignatura_id(id, nombre), grupo:grupo_id(ciclo, seccion, programa:programa_id(nombre_corto)))')
      .eq('docente_id', docenteCandidato.id)
      .eq('es_carga_oficial', true);
    if (errorOficiales) throw errorOficiales;

    const cursosOficiales = (oficiales || []).map((o) => ({
      curso_grupo_docente_id: o.id,
      asignatura_id: o.curso_grupo?.asignatura?.id,
      asignatura: o.curso_grupo?.asignatura?.nombre,
      programa: o.curso_grupo?.grupo?.programa?.nombre_corto,
      ciclo: o.curso_grupo?.grupo?.ciclo,
      seccion: o.curso_grupo?.grupo?.seccion,
    }));

    if (cursosOficiales.length === 0) {
      motivos.push(`"${docenteCandidato.nombre_completo}" no tiene cursos con carga oficial en el sistema.`);
    } else {
      const segmentosCurso = restantes.filter((s) => s !== segDocente);
      if (segmentosCurso.length === 0) {
        motivos.push('No quedó ningún segmento del nombre del archivo para identificar el curso.');
      } else {
        // Umbral bajo y límite generoso: el objetivo de esta consulta es
        // maximizar la probabilidad de que los cursos reales del docente
        // aparezcan en el pool, no filtrar de una -- el cruce contra
        // cursosOficiales (verdad de terreno) es lo que realmente decide.
        const poolPorSegmento = await Promise.all(segmentosCurso.map(async (seg) => {
          const { data, error } = await supabase.rpc('fn_buscar_asignatura_similar', {
            p_plan_estudios_id: null, p_clave: normalizarTexto(seg), p_umbral: 0.3, p_limite: 50,
          });
          if (error) throw error;
          return data || [];
        }));

        // Mejor similitud vista para cada asignatura_id, a través de TODOS
        // los segmentos evaluados.
        const similitudPorAsignaturaId = new Map();
        for (const candidatos of poolPorSegmento) {
          for (const c of candidatos) {
            if (c.similitud > (similitudPorAsignaturaId.get(c.id) || 0)) {
              similitudPorAsignaturaId.set(c.id, c.similitud);
            }
          }
        }

        // Se puntúa cada curso OFICIAL del docente (no cada resultado
        // crudo del pool): dos asignatura_id distintos con el mismo nombre
        // (el mismo curso dictado en dos programas, como acá) deben competir
        // juntos por el mejor puntaje -- si se picker el primero que
        // aparece en el pool arbitrariamente, nunca se llega a comparar
        // ambas ofertas para desambiguar por ciclo/sección más abajo.
        const puntuados = cursosOficiales
          .map((co) => ({ co, similitud: similitudPorAsignaturaId.get(co.asignatura_id) || 0 }))
          .filter((p) => p.similitud > 0);

        if (puntuados.length === 0) {
          motivos.push(`Ningún segmento del nombre coincide con los cursos oficiales de "${docenteCandidato.nombre_completo}".`);
        } else {
          const mejorSimilitud = Math.max(...puntuados.map((p) => p.similitud));
          const empatados = puntuados.filter((p) => p.similitud === mejorSimilitud);
          curso = { id: empatados[0].co.asignatura_id, nombre: empatados[0].co.asignatura, similitud: mejorSimilitud };

          if (mejorSimilitud < UMBRAL_CONFIANZA) {
            motivos.push(`El curso detectado no alcanza suficiente confianza (${Math.round(mejorSimilitud * 100)}%).`);
          } else if (empatados.length === 1) {
            cursoGrupoDocente = empatados[0].co;
          } else {
            // El mismo docente dicta el mismo curso (mismo nombre) en más
            // de un programa/sección -- desambiguar con ciclo/sección
            // parseados del nombre del archivo.
            const exacto = empatados.find((p) => p.co.ciclo === cicloDetectado && p.co.seccion === seccionDetectada);
            if (exacto) {
              cursoGrupoDocente = exacto.co;
              // curso.id por defecto queda en el primer empatado (arriba) --
              // se corrige acá al realmente elegido, para que no describa
              // una oferta (programa) distinta de la que curso_grupo_docente
              // termina resolviendo.
              curso = { id: exacto.co.asignatura_id, nombre: exacto.co.asignatura, similitud: mejorSimilitud };
            } else {
              motivos.push(`"${docenteCandidato.nombre_completo}" dicta "${empatados[0].co.asignatura}" en ${empatados.length} secciones distintas — no se pudo determinar cuál sin ambigüedad.`);
            }
          }
        }
      }
    }
  }

  if (cursoGrupoDocente) {
    if (cicloDetectado !== null && cicloDetectado !== cursoGrupoDocente.ciclo) {
      motivos.push(`El ciclo del nombre del archivo (${cicloDetectado}) no coincide con el ciclo real (${cursoGrupoDocente.ciclo}).`);
    }
    if (seccionDetectada !== null && seccionDetectada !== cursoGrupoDocente.seccion) {
      motivos.push(`La sección del nombre del archivo (${seccionDetectada}) no coincide con la sección real (${cursoGrupoDocente.seccion}).`);
    }
  }

  const badge = (cursoGrupoDocente && motivos.length === 0) ? 'success' : 'warning';

  return {
    badge,
    motivos,
    docente: docenteCandidato ? { id: docenteCandidato.id, nombre: docenteCandidato.nombre_completo, similitud: docenteCandidato.similitud } : null,
    curso,
    ciclo_detectado: cicloDetectado,
    seccion_detectada: seccionDetectada,
    curso_grupo_docente: cursoGrupoDocente,
  };
}
