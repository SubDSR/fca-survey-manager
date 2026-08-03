import {
  Chart as ChartJS, CategoryScale, LinearScale, RadialLinearScale,
  BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler, Title,
  BarController, LineController, PieController, RadarController,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler, Title,
  BarController, LineController, PieController, RadarController,
  ChartDataLabels
);
