import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';

const router = Router();

// Get all insights
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, severity, limit = '20' } = req.query;

    const where: any = {};

    if (category) where.category = category;
    if (severity) where.severity = severity;

    const insights = await prisma.insight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    // Parse JSON data for each insight
    const parsedInsights = insights.map(insight => ({
      ...insight,
      data: insight.data ? JSON.parse(insight.data) : null
    }));

    res.json({ insights: parsedInsights });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Erro ao buscar insights' });
  }
});

// Get single insight by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const insight = await prisma.insight.findUnique({ where: { id } });

    if (!insight) {
      return res.status(404).json({ error: 'Insight não encontrado' });
    }

    res.json({
      insight: {
        ...insight,
        data: insight.data ? JSON.parse(insight.data) : null
      }
    });
  } catch (error) {
    console.error('Get insight error:', error);
    res.status(500).json({ error: 'Erro ao buscar insight' });
  }
});

// Get insights by category
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;

    const validCategories = ['prediction', 'anomaly', 'trend', 'alert'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    const insights = await prisma.insight.findMany({
      where: { category },
      orderBy: { createdAt: 'desc' }
    });

    const parsedInsights = insights.map(insight => ({
      ...insight,
      data: insight.data ? JSON.parse(insight.data) : null
    }));

    res.json({ insights: parsedInsights });
  } catch (error) {
    console.error('Get insights by category error:', error);
    res.status(500).json({ error: 'Erro ao buscar insights por categoria' });
  }
});

// Create insight (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, severity, confidence, data } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        error: 'Título, descrição e categoria são obrigatórios'
      });
    }

    const validCategories = ['prediction', 'anomaly', 'trend', 'alert'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    const insight = await prisma.insight.create({
      data: {
        title,
        description,
        category,
        severity,
        confidence: confidence ? parseFloat(confidence) : null,
        data: data ? JSON.stringify(data) : null
      }
    });

    res.status(201).json({
      message: 'Insight criado com sucesso!',
      insight: {
        ...insight,
        data: insight.data ? JSON.parse(insight.data) : null
      }
    });
  } catch (error) {
    console.error('Create insight error:', error);
    res.status(500).json({ error: 'Erro ao criar insight' });
  }
});

// Update insight (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, description, category, severity, confidence, data } = req.body;

    const existingInsight = await prisma.insight.findUnique({ where: { id } });

    if (!existingInsight) {
      return res.status(404).json({ error: 'Insight não encontrado' });
    }

    const insight = await prisma.insight.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
        ...(severity !== undefined && { severity }),
        ...(confidence !== undefined && { confidence: parseFloat(confidence) }),
        ...(data && { data: JSON.stringify(data) })
      }
    });

    res.json({
      message: 'Insight atualizado!',
      insight: {
        ...insight,
        data: insight.data ? JSON.parse(insight.data) : null
      }
    });
  } catch (error) {
    console.error('Update insight error:', error);
    res.status(500).json({ error: 'Erro ao atualizar insight' });
  }
});

// Delete insight (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const insight = await prisma.insight.findUnique({ where: { id } });

    if (!insight) {
      return res.status(404).json({ error: 'Insight não encontrado' });
    }

    await prisma.insight.delete({ where: { id } });

    res.json({ message: 'Insight excluído com sucesso!' });
  } catch (error) {
    console.error('Delete insight error:', error);
    res.status(500).json({ error: 'Erro ao excluir insight' });
  }
});

// Generate AI insights based on current data (simulation)
router.post('/generate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get recent data for analysis
    const [recentIssues, recentReadings] = await Promise.all([
      prisma.issue.findMany({
        where: { reportedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { reportedAt: 'desc' }
      }),
      prisma.climateReading.findMany({
        where: { recordedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { recordedAt: 'desc' }
      })
    ]);

    const generatedInsights = [];

    // Generate issue trend insight
    if (recentIssues.length > 0) {
      const categoryCounts: { [key: string]: number } = {};
      recentIssues.forEach(issue => {
        categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1;
      });

      const topCategory = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)[0];

      if (topCategory) {
        const trendInsight = await prisma.insight.create({
          data: {
            title: `Tendência: Aumento de ocorrências de ${topCategory[0]}`,
            description: `Nos últimos 7 dias, foram registradas ${topCategory[1]} ocorrências de ${topCategory[0]}, representando a categoria mais reportada.`,
            category: 'trend',
            severity: topCategory[1] > 10 ? 'warning' : 'info',
            confidence: 85,
            data: JSON.stringify({ categoryCounts, totalIssues: recentIssues.length })
          }
        });
        generatedInsights.push(trendInsight);
      }
    }

    // Generate critical issues alert
    const criticalIssues = recentIssues.filter(i => i.severity === 'critical' && i.status === 'open');
    if (criticalIssues.length > 0) {
      const alertInsight = await prisma.insight.create({
        data: {
          title: `Alerta: ${criticalIssues.length} ocorrências críticas em aberto`,
          description: `Existem ${criticalIssues.length} ocorrências com severidade crítica que ainda não foram resolvidas. Ação imediata é recomendada.`,
          category: 'alert',
          severity: 'danger',
          confidence: 100,
          data: JSON.stringify({ issues: criticalIssues.map(i => ({ id: i.id, title: i.title, region: i.region })) })
        }
      });
      generatedInsights.push(alertInsight);
    }

    // Generate temperature anomaly insight (if readings exist)
    const tempReadings = recentReadings.filter(r => r.type === 'temperature');
    if (tempReadings.length >= 5) {
      const avgTemp = tempReadings.reduce((sum, r) => sum + r.value, 0) / tempReadings.length;
      const maxTemp = Math.max(...tempReadings.map(r => r.value));

      if (maxTemp > avgTemp * 1.2) {
        const anomalyInsight = await prisma.insight.create({
          data: {
            title: 'Anomalia: Pico de temperatura detectado',
            description: `Foi detectado um pico de temperatura de ${maxTemp}°C, ${((maxTemp / avgTemp - 1) * 100).toFixed(1)}% acima da média do período (${avgTemp.toFixed(1)}°C).`,
            category: 'anomaly',
            severity: 'warning',
            confidence: 78,
            data: JSON.stringify({ avgTemp, maxTemp, readings: tempReadings.length })
          }
        });
        generatedInsights.push(anomalyInsight);
      }
    }

    res.json({
      message: `${generatedInsights.length} insights gerados com sucesso!`,
      insights: generatedInsights.map(insight => ({
        ...insight,
        data: insight.data ? JSON.parse(insight.data) : null
      }))
    });
  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({ error: 'Erro ao gerar insights' });
  }
});

export default router;
