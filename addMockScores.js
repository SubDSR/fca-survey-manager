import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, 'src', 'data', 'mockTeachers.json');

const teachers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Generate a random score between min and max (with 2 decimals)
function getRandomScore(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

const periodos = ['2023-I', '2023-II', '2024-I', '2024-II'];

teachers.forEach((t) => {
  // Base score to create a realistic curve (e.g. they hover around 16.5)
  const baseScore = Math.random() * 4 + 14; // Between 14 and 18

  const evaluaciones = periodos.map(periodo => {
    // Add some random variance (-1.5 to +1.5) to base score for each period
    const variance = (Math.random() * 3) - 1.5;
    let score = baseScore + variance;
    
    // Cap between 10 and 20
    if (score > 20) score = 20;
    if (score < 10) score = 10;
    
    return {
      periodo: periodo,
      promedio: parseFloat(score.toFixed(2))
    };
  });
  
  // Calculate historical average (all except last one)
  const historicalScores = evaluaciones.slice(0, -1);
  const sumHistorical = historicalScores.reduce((acc, curr) => acc + curr.promedio, 0);
  const promedioHistorico = historicalScores.length > 0 ? (sumHistorical / historicalScores.length).toFixed(2) : 0;
  
  // Current cycle is the last one
  const promedioActual = evaluaciones[evaluaciones.length - 1].promedio.toFixed(2);

  t.evaluaciones = evaluaciones;
  t.promedioHistorico = parseFloat(promedioHistorico);
  t.promedioActual = parseFloat(promedioActual);
});

fs.writeFileSync(jsonPath, JSON.stringify(teachers, null, 2));
console.log('Added mock scores to all teachers.');
