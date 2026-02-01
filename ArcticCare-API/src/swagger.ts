import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ArcticCare API',
      version: '1.0.0',
      description: 'API para monitoramento climático e ambiental - Earth Guardian Backend',
      contact: {
        name: 'ArcticCare Team'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de Desenvolvimento'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            avatar: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['user', 'admin', 'moderator'] },
            points: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Issue: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string', enum: ['flood', 'fire', 'pollution', 'deforestation', 'waste', 'other'] },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            status: { type: 'string', enum: ['open', 'investigating', 'in_progress', 'resolved', 'closed'] },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            address: { type: 'string', nullable: true },
            region: { type: 'string', nullable: true },
            images: { type: 'string', nullable: true },
            reportedAt: { type: 'string', format: 'date-time' },
            userId: { type: 'string', format: 'uuid' }
          }
        },
        Dataset: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string', enum: ['temperature', 'air_quality', 'water', 'vegetation', 'weather'] },
            source: { type: 'string' },
            region: { type: 'string', nullable: true },
            data: { type: 'object' },
            unit: { type: 'string', nullable: true },
            lastUpdated: { type: 'string', format: 'date-time' }
          }
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['critical', 'warning', 'info'] },
            title: { type: 'string' },
            message: { type: 'string' },
            region: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Insight: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string', enum: ['prediction', 'anomaly', 'trend', 'alert'] },
            severity: { type: 'string', enum: ['info', 'warning', 'danger'], nullable: true },
            confidence: { type: 'number', nullable: true },
            data: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Autenticação e gerenciamento de usuários' },
      { name: 'Issues', description: 'Ocorrências ambientais (reports)' },
      { name: 'Datasets', description: 'Dados climáticos e ambientais' },
      { name: 'Insights', description: 'Análises e previsões' },
      { name: 'Alerts', description: 'Alertas ambientais' },
      { name: 'Stats', description: 'Estatísticas e gamificação' },
      { name: 'AI', description: 'Análises com Inteligência Artificial' },
      { name: 'Contributions', description: 'Contribuições do usuário' },
      { name: 'Ranking', description: 'Ranking e gamificação' },
      { name: 'Users', description: 'Perfis de usuários' },
      { name: 'Institution Auth', description: 'Autenticação institucional' },
      { name: 'Institution Reports', description: 'Gestão de relatos (painel institucional)' },
      { name: 'Institution Metrics', description: 'Métricas e estatísticas institucionais' },
      { name: 'Institution Risk Zones', description: 'Zonas de risco' },
      { name: 'Institution Profile', description: 'Perfil e membros da instituição' },
      { name: 'Institution Notifications', description: 'Configurações de notificações' }
    ]
  },
  apis: ['./src/routes/*.ts', './src/docs/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
