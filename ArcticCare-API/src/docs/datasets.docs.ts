/**
 * @swagger
 * /api/datasets:
 *   get:
 *     summary: Listar todos os datasets
 *     tags: [Datasets]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [temperature, air_quality, water, vegetation, weather]
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de datasets
 *   post:
 *     summary: Criar dataset (admin)
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, category, source, data]
 *             properties:
 *               name: { type: string, example: Temperatura SP }
 *               description: { type: string, example: Leituras de temperatura }
 *               category: { type: string, enum: [temperature, air_quality, water, vegetation, weather] }
 *               source: { type: string, example: sensor_01 }
 *               region: { type: string, example: São Paulo }
 *               data: { type: object }
 *               unit: { type: string, example: celsius }
 *     responses:
 *       201:
 *         description: Dataset criado
 *       403:
 *         description: Requer permissão de admin
 *
 * /api/datasets/{id}:
 *   get:
 *     summary: Obter dataset por ID
 *     tags: [Datasets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do dataset
 *   put:
 *     summary: Atualizar dataset (admin)
 *     tags: [Datasets]
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
 *         description: Dataset atualizado
 *   delete:
 *     summary: Excluir dataset (admin)
 *     tags: [Datasets]
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
 *         description: Dataset excluído
 *
 * /api/datasets/category/{category}:
 *   get:
 *     summary: Listar datasets por categoria
 *     tags: [Datasets]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [temperature, air_quality, water, vegetation, weather]
 *     responses:
 *       200:
 *         description: Datasets da categoria
 *
 * /api/datasets/readings/all:
 *   get:
 *     summary: Listar leituras climáticas
 *     tags: [Datasets]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Lista de leituras
 *
 * /api/datasets/readings:
 *   post:
 *     summary: Adicionar leitura climática
 *     tags: [Datasets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, value, unit, latitude, longitude]
 *             properties:
 *               type: { type: string, example: temperature }
 *               value: { type: number, example: 28.5 }
 *               unit: { type: string, example: celsius }
 *               latitude: { type: number, example: -23.5505 }
 *               longitude: { type: number, example: -46.6333 }
 *               region: { type: string, example: São Paulo }
 *               source: { type: string, example: sensor_manual }
 *     responses:
 *       201:
 *         description: Leitura registrada (+10 pontos)
 *
 * /api/datasets/aggregate/{region}:
 *   get:
 *     summary: Dados agregados por região
 *     tags: [Datasets]
 *     parameters:
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, 1y]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Estatísticas agregadas
 */
