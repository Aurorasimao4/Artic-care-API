import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';

const router = Router();

// Get all active alerts
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, region, includeExpired = 'false' } = req.query;

    const where: any = {};

    if (type) where.type = type;
    if (region) where.region = { contains: region as string };

    // Only show active and non-expired alerts by default
    if (includeExpired !== 'true') {
      where.isActive = true;
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ];
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: [
        { type: 'asc' }, // critical first, then warning, then info
        { createdAt: 'desc' }
      ]
    });

    res.json({ alerts });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
});

// Get single alert by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const alert = await prisma.alert.findUnique({ where: { id } });

    if (!alert) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    res.json({ alert });
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Erro ao buscar alerta' });
  }
});

// Get alerts by region
router.get('/region/:region', async (req: Request, res: Response) => {
  try {
    const region = req.params.region as string;

    const alerts = await prisma.alert.findMany({
      where: {
        region: { contains: region },
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ alerts });
  } catch (error) {
    console.error('Get alerts by region error:', error);
    res.status(500).json({ error: 'Erro ao buscar alertas por região' });
  }
});

// Get critical alerts
router.get('/type/critical', async (req: Request, res: Response) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: {
        type: 'critical',
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ alerts });
  } catch (error) {
    console.error('Get critical alerts error:', error);
    res.status(500).json({ error: 'Erro ao buscar alertas críticos' });
  }
});

// Create alert (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { type, title, message, region, expiresAt } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        error: 'Tipo, título e mensagem são obrigatórios'
      });
    }

    const validTypes = ['critical', 'warning', 'info'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Tipo de alerta inválido' });
    }

    const alert = await prisma.alert.create({
      data: {
        type,
        title,
        message,
        region,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    res.status(201).json({
      message: 'Alerta criado com sucesso!',
      alert
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Erro ao criar alerta' });
  }
});

// Update alert (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { type, title, message, region, isActive, expiresAt } = req.body;

    const existingAlert = await prisma.alert.findUnique({ where: { id } });

    if (!existingAlert) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(title && { title }),
        ...(message && { message }),
        ...(region !== undefined && { region }),
        ...(isActive !== undefined && { isActive }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null })
      }
    });

    res.json({
      message: 'Alerta atualizado!',
      alert
    });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ error: 'Erro ao atualizar alerta' });
  }
});

// Deactivate alert (admin only)
router.post('/:id/deactivate', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingAlert = await prisma.alert.findUnique({ where: { id } });

    if (!existingAlert) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      message: 'Alerta desativado!',
      alert
    });
  } catch (error) {
    console.error('Deactivate alert error:', error);
    res.status(500).json({ error: 'Erro ao desativar alerta' });
  }
});

// Delete alert (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const alert = await prisma.alert.findUnique({ where: { id } });

    if (!alert) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    await prisma.alert.delete({ where: { id } });

    res.json({ message: 'Alerta excluído com sucesso!' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ error: 'Erro ao excluir alerta' });
  }
});

// Generate alerts from critical issues (admin only)
router.post('/generate-from-issues', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get critical issues that don't have alerts yet
    const criticalIssues = await prisma.issue.findMany({
      where: {
        severity: 'critical',
        status: { in: ['open', 'investigating'] }
      },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    const generatedAlerts = [];

    for (const issue of criticalIssues) {
      // Check if alert already exists for this region and category
      const existingAlert = await prisma.alert.findFirst({
        where: {
          region: issue.region || undefined,
          isActive: true,
          message: { contains: issue.category }
        }
      });

      if (!existingAlert) {
        const alert = await prisma.alert.create({
          data: {
            type: 'critical',
            title: `Alerta: ${getCategoryName(issue.category)} - ${issue.region || 'Localização não especificada'}`,
            message: `${issue.title}. Reportado por ${issue.user.name}. ${issue.description.substring(0, 200)}...`,
            region: issue.region,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          }
        });
        generatedAlerts.push(alert);
      }
    }

    res.json({
      message: `${generatedAlerts.length} alertas gerados a partir de ocorrências críticas`,
      alerts: generatedAlerts
    });
  } catch (error) {
    console.error('Generate alerts error:', error);
    res.status(500).json({ error: 'Erro ao gerar alertas' });
  }
});

function getCategoryName(category: string): string {
  const names: { [key: string]: string } = {
    flood: 'Inundação',
    fire: 'Incêndio',
    pollution: 'Poluição',
    deforestation: 'Desmatamento',
    waste: 'Descarte Irregular',
    other: 'Ocorrência Ambiental'
  };
  return names[category] || category;
}

export default router;
