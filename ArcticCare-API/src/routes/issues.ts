import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all issues with filters
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      category,
      severity,
      status,
      region,
      search,
      page = '1',
      limit = '20',
      sortBy = 'reportedAt',
      order = 'desc'
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};

    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (region) where.region = { contains: region as string };
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { description: { contains: search as string } },
        { address: { contains: search as string } }
      ];
    }

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy as string]: order },
        include: {
          user: {
            select: { id: true, name: true, avatar: true }
          },
          _count: {
            select: { comments: true, votes: true }
          }
        }
      }),
      prisma.issue.count({ where })
    ]);

    // Get vote counts for each issue
    const issuesWithVotes = await Promise.all(
      issues.map(async (issue) => {
        const [upvotes, confirms] = await Promise.all([
          prisma.vote.count({ where: { issueId: issue.id, type: 'upvote' } }),
          prisma.vote.count({ where: { issueId: issue.id, type: 'confirm' } })
        ]);

        let userVote = null;
        if (req.user) {
          const vote = await prisma.vote.findFirst({
            where: { issueId: issue.id, userId: req.user.id }
          });
          userVote = vote?.type || null;
        }

        return {
          ...issue,
          upvotes,
          confirms,
          userVote
        };
      })
    );

    res.json({
      issues: issuesWithVotes,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ error: 'Erro ao buscar ocorrências' });
  }
});

// Get single issue by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, points: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { votes: true }
        }
      }
    });

    if (!issue) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    // Get vote counts
    const [upvotes, confirms] = await Promise.all([
      prisma.vote.count({ where: { issueId: id, type: 'upvote' } }),
      prisma.vote.count({ where: { issueId: id, type: 'confirm' } })
    ]);

    let userVote = null;
    if (req.user) {
      const vote = await prisma.vote.findFirst({
        where: { issueId: id, userId: req.user.id }
      });
      userVote = vote?.type || null;
    }

    res.json({
      issue: {
        ...issue,
        upvotes,
        confirms,
        userVote
      }
    });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ error: 'Erro ao buscar ocorrência' });
  }
});

// Create new issue
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      category,
      severity,
      latitude,
      longitude,
      address,
      region,
      images
    } = req.body;

    if (!title || !description || !category || !severity || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Título, descrição, categoria, severidade e localização são obrigatórios'
      });
    }

    const validCategories = ['flood', 'fire', 'pollution', 'deforestation', 'waste', 'other'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    if (!validSeverities.includes(severity)) {
      return res.status(400).json({ error: 'Severidade inválida' });
    }

    const issue = await prisma.issue.create({
      data: {
        title,
        description,
        category,
        severity,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        region,
        images: images ? JSON.stringify(images) : null,
        userId: req.user!.id
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    // Award points for reporting
    const points = severity === 'critical' ? 50 : severity === 'high' ? 30 : 20;

    await prisma.contribution.create({
      data: {
        userId: req.user!.id,
        type: 'issue_reported',
        points,
        description: `Reportou: ${title}`
      }
    });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { points: { increment: points } }
    });

    res.status(201).json({
      message: 'Ocorrência criada com sucesso!',
      issue,
      pointsEarned: points
    });
  } catch (error) {
    console.error('Create issue error:', error);
    res.status(500).json({ error: 'Erro ao criar ocorrência' });
  }
});

// Update issue
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, description, category, severity, status, address, region, images } = req.body;

    const issue = await prisma.issue.findUnique({ where: { id } });

    if (!issue) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    // Only owner or admin can update
    if (issue.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para editar esta ocorrência' });
    }

    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(category && { category }),
        ...(severity && { severity }),
        ...(status && { status }),
        ...(address && { address }),
        ...(region && { region }),
        ...(images && { images: JSON.stringify(images) }),
        ...(status === 'resolved' && { resolvedAt: new Date() })
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    res.json({ message: 'Ocorrência atualizada!', issue: updatedIssue });
  } catch (error) {
    console.error('Update issue error:', error);
    res.status(500).json({ error: 'Erro ao atualizar ocorrência' });
  }
});

// Delete issue
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const issue = await prisma.issue.findUnique({ where: { id } });

    if (!issue) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    // Only owner or admin can delete
    if (issue.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para excluir esta ocorrência' });
    }

    await prisma.issue.delete({ where: { id } });

    res.json({ message: 'Ocorrência excluída com sucesso!' });
  } catch (error) {
    console.error('Delete issue error:', error);
    res.status(500).json({ error: 'Erro ao excluir ocorrência' });
  }
});

// Vote on issue
router.post('/:id/vote', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { type } = req.body;

    if (!['upvote', 'confirm'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de voto inválido' });
    }

    const issue = await prisma.issue.findUnique({ where: { id } });

    if (!issue) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    // Check if already voted with this type
    const existingVote = await prisma.vote.findFirst({
      where: { issueId: id, userId: req.user!.id, type }
    });

    if (existingVote) {
      // Remove vote if already exists (toggle)
      await prisma.vote.delete({ where: { id: existingVote.id } });
      return res.json({ message: 'Voto removido', voted: false });
    }

    // Create new vote
    await prisma.vote.create({
      data: {
        issueId: id,
        userId: req.user!.id,
        type
      }
    });

    // Award points for confirming
    if (type === 'confirm') {
      await prisma.contribution.create({
        data: {
          userId: req.user!.id,
          type: 'issue_confirmed',
          points: 5,
          description: `Confirmou ocorrência: ${issue.title}`
        }
      });

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { points: { increment: 5 } }
      });
    }

    res.json({ message: 'Voto registrado!', voted: true });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Erro ao registrar voto' });
  }
});

// Add comment to issue
router.post('/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo do comentário é obrigatório' });
    }

    const issue = await prisma.issue.findUnique({ where: { id } });

    if (!issue) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        issueId: id,
        userId: req.user!.id
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    // Award points for commenting
    await prisma.contribution.create({
      data: {
        userId: req.user!.id,
        type: 'comment',
        points: 5,
        description: `Comentou em: ${issue.title}`
      }
    });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { points: { increment: 5 } }
    });

    res.status(201).json({
      message: 'Comentário adicionado!',
      comment,
      pointsEarned: 5
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Erro ao adicionar comentário' });
  }
});

// Delete comment
router.delete('/:issueId/comments/:commentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const commentId = req.params.commentId as string;

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });

    if (!comment) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    // Only owner or admin can delete
    if (comment.userId !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para excluir este comentário' });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ message: 'Comentário excluído!' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Erro ao excluir comentário' });
  }
});

// Get nearby issues
router.get('/nearby/:lat/:lng', async (req: Request, res: Response) => {
  try {
    const lat = req.params.lat as string;
    const lng = req.params.lng as string;
    const { radius = '50' } = req.query; // radius in km

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius as string);

    // Simple bounding box calculation
    const latDelta = radiusKm / 111; // ~111km per degree latitude
    const lngDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    const issues = await prisma.issue.findMany({
      where: {
        latitude: {
          gte: latitude - latDelta,
          lte: latitude + latDelta
        },
        longitude: {
          gte: longitude - lngDelta,
          lte: longitude + lngDelta
        }
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        },
        _count: {
          select: { comments: true, votes: true }
        }
      },
      orderBy: { reportedAt: 'desc' }
    });

    res.json({ issues });
  } catch (error) {
    console.error('Get nearby issues error:', error);
    res.status(500).json({ error: 'Erro ao buscar ocorrências próximas' });
  }
});

export default router;
