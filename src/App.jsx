import { useState } from 'react';
import styles from './App.module.css';
import { useData } from './context/DataContext.jsx';
import Topbar from './components/common/Topbar.jsx';
import EmptyState from './components/common/EmptyState.jsx';
import DirectorView from './components/director/DirectorView.jsx';
import DocenteView from './components/docente/DocenteView.jsx';
import SeguimientoModal from './components/modals/SeguimientoModal.jsx';
import CriteriaInfoModal from './components/modals/CriteriaInfoModal.jsx';
import CursoDetailModal from './components/modals/CursoDetailModal.jsx';
import ExcludedModal from './components/modals/ExcludedModal.jsx';

const EMPTY_MODAL = { kind: null, payload: null };

export default function App() {
  const { status, error } = useData();
  const [view, setView] = useState('director');
  const [modal, setModal] = useState(EMPTY_MODAL);
  const [pendingDocenteSelection, setPendingDocenteSelection] = useState(null);

  const openModal = (kind, payload) => setModal({ kind, payload });
  const closeModal = () => setModal(EMPTY_MODAL);

  // Portado desde reference (líneas 1586-1594): botón "Ver detalle →" del modal
  // de seguimiento. Se levanta la selección docente pendiente hasta App para
  // poder cambiar de vista y cerrar el modal, y useDocenteSelection la consume
  // mediante un efecto con guarda por identidad (ver hooks/useDocenteSelection.js).
  const handleVerDetalle = (group) => {
    setPendingDocenteSelection({ programa: group.programa, docente: group.docente, curso: group.curso });
    setView('docente');
    closeModal();
  };

  // Portado desde reference (líneas 1815-1824): clic en el nombre del docente de
  // la tabla "Detalle por docente / curso" lleva a la Vista Docente Individual con
  // ese profesor preseleccionado. El original limpia el curso (curso=''), así que
  // la vista muestra el primer curso del docente por defecto.
  const handleSelectDocente = (group) => {
    setPendingDocenteSelection({ programa: group.programa, docente: group.docente, curso: '' });
    setView('docente');
  };

  // Cambio de vista MANUAL desde el toggle superior: se descarta cualquier
  // selección pendiente para que las vistas se monten "en limpio". Así, al
  // alternar entre Director de Carrera y Docente Individual los valores no se
  // conservan (cada vista se remonta con su estado inicial). La navegación por
  // clic (handleVerDetalle / handleSelectDocente) llama a setView directamente,
  // sin pasar por aquí, para sí llevar la selección al montar la vista Docente.
  const handleViewChange = (nextView) => {
    setPendingDocenteSelection(null);
    setView(nextView);
  };

  return (
    <>
      <Topbar
        view={view}
        onViewChange={handleViewChange}
        showToggle={status === 'ready'}
        onOpenExcluded={() => openModal('excluded', null)}
      />
      <main className={styles.shell}>
        {status === 'ready' && view === 'director' && (
          <DirectorView
            onOpenSeguimiento={(groups) => openModal('seguimiento', groups)}
            onSelectDocente={handleSelectDocente}
          />
        )}
        {status === 'ready' && view === 'docente' && (
          <DocenteView
            onOpenCriteriaInfo={(cursoRows) => openModal('criteria', cursoRows)}
            onOpenCurso={(group) => openModal('curso', group)}
            pendingDocenteSelection={pendingDocenteSelection}
          />
        )}
        {status === 'error' && <p>{error}</p>}
        {status !== 'ready' && status !== 'error' && <EmptyState />}
      </main>

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
        open={modal.kind === 'curso'}
        onClose={closeModal}
        group={modal.kind === 'curso' ? modal.payload : null}
      />
      <ExcludedModal open={modal.kind === 'excluded'} onClose={closeModal} />
    </>
  );
}
