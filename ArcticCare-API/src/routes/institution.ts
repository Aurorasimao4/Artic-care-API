import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();

// ============================================
// MIDDLEWARE - Autenticação Institucional
// ============================================

interface InstitutionRequest extends Request {
  institution?: { id: string; email: string; name: string; type: string };
  member?: { id: string; email: string; name: string; role: string; institutionId: string };
}

const institutionAuth = async (req: InstitutionRequest, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    if (decoded.type === 'institution') {
      const institution = await prisma.institution.findUnique({
        where: { id: decoded.id }
      });
      if (!institution || !institution.isActive) {
        return res.status(401).json({ error: 'Instituição não encontrada ou inativa' });
      }
      req.institution = { id: institution.id, email: institution.email, name: institution.name, type: institution.type };
    } else if (decoded.type === 'member') {
      const member = await prisma.institutionMember.findUnique({
        where: { id: decoded.id },
        include: { institution: true }
      });
      if (!member || !member.isActive || !member.institution.isActive) {
        return res.status(401).json({ error: 'Membro não encontrado ou inativo' });
      }
      req.member = { id: member.id, email: member.email, name: member.name, role: member.role, institutionId: member.institutionId };
      req.institution = { id: member.institution.id, email: member.institution.email, name: member.institution.name, type: member.institution.type };
    } else {
      return res.status(401).json({ error: 'Token inválido' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// API Key Auth (alternativo)
const apiKeyAuth = async (req: InstitutionRequest, res: Response, next: Function) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return institutionAuth(req, res, next);
    }

    const institution = await prisma.institution.findUnique({
      where: { apiKey }
    });

    if (!institution || !institution.isActive) {
      return res.status(401).json({ error: 'API Key inválida' });
    }

    req.institution = { id: institution.id, email: institution.email, name: institution.name, type: institution.type };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Erro de autenticação' });
  }
};

// ============================================
// 🔐 AUTENTICAÇÃO INSTITUCIONAL
// ============================================

/**
 * @swagger
 * /api/institution/auth/login:
 *   post:
 *     summary: Login institucional
 *     tags: [Institution Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               memberEmail:
 *                 type: string
 *                 description: Email do membro (opcional, para login como membro)
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, memberEmail } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const institution = await prisma.institution.findUnique({
      where: { email }
    });

    if (!institution) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(password, institution.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!institution.isActive) {
      return res.status(403).json({ error: 'Instituição inativa' });
    }

    // Se memberEmail fornecido, fazer login como membro
    if (memberEmail) {
      const member = await prisma.institutionMember.findFirst({
        where: { email: memberEmail, institutionId: institution.id }
      });

      if (!member) {
        return res.status(401).json({ error: 'Membro não encontrado' });
      }

      const token = jwt.sign(
        { id: member.id, type: 'member', institutionId: institution.id },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      await prisma.institutionMember.update({
        where: { id: member.id },
        data: { lastLoginAt: new Date() }
      });

      return res.json({
        token,
        member: {
          id: member.id,
          email: member.email,
          name: member.name,
          role: member.role
        },
        institution: {
          id: institution.id,
          name: institution.name,
          type: institution.type
        }
      });
    }

    // Login como instituição
    const token = jwt.sign(
      { id: institution.id, type: 'institution' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      institution: {
        id: institution.id,
        name: institution.name,
        email: institution.email,
        type: institution.type,
        logo: institution.logo
      }
    });
  } catch (error) {
    console.error('Institution login error:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

/**
 * @swagger
 * /api/institution/auth/logout:
 *   post:
 *     summary: Logout institucional
 *     tags: [Institution Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 */
router.post('/auth/logout', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  // Como usamos JWT stateless, apenas confirmamos o logout
  res.json({ message: 'Logout realizado com sucesso' });
});

/**
 * @swagger
 * /api/institution/auth/me:
 *   get:
 *     summary: Dados do usuário logado
 *     tags: [Institution Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 */
