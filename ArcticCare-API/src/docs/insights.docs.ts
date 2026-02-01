/**
 * @swagger
 * /api/insights:
 *   get:
 *     summary: Listar insights
 *     tags: [Insights]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [prediction, anomaly, trend, alert]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [info, warning, danger]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de insights
 *   post:
 *     summary: Criar insight (admin)
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, category]
 *             properties:
 *               title: { type: string, example: Tendência de aumento de temperatura }
 *               description: { type: string, example: Análise indica aumento de 2°C }
 *               category: { type: string, enum: [prediction, anomaly, trend, alert] }
 *               severity: { type: string, enum: [info, warning, danger] }
 *               confidence: { type: number, example: 85.5 }
 *               data: { type: object }
 *     responses:
 *       201:
 *         description: Insight criado
 *
 * /api/insights/{id}:
 *   get:
 *     summary: Obter insight por ID
 *     tags: [Insights]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do insight
 *   put:
 *     summary: Atualizar insight (admin)
 *     tags: [Insights]
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
 *         description: Insight atualizado
 *   delete:
 *     summary: Excluir insight (admin)
 *     tags: [Insights]
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
 *         description: Insight excluído
 *
 * /api/insights/category/{category}:
 *   get:
 *     summary: Insights por categoria
 *     tags: [Insights]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [prediction, anomaly, trend, alert]
 *     responses:
 *       200:
 *         description: Lista de insights
 *
 * /api/insights/generate:
 *   post:
 *     summary: Gerar insights automaticamente (admin)
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Insights gerados com base nos dados atuais
 */
