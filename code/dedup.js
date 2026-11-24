// Nó "Checar duplicata": compara a tarefa nova com as PENDENTES da planilha.
// Duplicada = mesmo texto normalizado, ou >= 70% das palavras relevantes em comum (Jaccard).
const p = $('Parse').first().json;
const STOP = new Set(['para', 'com', 'uma', 'uns', 'umas', 'por', 'dos', 'das', 'que', 'ver', 'fazer', 'the']);
const palavras = s => new Set(String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
const sim = (a, b) => {
  if (!a.size || !b.size) return 0;
  const inter = [...a].filter(w => b.has(w)).length;
  return inter / (a.size + b.size - inter);
};
const nova = palavras(p.tarefa);
const pendentes = $input.all().map(i => i.json)
  .filter(r => r.tarefa && String(r.status || '').toLowerCase() === 'pendente');
const existente = pendentes.find(r => sim(nova, palavras(r.tarefa)) >= 0.7);

const id = Date.now().toString(36).slice(-5);
const criada_em = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const quem = p.quem ? ` (pedido por ${p.quem})` : '';
return [{ json: {
  ...p, id, criada_em, duplicada: !!existente, existente: existente || null,
  msgDup: existente ? `⚠️ Já tem algo parecido na lista:\n• ${existente.tarefa} [${existente.id}] — prazo ${existente.prazo}\n\nNão dupliquei. Se for a mesma coisa, manda /feito ${existente.id} quando terminar.` : '',
  msgOk: `✅ Anotado: ${p.tarefa}${quem}\n📅 Prazo ${p.prazo} · prioridade ${p.prioridade} · id ${id}\nAgora são ${pendentes.length + 1} pendentes. Que tal começar por 5 minutos?`,
} }];