router.get('/auth/me', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    if (req.member) {
      const member = await prisma.institutionMember.findUnique({
        where: { id: req.member.id },
        include: { institution: { select: { id: true, name: true, type: true, logo: true } } }
      });
      return res.json({ type: 'member', ...member });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: req.institution!.id },
      select: {
        id: true, name: true, email: true, type: true, cnpj: true,
        phone: true, address: true, city: true, state: true, logo: true, createdAt: true
      }
    });
    res.json({ type: 'institution', ...institution });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

/**
 * @swagger
 * /api/institution/auth/api-key/regenerate:
 *   post:
 *     summary: Regenerar chave de API
 *     tags: [Institution Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nova API key gerada
 */
router.post('/auth/api-key/regenerate', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const newApiKey = `arc_${crypto.randomBytes(32).toString('hex')}`;

    await prisma.institution.update({
      where: { id: req.institution!.id },
      data: { apiKey: newApiKey }
    });

    res.json({ apiKey: newApiKey, message: 'API Key regenerada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao regenerar API key' });
  }
});

// ============================================
// 📋 GESTÃO DE RELATOS
// ============================================

/**
 * @swagger
 * /api/institution/reports:
 *   get:
 *     summary: Listar todos os relatos (com filtros)
 *     tags: [Institution Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, investigating, in_progress, resolved, closed]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de relatos
 */
router.get('/reports', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const { status, category, severity, region, startDate, endDate } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (region) where.region = { contains: region as string };
    if (startDate || endDate) {
      where.reportedAt = {};
      if (startDate) where.reportedAt.gte = new Date(startDate as string);
      if (endDate) where.reportedAt.lte = new Date(endDate as string);
    }

    const [reports, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { comments: true, votes: true } }
        },
        orderBy: [
          { severity: 'desc' },
          { reportedAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.issue.count({ where })
    ]);

    res.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Erro ao buscar relatos' });
  }
});

/**
 * @swagger
 * /api/institution/reports/critical:
 *   get:
 *     summary: Listar apenas relatos críticos pendentes
 *     tags: [Institution Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de relatos críticos
 */
router.get('/reports/critical', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const criticalReports = await prisma.issue.findMany({
      where: {
        severity: 'critical',
        status: { in: ['open', 'investigating', 'in_progress'] }
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { comments: true, votes: true } }
      },
      orderBy: { reportedAt: 'desc' }
    });

    res.json({
      total: criticalReports.length,
      reports: criticalReports
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar relatos críticos' });
  }
});

/**
 * @swagger
 * /api/institution/reports/{id}:
 *   get:
 *     summary: Obter detalhes de um relato
 *     tags: [Institution Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do relato
 */
router.get('/reports/:id', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const report = await prisma.issue.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        },
        votes: true
      }
    });

    if (!report) {
      return res.status(404).json({ error: 'Relato não encontrado' });
    }

    const voteStats = {
      upvotes: report.votes.filter((v: { type: string }) => v.type === 'upvote').length,
      downvotes: report.votes.filter((v: { type: string }) => v.type === 'downvote').length,
      confirms: report.votes.filter((v: { type: string }) => v.type === 'confirm').length
    };

    res.json({ ...report, voteStats });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar relato' });
  }
});

/**
 * @swagger
 * /api/institution/reports/{id}:
 *   patch:
 *     summary: Atualizar status do relato
 *     tags: [Institution Reports]
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
 *               status:
 *                 type: string
 *                 enum: [open, investigating, in_progress, resolved, closed]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Relato atualizado
 */
router.patch('/reports/:id', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, notes } = req.body;

    const report = await prisma.issue.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ error: 'Relato não encontrado' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (status === 'resolved') updateData.resolvedAt = new Date();

    const updated = await prisma.issue.update({
      where: { id },
      data: updateData,
      include: { user: { select: { id: true, name: true } } }
    });

    // Se tiver notas, criar comentário institucional
    if (notes) {
      // Nota: Em produção, criar um user "system" para comentários institucionais
    }

    res.json({ message: 'Relato atualizado', report: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar relato' });
  }
});

/**
 * @swagger
 * /api/institution/reports/{id}/resolve:
 *   post:
 *     summary: Marcar relato como resolvido
 *     tags: [Institution Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Descrição da resolução
 *     responses:
 *       200:
 *         description: Relato resolvido
 */
