// Nó "Priorizar": monta o resumo (sapo do dia, atrasadas, Top 3) a partir das pendentes.
// Score = prioridade + urgência do prazo + 0,2/dia parada na lista (máx. 2): o que você empurra sobe.
const tz = 'America/Sao_Paulo';
const agora = new Date();
const hoje = agora.toLocaleDateString('en-CA', { timeZone: tz });
const hora = parseInt(agora.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }), 10);
// aceita ISO (2026-11-25) ou dd/mm/aaaa (formato que o Sheets pode devolver)
const iso = v => { const s = String(v || '').trim(), d = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return d ? `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}` : s.slice(0, 10); };
const dias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const P = { alta: 3, media: 2, baixa: 1 };

const pend = $input.all().map(i => i.json)
  .filter(r => r.tarefa && String(r.status || '').toLowerCase() === 'pendente')
  .map(r => {
    const prazo = iso(r.prazo), falta = prazo ? dias(prazo, hoje) : 3;
    const parada = r.criada_em ? Math.max(0, dias(hoje, iso(r.criada_em))) : 0;
    const urg = falta < 0 ? 5 + Math.min(-falta, 5) : falta === 0 ? 4 : falta === 1 ? 2 : falta <= 3 ? 1 : 0;
    return { ...r, prazo, falta, score: (P[String(r.prioridade).toLowerCase()] || 2) + urg + Math.min(parada * 0.2, 2) };
  })
  .sort((a, b) => b.score - a.score);

let chatId; try { chatId = $('Parse').first().json.chatId; } catch (e) {}
if (!chatId) try { chatId = $('Config').first().json.chat_id; } catch (e) {}

const linha = r => `• ${r.tarefa} [${r.id}]${r.quem ? ' · ' + r.quem : ''} — ${r.falta < 0 ? `atrasada ${-r.falta}d` : r.falta === 0 ? 'HOJE' : 'prazo ' + r.prazo}`;
let text;
if (!pend.length) text = '🏖️ Nenhuma pendência. Lista zerada!';
else {
  const atras = pend.filter(r => r.falta < 0), top = pend.slice(0, 3);
  text = (hora < 12 ? `☀️ Bom dia! ${pend.length} pendente(s).` : `⏰ Check da tarde: ${pend.length} ainda pendente(s).`) +
    `\n\n🐸 Comece por esta (só 5 minutos):\n${linha(top[0])}` +
    (atras.length ? `\n\n🔥 Atrasadas (${atras.length}):\n${atras.map(linha).join('\n')}` : '') +
    `\n\n📌 Top 3:\n${top.map(linha).join('\n')}\n\nTerminou? /feito id`;
}
return [{ json: { chatId, text, total: pend.length } }];
