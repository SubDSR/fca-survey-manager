import './registerCharts.js';
import { Pie } from 'react-chartjs-2';
export default function PieChart({ data, options }) {
  return <Pie data={data} options={options} />;
}