router.post('/reports/:id/resolve', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { resolution } = req.body;

    const report = await prisma.issue.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ error: 'Relato não encontrado' });
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date()
      }
    });

    // Dar pontos ao usuário que reportou
    await prisma.user.update({
      where: { id: report.userId },
      data: { points: { increment: 50 } }
    });

    // Criar contribuição
    await prisma.contribution.create({
      data: {
        userId: report.userId,
        type: 'issue_resolved',
        points: 50,
        description: `Problema "${report.title}" foi resolvido`
      }
    });

    res.json({
      message: 'Relato marcado como resolvido',
      report: updated,
      userRewarded: true,
      pointsAwarded: 50
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao resolver relato' });
  }
});

// ============================================
// 📊 MÉTRICAS
// ============================================

/**
 * @swagger
 * /api/institution/metrics:
 *   get:
 *     summary: Obter métricas gerais
 *     tags: [Institution Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas gerais
 */
router.get('/metrics', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const [total, pending, investigating, inProgress, resolved, closed, critical] = await Promise.all([
      prisma.issue.count(),
      prisma.issue.count({ where: { status: 'open' } }),
      prisma.issue.count({ where: { status: 'investigating' } }),
      prisma.issue.count({ where: { status: 'in_progress' } }),
      prisma.issue.count({ where: { status: 'resolved' } }),
      prisma.issue.count({ where: { status: 'closed' } }),
      prisma.issue.count({ where: { severity: 'critical', status: { in: ['open', 'investigating', 'in_progress'] } } })
    ]);

    // Métricas das últimas 24h
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [newToday, resolvedToday] = await Promise.all([
      prisma.issue.count({ where: { reportedAt: { gte: last24h } } }),
      prisma.issue.count({ where: { resolvedAt: { gte: last24h } } })
    ]);

    res.json({
      total,
      byStatus: {
        pending,
        investigating,
        inProgress,
        resolved,
        closed
      },
      critical,
      today: {
        newReports: newToday,
        resolved: resolvedToday
      },
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

/**
 * @swagger
 * /api/institution/metrics/by-category:
 *   get:
 *     summary: Distribuição por categoria
 *     tags: [Institution Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas por categoria
 */
router.get('/metrics/by-category', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const categories = await prisma.issue.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    const total = categories.reduce((sum: number, cat: { _count: { id: number } }) => sum + cat._count.id, 0);
    const distribution = categories.map((cat: { category: string; _count: { id: number } }) => ({
      category: cat.category,
      count: cat._count.id,
      percentage: Math.round((cat._count.id / total) * 100)
    }));

    res.json({ total, distribution });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar métricas por categoria' });
  }
});

/**
 * @swagger
 * /api/institution/metrics/by-risk:
 *   get:
 *     summary: Distribuição por nível de risco
 *     tags: [Institution Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas por nível de risco
 */
router.get('/metrics/by-risk', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const severities = await prisma.issue.groupBy({
      by: ['severity'],
      _count: { id: true },
      where: { status: { in: ['open', 'investigating', 'in_progress'] } }
    });

    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const sorted = severities.sort((a: { severity: string }, b: { severity: string }) => 
      (severityOrder[b.severity as keyof typeof severityOrder] || 0) - 
      (severityOrder[a.severity as keyof typeof severityOrder] || 0)
    );

    res.json({
      distribution: sorted.map((s: { severity: string; _count: { id: number } }) => ({
        severity: s.severity,
        count: s._count.id
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar métricas por risco' });
  }
});

/**
 * @swagger
 * /api/institution/metrics/trend:
 *   get:
 *     summary: Tendência dos últimos 7/30 dias
 *     tags: [Institution Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *           enum: [7, 30]
 *     responses:
 *       200:
 *         description: Tendência de relatos
 */
router.get('/metrics/trend', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const issues = await prisma.issue.findMany({
      where: { reportedAt: { gte: startDate } },
      select: { reportedAt: true, status: true }
    });

    const resolved = await prisma.issue.findMany({
      where: { resolvedAt: { gte: startDate } },
      select: { resolvedAt: true }
    });

    // Agrupar por dia
    const trendData: { [key: string]: { reported: number; resolved: number } } = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendData[dateStr] = { reported: 0, resolved: 0 };
    }

    issues.forEach((issue: { reportedAt: Date }) => {
      const dateStr = issue.reportedAt.toISOString().split('T')[0];
      if (trendData[dateStr]) trendData[dateStr].reported++;
    });

    resolved.forEach((issue: { resolvedAt: Date | null }) => {
      if (issue.resolvedAt) {
        const dateStr = issue.resolvedAt.toISOString().split('T')[0];
        if (trendData[dateStr]) trendData[dateStr].resolved++;
      }
    });

    const trend = Object.entries(trendData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    res.json({ days, trend });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar tendências' });
  }
});

/**
 * @swagger
 * /api/institution/metrics/resolution-time:
 *   get:
 *     summary: Tempo médio de resolução
 *     tags: [Institution Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tempo médio de resolução
 */
router.get('/metrics/resolution-time', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const resolved = await prisma.issue.findMany({
      where: { 
        status: 'resolved',
        resolvedAt: { not: null }
      },
      select: { reportedAt: true, resolvedAt: true, category: true, severity: true }
    });

    if (resolved.length === 0) {
      return res.json({ 
        averageHours: 0, 
        averageDays: 0,
        byCategory: {},
        bySeverity: {} 
      });
    }

    let totalHours = 0;
    const byCategory: { [key: string]: number[] } = {};
    const bySeverity: { [key: string]: number[] } = {};

    resolved.forEach((issue: { reportedAt: Date; resolvedAt: Date | null; category: string; severity: string }) => {
      const hours = (issue.resolvedAt!.getTime() - issue.reportedAt.getTime()) / (1000 * 60 * 60);
      totalHours += hours;

      if (!byCategory[issue.category]) byCategory[issue.category] = [];
      byCategory[issue.category].push(hours);

      if (!bySeverity[issue.severity]) bySeverity[issue.severity] = [];
      bySeverity[issue.severity].push(hours);
    });

    const averageHours = totalHours / resolved.length;
    const averageByCategory = Object.fromEntries(
      Object.entries(byCategory).map(([cat, hours]) => [
        cat, 
        Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)
      ])
    );
    const averageBySeverity = Object.fromEntries(
      Object.entries(bySeverity).map(([sev, hours]) => [
        sev,
        Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)
      ])
    );

    res.json({
      totalResolved: resolved.length,
      averageHours: Math.round(averageHours),
      averageDays: Math.round(averageHours / 24 * 10) / 10,
      byCategory: averageByCategory,
      bySeverity: averageBySeverity
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao calcular tempo de resolução' });
  }
});

