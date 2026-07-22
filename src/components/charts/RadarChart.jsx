import './registerCharts.js';
import { Radar } from 'react-chartjs-2';
export default function RadarChart({ data, options }) {
  return <Radar data={data} options={options} />;
}
