import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/users/{id}/points:
 *   get:
 *     summary: Obtém pontos de um usuário específico
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Informações de pontos do usuário
 *       404:
 *         description: Usuário não encontrado
 */
router.get('/:id/points', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        points: true,
        _count: {
          select: {
            issues: true,
            comments: true,
            votes: true,
            contributions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Get user rank
    const usersAbove = await prisma.user.count({
      where: { points: { gt: user.points } }
    });

    const totalUsers = await prisma.user.count();

    res.json({
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        points: user.points,
        rank: usersAbove + 1,
        totalUsers,
        percentile: ((1 - usersAbove / totalUsers) * 100).toFixed(1)
      },
      stats: {
        issuesReported: user._count.issues,
        comments: user._count.comments,
        votes: user._count.votes,
        contributions: user._count.contributions
      }
    });
  } catch (error) {
    console.error('Get user points error:', error);
    res.status(500).json({ error: 'Erro ao buscar pontos do usuário' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Perfil público de um usuário
 *     tags: [Users]
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

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        points: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            issues: true,
            comments: true,
            contributions: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Get recent issues by user
    const recentIssues = await prisma.issue.findMany({
      where: { userId: id },
      orderBy: { reportedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        severity: true,
        status: true,
        reportedAt: true
      }
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        points: user.points,
        role: user.role,
        memberSince: user.createdAt,
        stats: {
          issuesReported: user._count.issues,
          comments: user._count.comments,
          contributions: user._count.contributions
        }
      },
      recentIssues
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil do usuário' });
  }
});

// ============================================
// GAMIFICATION - Stats Completas
// ============================================

/**
 * @swagger
 * /api/users/{id}/gamification:
 *   get:
 *     summary: Stats completas do usuário (pontos, nível, badges)
 *     tags: [Gamification]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estatísticas de gamificação do usuário
 */
router.get('/:id/gamification', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        points: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
        lastActiveAt: true,
        createdAt: true,
        _count: {
          select: {
            issues: true,
            comments: true,
            votes: true,
            contributions: true,
            userBadges: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Get user badges
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: id },
      include: {
        badge: true
      },
      orderBy: { unlockedAt: 'desc' }
    });

    // Get user rank
    const usersAbove = await prisma.user.count({
      where: { points: { gt: user.points } }
    });

    // Calculate level progress
    const pointsForNextLevel = user.level * 100;
    const pointsInCurrentLevel = user.points % 100;
    const levelProgress = (pointsInCurrentLevel / pointsForNextLevel) * 100;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      gamification: {
        points: user.points,
        level: user.level,
        rank: usersAbove + 1,
        levelProgress: Math.min(levelProgress, 100).toFixed(1),
        pointsToNextLevel: pointsForNextLevel - pointsInCurrentLevel
      },
      streak: {
        current: user.currentStreak,
        longest: user.longestStreak,
        lastActive: user.lastActiveAt
      },
      badges: userBadges.map(ub => ({
        id: ub.badge.id,
        name: ub.badge.name,
        description: ub.badge.description,
        icon: ub.badge.icon,
        unlockedAt: ub.unlockedAt
      })),
      stats: {
        totalBadges: user._count.userBadges,
        issuesReported: user._count.issues,
        comments: user._count.comments,
        votes: user._count.votes,
        contributions: user._count.contributions,
        memberSince: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user gamification error:', error);
    res.status(500).json({ error: 'Erro ao buscar gamificação do usuário' });
  }
});

/**
 * @swagger
 * /api/users/{id}/points:
 *   put:
 *     summary: Atualizar pontos do usuário (interno)
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               points:
 *                 type: integer
 *               action:
 *                 type: string
 *                 enum: [add, set]
 */
