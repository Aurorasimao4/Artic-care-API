import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      totalIssues,
      openIssues,
      resolvedIssues,
      criticalIssues,
      totalUsers,
      activeAlerts,
      totalDatasets,
      totalReadings
    ] = await Promise.all([
      prisma.issue.count(),
      prisma.issue.count({ where: { status: 'open' } }),
      prisma.issue.count({ where: { status: 'resolved' } }),
      prisma.issue.count({ where: { severity: 'critical', status: { not: 'resolved' } } }),
      prisma.user.count(),
      prisma.alert.count({ where: { isActive: true } }),
      prisma.dataset.count(),
      prisma.climateReading.count()
    ]);

    // Get issues by category
    const issuesByCategory = await prisma.issue.groupBy({
      by: ['category'],
      _count: { category: true }
    });

    // Get issues by severity
    const issuesBySeverity = await prisma.issue.groupBy({
      by: ['severity'],
      _count: { severity: true }
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentIssues = await prisma.issue.count({
      where: { reportedAt: { gte: sevenDaysAgo } }
    });

    const recentComments = await prisma.comment.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    });

    res.json({
      overview: {
        totalIssues,
        openIssues,
        resolvedIssues,
        criticalIssues,
        totalUsers,
        activeAlerts,
        totalDatasets,
        totalReadings
      },
      issuesByCategory: issuesByCategory.map(item => ({
        category: item.category,
        count: item._count.category
      })),
      issuesBySeverity: issuesBySeverity.map(item => ({
        severity: item.severity,
        count: item._count.severity
      })),
      recentActivity: {
        issues: recentIssues,
        comments: recentComments,
        period: '7 days'
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;

    const users = await prisma.user.findMany({
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
            comments: true,
            contributions: true
          }
        }
      }
    });

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      points: user.points,
      issuesReported: user._count.issues,
      comments: user._count.comments,
      contributions: user._count.contributions
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
});

// Get user stats
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    // Get contribution breakdown
    const contributionsByType = await prisma.contribution.groupBy({
      by: ['type'],
      where: { userId },
      _count: true,
      _sum: { points: true }
    });

    // Get issues by status
    const issuesByStatus = await prisma.issue.groupBy({
      by: ['status'],
      where: { userId },
      _count: true
    });

    res.json({
      user: {
        ...user,
        rank: usersAbove + 1
      },
      stats: {
        issuesReported: user._count.issues,
        comments: user._count.comments,
        votes: user._count.votes,
        totalContributions: user._count.contributions
      },
      contributionsByType: contributionsByType.map(item => ({
        type: item.type,
        count: item._count,
        points: item._sum?.points || 0
      })),
      issuesByStatus: issuesByStatus.map(item => ({
        status: item.status,
        count: item._count
      }))
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas do usuário' });
  }
});

// Get my stats (authenticated user)
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    // Get recent contributions
    const recentContributions = await prisma.contribution.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get recent issues
    const recentIssues = await prisma.issue.findMany({
      where: { userId },
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
        ...user,
        rank: usersAbove + 1,
        totalUsers
      },
      stats: {
        issuesReported: user._count.issues,
        comments: user._count.comments,
        votes: user._count.votes,
        totalContributions: user._count.contributions,
        percentile: ((1 - usersAbove / totalUsers) * 100).toFixed(1)
      },
      recentContributions,
      recentIssues
    });
  } catch (error) {
    console.error('Get my stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar suas estatísticas' });
  }
});

// Get issues timeline
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const { period = '30d', category } = req.query;

    let startDate: Date;
    const now = new Date();

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const where: any = {
      reportedAt: { gte: startDate }
    };

    if (category) where.category = category;

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { reportedAt: 'asc' },
      select: {
        id: true,
        reportedAt: true,
        category: true,
        severity: true,
        status: true
      }
    });

    // Group by date
    const timeline: { [key: string]: { total: number; byCategory: { [key: string]: number }; bySeverity: { [key: string]: number } } } = {};

    issues.forEach(issue => {
      const dateKey = issue.reportedAt.toISOString().split('T')[0];
      
      if (!timeline[dateKey]) {
        timeline[dateKey] = { total: 0, byCategory: {}, bySeverity: {} };
      }
      
      timeline[dateKey].total++;
      timeline[dateKey].byCategory[issue.category] = (timeline[dateKey].byCategory[issue.category] || 0) + 1;
      timeline[dateKey].bySeverity[issue.severity] = (timeline[dateKey].bySeverity[issue.severity] || 0) + 1;
    });

    res.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalIssues: issues.length,
      timeline: Object.entries(timeline).map(([date, data]) => ({
        date,
        ...data
      }))
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Erro ao buscar linha do tempo' });
  }
});