// ============================================
// 🗺️ ZONAS DE RISCO
// ============================================

/**
 * @swagger
 * /api/institution/risk-zones:
 *   get:
 *     summary: Listar todas as zonas de risco
 *     tags: [Institution Risk Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de zonas de risco
 */
router.get('/risk-zones', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const { riskLevel, type } = req.query;
    const where: any = { institutionId: req.institution!.id, isActive: true };
    
    if (riskLevel) where.riskLevel = riskLevel;
    if (type) where.type = type;

    const zones = await prisma.riskZone.findMany({
      where,
      orderBy: [
        { riskLevel: 'desc' },
        { incidentCount: 'desc' }
      ]
    });

    res.json({ total: zones.length, zones });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar zonas de risco' });
  }
});

/**
 * @swagger
 * /api/institution/risk-zones/top:
 *   get:
 *     summary: Top zonas mais críticas
 *     tags: [Institution Risk Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Top zonas críticas
 */
router.get('/risk-zones/top', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    const zones = await prisma.riskZone.findMany({
      where: { 
        institutionId: req.institution!.id,
        isActive: true,
        riskLevel: { in: ['high', 'critical'] }
      },
      orderBy: [
        { riskLevel: 'desc' },
        { incidentCount: 'desc' }
      ],
      take: limit
    });

    res.json({ zones });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar top zonas' });
  }
});

/**
 * @swagger
 * /api/institution/risk-zones/{id}:
 *   get:
 *     summary: Detalhes de uma zona
 *     tags: [Institution Risk Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes da zona
 */
