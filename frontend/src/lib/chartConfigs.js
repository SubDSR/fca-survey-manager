/* ===================== CONFIGURACIONES DE GRÁFICOS (Chart.js) ==================== */
/* Portado verbatim desde reference/dashboard_evaluacion_docente.html:
   - criteriaBarConfig  <- renderCriteriaChart   (líneas 1607-1639)
   - directivesBarConfig <- renderDirectivesChart (líneas 1640-1686)
   - cicloTrendConfig / cicloSortValue <- renderCicloTrendChart (líneas 1671-1764)
   Los builders reciben datos ya calculados (no filas crudas ni STATE) y devuelven
   objetos { data, options } listos para los wrappers <BarChart>/<LineChart>. */

export function criteriaBarConfig(criteriaAvgs, labels) {
  return {
    data: {
      labels,
      datasets: [{
        label: 'Promedio (escala 20)',
        data: criteriaAvgs.map((v) => Math.round(v * 10) / 10),
        backgroundColor: '#9C1F06',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'start',
          color: '#ffffff',
          offset: 6,
          font: { weight: 'bold', family: 'Inter', size: 11 },
          formatter: (val) => Number(val).toFixed(1)
        }
      },
      scales: {
        x: { min: 0, max: 20, grid: { drawOnChartArea: false, color: '#E0E6ED' } },
        y: { grid: { display: false } }
      }
    }
  };
}

export function directivesBarConfig(breakdown) {
  return {
    data: {
      labels: breakdown.map((b) => b.label),
      datasets: [
        { label: 'Sí', data: breakdown.map((b) => Math.round(b.pctSi)), backgroundColor: '#34A853' },
        { label: 'A veces', data: breakdown.map((b) => Math.round(b.pctAv)), backgroundColor: '#FBBC05' },
        { label: 'No', data: breakdown.map((b) => Math.round(b.pctNo)), backgroundColor: '#EA4335' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', family: 'Inter', size: 10 },
          formatter: (val) => val >= 5 ? val + '%' : ''
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, min: 0, max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#E0E6ED' } }
      }
    }
  };
}

/* rowsByCiclo: [{ ciclo, nota, cumplimiento }, ...] ya agrupado y ordenado */
export function cicloTrendConfig(rowsByCiclo) {
  return {
    data: {
      labels: rowsByCiclo.map((c) => 'Ciclo ' + c.ciclo),
      datasets: [
        {
          type: 'bar',
          label: 'Nota promedio (0–20)',
          data: rowsByCiclo.map((c) => c.nota),
          backgroundColor: '#9C1F06',
          borderRadius: 4,
          barPercentage: 0.45,
          categoryPercentage: 0.6,
          yAxisID: 'yNota'
        },
        {
          type: 'line',
          label: '% Cumplimiento directivas',
          data: rowsByCiclo.map((c) => c.cumplimiento),
          borderColor: '#4285F4',
          backgroundColor: '#4285F4',
          tension: 0.3,
          yAxisID: 'yPct'
        },
        {
          type: 'line',
          label: 'Nota mínima aceptable',
          data: rowsByCiclo.map(() => 11),
          borderColor: '#111827',
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          yAxisID: 'yNota'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, datalabels: { display: false } },
      scales: {
        x: { grid: { display: false } },
        yNota: { position: 'left', min: 0, max: 20, title: { display: true, text: 'Nota (0–20)' }, grid: { color: '#E0E6ED' } },
        yPct: { position: 'right', min: 0, max: 100, title: { display: true, text: '% Cumplimiento' }, grid: { display: false }, ticks: { callback: (v) => v + '%' } }
      }
    }
  };
}

/* radarConfig <- renderRadarChart (líneas 1976-2023)
   directivesPieConfig <- renderDirectivesPieChart (líneas 2059-2097)
   coursePieConfig <- renderCoursePieChart (líneas 2107-2163)
   Portados desde reference/dashboard_evaluacion_docente.html (Vista Docente). */

export function radarConfig(labels, docenteAvgs, programaAvgs) {
  return {
    data: {
      labels,
      datasets: [
        {
          label: 'Docente',
          data: docenteAvgs.map((v) => Math.round(v * 10) / 10),
          backgroundColor: 'rgba(156, 31, 6, 0.4)',
          borderColor: '#9C1F06',
          pointBackgroundColor: '#9C1F06',
          fill: true
        },
        {
          label: 'Promedio del programa',
          data: programaAvgs.map((v) => Math.round(v * 10) / 10),
          backgroundColor: 'rgba(224, 230, 237, 0.5)',
          borderColor: '#C0CCDA',
          pointBackgroundColor: '#C0CCDA',
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 20,
          ticks: { display: false, stepSize: 5 },
          grid: { color: '#E0E6ED' },
          angleLines: { color: '#E0E6ED' }
        }
      },
      plugins: { legend: { position: 'bottom' }, datalabels: { display: false } }
    }
  };
}

export function directivesPieConfig(counts) {
  return {
    data: {
      labels: ['Sí', 'A veces', 'No'],
      datasets: [{
        data: [counts.si, counts.av, counts.no],
        backgroundColor: ['#34A853', '#FBBC05', '#EA4335'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: { display: false },
        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11, family: 'Inter' } } },
        tooltip: {
          callbacks: {
            label: (context) => {
              const val = context.raw;
              const pct = counts.total ? Math.round((val / counts.total) * 100) : 0;
              return ` ${context.label}: ${val} (${pct}%)`;
            }
          }
        }
      }
    }
  };
}

export function coursePieConfig(labels, data) {
  const total = data.reduce((a, b) => a + b, 0);
  const bgColors = ['#9C1F06', '#4285F4', '#34A853', '#FBBC05', '#00BCD4', '#8A2BE2', '#FF8C00'];
  return {
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        datalabels: { display: false },
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11, family: 'Inter' } } },
        tooltip: {
          callbacks: {
            label: (context) => {
              const val = context.raw;
              const pct = total ? Math.round((val / total) * 100) : 0;
              return ` ${context.label}: ${val} encuestados (${pct}%)`;
            }
          }
        }
      }
    }
  };
}

const ROMAN_MAP = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function toNumberOrNull(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function cicloSortValue(v) {
  const s = String(v).trim().toUpperCase();
  if (/^[IVXLCDM]+$/.test(s)) {
    let total = 0;
    for (let i = 0; i < s.length; i++) {
      const cur = ROMAN_MAP[s[i]];
      const next = ROMAN_MAP[s[i + 1]];
      if (next && cur < next) total -= cur; else total += cur;
    }
    return total;
  }
  const n = toNumberOrNull(s);
  return n !== null ? n : Number.MAX_SAFE_INTEGER;
}

const ROMAN_NUMERALS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/* dataset.csv usa ciclos en números romanos ("IV"); v_docente_seccion_consolidada
   los trae como entero (4). Se convierte a romano para que groupRows.ciclo sea
   comparable con rows.ciclo en los filtros compartidos (useSharedFilters) y en
   useDocenteSelection. Si v ya viene como romano, o no es un entero positivo
   válido, se devuelve tal cual. */
export function toRoman(v) {
  const s = String(v).trim().toUpperCase();
  if (/^[IVXLCDM]+$/.test(s)) return s;
  const n = toNumberOrNull(s);
  if (n === null || !Number.isInteger(n) || n <= 0) return s;
  let remaining = n;
  let result = '';
  for (const [value, numeral] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}
