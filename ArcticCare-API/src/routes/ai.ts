import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @swagger
 * /api/ai/analyze-report:
 *   post:
 *     summary: Analisa um report e retorna avaliação de risco com IA
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - latitude
 *               - longitude
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [flood, fire, pollution, deforestation, waste, other]
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Análise de risco gerada com sucesso
 */
router.post('/analyze-report', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, category, latitude, longitude } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Título, descrição e categoria são obrigatórios' });
    }

    // Simulated AI analysis based on keywords and category
    const riskFactors: string[] = [];
    let riskScore = 0;
    let suggestedSeverity = 'low';

    // Category-based risk
    const categoryRisk: { [key: string]: number } = {
      fire: 40,
      flood: 35,
      pollution: 30,
      deforestation: 25,
      waste: 15,
      other: 10
    };
    riskScore += categoryRisk[category] || 10;

    // Keyword analysis
    const criticalKeywords = ['urgente', 'emergência', 'crítico', 'perigo', 'morte', 'evacuação', 'explosão'];
    const highKeywords = ['grande', 'extenso', 'rápido', 'propagando', 'contaminação', 'tóxico'];
    const mediumKeywords = ['moderado', 'crescendo', 'preocupante', 'atenção'];

    const textToAnalyze = `${title} ${description}`.toLowerCase();

    criticalKeywords.forEach(keyword => {
      if (textToAnalyze.includes(keyword)) {
        riskScore += 15;
        riskFactors.push(`Palavra crítica detectada: "${keyword}"`);
      }
    });

    highKeywords.forEach(keyword => {
      if (textToAnalyze.includes(keyword)) {
        riskScore += 10;
        riskFactors.push(`Indicador de alta severidade: "${keyword}"`);
      }
    });

    mediumKeywords.forEach(keyword => {
      if (textToAnalyze.includes(keyword)) {
        riskScore += 5;
        riskFactors.push(`Indicador de atenção: "${keyword}"`);
      }
    });

    // Check for nearby issues
    if (latitude && longitude) {
      const nearbyIssues = await prisma.issue.count({
        where: {
          latitude: { gte: latitude - 0.1, lte: latitude + 0.1 },
          longitude: { gte: longitude - 0.1, lte: longitude + 0.1 },
          status: { in: ['open', 'investigating'] }
        }
      });

      if (nearbyIssues > 0) {
        riskScore += nearbyIssues * 5;
        riskFactors.push(`${nearbyIssues} ocorrência(s) ativa(s) na região`);
      }
    }

    // Determine severity based on score
    if (riskScore >= 70) {
      suggestedSeverity = 'critical';
    } else if (riskScore >= 50) {
      suggestedSeverity = 'high';
    } else if (riskScore >= 30) {
      suggestedSeverity = 'medium';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (suggestedSeverity === 'critical') {
      recommendations.push('Acionar equipes de emergência imediatamente');
      recommendations.push('Notificar autoridades locais');
      recommendations.push('Considerar evacuação da área se necessário');
    } else if (suggestedSeverity === 'high') {
      recommendations.push('Monitorar situação de perto');
      recommendations.push('Preparar recursos para intervenção');
      recommendations.push('Alertar comunidades próximas');
    } else if (suggestedSeverity === 'medium') {
      recommendations.push('Acompanhar evolução do problema');
      recommendations.push('Registrar evidências adicionais');
    } else {
      recommendations.push('Manter registro para acompanhamento');
    }

    // Award points for using AI analysis
    await prisma.contribution.create({
      data: {
        userId: req.user!.id,
        type: 'ai_analysis',
        points: 5,
        description: 'Usou análise de IA para avaliação de risco'
      }
    });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { points: { increment: 5 } }
    });

    res.json({
      analysis: {
        riskScore: Math.min(riskScore, 100),
        suggestedSeverity,
        riskLevel: riskScore >= 70 ? 'CRÍTICO' : riskScore >= 50 ? 'ALTO' : riskScore >= 30 ? 'MÉDIO' : 'BAIXO',
        riskFactors,
        recommendations,
        confidence: Math.min(65 + riskFactors.length * 5, 95),
        analyzedAt: new Date().toISOString()
      },
      pointsEarned: 5
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'Erro ao realizar análise de IA' });
  }
});

/**
 * @swagger
 * /api/ai/predict-trend:
 *   post:
 *     summary: Prevê tendências baseado em dados históricos
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/predict-trend', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { category, region, period = '30d' } = req.body;

    // Get historical data
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const where: any = { reportedAt: { gte: startDate } };
    if (category) where.category = category;
    if (region) where.region = { contains: region };

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { reportedAt: 'asc' }
    });

    // Calculate trend
    const firstHalf = issues.filter(i => i.reportedAt < new Date(startDate.getTime() + (daysBack / 2) * 24 * 60 * 60 * 1000));
    const secondHalf = issues.filter(i => i.reportedAt >= new Date(startDate.getTime() + (daysBack / 2) * 24 * 60 * 60 * 1000));

    const trend = secondHalf.length > firstHalf.length ? 'increasing' : 
                  secondHalf.length < firstHalf.length ? 'decreasing' : 'stable';

    const changePercent = firstHalf.length > 0 
      ? ((secondHalf.length - firstHalf.length) / firstHalf.length * 100).toFixed(1)
      : 0;

    res.json({
      prediction: {
        trend,
        changePercent: `${changePercent}%`,
        totalIssues: issues.length,
        period,
        category: category || 'all',
        region: region || 'all',
        confidence: Math.min(50 + issues.length * 2, 90),
        predictedNextPeriod: trend === 'increasing' ? 'Aumento esperado' : 
                             trend === 'decreasing' ? 'Redução esperada' : 'Estabilidade esperada'
      }
    });
  } catch (error) {
    console.error('Predict trend error:', error);
    res.status(500).json({ error: 'Erro ao prever tendência' });
  }
});

export default router;
