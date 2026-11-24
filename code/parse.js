// Nó "Parse": transforma a mensagem do Telegram em um comando estruturado.
// Formatos: "/add tarefa | quem pediu | 25/11 | alta"  (ordem livre depois da tarefa)
//           "/feito ab12"   "/lista"   (texto solto sem "/" = nova tarefa)
const tz = 'America/Sao_Paulo';
const msg = $input.first().json.message || {};
const chatId = msg.chat && msg.chat.id;
const raw = String(msg.text || '').trim();
const hoje = new Date().toLocaleDateString('en-CA', { timeZone: tz });
const soma = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

const m = raw.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
let cmd = m ? m[1].toLowerCase() : 'add';
let resto = m ? m[2].trim() : raw;
if (cmd === 'start' || cmd === 'ajuda' || cmd === 'help') cmd = 'ajuda';
if (cmd === 'adicionar' || cmd === 'nova') cmd = 'add';
if (cmd === 'concluir' || cmd === 'ok') cmd = 'feito';
if (!['add', 'feito', 'lista', 'ajuda'].includes(cmd)) cmd = 'ajuda';
if (cmd === 'add' && !resto) cmd = 'ajuda';

const out = { cmd, chatId };
if (cmd === 'feito') out.id = resto.toLowerCase();
if (cmd === 'add') {
  const [tarefa, ...extras] = resto.split('|').map(s => s.trim()).filter(Boolean);
  out.tarefa = tarefa; out.quem = ''; out.prioridade = 'media'; out.prazo = soma(hoje, 1);
  for (const e of extras) {
    const k = e.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    let d;
    if (/^(alta|media|baixa)$/.test(k)) out.prioridade = k;
    else if (k === 'urgente') out.prioridade = 'alta';
    else if (k === 'hoje') out.prazo = hoje;
    else if (k === 'amanha') out.prazo = soma(hoje, 1);
    else if ((d = k.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
      let y = d[3] ? +d[3] : +hoje.slice(0, 4); if (y < 100) y += 2000;
      out.prazo = `${y}-${String(d[2]).padStart(2, '0')}-${String(d[1]).padStart(2, '0')}`;
      if (!d[3] && out.prazo < hoje) out.prazo = out.prazo.replace(/^\d{4}/, y + 1); // "05/01" em dezembro = ano que vem
    } else out.quem = e;
  }
}
return [{ json: out }];
