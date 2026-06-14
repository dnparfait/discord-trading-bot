const express = require('express');
const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 3000;
const PASSWORD = process.env.DASHBOARD_PASSWORD || 'changeme';

const state = {
  botActive: true,
  signalsReceived: 0,
  tradesExecuted: 0,
  wins: 0,
  losses: 0,
  pnlDay: 0,
  balance: parseFloat(process.env.INITIAL_BALANCE) || 5000,
  logs: [],
  trades: [],
};

function broadcastLog(type, msg) {
  const entry = { type, msg, time: new Date().toLocaleTimeString('fr-FR') };
  state.logs.unshift(entry);
  if (state.logs.length > 200) state.logs.pop();
  broadcast({ event: 'log', data: entry });
  console.log(`[${type.toUpperCase()}] ${msg}`);
}

function broadcastTrade(trade) {
  state.trades.unshift(trade);
  if (state.trades.length > 50) state.trades.pop();
  state.tradesExecuted++;
  if (trade.pnl > 0) state.wins++;
  else state.losses++;
  state.pnlDay += trade.pnl || 0;
  broadcast({ event: 'trade', data: trade });
  broadcast({ event: 'stats', data: getStats() });
}

function incrementSignals() {
  state.signalsReceived++;
  broadcast({ event: 'stats', data: getStats() });
}

function updateBalance(balance) {
  state.balance = balance;
  broadcast({ event: 'stats', data: getStats() });
}

function getBotState() {
  return state.botActive;
}

function getStats() {
  const wr = state.tradesExecuted > 0 ? Math.round((state.wins / state.tradesExecuted) * 100) : 0;
  return {
    botActive: state.botActive,
    signalsReceived: state.signalsReceived,
    tradesExecuted: state.tradesExecuted,
    wins: state.wins,
    losses: state.losses,
    winrate: wr,
    pnlDay: parseFloat(state.pnlDay.toFixed(2)),
    balance: parseFloat(state.balance.toFixed(2)),
  };
}

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'init', data: { stats: getStats(), logs: state.logs.slice(0, 50), trades: state.trades.slice(0, 20) } }));
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.action === 'auth' && msg.password !== PASSWORD) {
        ws.send(JSON.stringify({ event: 'error', data: 'Mot de passe incorrect' }));
        ws.close();
        return;
      }
      if (msg.action === 'toggleBot') {
        state.botActive = !state.botActive;
        broadcastLog('info', `Bot ${state.botActive ? 'démarré' : 'arrêté'} depuis le dashboard`);
        broadcast({ event: 'stats', data: getStats() });
      }
    } catch {}
  });
});

app.use(express.static(path.join(__dirname, 'public')));

function startDashboard() {
  server.listen(PORT, () => {
    console.log(`Dashboard disponible → http://localhost:${PORT}`);
  });
}

module.exports = { broadcastLog, broadcastTrade, incrementSignals, updateBalance, getBotState, startDashboard };
