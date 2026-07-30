import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, 'src', 'data', 'mockTeachers.json');

const teachers = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const fakeCourses = [
  { curso: 'Administración de Recursos Humanos', programa: 'Administración', ciclo: 'V', seccion: '1' },
  { curso: 'Marketing Estratégico', programa: 'Negocios Internacionales', ciclo: 'VII', seccion: '2' },
  { curso: 'Finanzas Corporativas', programa: 'Contabilidad', ciclo: 'VI', seccion: '3' },
  { curso: 'Gestión de Proyectos', programa: 'Gestión Pública', ciclo: 'VIII', seccion: '1' },
  { curso: 'Comportamiento Organizacional', programa: 'Administración', ciclo: 'IV', seccion: '2' }
];

let added = 0;

teachers.forEach((t, index) => {
  if (t.asignaciones.length === 0) {
    // Pick 1 or 2 random courses based on index
    const numCourses = (index % 2 === 0) ? 2 : 1;
    const startIndex = index % fakeCourses.length;
    
    for (let i = 0; i < numCourses; i++) {
      const course = fakeCourses[(startIndex + i) % fakeCourses.length];
      t.asignaciones.push(course);
    }
    added++;
  }
});

fs.writeFileSync(jsonPath, JSON.stringify(teachers, null, 2));
console.log(`Added fake courses to ${added} teachers.`);
