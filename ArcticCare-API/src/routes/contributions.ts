import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @swagger
 * /api/contributions:
 *   get:
 *     summary: Lista contribuições do usuário logado
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [issue_reported, issue_confirmed, comment, data_submitted, account_created, ai_analysis]
 *     responses:
 *       200:
 *         description: Lista de contribuições
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '50', type } = req.query;

    const where: any = { userId: req.user!.id };
    if (type) where.type = type;

    const contributions = await prisma.contribution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    const totalPoints = await prisma.contribution.aggregate({
      where: { userId: req.user!.id },
      _sum: { points: true }
    });

    res.json({
      contributions,
      summary: {
        total: contributions.length,
        totalPoints: totalPoints._sum.points || 0
      }
    });
  } catch (error) {
    console.error('Get contributions error:', error);
    res.status(500).json({ error: 'Erro ao buscar contribuições' });
  }
});

/**
 * @swagger
 * /api/contributions/summary:
 *   get:
 *     summary: Resumo das contribuições do usuário
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const contributionsByType = await prisma.contribution.groupBy({
      by: ['type'],
      where: { userId: req.user!.id },
      _count: true,
      _sum: { points: true }
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { points: true, createdAt: true }
    });

    res.json({
      summary: {
        totalPoints: user?.points || 0,
        memberSince: user?.createdAt,
        byType: contributionsByType.map(c => ({
          type: c.type,
          count: c._count,
          points: c._sum?.points || 0
        }))
      }
    });
  } catch (error) {
    console.error('Get contributions summary error:', error);
    res.status(500).json({ error: 'Erro ao buscar resumo de contribuições' });
  }
});

export default router;
