/**
 * @swagger
 * /api/issues:
 *   get:
 *     summary: Listar todas as ocorrências
 *     tags: [Issues]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [flood, fire, pollution, deforestation, waste, other]
 *         description: Filtrar por categoria
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filtrar por severidade
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, investigating, in_progress, resolved, closed]
 *         description: Filtrar por status
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filtrar por região
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por texto
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
 *         description: Lista de ocorrências
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 issues:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Issue'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *   post:
 *     summary: Criar nova ocorrência (report)
 *     tags: [Issues]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, category, severity, latitude, longitude]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Queimada na área rural
 *               description:
 *                 type: string
 *                 example: Foco de incêndio detectado próximo à reserva
 *               category:
 *                 type: string
 *                 enum: [flood, fire, pollution, deforestation, waste, other]
 *                 example: fire
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 example: high
 *               latitude:
 *                 type: number
 *                 example: -23.5505
 *               longitude:
 *                 type: number
 *                 example: -46.6333
 *               address:
 *                 type: string
 *                 example: Zona Rural, Km 45
 *               region:
 *                 type: string
 *                 example: São Paulo, SP
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Ocorrência criada
 *       401:
 *         description: Não autenticado
 *
 * /api/issues/{id}:
 *   get:
 *     summary: Obter ocorrência por ID
 *     tags: [Issues]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes da ocorrência
 *       404:
 *         description: Não encontrada
 *   put:
 *     summary: Atualizar ocorrência
 *     tags: [Issues]
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
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               severity: { type: string }
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Ocorrência atualizada
 *       403:
 *         description: Sem permissão
 *   delete:
 *     summary: Excluir ocorrência
 *     tags: [Issues]
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
 *         description: Ocorrência excluída
 *       403:
 *         description: Sem permissão
 *
 * /api/issues/{id}/vote:
 *   post:
 *     summary: Votar/confirmar ocorrência
 *     tags: [Issues]
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
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [upvote, confirm]
 *                 example: confirm
 *     responses:
 *       200:
 *         description: Voto registrado ou removido
 *
 * /api/issues/{id}/comments:
 *   post:
 *     summary: Adicionar comentário
 *     tags: [Issues]
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 example: Confirmado! Vi essa ocorrência pessoalmente.
 *     responses:
 *       201:
 *         description: Comentário adicionado
 *
 * /api/issues/nearby/{lat}/{lng}:
 *   get:
 *     summary: Buscar ocorrências próximas
 *     tags: [Issues]
 *     parameters:
 *       - in: path
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         example: -23.5505
 *       - in: path
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         example: -46.6333
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 50
 *         description: Raio em km
 *     responses:
 *       200:
 *         description: Lista de ocorrências próximas
 */
