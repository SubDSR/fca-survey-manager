import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, Users, BookOpen, FileText, Settings,
  ChevronLeft, Menu, ChevronDown, Sliders,
} from 'lucide-react';
import { LOGO_UNMSM } from '../../assets/logos.js';

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Resumen General', disabled: false },
  { to: '/evaluacion-docente', icon: BarChart2, label: 'Evaluación Docente', disabled: false },
  { to: '/gestion-docentes', icon: Users, label: 'Gestión de Docentes', disabled: false },
  { to: '/cursos-y-programas', icon: BookOpen, label: 'Cursos y Programas', disabled: false },
  { to: null, icon: FileText, label: 'Reportes', disabled: true },
  { to: '/configuracion', icon: Settings, label: 'Configuración', disabled: false },
];

export default function Sidebar({ onViewChange, sel, docenteStats }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const showDocenteBlocks = !collapsed && location.pathname === '/evaluacion-docente' && sel?.selected;

  return (
    <div
      className={`no-print ${collapsed ? 'w-[60px]' : 'w-[272px]'} shrink-0 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 overflow-hidden`}
    >
      {/* Header de marca */}
      <div className={`px-3 py-4 border-b border-slate-100 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        {!collapsed && (
          <>
            <img src={LOGO_UNMSM} alt="UNMSM FCA" className="w-9 h-9 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black leading-tight text-primary">Reporte de Encuesta Docente</div>
              <div className="text-[9px] text-slate-400 mt-0.5 truncate">Unidad de Posgrado · FCA</div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors shrink-0"
            >
              <ChevronLeft size={13} className="text-slate-400" />
            </button>
          </>
        )}
        {collapsed && (
          <button type="button" onClick={() => setCollapsed(false)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors">
            <Menu size={13} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                aria-disabled="true"
                tabIndex={-1}
                className={`w-full flex items-center rounded-lg transition-colors ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} text-slate-300 cursor-not-allowed`}
              >
                <item.icon size={15} className="shrink-0" />
                {!collapsed && <span className="text-xs font-medium truncate">{item.label}</span>}
              </button>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => onViewChange?.()}
              className={({ isActive }) => `w-full flex items-center rounded-lg transition-colors no-underline ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} ${
                isActive ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={15} className="shrink-0" />
                  {!collapsed && <span className="text-xs font-medium truncate">{item.label}</span>}
                  {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Filtros activos (placeholder hasta Tarea 6) */}
      {showDocenteBlocks && (
        <div className="border-t border-slate-100 px-3 pt-3">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sliders size={9} /> Filtros activos
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Programa', val: sel.programa || 'Todos' },
              { label: 'Docente', val: sel.selected },
              { label: 'Curso', val: sel.curso ? sel.curso.split('|||')[0] : 'Todos' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2">
                <span className="text-[9px] text-slate-400 font-bold uppercase w-14 shrink-0">{f.label}</span>
                <div className="flex-1 flex items-center justify-between bg-slate-50 rounded-md px-2 py-1 text-[11px] text-slate-700">
                  <span className="truncate">{f.val}</span>
                  <ChevronDown size={9} className="text-slate-400 shrink-0 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini-card docente (placeholder hasta Tarea 6) */}
      {showDocenteBlocks && docenteStats && (
        <div className="border-t border-slate-100 p-3 pb-4">
          <div className="rounded-xl p-3 text-white bg-primary">
            <div className="text-xs font-bold truncate mb-3">{sel.selected}</div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="rounded-lg py-2 bg-white/15">
                <div className="text-lg font-black leading-none">{docenteStats.notaDocente.toFixed(1)}</div>
                <div className="text-[8px] mt-0.5 text-primary-mid">Individual</div>
              </div>
              <div className="rounded-lg py-2 bg-white/15">
                <div className="text-lg font-black leading-none text-primary-mid">{docenteStats.notaPrograma.toFixed(1)}</div>
                <div className="text-[8px] mt-0.5 text-primary-mid">Programa</div>
              </div>
              <div className="rounded-lg py-2 bg-white/15">
                <div className="text-lg font-black leading-none">{docenteStats.nValidas}</div>
                <div className="text-[8px] mt-0.5 text-primary-mid">Encuestas</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
