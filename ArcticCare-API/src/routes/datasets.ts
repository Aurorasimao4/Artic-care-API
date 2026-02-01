import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';

const router = Router();

// Get all datasets
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, region, search } = req.query;

    const where: any = {};

    if (category) where.category = category;
    if (region) where.region = { contains: region as string };
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } }
      ];
    }

    const datasets = await prisma.dataset.findMany({
      where,
      orderBy: { lastUpdated: 'desc' }
    });

    // Parse JSON data for each dataset
    const parsedDatasets = datasets.map(dataset => ({
      ...dataset,
      data: JSON.parse(dataset.data)
    }));

    res.json({ datasets: parsedDatasets });
  } catch (error) {
    console.error('Get datasets error:', error);
    res.status(500).json({ error: 'Erro ao buscar datasets' });
  }
});

// Get single dataset by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const dataset = await prisma.dataset.findUnique({ where: { id } });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset não encontrado' });
    }

    res.json({
      dataset: {
        ...dataset,
        data: JSON.parse(dataset.data)
      }
    });
  } catch (error) {
    console.error('Get dataset error:', error);
    res.status(500).json({ error: 'Erro ao buscar dataset' });
  }
});

// Get datasets by category
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;

    const validCategories = ['temperature', 'air_quality', 'water', 'vegetation', 'weather'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    const datasets = await prisma.dataset.findMany({
      where: { category },
      orderBy: { lastUpdated: 'desc' }
    });

    const parsedDatasets = datasets.map(dataset => ({
      ...dataset,
      data: JSON.parse(dataset.data)
    }));

    res.json({ datasets: parsedDatasets });
  } catch (error) {
    console.error('Get datasets by category error:', error);
    res.status(500).json({ error: 'Erro ao buscar datasets por categoria' });
  }
});

// Create dataset (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, category, source, region, data, unit } = req.body;

    if (!name || !description || !category || !source || !data) {
      return res.status(400).json({
        error: 'Nome, descrição, categoria, fonte e dados são obrigatórios'
      });
    }

    const dataset = await prisma.dataset.create({
      data: {
        name,
        description,
        category,
        source,
        region,
        data: JSON.stringify(data),
        unit
      }
    });

    res.status(201).json({
      message: 'Dataset criado com sucesso!',
      dataset: {
        ...dataset,
        data: JSON.parse(dataset.data)
      }
    });
  } catch (error) {
    console.error('Create dataset error:', error);
    res.status(500).json({ error: 'Erro ao criar dataset' });
  }
});

// Update dataset (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, description, category, source, region, data, unit } = req.body;

    const existingDataset = await prisma.dataset.findUnique({ where: { id } });

    if (!existingDataset) {
      return res.status(404).json({ error: 'Dataset não encontrado' });
    }

    const dataset = await prisma.dataset.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(category && { category }),
        ...(source && { source }),
        ...(region && { region }),
        ...(data && { data: JSON.stringify(data) }),
        ...(unit && { unit }),
        lastUpdated: new Date()
      }
    });

    res.json({
      message: 'Dataset atualizado!',
      dataset: {
        ...dataset,
        data: JSON.parse(dataset.data)
      }
    });
  } catch (error) {
    console.error('Update dataset error:', error);
    res.status(500).json({ error: 'Erro ao atualizar dataset' });
  }
});

// Delete dataset (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const dataset = await prisma.dataset.findUnique({ where: { id } });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset não encontrado' });
    }

    await prisma.dataset.delete({ where: { id } });

    res.json({ message: 'Dataset excluído com sucesso!' });
  } catch (error) {
    console.error('Delete dataset error:', error);
    res.status(500).json({ error: 'Erro ao excluir dataset' });
  }
});

// Get climate readings
router.get('/readings/all', async (req: Request, res: Response) => {
  try {
    const { type, region, startDate, endDate, limit = '100' } = req.query;

    const where: any = {};

    if (type) where.type = type;
    if (region) where.region = { contains: region as string };
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = new Date(startDate as string);
      if (endDate) where.recordedAt.lte = new Date(endDate as string);
    }

    const readings = await prisma.climateReading.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: parseInt(limit as string)
    });

    res.json({ readings });
  } catch (error) {
    console.error('Get climate readings error:', error);
    res.status(500).json({ error: 'Erro ao buscar leituras climáticas' });
  }
});

// Add climate reading
router.post('/readings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { type, value, unit, latitude, longitude, region, source } = req.body;

    if (!type || value === undefined || !unit || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Tipo, valor, unidade e localização são obrigatórios'
      });
    }

    const reading = await prisma.climateReading.create({
      data: {
        type,
        value: parseFloat(value),
        unit,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        region,
        source: source || 'user_submitted'
      }
    });

    // Award points for data submission
    await prisma.contribution.create({
      data: {
        userId: req.user!.id,
        type: 'data_submitted',
        points: 10,
        description: `Enviou leitura de ${type}`
      }
    });

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { points: { increment: 10 } }
    });

    res.status(201).json({
      message: 'Leitura registrada com sucesso!',
      reading,
      pointsEarned: 10
    });
  } catch (error) {
    console.error('Add climate reading error:', error);
    res.status(500).json({ error: 'Erro ao registrar leitura' });
  }
});

// Get aggregated data by region
router.get('/aggregate/:region', async (req: Request, res: Response) => {
  try {
    const region = req.params.region as string;
    const { type, period = '7d' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const where: any = {
      region: { contains: region },
      recordedAt: { gte: startDate }
    };

    if (type) where.type = type;

    const readings = await prisma.climateReading.findMany({
      where,
      orderBy: { recordedAt: 'asc' }
    });

    // Group by type and calculate stats
    const grouped: { [key: string]: number[] } = {};
    readings.forEach(reading => {
      if (!grouped[reading.type]) {
        grouped[reading.type] = [];
      }
      grouped[reading.type].push(reading.value);
    });

    const stats: { [key: string]: any } = {};
    for (const [readingType, values] of Object.entries(grouped)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      stats[readingType] = {
        average: parseFloat(avg.toFixed(2)),
        min,
        max,
        count: values.length
      };
    }

    res.json({
      region,
      period,
      stats,
      readings
    });
  } catch (error) {
    console.error('Get aggregated data error:', error);
    res.status(500).json({ error: 'Erro ao buscar dados agregados' });
  }
});

export default router;
