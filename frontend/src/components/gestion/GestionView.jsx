import { useState, useMemo } from 'react';
import { Search, GraduationCap, User, BookOpen, Edit2, ShieldCheck, Users as UsersIcon, ChevronLeft, ChevronRight, History, TrendingUp, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './GestionView.module.css';
import mockTeachers from '../../data/mockTeachers.json';

// Helper to convert ALL CAPS to Title Case
function toTitleCase(str) {
  if (!str) return '';
  return str.split(' ').map(word => {
    if (word.length === 0) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// Normalizer for search
function normKey(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getStatusClass(condicion) {
  const c = (condicion || '').toLowerCase();
  if (c.includes('nombrado') && c.includes('of')) return styles.nombradoOf;
  if (c.includes('nombrado')) return styles.nombrado;
  if (c.includes('parcial')) return styles.parcial;
  if (c.includes('contratado')) return styles.contratado;
  if (c.includes('licencia')) return styles.licencia;
  return styles.default;
}

export default function GestionView({ initialSearch }) {
  const [search, setSearch] = useState(initialSearch || '');
  const [selectedId, setSelectedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartView, setChartView] = useState('historico');
  const itemsPerPage = 20;

  // Filter mock data
  const filteredTeachers = useMemo(() => {
    const term = normKey(search);
    if (!term) return mockTeachers;
    return mockTeachers.filter(t => 
      normKey(t.nombreCompleto).includes(term) || 
      normKey(t.numDoc || '').includes(term)
    );
  }, [search]);

  // Reset page when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  
  // Get current page slice
  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTeachers.slice(start, start + itemsPerPage);
  }, [filteredTeachers, currentPage]);

  // Set initial selected if none
  if (!selectedId && paginatedTeachers.length > 0) {
    setSelectedId(paginatedTeachers[0].id);
  }

  const selectedTeacher = mockTeachers.find(t => t.id === selectedId);

  return (
    <div className={styles.gestionContainer}>
      {/* Sidebar de Lista de Docentes */}
      <div className={styles.directorySidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>
            Directorio Docente
            <span className={styles.totalBadge}>{filteredTeachers.length} Total</span>
          </div>
          <input 
            type="text" 
            placeholder="Buscar por nombre o DNI..." 
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className={styles.teacherList}>
          {paginatedTeachers.map(teacher => (
            <div 
              key={teacher.id} 
              className={`${styles.teacherItem} ${selectedId === teacher.id ? styles.active : ''}`}
              onClick={() => setSelectedId(teacher.id)}
            >
              <div className={styles.teacherName}>{toTitleCase(teacher.nombreCompleto)}</div>
              <div className={styles.teacherMeta}>
                <span className={styles.teacherFaculty} title={teacher.facultad || 'Sin Facultad'}>
                  {toTitleCase(teacher.facultad) || 'Sin Facultad'}
                </span>
                <span className={`${styles.statusChip} ${getStatusClass(teacher.categoria)}`}>
                  {toTitleCase(teacher.categoria)}
                </span>
              </div>
            </div>
          ))}
          {filteredTeachers.length === 0 && (
            <div className={styles.emptyState}>No se encontraron docentes</div>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button 
              className={styles.pageButton} 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.pageInfo}>Pág {currentPage} de {totalPages}</span>
            <button 
              className={styles.pageButton} 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Vista de Perfil */}
      <div className={styles.profileView}>
        {selectedTeacher ? (
          <>
            <div className={styles.profileHeader}>
              <div className={styles.avatar}>
                {selectedTeacher.nombres ? selectedTeacher.nombres.charAt(0).toUpperCase() : 'D'}
              </div>
              <div className={styles.headerInfo}>
                <div className={styles.profileName}>
                  {toTitleCase(selectedTeacher.nombreCompleto)}
                  <ShieldCheck size={20} className="text-blue-600" />
                </div>
                <div className={styles.profileSubtitle}>
                  {toTitleCase(selectedTeacher.categoria)} • {toTitleCase(selectedTeacher.facultad) || 'Sin Facultad'}
                </div>
                <div className={styles.profileId}>
                  ID DOCENTE: {selectedTeacher.numDoc || 'N/A'}
                </div>
              </div>
              <button className={styles.editButton}>
                <Edit2 size={14} /> Editar Perfil
              </button>
            </div>

            <div className={styles.cardsGrid}>
              <div className={styles.card}>
                <div className={styles.cardTitle}><User size={18} /> Datos Personales</div>
                <div className={styles.dataGrid}>
                  <div className={styles.dataRow}>
                    <div className={styles.dataLabel}>Tipo Doc.</div>
                    <div className={styles.dataValue}>{selectedTeacher.tipoDoc || '-'}</div>
                  </div>
                  <div className={styles.dataRow}>
                    <div className={styles.dataLabel}>N° Doc.</div>
                    <div className={styles.dataValue}>{selectedTeacher.numDoc || '-'}</div>
                  </div>
                  <div className={styles.dataRow}>
                    <div className={styles.dataLabel}>Correo Inst.</div>
                    <div className={styles.dataValue}>{selectedTeacher.correo ? selectedTeacher.correo.toLowerCase() : '-'}</div>
                  </div>
                  <div className={styles.dataRow}>
                    <div className={styles.dataLabel}>Condición</div>
                    <div className={styles.dataValue}>
                      <span className={`${styles.statusChip} ${getStatusClass(selectedTeacher.categoria)}`}>
                        {toTitleCase(selectedTeacher.categoria)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardTitle}><GraduationCap size={18} /> Información Académica</div>
                <div className={styles.dataGrid}>
                  <div className={styles.dataRow}>
                    <div className={styles.dataLabel}>Facultad</div>
                    <div className={styles.dataValue}>{toTitleCase(selectedTeacher.facultad) || '-'}</div>
                  </div>
                  <div className={styles.dataRow}>
                    <div className={styles.dataLabel}>Grado Académico</div>
                    <div className={styles.dataValue}>{toTitleCase(selectedTeacher.grado) || '-'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.card} style={{ marginBottom: '40px' }}>
              <div className={styles.cardTitle}><BookOpen size={18} /> Asignación Actual (Encuestas)</div>
              {selectedTeacher.asignaciones && selectedTeacher.asignaciones.length > 0 ? (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Curso</th>
                        <th>Programa</th>
                        <th>Ciclo</th>
                        <th>Sección</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeacher.asignaciones.map((ac, i) => (
                        <tr key={i}>
                          <td>{ac.curso}</td>
                          <td>{ac.programa}</td>
                          <td>{ac.ciclo || '-'}</td>
                          <td>{ac.seccion || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState} style={{ padding: '40px' }}>
                  <UsersIcon size={32} />
                  <div>Este docente no tiene cursos asignados en el registro.</div>
                </div>
              )}
            </div>

            {/* Nueva Sección: Evaluación de Desempeño */}
            {selectedTeacher.evaluaciones && selectedTeacher.evaluaciones.length > 0 && (
              <div className={styles.evaluationSection}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>
                    <BarChart2 size={20} className="text-blue-600 mr-2" />
                    Evaluación de Desempeño Docente
                  </h3>
                  <p className={styles.sectionSubtitle}>
                    Monitoreo detallado del rendimiento académico y métricas de satisfacción estudiantil.
                  </p>
                </div>

                <div className={styles.cardsGrid}>
                  {/* Tarjeta Promedio Histórico */}
                  <div className={`${styles.card} ${styles.metricCard}`}>
                    <div className={styles.metricIconBox}>
                      <History size={24} className="text-gray-500" />
                    </div>
                    <div className={styles.metricInfo}>
                      <div className={styles.metricLabel}>PROMEDIO HISTÓRICO</div>
                      <div className={styles.metricValue}>{selectedTeacher.promedioHistorico || '0.00'}</div>
                      <div className={styles.metricSubtext}>Basado en ciclos anteriores</div>
                    </div>
                  </div>

                  {/* Tarjeta Promedio Ciclo Actual */}
                  <div className={`${styles.card} ${styles.metricCard} ${styles.metricCardActive}`}>
                    <div className={styles.metricIconBox}>
                      <TrendingUp size={24} className="text-green-600" />
                    </div>
                    <div className={styles.metricInfo}>
                      <div className={styles.metricLabel}>PROMEDIO CICLO ACTUAL</div>
                      <div className={styles.metricValue}>{selectedTeacher.promedioActual || '0.00'}</div>
                      <div className={styles.metricSubtext} style={{ color: '#16a34a' }}>
                        ● Actualizado: Última encuesta
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gráfico de Evolución */}
                <div className={styles.card} style={{ marginTop: '24px' }}>
                  <div className={styles.cardTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Evolución del Promedio {chartView === 'historico' ? 'por Periodo Académico' : 'por Fecha de Encuesta'}</span>
                    
                    {/* Toggle Buttons */}
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                      <button 
                        onClick={() => setChartView('historico')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: chartView === 'historico' ? 'white' : 'transparent',
                          color: chartView === 'historico' ? '#0f172a' : '#64748b',
                          boxShadow: chartView === 'historico' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        Histórico
                      </button>
                      <button 
                        onClick={() => setChartView('ciclo')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: chartView === 'ciclo' ? 'white' : 'transparent',
                          color: chartView === 'ciclo' ? '#0f172a' : '#64748b',
                          boxShadow: chartView === 'ciclo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        Ciclo Actual
                      </button>
                    </div>
                  </div>
                  <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart 
                        data={chartView === 'historico' ? selectedTeacher.evaluaciones : selectedTeacher.evaluacionesCiclo} 
                        margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="periodo" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                          dy={10}
                        />
                        <YAxis 
                          domain={['auto', 'auto']}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          dx={-10}
                          tickFormatter={(value) => value.toFixed(1)}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ fontWeight: 600, color: '#0f172a' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="promedio" 
                          stroke="#3b82f6" 
                          strokeWidth={4}
                          dot={{ fill: 'white', stroke: '#3b82f6', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <UsersIcon size={48} />
            <h2>Selecciona un docente</h2>
            <p>Elige un perfil del directorio para ver sus detalles</p>
          </div>
        )}
      </div>
    </div>
  );
}
