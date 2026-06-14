const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Tu es un parser de signaux de trading Forex/Gold.
Extrait les informations du message et réponds UNIQUEMENT en JSON valide, sans markdown ni backticks.

Format attendu :
{
  "valid": true,
  "symbol": "EURUSD",
  "action": "BUY",
  "entryPrice": 1.0852,
  "stopLoss": 1.0800,
  "takeProfit": 1.0920,
  "takeProfit2": null,
  "takeProfit3": null,
  "comment": "Signal original résumé"
}

Règles :
- symbol : normalise en MAJUSCULES sans slash (EURUSD, XAUUSD, GBPJPY...)
- action : "BUY" ou "SELL" uniquement
- stopLoss est OBLIGATOIRE — si absent, mettre "valid": false
- takeProfit peut être une liste (TP1, TP2, TP3) — utilise takeProfit pour TP1
- Si le message n'est pas un signal de trading, réponds : {"valid": false, "reason": "pas un signal"}
- entryPrice peut être null si c'est un ordre au marché`;

async function parseSignal(text) {
  const chat = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    temperature: 0,
    max_tokens: 300,
  });
  const raw = chat.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { parseSignal };
