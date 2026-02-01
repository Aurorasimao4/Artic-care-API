/**
 * @swagger
 * /api/stats/dashboard:
 *   get:
 *     summary: Estatísticas do dashboard
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Estatísticas gerais
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: object
 *                   properties:
 *                     totalIssues: { type: integer }
 *                     openIssues: { type: integer }
 *                     resolvedIssues: { type: integer }
 *                     criticalIssues: { type: integer }
 *                     totalUsers: { type: integer }
 *                     activeAlerts: { type: integer }
 *                 issuesByCategory: { type: array }
 *                 issuesBySeverity: { type: array }
 *                 recentActivity: { type: object }
 *
 * /api/stats/leaderboard:
 *   get:
 *     summary: Ranking de usuários
 *     tags: [Stats]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista de usuários ordenados por pontos
 *
 * /api/stats/user/{userId}:
 *   get:
 *     summary: Estatísticas de um usuário
 *     tags: [Stats]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estatísticas do usuário
 *       404:
 *         description: Usuário não encontrado
 *
 * /api/stats/me:
 *   get:
 *     summary: Minhas estatísticas
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do usuário autenticado
 *
 * /api/stats/timeline:
 *   get:
 *     summary: Linha do tempo de ocorrências
 *     tags: [Stats]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados da linha do tempo
 *
 * /api/stats/regions:
 *   get:
 *     summary: Estatísticas por região
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Estatísticas regionais
 *
 * /api/stats/badges:
 *   get:
 *     summary: Listar badges disponíveis
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Lista de badges
 */