router.get('/risk-zones/:id', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const zone = await prisma.riskZone.findFirst({
      where: { id, institutionId: req.institution!.id }
    });

    if (!zone) {
      return res.status(404).json({ error: 'Zona não encontrada' });
    }

    res.json(zone);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar zona' });
  }
});

/**
 * @swagger
 * /api/institution/risk-zones/{id}/reports:
 *   get:
 *     summary: Relatos de uma zona específica
 *     tags: [Institution Risk Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatos da zona
 */
router.get('/risk-zones/:id/reports', apiKeyAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const zone = await prisma.riskZone.findFirst({
      where: { id, institutionId: req.institution!.id }
    });

    if (!zone) {
      return res.status(404).json({ error: 'Zona não encontrada' });
    }

    // Buscar issues próximas ao centro da zona (simplificado)
    // Em produção, usar queries geográficas mais sofisticadas
    const radius = zone.radius || 5000; // 5km padrão
    const latDelta = radius / 111000; // ~111km por grau
    const lngDelta = radius / (111000 * Math.cos(zone.centerLat * Math.PI / 180));

    const reports = await prisma.issue.findMany({
      where: {
        latitude: { gte: zone.centerLat - latDelta, lte: zone.centerLat + latDelta },
        longitude: { gte: zone.centerLng - lngDelta, lte: zone.centerLng + lngDelta }
      },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { comments: true, votes: true } }
      },
      orderBy: { reportedAt: 'desc' }
    });

    res.json({ zone: { id: zone.id, name: zone.name }, total: reports.length, reports });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar relatos da zona' });
  }
});

// ============================================
// 🏛️ PERFIL DA INSTITUIÇÃO
// ============================================

/**
 * @swagger
 * /api/institution/profile:
 *   get:
 *     summary: Perfil da instituição
 *     tags: [Institution Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil da instituição
 */
router.get('/profile', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: req.institution!.id },
      select: {
        id: true, name: true, email: true, type: true, cnpj: true,
        phone: true, address: true, city: true, state: true, country: true,
        logo: true, isActive: true, createdAt: true, updatedAt: true,
        _count: { select: { members: true, riskZones: true } }
      }
    });

    res.json(institution);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

/**
 * @swagger
 * /api/institution/profile:
 *   put:
 *     summary: Atualizar perfil
 *     tags: [Institution Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               logo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil atualizado
 */
router.put('/profile', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const { name, phone, address, city, state, logo } = req.body;

    const updated = await prisma.institution.update({
      where: { id: req.institution!.id },
      data: { 
        ...(name && { name }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(logo && { logo })
      },
      select: {
        id: true, name: true, email: true, phone: true, 
        address: true, city: true, state: true, logo: true, updatedAt: true
      }
    });

    res.json({ message: 'Perfil atualizado', institution: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

/**
 * @swagger
 * /api/institution/members:
 *   get:
 *     summary: Listar membros da equipe
 *     tags: [Institution Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de membros
 */
router.get('/members', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const members = await prisma.institutionMember.findMany({
      where: { institutionId: req.institution!.id },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ total: members.length, members });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar membros' });
  }
});

/**
 * @swagger
 * /api/institution/permissions:
 *   get:
 *     summary: Permissões da instituição
 *     tags: [Institution Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissões
 */
router.get('/permissions', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: req.institution!.id }
    });

    // Permissões baseadas no tipo da instituição
    const basePermissions = {
      viewReports: true,
      updateReportStatus: true,
      viewMetrics: true,
      viewRiskZones: true,
      manageRiskZones: false,
      manageMembers: false,
      accessApiKey: false,
      exportData: true
    };

    // Permissões adicionais por tipo
    if (institution?.type === 'municipal' || institution?.type === 'estadual' || institution?.type === 'federal') {
      basePermissions.manageRiskZones = true;
      basePermissions.manageMembers = true;
      basePermissions.accessApiKey = true;
    }

    // Permissões do membro logado
    let memberPermissions = null;
    if (req.member) {
      const rolePermissions: { [key: string]: any } = {
        admin: { ...basePermissions, manageMembers: true, accessApiKey: true },
        manager: { ...basePermissions, manageMembers: true },
        analyst: { ...basePermissions },
        viewer: { viewReports: true, viewMetrics: true, viewRiskZones: true, exportData: false }
      };
      memberPermissions = rolePermissions[req.member.role] || rolePermissions.viewer;
    }

    res.json({
      institutionType: institution?.type,
      institutionPermissions: basePermissions,
      memberPermissions,
      memberRole: req.member?.role
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar permissões' });
  }
});

