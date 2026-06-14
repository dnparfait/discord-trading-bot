require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const MetaApi = require('metaapi.cloud-sdk');
const { parseSignal } = require('./signalParser');
const { calculateLotSize, checkDrawdown, calcStopLossPips } = require('./riskManager');
const { broadcastLog, broadcastTrade, incrementSignals, updateBalance, getBotState, startDashboard } = require('./dashboard');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const api = new MetaApi.default(process.env.META_API_TOKEN);

const RISK_PERCENT    = parseFloat(process.env.RISK_PERCENT)    || 1;
const MAX_DRAWDOWN    = parseFloat(process.env.MAX_DRAWDOWN_PCT) || 10;
const INITIAL_BALANCE = parseFloat(process.env.INITIAL_BALANCE) || 5000;
const CHANNEL_ID      = process.env.DISCORD_CHANNEL_ID;

async function getConnection() {
  const account = await api.metatraderAccountApi.getAccount(process.env.META_ACCOUNT_ID);
  if (!['DEPLOYED', 'DEPLOYING'].includes(account.state)) await account.deploy();
  await account.waitConnected();
  const conn = account.getStreamingConnection();
  await conn.connect();
  await conn.waitSynchronized();
  return conn;
}

async function executeTrade(signal) {
  const conn = await getConnection();
  const info = await conn.getAccountInformation();
  const balance = info.balance;
  updateBalance(balance);

  checkDrawdown({ currentBalance: balance, initialBalance: INITIAL_BALANCE, maxDrawdownPct: MAX_DRAWDOWN });

  const slPips = calcStopLossPips(
    signal.entryPrice || signal.stopLoss + (signal.action === 'BUY' ? 0.005 : -0.005),
    signal.stopLoss,
    signal.symbol
  );

  const { lot, riskAmount, pipValue } = calculateLotSize({
    balance,
    riskPercent: RISK_PERCENT,
    stopLossPips: slPips,
    symbol: signal.symbol,
  });

  broadcastLog('info', `Risk: $${riskAmount} (${RISK_PERCENT}%) | SL: ${slPips} pips | PipVal: $${pipValue} | Lot: ${lot}`);

  const opts = { comment: 'DiscordBot' };
  let result;
  if (signal.action === 'BUY') {
    result = await conn.createMarketBuyOrder(signal.symbol, lot, signal.stopLoss, signal.takeProfit, opts);
  } else {
    result = await conn.createMarketSellOrder(signal.symbol, lot, signal.stopLoss, signal.takeProfit, opts);
  }

  await conn.close();
  return { result, lot, riskAmount, slPips };
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== CHANNEL_ID) return;
  if (!getBotState()) {
    broadcastLog('warn', 'Signal reçu mais bot arrêté — ignoré');
    return;
  }

  broadcastLog('info', `Signal reçu: "${message.content.slice(0, 80)}"`);
  incrementSignals();

  let signal;
  try {
    signal = await parseSignal(message.content);
  } catch (err) {
    broadcastLog('error', `Erreur parsing Groq: ${err.message}`);
    await message.reply(`❌ Erreur parsing: ${err.message}`);
    return;
  }

  if (!signal?.valid) {
    broadcastLog('warn', `Message ignoré — pas un signal (${signal?.reason || 'inconnu'})`);
    return;
  }

  broadcastLog('info', `Signal parsé: ${signal.action} ${signal.symbol} | SL:${signal.stopLoss} TP:${signal.takeProfit}`);

  await message.reply(
    `🤖 **Signal détecté**\n` +
    `**${signal.action}** ${signal.symbol}\n` +
    `Entry: \`${signal.entryPrice || 'Marché'}\` | SL: \`${signal.stopLoss}\` | TP: \`${signal.takeProfit}\`\n` +
    `⏳ Calcul du lot et exécution...`
  );

  try {
    const { result, lot, riskAmount, slPips } = await executeTrade(signal);

    broadcastTrade({
      symbol: signal.symbol,
      action: signal.action,
      lot,
      entry: signal.entryPrice || 'Marché',
      sl: signal.stopLoss,
      tp: signal.takeProfit,
      orderId: result.orderId,
      riskAmount,
      slPips,
      time: new Date().toLocaleTimeString('fr-FR'),
      pnl: 0,
    });

    broadcastLog('success', `Trade exécuté: ${signal.action} ${signal.symbol} ${lot} lots — Order #${result.orderId}`);

    await message.reply(
      `✅ **Trade exécuté !**\n` +
      `${signal.action} ${signal.symbol} — **${lot} lots**\n` +
      `Risque: $${riskAmount} (${RISK_PERCENT}%) | SL: ${slPips} pips\n` +
      `Order ID: \`${result.orderId}\``
    );
  } catch (err) {
    broadcastLog('error', `Erreur exécution: ${err.message}`);
    await message.reply(`❌ **Erreur:** ${err.message}`);
  }
});

client.once('ready', () => {
  broadcastLog('success', `Bot Discord connecté: ${client.user.tag}`);
  broadcastLog('info', `Surveillance salon: ${CHANNEL_ID}`);
  console.log(`Bot prêt: ${client.user.tag}`);
});

startDashboard();
client.login(process.env.DISCORD_TOKEN);
