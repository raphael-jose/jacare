# 🎮 Love Games Hub 💕

Jogos multiplayer fofos para casais jogarem juntos, cada um de sua casa!

## 🎯 Jogos Disponíveis

| Jogo | Descrição |
|------|-----------|
| ❌⭕ **Jogo da Velha** | Clássico da velha com temática romântica |
| 🎯 **Jogo da Forca** | Um escolhe a palavra, o outro adivinha |
| 🧠 **Jogo da Memória** | Pares de emojis românticos |
| ✍️ **Jogo de Palavras** | Corrida para escrever a palavra certa |

## 🚀 Como Jogar

1. Acesse o site (link do GitHub Pages)
2. Escolha seu nome e avatar fofo 🐱
3. Crie uma sala e copie o código
4. Manda o código pra sua parceira/o 💕
5. Entra no link → digita o código → escolham um jogo e joguem!

## ⚙️ Funcionalidades

- 💬 Chat em tempo real durante os jogos
- 🏆 Placar compartilhado entre todos os jogos
- 🎨 Avatares personalizados
- 🔊 Efeitos sonoros fofos
- 📱 PWA - funciona como app no celular
- 💕 Tema romântico com corações flutuantes

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express + Socket.io
- **PWA**: vite-plugin-pwa

## 📦 Deploy

### Frontend (GitHub Pages)

O deploy automático está configurado via GitHub Actions.
A cada push na branch `main`, o frontend é buildado e publicado.

Para configurar a URL do servidor multiplayer:
1. Vá em **Settings → Secrets and variables → Actions → Variables**
2. Adicione `VITE_SERVER_URL` com a URL do backend (ex: `https://seu-backend.onrender.com`)

### Backend (Servidor Multiplayer)

O servidor precisa rodar em um serviço que suporte WebSockets.
Opções gratuitas:

**Render.com:**
1. Crie conta em [render.com](https://render.com)
2. New → Web Service
3. Conecte o repositório GitHub
4. Build Command: `npm install`
5. Start Command: `npx tsx server/index.ts`
6. Adicione a variável de ambiente `PORT=3001`

**Railway.app:**
1. Crie conta em [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Adicione `PORT=3001` como variável de ambiente

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar backend
PORT=3001 npx tsx server/index.ts

# Rodar frontend (em outro terminal)
npm run dev
```

Acesse http://localhost:5173 🎮

---

Feito com 💕