// Get regional stats
router.get('/regions', async (req: Request, res: Response) => {
  try {
    const issuesByRegion = await prisma.issue.groupBy({
      by: ['region'],
      _count: { region: true },
      where: {
        region: { not: null }
      }
    });

    // Get severity breakdown by region
    const regionStats = await Promise.all(
      issuesByRegion.map(async (item) => {
        const severityBreakdown = await prisma.issue.groupBy({
          by: ['severity'],
          where: { region: item.region },
          _count: { severity: true }
        });

        const statusBreakdown = await prisma.issue.groupBy({
          by: ['status'],
          where: { region: item.region },
          _count: { status: true }
        });

        return {
          region: item.region,
          totalIssues: item._count.region,
          severity: severityBreakdown.map(s => ({
            level: s.severity,
            count: s._count.severity
          })),
          status: statusBreakdown.map(s => ({
            status: s.status,
            count: s._count.status
          }))
        };
      })
    );

    res.json({
      regions: regionStats.sort((a, b) => b.totalIssues - a.totalIssues)
    });
  } catch (error) {
    console.error('Get regional stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas regionais' });
  }
});

// Get badges
router.get('/badges', async (req: Request, res: Response) => {
  try {
    const badges = await prisma.badge.findMany({
      orderBy: { points: 'asc' }
    });

    const parsedBadges = badges.map(badge => ({
      ...badge,
      requirement: JSON.parse(badge.requirement)
    }));

    res.json({ badges: parsedBadges });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Erro ao buscar badges' });
  }
});

/**
 * @swagger
 * /api/stats/community-impact:
 *   get:
 *     summary: Impacto total da comunidade
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Estatísticas de impacto ambiental da comunidade
 */
router.get('/community-impact', async (req: Request, res: Response) => {
  try {
    // Get aggregate stats
    const [
      totalUsers,
      totalIssues,
      resolvedIssues,
      totalVotes,
      totalContributions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.issue.count(),
      prisma.issue.count({ where: { status: 'resolved' } }),
      prisma.vote.count(),
      prisma.contribution.count()
    ]);

    // Get total points distributed
    const pointsAggregate = await prisma.user.aggregate({
      _sum: { points: true }
    });

    // Get impact stats aggregate
    const impactAggregate = await prisma.impactStats.aggregate({
      _sum: {
        co2Saved: true,
        treesEquivalent: true,
        waterSaved: true,
        wasteReported: true,
        areasProtected: true
      }
    });

    // Calculate estimated impact based on activity
    const estimatedCO2 = (impactAggregate._sum.co2Saved || 0) + (totalIssues * 2.5);
    const estimatedTrees = (impactAggregate._sum.treesEquivalent || 0) + (resolvedIssues * 0.5);
    const estimatedWater = (impactAggregate._sum.waterSaved || 0) + (totalIssues * 50);
    const estimatedWaste = (impactAggregate._sum.wasteReported || 0) + (totalIssues * 5);

    // Get top contributors for community section
    const topContributors = await prisma.user.findMany({
      take: 5,
      orderBy: { points: 'desc' },
      select: {
        id: true,
        name: true,
        avatar: true,
        points: true
      }
    });

    // Get issues by category for impact breakdown
    const issuesByCategory = await prisma.issue.groupBy({
      by: ['category'],
      _count: true
    });

    res.json({
      community: {
        totalMembers: totalUsers,
        totalPoints: pointsAggregate._sum.points || 0,
        totalContributions,
        issuesReported: totalIssues,
        issuesResolved: resolvedIssues,
        confirmations: totalVotes
      },
      environmentalImpact: {
        co2Saved: {
          value: parseFloat(estimatedCO2.toFixed(1)),
          unit: 'kg',
          description: 'CO₂ economizado',
          equivalent: `${Math.round(estimatedCO2 / 22)} viagens de carro evitadas`
        },
        treesEquivalent: {
          value: parseFloat(estimatedTrees.toFixed(1)),
          unit: 'árvores',
          description: 'Equivalente em árvores plantadas',
          equivalent: `${Math.round(estimatedTrees * 21)}kg de CO₂ absorvido/ano`
        },
        waterSaved: {
          value: parseFloat(estimatedWater.toFixed(0)),
          unit: 'litros',
          description: 'Água preservada',
          equivalent: `${Math.round(estimatedWater / 150)} banhos economizados`
        },
        wasteReported: {
          value: parseFloat(estimatedWaste.toFixed(1)),
          unit: 'kg',
          description: 'Resíduos reportados',
          equivalent: `${Math.round(estimatedWaste / 5)} sacos de lixo`
        },
        areasProtected: {
          value: impactAggregate._sum.areasProtected || resolvedIssues,
          unit: 'áreas',
          description: 'Áreas protegidas'
        }
      },
      issueBreakdown: issuesByCategory.map(item => ({
        category: item.category,
        count: item._count,
        impact: getCategoryImpact(item.category, item._count)
      })),
      topContributors: topContributors.map((user, index) => ({
        rank: index + 1,
        ...user
      })),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get community impact error:', error);
    res.status(500).json({ error: 'Erro ao buscar impacto da comunidade' });
  }
});

function getCategoryImpact(category: string, count: number): string {
  const impacts: { [key: string]: string } = {
    fire: `${(count * 5).toFixed(0)} hectares monitorados`,
    flood: `${(count * 100).toFixed(0)} pessoas alertadas`,
    pollution: `${(count * 10).toFixed(0)}kg de poluentes reportados`,
    deforestation: `${(count * 2).toFixed(0)} hectares protegidos`,
    waste: `${(count * 5).toFixed(0)}kg de resíduos reportados`,
    other: `${count} ocorrências registradas`
  };
  return impacts[category] || impacts.other;
}

export default router;
