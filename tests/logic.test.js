// Teste da lógica dos nós Code, sem n8n: node tests/logic.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const run = (file, { input = [], nodes = {} }) => {
  const src = fs.readFileSync(path.join(__dirname, '../code', file), 'utf8');
  const wrap = a => ({ first: () => ({ json: a[0] }), all: () => a.map(json => ({ json })) });
  const $ = name => { if (!(name in nodes)) throw new Error('node not run: ' + name); return wrap(nodes[name]); };
  return new Function('$', '$input', src)($, wrap(input))[0].json;
};
const tz = 'America/Sao_Paulo';
const hoje = new Date().toLocaleDateString('en-CA', { timeZone: tz });
const d = n => new Date(Date.parse(hoje) + n * 864e5).toISOString().slice(0, 10);
const tg = text => [{ message: { text, chat: { id: 42 } } }];

// Parse
let p = run('parse.js', { input: tg('/add Enviar relatório do PPP | Dra. Ana | 25/12 | urgente') });
assert.deepEqual([p.cmd, p.tarefa, p.quem, p.prioridade, p.chatId], ['add', 'Enviar relatório do PPP', 'Dra. Ana', 'alta', 42]);
assert.match(p.prazo, /^\d{4}-12-25$/);
p = run('parse.js', { input: tg('ligar pro cliente | hoje') });
assert.deepEqual([p.cmd, p.prazo, p.prioridade], ['add', hoje, 'media']);
assert.equal(run('parse.js', { input: tg('/feito AB12') }).id, 'ab12');
assert.equal(run('parse.js', { input: tg('/lista@meu_bot') }).cmd, 'lista');
assert.equal(run('parse.js', { input: tg('/start') }).cmd, 'ajuda');
assert.equal(run('parse.js', { input: tg('/add') }).cmd, 'ajuda');

// Dedup: igual, parecida (acento/caixa/ordem) e diferente; ignora concluídas; planilha vazia
const rows = [
  { id: 'a1', tarefa: 'Enviar relatório do PPP', prazo: d(1), status: 'pendente' },
  { id: 'b2', tarefa: 'Pagar boleto do condomínio', prazo: d(2), status: 'feito' },
];
const dedup = t => run('dedup.js', { input: rows, nodes: { Parse: [{ ...p, tarefa: t, prazo: d(1), prioridade: 'media', quem: '' }] } });
assert.equal(dedup('enviar RELATORIO do ppp').duplicada, true);
assert.equal(dedup('Relatório PPP enviar').duplicada, true);
assert.equal(dedup('Ligar para o cliente').duplicada, false);
assert.equal(dedup('Pagar boleto do condomínio').duplicada, false);        // a antiga já foi feita
assert.equal(run('dedup.js', { input: [{}], nodes: { Parse: [{ ...p, tarefa: 'x tarefa' }] } }).duplicada, false);

// Achar
const achar = id => run('achar.js', { input: rows, nodes: { Parse: [{ id }] } });
assert.equal(achar('a1').achou, true);
assert.equal(achar('b2').achou, false);   // já concluída
assert.equal(achar('zzz').achou, false);

// Priorizar: atrasada alta > hoje média > longe baixa; aceita dd/mm/aaaa; vazia
const br = iso => iso.split('-').reverse().join('/');
const pr = run('priorizar.js', { nodes: { Parse: [{ chatId: 42 }] }, input: [
  { id: 'x1', tarefa: 'longe', prazo: d(10), prioridade: 'baixa', status: 'pendente', criada_em: hoje },
  { id: 'x2', tarefa: 'hoje', prazo: br(d(0)), prioridade: 'media', status: 'pendente', criada_em: hoje },
  { id: 'x3', tarefa: 'atrasada', prazo: d(-2), prioridade: 'alta', status: 'pendente', criada_em: d(-5) },
  { id: 'x4', tarefa: 'feita', prazo: d(-2), prioridade: 'alta', status: 'feito' },
] });
assert.equal(pr.total, 3);
assert.ok(pr.text.indexOf('atrasada [x3]') < pr.text.indexOf('hoje [x2]'));
assert.ok(pr.text.includes('🔥 Atrasadas (1)') && !pr.text.includes('feita'));
assert.equal(pr.chatId, 42);
assert.match(run('priorizar.js', { nodes: { Config: [{ chat_id: 7 }] }, input: [{}] }).text, /Lista zerada/);
console.log('OK: todos os testes de lógica passaram');
