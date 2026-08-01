import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FCA Survey Manager API',
      version: '1.0.0',
      description:
        'API REST para el sistema de evaluación docente de la Unidad de Posgrado — FCA UNMSM',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
