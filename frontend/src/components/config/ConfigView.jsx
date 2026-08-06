import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import RevisionResolverModal from '../layout/RevisionResolverModal.jsx';
import CargaTab from './tabs/CargaTab.jsx';
import SubirCsvPage from './tabs/SubirCsvPage.jsx';
import SubirVirtualPage from './tabs/SubirVirtualPage.jsx';
import DocentesTab from './tabs/DocentesTab.jsx';
import CursosTab from './tabs/CursosTab.jsx';
import ProgramasTab from './tabs/ProgramasTab.jsx';
import styles from './ConfigView.module.css';

// Los 4 sub-tabs (Carga/Docentes/Cursos/Programas) traen su propio
// encabezado -- ConfigView.jsx ya no renderiza un título genérico compartido.
//
// Layout de Configuración: ya no maneja tabs con useState (ese switcher vivía
// acá antes de que el sidebar tuviera submenú, ver Sidebar.jsx) -- ahora cada
// sub-ítem es una ruta real bajo /configuracion/*, montada como <Routes>
// anidadas porque App.jsx solo conoce "/configuracion/*" como ruta hoja.
//
// El modal de revisión de incidencias (RevisionResolverModal) vive acá, no en
// TopbarRed.jsx: se abre a partir del query param ?revision=<id> (única
// fuente de verdad), así funciona igual sea que el usuario haga click en la
// campana (TopbarRed navega a /configuracion?revision=<id>) o entre
// directamente por URL/recarga con ese parámetro ya puesto.
export default function ConfigView() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const resolverTargetId = searchParams.get('revision');

  // /configuracion (sin sub-ruta) redirige por defecto a "carga" -- pero si
  // se llega con ?revision=<id> (desde la campana de TopbarRed, o una URL
  // directa/recarga con el param ya puesto), el destino temáticamente
  // correcto es "docentes" (la incidencia es sobre un docente), no "carga".
  // Sin el param, el default general no cambia.
  const defaultSubtab = resolverTargetId ? 'docentes' : 'carga';

  const cerrarResolver = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('revision');
      return next;
    }, { replace: true });
  };

  return (
    <div className="min-h-full bg-surface text-on-surface font-body-md selection:bg-primary-container selection:text-on-primary-container p-margin-mobile md:p-margin-desktop">
      <Routes>
        <Route index element={<Navigate to={{ pathname: defaultSubtab, search: location.search }} replace />} />
        <Route path="carga" element={<CargaTab />} />
        <Route path="carga/subir-csv" element={<SubirCsvPage />} />
        <Route path="carga/subir-virtual" element={<SubirVirtualPage />} />
        <Route path="docentes" element={<DocentesTab />} />
        <Route path="cursos" element={<CursosTab />} />
        <Route path="programas" element={<ProgramasTab />} />
        <Route path="*" element={<Navigate to={{ pathname: defaultSubtab, search: location.search }} replace />} />
      </Routes>

      <RevisionResolverModal
        revisionId={resolverTargetId}
        onClose={cerrarResolver}
        onResolved={cerrarResolver}
      />
    </div>
  );
}
