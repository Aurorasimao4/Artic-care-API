# 🌍 ArcticCare API - Earth Guardian Backend

API robusta desenvolvida para a plataforma ArcticCare, focada no monitoramento ambiental, alertas em tempo real e análise de dados climáticos com Inteligência Artificial.

## 🚀 Novas Implementações (Conexão com Frontend)

### 1. 🔗 Conectividade & CORS
- **Suporte Multi-origem:** Configurado para aceitar requisições de `localhost:3000` (Next.js) e `localhost:5173` (Vite).
- **Credentials:** Habilitado para suporte a cookies e headers de autenticação.
- **Headers:** Liberado `Authorization` para uso de Bearer Tokens.

### 2. 🗺️ Integração com Mapa Real
- **Filtro de Geofencing:** O endpoint `GET /api/issues` agora aceita o parâmetro `mapBounds`.
- **Uso:** Permite filtrar ocorrências dinamicamente conforme o usuário move o mapa no frontend (LatLng bounds).

### 3. 🤖 Chat de IA Real (OpenAI)
- **Conversa Fluida:** Novo endpoint `POST /api/ai/chat` com suporte a histórico de mensagens.
- **IA Ambientalista:** Configurada com personalidade técnica e empática focada em preservação ambiental.
- **Fallback:** Modo de demonstração inteligente caso a `OPENAI_API_KEY` não esteja presente.

---

## 🛠️ Tecnologias
- **Runtime:** Node.js + Express
- **Linguagem:** TypeScript
- **Banco de Dados:** SQLite (Prisma ORM)
- **IA:** OpenAI API
- **Documentação:** Swagger UI

## 🏁 Como Rodar

1. **Instale as dependências:**
   ```bash
   cd ArcticCare-API
   npm install
   ```

2. **Configure o `.env`:**
   ```env
   PORT=3001
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="sua-chave-secreta"
   FRONTEND_URL="http://localhost:3000"
   OPENAI_API_KEY="sua-chave-da-openai"
   ```

3. **Inicie o servidor:**
   ```bash
   npm run dev
   ```

## 📚 Endpoints Principais
- **Swagger Docs:** `http://localhost:3001/api-docs`
- **Health Check:** `http://localhost:3001/health`
- **Auth:** `/api/auth/login`, `/api/auth/register`
- **Issues:** `/api/issues` (com suporte a `mapBounds`)
- **AI Chat:** `/api/ai/chat`

---
*ArcticCare - Protegendo o futuro, um dado de cada vez.*