// ============================================
// 🔔 NOTIFICAÇÕES
// ============================================

/**
 * @swagger
 * /api/institution/notifications/settings:
 *   get:
 *     summary: Configurações de notificação
 *     tags: [Institution Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações
 */
router.get('/notifications/settings', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    let settings = await prisma.notificationSettings.findUnique({
      where: { institutionId: req.institution!.id }
    });

    // Criar configurações padrão se não existir
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { institutionId: req.institution!.id }
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

/**
 * @swagger
 * /api/institution/notifications/settings:
 *   put:
 *     summary: Atualizar configurações de notificação
 *     tags: [Institution Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailEnabled:
 *                 type: boolean
 *               smsEnabled:
 *                 type: boolean
 *               pushEnabled:
 *                 type: boolean
 *               criticalAlerts:
 *                 type: boolean
 *               dailyDigest:
 *                 type: boolean
 *               weeklyReport:
 *                 type: boolean
 *               newReportNotification:
 *                 type: boolean
 *               resolvedNotification:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configurações atualizadas
 */
router.put('/notifications/settings', institutionAuth, async (req: InstitutionRequest, res: Response) => {
  try {
    const {
      emailEnabled, smsEnabled, pushEnabled, criticalAlerts,
      dailyDigest, weeklyReport, newReportNotification, resolvedNotification
    } = req.body;

    const settings = await prisma.notificationSettings.upsert({
      where: { institutionId: req.institution!.id },
      create: {
        institutionId: req.institution!.id,
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(smsEnabled !== undefined && { smsEnabled }),
        ...(pushEnabled !== undefined && { pushEnabled }),
        ...(criticalAlerts !== undefined && { criticalAlerts }),
        ...(dailyDigest !== undefined && { dailyDigest }),
        ...(weeklyReport !== undefined && { weeklyReport }),
        ...(newReportNotification !== undefined && { newReportNotification }),
        ...(resolvedNotification !== undefined && { resolvedNotification })
      },
      update: {
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(smsEnabled !== undefined && { smsEnabled }),
        ...(pushEnabled !== undefined && { pushEnabled }),
        ...(criticalAlerts !== undefined && { criticalAlerts }),
        ...(dailyDigest !== undefined && { dailyDigest }),
        ...(weeklyReport !== undefined && { weeklyReport }),
        ...(newReportNotification !== undefined && { newReportNotification }),
        ...(resolvedNotification !== undefined && { resolvedNotification })
      }
    });

    res.json({ message: 'Configurações atualizadas', settings });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

// ============================================
// REGISTRO DE INSTITUIÇÃO (Admin)
// ============================================

/**
 * @swagger
 * /api/institution/register:
 *   post:
 *     summary: Registrar nova instituição
 *     tags: [Institution Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, type]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [municipal, estadual, federal, ong, privada]
 *               cnpj:
 *                 type: string
 *               phone:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *     responses:
 *       201:
 *         description: Instituição criada
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, type, cnpj, phone, city, state } = req.body;

    if (!name || !email || !password || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, email, password, type' });
    }

    const existing = await prisma.institution.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const apiKey = `arc_${crypto.randomBytes(32).toString('hex')}`;

    const institution = await prisma.institution.create({
      data: {
        name,
        email,
        password: hashedPassword,
        type,
        cnpj,
        phone,
        city,
        state,
        apiKey
      },
      select: {
        id: true, name: true, email: true, type: true, apiKey: true, createdAt: true
      }
    });

    res.status(201).json({
      message: 'Instituição criada com sucesso',
      institution,
      note: 'Guarde a API Key em local seguro!'
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'CNPJ ou email já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar instituição' });
  }
});

export default router;
