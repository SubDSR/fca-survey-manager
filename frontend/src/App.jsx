import { useMemo, useState } from 'react';
import { useData } from './context/DataContext.jsx';
import { useSharedFilters } from './hooks/useSharedFilters.js';
import { useDocenteSelection } from './hooks/useDocenteSelection.js';
import { computeDocenteVsPrograma } from './lib/stats.js';
import AppLayout from './components/layout/AppLayout.jsx';
import EmptyState from './components/common/EmptyState.jsx';
import DirectorView from './components/director/DirectorView.jsx';
import DocenteView from './components/docente/DocenteView.jsx';
import CursoView from './components/curso/CursoView.jsx';
import GestionView from './components/gestion/GestionView.jsx';
import SeguimientoModal from './components/modals/SeguimientoModal.jsx';
import CriteriaInfoModal from './components/modals/CriteriaInfoModal.jsx';
import CursoDetailModal from './components/modals/CursoDetailModal.jsx';

const EMPTY_MODAL = { kind: null, payload: null };

export default function App() {
  const { status, error, groupRows } = useData();
  const [view, setView] = useState('director');
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [pendingDocenteSelection, setPendingDocenteSelection] = useState(null);

  // Los filtros compartidos (Categoría/Programa/Ciclo/Sección/Docente/Estado)
  // y la selección de Vista Docente se calculan ambos sobre groupRows (GET
  // /api/encuestas/consolidado, un registro por grupo docente+asignatura+
  // ciclo+sección, ya agregado en el backend) — es la única fuente de filas
  // de la app, ver context/DataContext.jsx.
  const sharedFilters = useSharedFilters(groupRows);

  const {
    sel, cursoLabel, setSel, reset, options, docenteRows, cursoRows,
  } = useDocenteSelection(groupRows, sharedFilters, pendingDocenteSelection);

  const programaRows = useMemo(() => {
    const first = cursoRows[0];
    return first ? groupRows.filter((r) => r.programa === first.programa) : [];
  }, [groupRows, cursoRows]);

  const docenteStats = sel.selected && cursoRows.length
    ? {
      ...computeDocenteVsPrograma(cursoRows, programaRows),
      nValidas: cursoRows.reduce((a, r) => a + (r.nValidas || 0), 0),
    }
    : null;

  const openModal = (kind, payload) => setModal({ kind, payload });
  const closeModal = () => setModal(EMPTY_MODAL);

  // Portado desde reference (líneas 1586-1594): botón "Ver detalle →" del modal
  // de seguimiento. Se levanta la selección docente pendiente hasta App para
  // poder cambiar de vista y cerrar el modal, y useDocenteSelection la consume
  // mediante un efecto con guarda por identidad (ver hooks/useDocenteSelection.js).
  const handleVerDetalle = (group) => {
    setPendingDocenteSelection({
      programa: group.programa, docente: group.docente,
      curso: group.curso, ciclo: group.ciclo, seccion: group.seccion,
    });
    setView('docente');
    closeModal();
  };

  // Clic en el nombre del docente de la tabla "Detalle por docente / curso": lleva
  // a la Vista Docente Individual abriendo EXACTAMENTE ese grupo (curso·ciclo·
  // sección) en el filtro de curso (Fase 2.2), sin caer en la primera opción.
  const handleSelectDocente = (group) => {
    setPendingDocenteSelection({
      programa: group.programa, docente: group.docente,
      curso: group.curso, ciclo: group.ciclo, seccion: group.seccion,
    });
    setView('docente');
  };

  // Cambio de vista MANUAL desde el sidebar/topbar: solo descarta la selección
  // PENDIENTE (la que llevaría a precargar un docente al entrar a la vista
  // Docente). La selección normal (`sel`, en useDocenteSelection) vive en este
  // componente padre desde que se elevó para alimentar el sidebar dinámico
  // (Filtros activos / mini-card), así que persiste al alternar entre Director
  // de Carrera y Docente Individual: volver a "Evaluación Docente" conserva el
  // último docente elegido en vez de remontar en blanco. La navegación por
  // clic (handleVerDetalle / handleSelectDocente) llama a setView directamente,
  // sin pasar por aquí, para sí forzar una nueva selección pendiente.
  const handleViewChange = (nextView) => {
    setPendingDocenteSelection(null);
    setView(nextView);
  };

  return (
    <>
      <AppLayout
        view={view}
        onViewChange={handleViewChange}
        onSelectDocente={handleSelectDocente}
        sel={sel}
        docenteStats={docenteStats}
      >
        {status === 'ready' && view === 'director' && (
          <DirectorView
            onOpenSeguimiento={(groups) => openModal('seguimiento', groups)}
            onSelectDocente={handleSelectDocente}
            sharedFilters={sharedFilters}
          />
        )}
        {status === 'ready' && view === 'docente' && (
          <DocenteView
            onOpenCriteriaInfo={(cursoRows) => openModal('criteria', cursoRows)}
            onOpenCurso={(group) => openModal('curso', group)}
            sel={sel}
            cursoLabel={cursoLabel}
            setSel={setSel}
            onToggleCiclo={sharedFilters.toggleCiclo}
            onClearCiclo={sharedFilters.clearCiclo}
            reset={reset}
            options={options}
            docenteRows={docenteRows}
            cursoRows={cursoRows}
            programaRows={programaRows}
          />
        )}
        {status === 'ready' && view === 'cursos' && (
          <CursoView 
            onOpenCriteriaInfo={(cursoRows) => openModal('criteria', cursoRows)}
            onOpenDocente={(group) => openModal('docente-en-curso', group)}
          />
        )}
        {status === 'ready' && view === 'gestion' && (
          <GestionView />
        )}
        {status === 'error' && <p>{error}</p>}
        {status !== 'ready' && status !== 'error' && <EmptyState />}
      </AppLayout>

      <SeguimientoModal
        open={modal.kind === 'seguimiento'}
        onClose={closeModal}
        groups={modal.kind === 'seguimiento' ? modal.payload : []}
        onVerDetalle={handleVerDetalle}
      />
      <CriteriaInfoModal
        open={modal.kind === 'criteria'}
        onClose={closeModal}
        cursoRows={modal.kind === 'criteria' ? modal.payload : []}
      />
      <CursoDetailModal
        open={modal.kind === 'curso' || modal.kind === 'docente-en-curso'}
        onClose={closeModal}
        group={modal.kind === 'curso' || modal.kind === 'docente-en-curso' ? modal.payload : null}
        viewMode={modal.kind === 'docente-en-curso' ? 'curso' : 'docente'}
      />
    </>
  );
}
