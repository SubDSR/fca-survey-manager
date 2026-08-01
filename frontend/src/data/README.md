# Documentación de Datos Mockeados (Gestión de Docentes)

Este directorio contiene la lógica para la simulación de datos (Mocks) de la vista "Gestión de Docentes". El propósito de estos mocks es **simular la respuesta futura de la Base de Datos**, permitiendo al Frontend avanzar en el desarrollo de la interfaz sin estar bloqueado por el Backend.

## 🛠️ ¿Cómo funciona?

En lugar de que el Frontend (React) procese miles de filas del CSV en vivo, hemos delegado ese trabajo a un script de Node.js que actúa como nuestro "Backend falso".

### Archivos Clave:
1. **`generateMockData.js` (El Backend Falso)**: 
   * Es un script que lee `docentes.csv` y `dataset.csv`.
   * Calcula matemáticamente los promedios reales exactos (P1 a P9).
   * Cruza la información personal del docente con sus cursos asignados.
   * *Nota: Este script no se ejecuta en el navegador, solo se corre en terminal (`node generateMockData.js`) cada vez que los CSV cambian.*

2. **`src/data/mockTeachers.json` (La "API")**:
   * Es el resultado directo del script anterior.
   * Contiene un arreglo de objetos altamente estructurados y listos para ser consumidos por React.
   * Representa **exactamente** la estructura de JSON que se espera que devuelva la verdadera Base de Datos en el futuro.

## 🔄 Transición a Producción (Para el equipo Backend)

Cuando la Base de Datos real y los Endpoints (API) estén listos, la transición será directa:

1. El Backend deberá crear un Endpoint (ej. `GET /api/docentes`) que devuelva un JSON con **la misma estructura** que tiene `mockTeachers.json` actualmente (incluyendo el arreglo `evaluaciones` y `evaluacionesCiclo`).
2. En el Frontend, simplemente se reemplazará la importación local del archivo JSON por una llamada `fetch()` o `axios.get()` al nuevo Endpoint.
3. ¡La interfaz gráfica (`GestionView.jsx`) funcionará de inmediato sin necesidad de refactorizar el código de React!

Una vez hecho esto, los archivos `generateMockData.js` y `mockTeachers.json` podrán ser eliminados del proyecto de forma segura.
