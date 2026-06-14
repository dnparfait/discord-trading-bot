# Discord Trading Bot

Bot de trading automatique : Discord → Groq (IA) → MetaApi (MT5)

## Architecture

```
Salon Discord (#signaux)
        ↓
discord.js — écoute les messages
        ↓
Groq API (Llama 3.3) — parse le signal
        ↓
Risk Manager — calcule le lot size
        ↓
MetaApi — exécute le trade sur MT5
        ↓
Dashboard web (localhost:3000) — logs temps réel
```

## Installation

### 1. Prérequis
- Node.js v18 ou supérieur
- Un compte [Groq](https://console.groq.com) (gratuit)
- Un compte [MetaApi](https://metaapi.cloud) avec MT5 connecté
- Un bot Discord créé sur [discord.com/developers](https://discord.com/developers/applications)

### 2. Cloner et installer
```bash
npm install
```

### 3. Configurer l'environnement
```bash
cp .env.example .env
```
Remplis `.env` avec tes clés :

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Token de ton bot Discord |
| `DISCORD_CHANNEL_ID` | ID du salon #signaux (clic droit → Copier l'ID) |
| `GROQ_API_KEY` | Clé API Groq (console.groq.com) |
| `META_API_TOKEN` | Token MetaApi |
| `META_ACCOUNT_ID` | ID de ton compte MT5 sur MetaApi |
| `RISK_PERCENT` | Risque par trade en % (défaut: 1) |
| `MAX_DRAWDOWN_PCT` | Drawdown max avant arrêt auto (défaut: 10) |
| `INITIAL_BALANCE` | Balance de départ pour calcul drawdown |
| `DASHBOARD_PORT` | Port du dashboard (défaut: 3000) |
| `DASHBOARD_PASSWORD` | Mot de passe du dashboard |

### 4. Créer le bot Discord
1. Va sur https://discord.com/developers/applications
2. "New Application" → donne un nom
3. Onglet "Bot" → "Reset Token" → copie le token dans `.env`
4. Active **"Message Content Intent"** (obligatoire)
5. Onglet "OAuth2" → "URL Generator" → coche `bot` + permissions `Read Messages` + `Send Messages`
6. Ouvre l'URL générée pour inviter le bot sur ton serveur

### 5. Démarrer
```bash
npm start
```

Le dashboard est disponible sur http://localhost:3000

## Format des signaux supportés

Le bot accepte des signaux en texte libre. Exemples :

```
EURUSD BUY
Entry: 1.0852
SL: 1.0800
TP: 1.0920
```

```
🔥 GOLD SELL NOW
Entry 2312.50
Stop loss 2325
Take profit 2290 / 2270
```

```
GBPJPY BUY 197.50
SL 196.80 TP 198.50
```

## Risk Management

Le lot est calculé automatiquement :

```
Lot = (Balance × Risque%) ÷ (SL_pips × PipValue)
```

Exemple avec $5 000, 1% de risque, SL 30 pips sur EURUSD :
```
Lot = (5000 × 0.01) ÷ (30 × 10) = 0.17 lots
```

## Déployer sur un VPS

### Option A — PM2 (recommandé)
```bash
npm install -g pm2
pm2 start index.js --name trading-bot
pm2 save
pm2 startup
```

### Option B — Railway.app (gratuit)
1. Push le projet sur GitHub
2. Va sur https://railway.app → "New Project" → "Deploy from GitHub"
3. Ajoute les variables d'environnement dans l'interface Railway
4. Le bot démarre automatiquement

### Option C — Render.com (gratuit)
1. Push sur GitHub
2. Nouveau "Web Service" sur https://render.com
3. Build command : `npm install`
4. Start command : `npm start`
5. Ajoute les variables d'environnement

## Structure des fichiers

```
discord-trading-bot/
├── index.js          → Point d'entrée, bot Discord
├── signalParser.js   → Parsing Groq (Llama 3.3)
├── riskManager.js    → Calcul lot size + protection drawdown
├── dashboard.js      → Serveur Express + WebSocket
├── public/
│   └── index.html    → Dashboard web
├── .env.example      → Template de configuration
├── package.json
└── README.md
```