import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/badges:
 *   get:
 *     summary: Lista todas as badges disponíveis
 *     tags: [Badges]
 *     responses:
 *       200:
 *         description: Lista de todas as badges do sistema
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const badges = await prisma.badge.findMany({
      orderBy: [
        { category: 'asc' },
        { points: 'asc' }
      ]
    });

    // Group by category
    const byCategory: { [key: string]: any[] } = {};
    
    badges.forEach(badge => {
      const cat = badge.category || 'general';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        points: badge.points,
        requirement: JSON.parse(badge.requirement)
      });
    });

    res.json({
      total: badges.length,
      categories: Object.keys(byCategory),
      badges: byCategory
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Erro ao buscar badges' });
  }
});

/**
 * @swagger
 * /api/badges/{id}:
 *   get:
 *     summary: Detalhes de uma badge específica
 *     tags: [Badges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const badge = await prisma.badge.findUnique({
      where: { id },
      include: {
        userBadges: {
          take: 10,
          orderBy: { unlockedAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    });

    if (!badge) {
      return res.status(404).json({ error: 'Badge não encontrada' });
    }

    // Count total users with this badge
    const totalUnlocked = await prisma.userBadge.count({
      where: { badgeId: id }
    });

    res.json({
      badge: {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        points: badge.points,
        category: badge.category,
        requirement: JSON.parse(badge.requirement)
      },
      stats: {
        totalUnlocked,
        recentUnlocks: badge.userBadges.map(ub => ({
          user: ub.user,
          unlockedAt: ub.unlockedAt
        }))
      }
    });
  } catch (error) {
    console.error('Get badge error:', error);
    res.status(500).json({ error: 'Erro ao buscar badge' });
  }
});

/**
 * @swagger
 * /api/badges:
 *   post:
 *     summary: Criar nova badge (admin)
 *     tags: [Badges]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, icon, requirement, points, category } = req.body;

    if (!name || !description || !icon || !requirement || points === undefined) {
      return res.status(400).json({ 
        error: 'Nome, descrição, ícone, requisito e pontos são obrigatórios' 
      });
    }

    const badge = await prisma.badge.create({
      data: {
        name,
        description,
        icon,
        requirement: JSON.stringify(requirement),
        points,
        category: category || 'general'
      }
    });

    res.status(201).json({
      message: 'Badge criada com sucesso!',
      badge: {
        ...badge,
        requirement: JSON.parse(badge.requirement)
      }
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe uma badge com este nome' });
    }
    console.error('Create badge error:', error);
    res.status(500).json({ error: 'Erro ao criar badge' });
  }
});

export default router;
