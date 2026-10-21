/* Servis — Demandas: configurações */
'use strict';

const Config = {
  aba: 'equipe',

  render() {
    const abas = [['equipe', 'Equipe'], ['departamentos', 'Departamentos'], ['categorias', 'Categorias'], ['parametros', 'Alertas e prazos'], ['modelos', 'Tarefas recorrentes'], ['demo', 'Demonstração'], ['acesso', 'Acesso e segurança']];
    $('view').innerHTML = `<div class="tabs-line">${abas.map(([k, l]) => `<button class="${this.aba === k ? 'on' : ''}" onclick="Config.aba='${k}';App.render()">${l}</button>`).join('')}</div><div id="cfg-b"></div>`;
    $('cfg-b').innerHTML = this['aba_' + this.aba]();
  },

  // ---------- equipe ----------
  aba_equipe() {
    return `<div class="card"><div class="card-h"><h3>Colaboradores</h3><button class="btn btn-primary btn-sm" onclick="Config.formPessoa()">+ Cadastrar colaborador</button></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>Cargo / função</th><th>Departamento</th><th>Perfil</th><th class="num">Abertas</th><th>Situação</th></tr></thead><tbody>
      ${S.profiles.map(p => `<tr onclick="Config.formPessoa('${p.id}')"><td><div class="row" style="flex-wrap:nowrap">${avatar(p, 24)}<b>${esc(p.nome)}</b></div></td><td>${esc(p.cargo || '—')}</td><td>${esc(nomeDep(p.department_id))}</td>
        <td>${esc(PAPEL[p.papel])}</td><td class="num">${S.tasks.filter(t => t.responsavel_id === p.id && aberta(t) && !t.arquivada).length}</td><td>${p.ativo ? '<span class="tag" style="color:var(--ok);background:var(--ok-50)">Ativo</span>' : '<span class="tag">Inativo</span>'}</td></tr>`).join('')}
      </tbody></table></div><div class="card-b"><p class="note">Colaboradores não são apagados (para manter o histórico): use "Inativo" para quem saiu da equipe.</p></div></div>`;
  },
  formPessoa(id) {
    const p = id ? perfil(id) : { nome: '', cargo: '', email: '', department_id: '', papel: 'colaborador', cor: '', ativo: true };
    Modal.open(`${Modal.head(id ? 'Editar colaborador' : 'Cadastrar colaborador')}<div class="modal-b">
      <div class="fg"><label for="p-nome">Nome <span class="req">*</span></label><input class="inp" id="p-nome" value="${esc(p.nome)}" autofocus></div>
      <div class="fr"><div class="fg"><label for="p-cargo">Cargo / função</label><input class="inp" id="p-cargo" value="${esc(p.cargo || '')}"></div>
        <div class="fg"><label for="p-email">E-mail</label><input class="inp" id="p-email" type="email" value="${esc(p.email || '')}"></div></div>
      <div class="fr"><div class="fg"><label for="p-dep">Departamento</label><select class="sel" id="p-dep"><option value="">—</option>${S.deps.map(d => `<option value="${d.id}" ${d.id === p.department_id ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></div>
        <div class="fg"><label for="p-papel">Perfil</label><select class="sel" id="p-papel">${Object.entries(PAPEL).map(([k, v]) => `<option value="${k}" ${k === p.papel ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <div class="fr"><div class="fg"><label for="p-cor">Cor do avatar</label><input class="inp" id="p-cor" type="color" value="${esc(p.cor || corDe(p.nome ? p : { nome: 'x' }))}"></div>
        <div class="fg"><label>Situação</label><label class="row small"><input type="checkbox" id="p-ativo" ${p.ativo ? 'checked' : ''}> Ativo</label></div></div>
      <div class="err" id="p-err"></div></div>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="p-save" onclick="Config.salvarPessoa(${id ? `'${id}'` : 'null'})">Salvar</button></div>`, { small: true });
  },
  async salvarPessoa(id) {
    const nome = $('p-nome').value.trim();
    if (nome.length < 2) { $('p-err').textContent = 'Informe o nome.'; return; }
    const row = { nome, cargo: $('p-cargo').value.trim() || null, email: $('p-email').value.trim() || null, department_id: $('p-dep').value ? Number($('p-dep').value) : null,
      papel: $('p-papel').value, cor: $('p-cor').value, ativo: $('p-ativo').checked, updated_at: new Date().toISOString() };
    await comCarregando($('p-save'), async () => {
      if (id) await q(sb.from('dem_profiles').update(row).eq('id', id)); else await q(sb.from('dem_profiles').insert(row));
      Modal.close(); toast('Colaborador salvo.', 'ok'); await App.reload();
      if (S.me) { S.me = perfil(S.me.id); App.renderMe(); }
    }).catch(e => { $('p-err').textContent = msgErro(e); });
  },

  // ---------- departamentos / categorias ----------
  _lista(tabela, itens, rotulo) {
    return `<div class="card" style="max-width:640px"><div class="card-h"><h3>${rotulo}</h3></div><div class="card-b">
      ${itens.map(i => `<div class="chk"><span>${esc(i.nome)}</span>${i.ativo ? '' : '<span class="tag">inativo</span>'}
        <button class="btn btn-sm" onclick="Config.toggle('${tabela}', ${i.id}, ${!i.ativo})">${i.ativo ? 'Desativar' : 'Ativar'}</button></div>`).join('') || '<div class="small muted">Nenhum cadastro.</div>'}
      <div class="row" style="margin-top:10px"><input class="inp" id="novo-${tabela}" placeholder="Novo nome..." style="flex:1" onkeydown="if(event.key==='Enter')Config.add('${tabela}')"><button class="btn btn-primary btn-sm" onclick="Config.add('${tabela}')">Adicionar</button></div></div></div>`;
  },
  aba_departamentos() { return this._lista('dem_departments', S.deps, 'Departamentos / áreas'); },
  aba_categorias() { return this._lista('dem_categories', S.cats, 'Categorias de demanda'); },
  async add(tabela) {
    const el = $('novo-' + tabela); const nome = el.value.trim(); if (nome.length < 2) return;
    try { await q(sb.from(tabela).insert({ nome })); toast('Adicionado.', 'ok'); await App.reload(); } catch (e) { toast(msgErro(e), 'bad'); }
  },
  async toggle(tabela, id, ativo) {
    try { await q(sb.from(tabela).update({ ativo }).eq('id', id)); await App.reload(); } catch (e) { toast(msgErro(e), 'bad'); }
  },

  // ---------- parâmetros ----------
  aba_parametros() {
    const c = S.cfg;
    return `<div class="card" style="max-width:640px"><div class="card-h"><h3>Regras de alerta</h3></div><div class="card-b">
      <div class="fg"><label for="c-sem">Dias sem atualização para alertar o gestor</label><input class="inp" type="number" min="1" max="60" id="c-sem" value="${c.dias_sem_atualizacao}"></div>
      <div class="fg"><label for="c-prox">Dias antes do prazo para sinalizar "prazo próximo"</label><input class="inp" type="number" min="0" max="30" id="c-prox" value="${c.dias_prazo_proximo}"></div>
      <div class="fg"><label for="c-lim">Máximo de demandas abertas por pessoa antes de alertar excesso</label><input class="inp" type="number" min="1" max="200" id="c-lim" value="${c.limite_abertas_por_pessoa}"></div>
      <button class="btn btn-primary" id="c-save" onclick="Config.salvarParametros()">Salvar</button>
      <p class="note" style="margin-top:12px">Os alertas aparecem dentro do sistema (Dashboard → Atenção do Gestor, menu e etiquetas nos cartões). O sistema não envia e-mail nem mensagens externas.</p></div></div>`;
  },
  async salvarParametros() {
    const vals = { dias_sem_atualizacao: Number($('c-sem').value), dias_prazo_proximo: Number($('c-prox').value), limite_abertas_por_pessoa: Number($('c-lim').value) };
    if (Object.values(vals).some(v => !Number.isFinite(v) || v < 0)) { toast('Valores inválidos.', 'bad'); return; }
    await comCarregando($('c-save'), async () => {
      await q(sb.from('dem_config').upsert(Object.entries(vals).map(([chave, valor]) => ({ chave, valor, updated_at: new Date().toISOString() }))));
      toast('Parâmetros salvos.', 'ok'); await App.reload();
    }).catch(() => {});
  },

  // ---------- modelos recorrentes ----------
  aba_modelos() {
    const FREQ = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };
    return `<div class="card"><div class="card-h"><h3>Modelos de tarefas recorrentes</h3><div class="row">
        <button class="btn btn-sm" onclick="Config.gerarAgora(this)">Gerar pendentes agora</button><button class="btn btn-primary btn-sm" onclick="Config.formModelo()">+ Novo modelo</button></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Modelo</th><th>Responsável</th><th>Frequência</th><th>Prazo</th><th>Próxima geração</th><th>Situação</th></tr></thead><tbody>
      ${S.templates.map(m => `<tr onclick="Config.formModelo(${m.id})"><td><b>${esc(m.titulo)}</b></td><td>${esc(nomeDe(m.responsavel_id))}</td><td>${FREQ[m.frequencia]}</td><td>${m.dias_para_prazo ? '+' + m.dias_para_prazo + ' dia(s)' : 'mesmo dia'}</td>
        <td>${fmtData(m.proxima_geracao)}</td><td>${m.ativo ? 'Ativo' : 'Pausado'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum modelo cadastrado.</td></tr>'}
      </tbody></table></div><div class="card-b"><p class="note">As tarefas recorrentes são criadas automaticamente quando alguém abre o sistema na data prevista (ou pelo botão "Gerar pendentes agora"). Se ninguém abrir o sistema num dia, a tarefa é criada no próximo acesso.</p></div></div>`;
  },
  formModelo(id) {
    const m = id ? S.templates.find(x => x.id === id) : { titulo: '', descricao: '', categoria: '', responsavel_id: '', prioridade: 'media', complexidade: 2, esforco_estimado_horas: '', frequencia: 'semanal', dias_para_prazo: 0, checklist: [], proxima_geracao: hojeISO(), ativo: true };
    Modal.open(`${Modal.head(id ? 'Editar modelo' : 'Novo modelo recorrente')}<div class="modal-b">
      <div class="fg"><label for="m-tit">Título <span class="req">*</span></label><input class="inp" id="m-tit" value="${esc(m.titulo)}" autofocus></div>
      <div class="fg"><label for="m-desc">Descrição</label><textarea class="ta" id="m-desc" style="min-height:56px">${esc(m.descricao || '')}</textarea></div>
      <div class="fr"><div class="fg"><label for="m-resp">Responsável <span class="req">*</span></label><select class="sel" id="m-resp"><option value="">Selecione...</option>${S.profiles.filter(p => p.ativo || p.id === m.responsavel_id).map(p => `<option value="${p.id}" ${p.id === m.responsavel_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
        <div class="fg"><label for="m-cat">Categoria</label><select class="sel" id="m-cat"><option value="">—</option>${S.cats.map(c => `<option ${c.nome === m.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div></div>
      <div class="fr3"><div class="fg"><label for="m-freq">Frequência</label><select class="sel" id="m-freq">${[['diaria', 'Diária'], ['semanal', 'Semanal'], ['mensal', 'Mensal']].map(([k, l]) => `<option value="${k}" ${k === m.frequencia ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="fg"><label for="m-prazo">Prazo (dias após criar)</label><input class="inp" type="number" min="0" max="60" id="m-prazo" value="${m.dias_para_prazo}"></div>
        <div class="fg"><label for="m-prox">Próxima geração</label><input class="inp" type="date" id="m-prox" value="${m.proxima_geracao}"></div></div>
      <div class="fr3"><div class="fg"><label for="m-prio">Prioridade</label><select class="sel" id="m-prio">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${k === m.prioridade ? 'selected' : ''}>${v.l}</option>`).join('')}</select></div>
        <div class="fg"><label for="m-cx">Complexidade</label><select class="sel" id="m-cx">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === m.complexidade ? 'selected' : ''}>${n} · ${COMPLEX[n]}</option>`).join('')}</select></div>
        <div class="fg"><label for="m-esf">Horas estimadas</label><input class="inp" type="number" min="0" step="0.5" id="m-esf" value="${esc(m.esforco_estimado_horas ?? '')}"></div></div>
      <div class="fg"><label for="m-chk">Checklist (uma etapa por linha)</label><textarea class="ta" id="m-chk" style="min-height:64px">${esc((m.checklist || []).join('\n'))}</textarea></div>
      <label class="row small"><input type="checkbox" id="m-ativo" ${m.ativo ? 'checked' : ''}> Ativo</label>
      <div class="err" id="m-err"></div></div>
      <div class="modal-f">${id ? `<button class="btn btn-danger" onclick="Config.excluirModelo(${id})">Excluir modelo</button><span class="spacer"></span>` : ''}<button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="m-save" onclick="Config.salvarModelo(${id || 'null'})">Salvar</button></div>`);
  },
  async salvarModelo(id) {
    const tit = $('m-tit').value.trim(), resp = $('m-resp').value;
    if (tit.length < 3) { $('m-err').textContent = 'Informe o título.'; return; }
    if (!resp) { $('m-err').textContent = 'Escolha o responsável.'; return; }
    const esf = $('m-esf').value;
    const row = { titulo: tit, descricao: $('m-desc').value.trim() || null, responsavel_id: resp, categoria: $('m-cat').value || null, frequencia: $('m-freq').value,
      dias_para_prazo: Number($('m-prazo').value || 0), proxima_geracao: $('m-prox').value || hojeISO(), prioridade: $('m-prio').value, complexidade: Number($('m-cx').value),
      esforco_estimado_horas: esf === '' ? null : Number(esf), checklist: $('m-chk').value.split('\n').map(s => s.trim()).filter(s => s.length >= 2), ativo: $('m-ativo').checked };
    await comCarregando($('m-save'), async () => {
      if (id) await q(sb.from('dem_templates').update(row).eq('id', id)); else await q(sb.from('dem_templates').insert(row));
      Modal.close(); toast('Modelo salvo.', 'ok'); await App.reload();
    }).catch(e => { $('m-err').textContent = msgErro(e); });
  },
  async excluirModelo(id) {
    Modal.close();
    if (!await confirmar('Excluir este modelo? As tarefas já criadas por ele continuam existindo.', { ok: 'Excluir', perigo: true })) return;
    try { await q(sb.from('dem_templates').delete().eq('id', id)); toast('Modelo excluído.', 'ok'); await App.reload(); } catch (e) { toast(msgErro(e), 'bad'); }
  },
  async gerarAgora(btn) {
    await comCarregando(btn, async () => { const n = await q(sb.rpc('dem_gerar_recorrentes')); toast(n ? `${n} tarefa(s) criada(s).` : 'Nenhum modelo pendente para hoje.', 'ok'); await App.reload(); }).catch(() => {});
  },

  // ---------- demonstração ----------
  aba_demo() {
    const n = S.tasks.filter(t => t.is_demo).length;
    return `<div class="card" style="max-width:640px"><div class="card-h"><h3>Dados de demonstração</h3></div><div class="card-b">
      <p style="margin-bottom:12px">Existem <b>${n}</b> demanda(s) de demonstração. Elas aparecem com a etiqueta <span class="tag tag-demo">DEMONSTRAÇÃO</span> e não são registros oficiais.</p>
      <label class="row" style="margin-bottom:14px"><input type="checkbox" ${S.showDemo ? 'checked' : ''} onchange="Config.mostrarDemo(this.checked)"> Mostrar demonstrações nas telas e indicadores (só neste navegador)</label>
      <button class="btn btn-danger" ${n ? '' : 'disabled'} onclick="Config.apagarDemos(this)">Excluir todas as demonstrações</button>
      <p class="note" style="margin-top:12px">O banco só permite apagar demandas marcadas como demonstração. Demandas oficiais podem apenas ser arquivadas.</p></div></div>`;
  },
  mostrarDemo(v) { S.showDemo = v; try { localStorage.setItem('dem_show_demo', v ? '1' : '0'); } catch (e) {} App.render(); },
  async apagarDemos(btn) {
    if (!await confirmar('Excluir todas as demandas de demonstração e o histórico delas? Esta ação não pode ser desfeita.', { ok: 'Excluir', perigo: true })) return;
    await comCarregando(btn, async () => {
      await q(sb.from('dem_tasks').delete().eq('is_demo', true));
      await q(sb.from('dem_task_history').delete().eq('is_demo', true));
      toast('Demonstrações excluídas.', 'ok'); await App.reload();
    }).catch(() => {});
  },

  aba_acesso() {
    return `<div class="card" style="max-width:760px"><div class="card-h"><h3>Acesso e segurança</h3></div><div class="card-b">
      <p class="alert alert-warn"><b>O sistema está sem login.</b> Qualquer pessoa com o link pode abrir, escolher um nome e alterar demandas. Os perfis (gestor, colaborador, administrador) só organizam as telas — não impedem acesso.</p>
      <div class="sec-t">O que o banco de dados garante mesmo sem login</div>
      <ul style="padding-left:18px;color:var(--tx-2);font-size:13px;line-height:1.8">
        <li>O histórico é gravado automaticamente e não pode ser editado nem apagado.</li>
        <li>Atualizações e comentários não podem ser editados nem apagados depois de registrados.</li>
        <li>Demandas oficiais não podem ser apagadas (só arquivadas); colaboradores só podem ser desativados.</li>
        <li>Bloquear exige motivo; concluir exige descrição da entrega e registra data e responsável; mudar prazo exige justificativa.</li>
      </ul>
      <div class="sec-t">Para ter permissões reais</div>
      <p class="small" style="color:var(--tx-2)">É preciso ativar login (Supabase Auth, e-mail e senha). Com login, as regras de quem vê e altera cada demanda passam a ser verificadas no banco. A estrutura atual já está preparada para essa mudança.</p>
      <div class="sec-t">Você está usando como</div>
      <div class="row">${S.me ? avatar(S.me, 30) + '<b>' + esc(S.me.nome) + '</b> · ' + esc(PAPEL[S.me.papel]) : '—'}<button class="btn btn-sm" onclick="App.escolherUsuario()">Trocar</button></div></div></div>`;
  },
};
Paginas.config = () => Config.render();
