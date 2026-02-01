import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import issueRoutes from './routes/issues';
import datasetRoutes from './routes/datasets';
import insightRoutes from './routes/insights';
import alertRoutes from './routes/alerts';
import statsRoutes from './routes/stats';
import aiRoutes from './routes/ai';
import contributionsRoutes from './routes/contributions';
import rankingRoutes from './routes/ranking';
import usersRoutes from './routes/users';
import badgesRoutes from './routes/badges';
import institutionRoutes from './routes/institution';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ArcticCare API - Documentação'
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ArcticCare API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/contributions', contributionsRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/institution', institutionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🌍 ═══════════════════════════════════════════════════════
   ArcticCare API - Earth Guardian Backend
   ═══════════════════════════════════════════════════════
   
   🚀 Server running on http://localhost:${PORT}
   📊 Health check: http://localhost:${PORT}/health
   📚 Swagger Docs: http://localhost:${PORT}/api-docs
   
   📌 Available endpoints:
      POST /api/auth/register
      POST /api/auth/login
      GET  /api/issues
      POST /api/issues
      GET  /api/datasets
      GET  /api/insights
      GET  /api/alerts
      GET  /api/stats
   
🌍 ═══════════════════════════════════════════════════════
  `);
});

export default app;
