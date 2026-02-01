/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Listar alertas ativos
 *     tags: [Alerts]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [critical, warning, info]
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeExpired
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Lista de alertas
 *   post:
 *     summary: Criar alerta (admin)
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, title, message]
 *             properties:
 *               type: { type: string, enum: [critical, warning, info], example: warning }
 *               title: { type: string, example: Alerta de Chuvas Intensas }
 *               message: { type: string, example: Previsão de chuvas fortes nas próximas 24h }
 *               region: { type: string, example: São Paulo, SP }
 *               expiresAt: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Alerta criado
 *
 * /api/alerts/{id}:
 *   get:
 *     summary: Obter alerta por ID
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do alerta
 *   put:
 *     summary: Atualizar alerta (admin)
 *     tags: [Alerts]
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
 *         description: Alerta atualizado
 *   delete:
 *     summary: Excluir alerta (admin)
 *     tags: [Alerts]
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
 *         description: Alerta excluído
 *
 * /api/alerts/{id}/deactivate:
 *   post:
 *     summary: Desativar alerta (admin)
 *     tags: [Alerts]
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
 *         description: Alerta desativado
 *
 * /api/alerts/region/{region}:
 *   get:
 *     summary: Alertas por região
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *         example: São Paulo
 *     responses:
 *       200:
 *         description: Lista de alertas da região
 *
 * /api/alerts/type/critical:
 *   get:
 *     summary: Listar alertas críticos
 *     tags: [Alerts]
 *     responses:
 *       200:
 *         description: Lista de alertas críticos ativos
 *
 * /api/alerts/generate-from-issues:
 *   post:
 *     summary: Gerar alertas de ocorrências críticas (admin)
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alertas gerados
 */
