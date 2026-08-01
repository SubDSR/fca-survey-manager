import {
  Chart as ChartJS, CategoryScale, LinearScale, RadialLinearScale,
  BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler, Title,
  BarController, LineController, PieController, RadarController,
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler, Title,
  BarController, LineController, PieController, RadarController,
);
