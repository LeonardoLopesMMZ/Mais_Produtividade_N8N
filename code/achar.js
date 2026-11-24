// Nó "Achar tarefa": localiza a pendente pelo id informado em /feito.
const p = $('Parse').first().json;
const r = $input.all().map(i => i.json)
  .find(x => String(x.id || '').toLowerCase() === p.id && String(x.status || '').toLowerCase() === 'pendente');
return [{ json: {
  achou: !!r, id: p.id, tarefa: r ? r.tarefa : '',
  concluida_em: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
  msgOk: r ? `🎉 Feito: ${r.tarefa}\nMais uma fora da lista!` : '',
  msgNao: `🤔 Não achei pendente com id "${p.id}". Manda /lista para ver os ids.`,
} }];
