import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, Users, BookOpen, FileText, Settings,
  ChevronLeft, Menu, ChevronDown, ChevronRight, Sliders, HelpCircle,
} from 'lucide-react';
import { LOGO_UNMSM } from '../../assets/logos.js';

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Resumen General', disabled: false },
  { to: '/evaluacion-docente', icon: BarChart2, label: 'Evaluación Docente', disabled: false },
  { to: '/gestion-docentes', icon: Users, label: 'Gestión de Docentes', disabled: false },
  { to: '/cursos-y-programas', icon: BookOpen, label: 'Cursos y Programas', disabled: false },
  { to: null, icon: FileText, label: 'Reportes', disabled: true },
  {
    to: '/configuracion',
    icon: Settings,
    label: 'Configuración',
    disabled: false,
    children: [
      { to: '/configuracion/carga', label: 'Carga de Información' },
      { to: '/configuracion/docentes', label: 'Docentes' },
      { to: '/configuracion/cursos', label: 'Catálogo de Cursos' },
      { to: '/configuracion/programas', label: 'Catálogo de Programas' },
      { to: '/configuracion/asignaciones', label: 'Asignaciones' },
    ],
  },
];

export default function Sidebar({ onViewChange, sel, docenteStats }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [configExpanded, setConfigExpanded] = useState(() => location.pathname.startsWith('/configuracion'));

  // El submenú de Configuración se auto-expande al entrar a cualquier
  // /configuracion/* (click en la campana de incidencias, URL directa,
  // recarga, etc.) sin pisar un colapso manual mientras el usuario sigue
  // dentro de la misma sub-ruta.
  useEffect(() => {
    if (location.pathname.startsWith('/configuracion')) setConfigExpanded(true);
  }, [location.pathname]);

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
          if (item.children) {
            const isSectionActive = location.pathname.startsWith(item.to);
            return (
              <div key={item.to}>
                <button
                  type="button"
                  onClick={() => {
                    onViewChange?.();
                    setConfigExpanded((v) => !v);
                    if (!location.pathname.startsWith(item.to)) navigate(item.children[0].to);
                  }}
                  className={`w-full flex items-center rounded-lg transition-colors ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} ${
                    isSectionActive ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <item.icon size={15} className="shrink-0" />
                  {!collapsed && <span className="text-xs font-medium truncate flex-1 text-left">{item.label}</span>}
                  {!collapsed && (configExpanded ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />)}
                </button>
                {!collapsed && configExpanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={() => onViewChange?.()}
                        className={({ isActive }) => `w-full flex items-center gap-2.5 rounded-lg transition-colors no-underline pl-8 pr-3 py-2 ${
                          isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                        <span className="text-xs truncate">{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
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

      {/* Bloque de ayuda -- solo dentro de Configuración (cualquiera de las
          4 sub-rutas), mismo patrón de useLocation() que showDocenteBlocks
          arriba. "Ver guía" sin destino todavía: no existe contenido de
          guía real (mismo criterio ya usado para otros enlaces de ayuda
          placeholder de esta tarea). */}
      {!collapsed && location.pathname.startsWith('/configuracion') && (
        <div className="border-t border-slate-100 p-3">
          <div className="rounded-xl p-3" style={{ background: '#fdf1ea' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <HelpCircle size={14} className="text-primary shrink-0" />
              <span className="text-xs font-bold text-slate-700">¿Necesitas ayuda?</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2 leading-snug">Consulta la guía de uso o contacta al soporte.</p>
            <button
              type="button"
              className="w-full text-[11px] font-bold text-primary border border-primary rounded-lg py-1.5 bg-transparent hover:bg-white transition-colors cursor-default"
            >
              Ver guía
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
