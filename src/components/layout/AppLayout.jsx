import Sidebar from './Sidebar.jsx';
import TopbarRed from './TopbarRed.jsx';

export default function AppLayout({ view, onViewChange, onOpenExcluded, onSelectDocente, sel, docenteStats, children }) {
  return (
    <div className="fca-shell app-shell flex h-screen overflow-hidden">
      <Sidebar view={view} onViewChange={onViewChange} onOpenExcluded={onOpenExcluded} sel={sel} docenteStats={docenteStats} />
      <div className="app-content flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopbarRed view={view} onSelectDocente={onSelectDocente} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
