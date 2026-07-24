import { GraduationCap, BookOpen, Calendar, Layers, ClipboardList } from 'lucide-react';

export default function ContextStrip({ programa, curso, ciclos, secciones, encuestas, items: itemsProp }) {
  const items = itemsProp || [
    { icon: GraduationCap, label: 'PROGRAMA', value: programa },
    { icon: BookOpen, label: 'CURSO', value: curso },
    { icon: Calendar, label: 'CICLO', value: ciclos },
    { icon: Layers, label: 'SECCIONES', value: secciones },
    { icon: ClipboardList, label: 'ENCUESTAS', value: String(encuestas) },
  ];
  return (
    <div className="rounded-xl overflow-hidden grid grid-cols-2 sm:grid-cols-5 divide-x divide-primary/20 border border-primary/20 bg-white">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/15">
            <item.icon size={13} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest leading-none text-primary/70">{item.label}</div>
            <div className="text-xs font-semibold mt-0.5 truncate leading-tight text-primary">{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