router.put('/:id/points', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { points, action = 'add' } = req.body;

    if (points === undefined) {
      return res.status(400).json({ error: 'Pontos são obrigatórios' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    let newPoints: number;
    let newLevel: number;

    if (action === 'set') {
      newPoints = points;
    } else {
      newPoints = user.points + points;
    }

    // Calculate level (every 100 points = 1 level)
    newLevel = Math.floor(newPoints / 100) + 1;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        points: newPoints,
        level: newLevel
      },
      select: {
        id: true,
        points: true,
        level: true
      }
    });

    res.json({
      message: 'Pontos atualizados!',
      user: updatedUser,
      leveledUp: newLevel > user.level
    });
  } catch (error) {
    console.error('Update user points error:', error);
    res.status(500).json({ error: 'Erro ao atualizar pontos' });
  }
});

// ============================================
// BADGES
// ============================================

/**
 * @swagger
 * /api/users/{id}/badges:
 *   get:
 *     summary: Badges do usuário
 *     tags: [Badges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id/badges', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userBadges = await prisma.userBadge.findMany({
      where: { userId: id },
      include: {
        badge: true
      },
      orderBy: { unlockedAt: 'desc' }
    });

    // Get all badges to show locked ones too
    const allBadges = await prisma.badge.findMany();
    const unlockedIds = userBadges.map(ub => ub.badgeId);

    const badges = allBadges.map(badge => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      points: badge.points,
      category: badge.category,
      unlocked: unlockedIds.includes(badge.id),
      unlockedAt: userBadges.find(ub => ub.badgeId === badge.id)?.unlockedAt || null
    }));

    res.json({
      unlocked: userBadges.length,
      total: allBadges.length,
      badges
    });
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ error: 'Erro ao buscar badges do usuário' });
  }
});

/**
 * @swagger
 * /api/users/{id}/badges:
 *   post:
 *     summary: Desbloquear badge (interno)
 *     tags: [Badges]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               badgeId:
 *                 type: string
 */
router.post('/:id/badges', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { badgeId } = req.body;

    if (!badgeId) {
      return res.status(400).json({ error: 'ID do badge é obrigatório' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) {
      return res.status(404).json({ error: 'Badge não encontrado' });
    }

    // Check if already unlocked
    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId: id, badgeId } }
    });

    if (existing) {
      return res.status(400).json({ error: 'Badge já desbloqueado' });
    }

    // Unlock badge
    const userBadge = await prisma.userBadge.create({
      data: { userId: id, badgeId },
      include: { badge: true }
    });

    // Award badge points
    await prisma.user.update({
      where: { id },
      data: { points: { increment: badge.points } }
    });

    // Create contribution
    await prisma.contribution.create({
      data: {
        userId: id,
        type: 'badge_unlocked',
        points: badge.points,
        description: `Desbloqueou badge: ${badge.name}`
      }
    });

    res.status(201).json({
      message: 'Badge desbloqueado!',
      badge: {
        id: userBadge.badge.id,
        name: userBadge.badge.name,
        description: userBadge.badge.description,
        icon: userBadge.badge.icon,
        pointsEarned: badge.points
      }
    });
  } catch (error) {
    console.error('Unlock badge error:', error);
    res.status(500).json({ error: 'Erro ao desbloquear badge' });
  }
});

// ============================================
// STREAK
// ============================================

