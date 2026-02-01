import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @swagger
 * /api/ranking:
 *   get:
 *     summary: Ranking geral de usuários
 *     tags: [Ranking]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [global, monthly]
 *           default: global
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Lista de usuários ordenados por pontos
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type = 'global', limit = '50', page = '1' } = req.query;
    const take = parseInt(limit as string);
    const skip = (parseInt(page as string) - 1) * take;

    let dateFilter = {};
    
    // For monthly ranking, only count contributions from this month
    if (type === 'monthly') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { gte: startOfMonth } };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { points: 'desc' },
        skip,
        take,
        select: {
          id: true,
          name: true,
          avatar: true,
          points: true,
          createdAt: true,
          _count: {
            select: {
              issues: true,
              comments: true,
              contributions: true
            }
          }
        }
      }),
      prisma.user.count()
    ]);

    const ranking = users.map((user, index) => ({
      rank: skip + index + 1,
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      points: user.points,
      issuesReported: user._count.issues,
      comments: user._count.comments,
      contributions: user._count.contributions,
      memberSince: user.createdAt
    }));

    res.json({
      ranking,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get ranking error:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
});

/**
 * @swagger
 * /api/ranking/top:
 *   get:
 *     summary: Top contribuidores
 *     tags: [Ranking]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista dos top contribuidores
 */
router.get('/top', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;

    const topUsers = await prisma.user.findMany({
      orderBy: { points: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        name: true,
        avatar: true,
        points: true,
        _count: {
          select: {
            issues: true,
            contributions: true
          }
        }
      }
    });

    const top = topUsers.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      points: user.points,
      issuesReported: user._count.issues,
      contributions: user._count.contributions,
      badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
    }));

    res.json({ top });
  } catch (error) {
    console.error('Get top ranking error:', error);
    res.status(500).json({ error: 'Erro ao buscar top ranking' });
  }
});

export default router;
