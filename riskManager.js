const PIP_VALUES = {
  EURUSD: 10, GBPUSD: 10, AUDUSD: 10, NZDUSD: 10, USDCAD: 10,
  USDCHF: 10, EURGBP: 10, EURJPY: 9.1, USDJPY: 9.1, GBPJPY: 9.1,
  XAUUSD: 1,  XAGUSD: 50, BTCUSD: 0.1,
};

export function getPipValue(symbol) {
  const base = symbol.toUpperCase().replace('/', '');
  return PIP_VALUES[base] || 10;
}

export function calculateLotSize({
  balance,
  riskPercent,
  stopLossPips,
  symbol = 'EURUSD',
  pipValue = null,
  minLot = 0.01,
  maxLot = 5.0,
}) {
  if (!stopLossPips || stopLossPips <= 0) {
    throw new Error('Stop Loss manquant ou invalide — trade rejeté');
  }
  if (!balance || balance <= 0) {
    throw new Error('Balance invalide');
  }

  const pv = pipValue || getPipValue(symbol);
  const riskAmount = balance * (riskPercent / 100);
  const rawLot = riskAmount / (stopLossPips * pv);
  const lot = Math.round(rawLot * 100) / 100;

  return {
    lot: Math.min(Math.max(lot, minLot), maxLot),
    riskAmount: parseFloat(riskAmount.toFixed(2)),
    pipValue: pv,
  };
}

export function checkDrawdown({ currentBalance, initialBalance, maxDrawdownPct }) {
  const drawdown = ((initialBalance - currentBalance) / initialBalance) * 100;
  if (drawdown >= maxDrawdownPct) {
    throw new Error(
      `Drawdown maximum atteint (${drawdown.toFixed(1)}% >= ${maxDrawdownPct}%) — bot suspendu`
    );
  }
  return parseFloat(drawdown.toFixed(2));
}

export function calcStopLossPips(entryPrice, stopLoss, symbol = 'EURUSD') {
  const sym = symbol.toUpperCase().replace('/', '');
  const isJpy = sym.includes('JPY');
  const isXau = sym.includes('XAU');
  const multiplier = isJpy ? 100 : isXau ? 10 : 10000;
  return Math.abs(Math.round((entryPrice - stopLoss) * multiplier));
}