/**
 * @swagger
 * /api/users/{id}/streak:
 *   get:
 *     summary: Streak atual do usuário
 *     tags: [Streak]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id/streak', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        currentStreak: true,
        longestStreak: true,
        lastActiveAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Check if streak is still active (last activity within 24h)
    const now = new Date();
    const lastActive = new Date(user.lastActiveAt);
    const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
    const streakActive = hoursSinceActive < 48; // 48h grace period

    res.json({
      userId: user.id,
      currentStreak: streakActive ? user.currentStreak : 0,
      longestStreak: user.longestStreak,
      lastActiveAt: user.lastActiveAt,
      streakActive,
      nextMilestone: getNextStreakMilestone(user.currentStreak)
    });
  } catch (error) {
    console.error('Get user streak error:', error);
    res.status(500).json({ error: 'Erro ao buscar streak do usuário' });
  }
});

/**
 * @swagger
 * /api/users/{id}/streak:
 *   put:
 *     summary: Atualizar streak do usuário (interno, diário)
 *     tags: [Streak]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/streak', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { currentStreak: true, longestStreak: true, lastActiveAt: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const now = new Date();
    const lastActive = new Date(user.lastActiveAt);
    const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    let newStreak: number;
    let streakBroken = false;

    if (daysSinceActive === 0) {
      // Same day, no change
      newStreak = user.currentStreak;
    } else if (daysSinceActive === 1) {
      // Next day, increment streak
      newStreak = user.currentStreak + 1;
    } else {
      // Streak broken
      newStreak = 1;
      streakBroken = true;
    }

    const newLongest = Math.max(newStreak, user.longestStreak);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActiveAt: now
      },
      select: {
        currentStreak: true,
        longestStreak: true,
        lastActiveAt: true
      }
    });

    // Award streak points
    if (newStreak > user.currentStreak && newStreak % 7 === 0) {
      // Weekly streak bonus
      const bonusPoints = newStreak;
      await prisma.user.update({
        where: { id },
        data: { points: { increment: bonusPoints } }
      });

      await prisma.contribution.create({
        data: {
          userId: id,
          type: 'streak_bonus',
          points: bonusPoints,
          description: `Streak de ${newStreak} dias!`
        }
      });
    }

    res.json({
      message: streakBroken ? 'Streak reiniciado' : 'Streak atualizado!',
      streak: updatedUser,
      streakBroken
    });
  } catch (error) {
    console.error('Update user streak error:', error);
    res.status(500).json({ error: 'Erro ao atualizar streak' });
  }
});

// ============================================
// IMPACT
// ============================================

/**
 * @swagger
 * /api/users/{id}/impact:
 *   get:
 *     summary: Estatísticas de impacto do usuário
 *     tags: [Impact]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id/impact', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            issues: true,
            votes: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Get or create impact stats
    let impactStats = await prisma.impactStats.findUnique({
      where: { userId: id }
    });

    if (!impactStats) {
      // Calculate impact based on user activity
      const issuesResolved = await prisma.issue.count({
        where: { userId: id, status: 'resolved' }
      });

      impactStats = await prisma.impactStats.create({
        data: {
          userId: id,
          co2Saved: user._count.issues * 2.5,
          treesEquivalent: user._count.issues * 0.1,
          waterSaved: user._count.issues * 50,
          wasteReported: user._count.issues * 5,
          areasProtected: issuesResolved
        }
      });
    }

    res.json({
      userId: user.id,
      userName: user.name,
      impact: {
        co2Saved: {
          value: impactStats.co2Saved,
          unit: 'kg',
          description: 'CO₂ economizado'
        },
        treesEquivalent: {
          value: impactStats.treesEquivalent,
          unit: 'árvores',
          description: 'Equivalente em árvores plantadas'
        },
        waterSaved: {
          value: impactStats.waterSaved,
          unit: 'litros',
          description: 'Água preservada'
        },
        wasteReported: {
          value: impactStats.wasteReported,
          unit: 'kg',
          description: 'Resíduos reportados'
        },
        areasProtected: {
          value: impactStats.areasProtected,
          unit: 'áreas',
          description: 'Áreas protegidas'
        }
      },
      activity: {
        issuesReported: user._count.issues,
        confirmations: user._count.votes
      }
    });
  } catch (error) {
    console.error('Get user impact error:', error);
    res.status(500).json({ error: 'Erro ao buscar impacto do usuário' });
  }
});

// Helper function
function getNextStreakMilestone(currentStreak: number): { days: number; reward: string } {
  const milestones = [
    { days: 7, reward: '🔥 Semana de Fogo' },
    { days: 14, reward: '⚡ Duas Semanas' },
    { days: 30, reward: '🏆 Mês Completo' },
    { days: 60, reward: '💎 Dois Meses' },
    { days: 90, reward: '👑 Trimestre' },
    { days: 180, reward: '🌟 Meio Ano' },
    { days: 365, reward: '🎖️ Um Ano' }
  ];

  for (const milestone of milestones) {
    if (currentStreak < milestone.days) {
      return milestone;
    }
  }

  return { days: 365 * 2, reward: '🏅 Dois Anos' };
}

export default router;
