/* Servis — Demandas: tarefa (detalhes, formulário e ações) */
'use strict';

const Tarefa = {
  atual: null, aba: 'detalhes', dados: null,

  get t() { return S.tasks.find(x => x.id === this.atual) || null; },

  // ---------- painel de detalhes ----------
  async abrir(id, aba) {
    this.atual = id; this.aba = aba || 'detalhes'; this.dados = null;
    $('drawer').hidden = false; $('drawer-scrim').classList.add('on');
    $('drawer').innerHTML = '<div class="empty"><div class="spin" style="margin:30px auto"></div></div>';
    await this.carregar();
    this.render();
  },
  fechar() { this.atual = null; this.dados = null; $('drawer').hidden = true; $('drawer-scrim').classList.remove('on'); },
  async carregar() {
    const id = this.atual;
    try {
      const [upd, com, chk, anx, his] = await Promise.all([
        q(sb.from('dem_task_updates').select('*').eq('task_id', id).order('created_at', { ascending: false })),
        q(sb.from('dem_task_comments').select('*').eq('task_id', id).order('created_at', { ascending: true })),
        q(sb.from('dem_task_checklists').select('*').eq('task_id', id).order('ordem').order('id')),
        q(sb.from('dem_task_attachments').select('*').eq('task_id', id).order('created_at')),
        q(sb.from('dem_task_history').select('*').eq('task_id', id).order('created_at', { ascending: false }).order('id', { ascending: false })),
      ]);
      if (this.atual === id) this.dados = { upd, com, chk, anx, his };
    } catch (e) { toast(msgErro(e), 'bad'); this.dados = { upd: [], com: [], chk: [], anx: [], his: [], erro: true }; }
  },
  async recarregar() { await App.refresh(); if (this.atual) { await this.carregar(); this.render(); } },

  render() {
    const t = this.t;
    if (!t) { this.fechar(); return; }
    const d = this.dados || { upd: [], com: [], chk: [], anx: [], his: [] };
    const st = ST[t.status];
    const souEnvolvido = S.me && envolve(t, S.me.id);
    const pode = ehGestor() || souEnvolvido;
    const pai = t.parent_id ? S.tasks.find(x => x.id === t.parent_id) : null;
    const acoes = [];
    if (aberta(t) && pode) {
      if (t.status === 'nao_iniciada') acoes.push(`<button class="btn btn-sm btn-primary" onclick="Tarefa.iniciar()">▶ Iniciar</button>`);
      acoes.push(`<button class="btn btn-sm${t.status !== 'nao_iniciada' ? ' btn-primary' : ''}" onclick="Tarefa.formAtualizacao()">Registrar atualização</button>`);
      if (t.status === 'bloqueada') acoes.push(`<button class="btn btn-sm" onclick="Tarefa.formStatus('em_andamento')">Desbloquear</button>`);
      else acoes.push(`<button class="btn btn-sm" onclick="Tarefa.formStatus('bloqueada')">Bloquear</button>`);
      if (!t.ajuda_solicitada) acoes.push(`<button class="btn btn-sm" onclick="Tarefa.formAjuda()">Pedir ajuda</button>`);
      if (t.status !== 'em_revisao') acoes.push(`<button class="btn btn-sm" onclick="Tarefa.formStatus('em_revisao')">Enviar p/ revisão</button>`);
      acoes.push(`<button class="btn btn-sm" onclick="Tarefa.formStatus('concluida')">✓ Concluir</button>`);
    }
    if (!aberta(t) && pode) acoes.push(`<button class="btn btn-sm" onclick="Tarefa.formStatus('em_andamento')">Reabrir</button>`);
    if (ehGestor() && aberta(t) && S.me && t.responsavel_id !== S.me.id) acoes.push(`<button class="btn btn-sm" onclick="Tarefa.formCobranca()">Cobrar atualização</button>`);
    acoes.push(`<span class="spacer"></span>`);
    if (pode) acoes.push(`<button class="btn btn-sm" onclick="Tarefa.abrirForm({id:${t.id}})">Editar</button>`);
    acoes.push(`<button class="btn btn-sm" onclick="Tarefa.duplicar()" title="Criar uma cópia">Duplicar</button>`);
    if (ehGestor()) acoes.push(t.arquivada ? `<button class="btn btn-sm" onclick="Tarefa.arquivar(false)">Restaurar</button>` : `<button class="btn btn-sm btn-danger" onclick="Tarefa.arquivar(true)">Arquivar</button>`);
    if (t.is_demo) acoes.push(`<button class="btn btn-sm btn-danger" onclick="Tarefa.excluirDemo()">Excluir</button>`);

    const abas = [['detalhes', 'Detalhes'], ['atualizacoes', `Atualizações (${d.upd.length})`], ['comentarios', `Comentários (${d.com.length})`], ['historico', `Histórico (${d.his.length})`]];
    $('drawer').innerHTML = `
      <div class="dr-h">
        <div class="row"><span class="code">${esc(t.codigo)}</span>${tagStatus(t.status)}${tagPrio(t.prioridade)}${tagsAlerta(t)}${t.arquivada ? '<span class="tag">Arquivada</span>' : ''}
          <span class="spacer"></span><button class="icon-btn" onclick="Tarefa.fechar()" aria-label="Fechar">✕</button></div>
        <h2>${esc(t.titulo)}</h2>
        ${pai ? `<div class="small muted">Subtarefa de <a href="javascript:void(0)" onclick="Tarefa.abrir(${pai.id})">${esc(pai.codigo)} · ${esc(pai.titulo)}</a></div>` : ''}
        <div class="row small" style="margin-top:6px">${avatar(t.responsavel_id, 24)} <b>${esc(nomeDe(t.responsavel_id))}</b>
          ${(t.participantes || []).length ? `<span class="muted">+ ${t.participantes.map(nomeDe).map(esc).join(', ')}</span>` : ''}</div>
        <div style="margin-top:10px"><div class="row small muted" style="margin-bottom:4px"><span>Progresso</span><span class="spacer"></span><b style="color:var(--tx)">${t.progresso}%</b></div>
          <div class="prog${t.status === 'concluida' ? ' ok' : ''}"><i style="width:${t.progresso}%"></i></div></div>
      </div>
      <div class="dr-actions">${acoes.join('')}</div>
      <div class="dr-tabs">${abas.map(([k, l]) => `<button class="${this.aba === k ? 'on' : ''}" onclick="Tarefa.aba='${k}';Tarefa.render()">${l}</button>`).join('')}</div>
      <div class="dr-b">${this['aba_' + this.aba](t, d)}</div>`;
  },

  aba_detalhes(t, d) {
    const alertas = [];
    if (t.status === 'bloqueada') alertas.push(`<div class="alert alert-bad"><b>Bloqueada:</b> ${esc(t.motivo_bloqueio)}</div>`);
    if (t.ajuda_solicitada && aberta(t)) alertas.push(`<div class="alert alert-warn"><b>Ajuda solicitada ao gestor.</b> Veja a última atualização.</div>`);
    if (atrasada(t)) alertas.push(`<div class="alert alert-bad">Prazo vencido há ${-diasAte(t.prazo)} dia(s).</div>`);
    if (semAtualizacao(t)) alertas.push(`<div class="alert alert-warn">Sem atualização registrada ${t.ultima_atualizacao_em ? fmtRel(t.ultima_atualizacao_em) : 'desde a criação (' + fmtRel(t.created_at) + ')'}.</div>`);
    if (t.legacy_id) alertas.push(`<div class="alert alert-info">Importada da aba Demandas antiga.${t.recorrencia ? ' Frequência original: <b>' + esc(t.recorrencia) + '</b>.' : ''}${t.observacao_prazo ? ' Observação de prazo: ' + esc(t.observacao_prazo) : ''}</div>`);
    const subs = S.tasks.filter(x => x.parent_id === t.id && !x.arquivada);
    const chkFeitos = d.chk.filter(c => c.feito).length;
    const podeEditar = ehGestor() || (S.me && envolve(t, S.me.id));
    return `${alertas.join('')}
      <dl class="facts">
        <div><dt>Categoria</dt><dd>${esc(t.categoria || '—')}</dd></div>
        <div><dt>Departamento</dt><dd>${esc(nomeDep(t.department_id))}</dd></div>
        <div><dt>Criada em</dt><dd>${fmtDataHora(t.created_at)}${t.criado_por ? ' por ' + esc(nomeDe(t.criado_por)) : ''}</dd></div>
        <div><dt>Última atualização</dt><dd>${t.ultima_atualizacao_em ? fmtDataHora(t.ultima_atualizacao_em) : '<span class="muted">nenhuma registrada</span>'}</dd></div>
        <div><dt>Início</dt><dd>${fmtData(t.data_inicio)}</dd></div>
        <div><dt>Prazo final</dt><dd>${fmtData(t.prazo)}</dd></div>
        <div><dt>Complexidade</dt><dd>${t.complexidade} · ${COMPLEX[t.complexidade]}</dd></div>
        <div><dt>Tempo estimado / gasto</dt><dd>${t.esforco_estimado_horas != null ? fmtNum(t.esforco_estimado_horas, 1) + ' h' : '—'} / ${fmtNum(t.horas_gastas, 1)} h</dd></div>
        ${t.concluida_em ? `<div><dt>Concluída em</dt><dd>${fmtDataHora(t.concluida_em)}${t.concluida_por ? ' por ' + esc(nomeDe(t.concluida_por)) : ''}</dd></div>` : ''}
        ${t.recorrencia ? `<div><dt>Recorrência</dt><dd>${esc(t.recorrencia)}</dd></div>` : ''}
      </dl>
      ${t.descricao ? `<div class="sec-t">Descrição</div><div class="blk">${esc(t.descricao)}</div>` : ''}
      ${t.motivo ? `<div class="sec-t">Motivo da demanda</div><div class="blk">${esc(t.motivo)}</div>` : ''}
      ${t.resultado_esperado ? `<div class="sec-t">Resultado esperado</div><div class="blk">${esc(t.resultado_esperado)}</div>` : ''}
      ${t.entrega_descricao ? `<div class="sec-t">Entrega</div><div class="blk">${esc(t.entrega_descricao)}</div>` : ''}

      <div class="sec-t">Checklist ${d.chk.length ? `<span class="muted">${chkFeitos}/${d.chk.length}</span>` : ''}</div>
      ${d.chk.map(c => `<div class="chk${c.feito ? ' done' : ''}"><input type="checkbox" ${c.feito ? 'checked' : ''} ${podeEditar ? '' : 'disabled'} onchange="Tarefa.marcarItem(${c.id}, this.checked)" aria-label="${esc(c.texto)}"><span>${esc(c.texto)}</span>
        ${c.feito && c.feito_por ? `<small class="muted">${esc(nomeDe(c.feito_por))}</small>` : ''}
        ${podeEditar ? `<button class="icon-btn" style="width:26px;height:26px;font-size:13px" onclick="Tarefa.removerItem(${c.id})" aria-label="Remover item">✕</button>` : ''}</div>`).join('') || '<div class="small muted">Nenhuma etapa cadastrada.</div>'}
      ${podeEditar ? `<div class="row" style="margin-top:8px"><input class="inp" id="novo-item" placeholder="Nova etapa..." style="flex:1" onkeydown="if(event.key==='Enter')Tarefa.addItem()"><button class="btn btn-sm" onclick="Tarefa.addItem()">Adicionar</button></div>` : ''}

      <div class="sec-t">Subtarefas <span class="spacer"></span>${podeEditar ? `<button class="btn btn-sm" onclick="Tarefa.abrirForm({parent_id:${t.id}})">+ Subtarefa</button>` : ''}</div>
      ${subs.map(s => `<div class="chk" style="cursor:pointer" onclick="Tarefa.abrir(${s.id})"><span><span class="code">${esc(s.codigo)}</span> ${esc(s.titulo)}</span>${tagStatus(s.status)}${avatar(s.responsavel_id, 22)}</div>`).join('') || '<div class="small muted">Nenhuma subtarefa.</div>'}

      <div class="sec-t">Anexos e evidências</div>
      ${d.anx.map(a => `<div class="chk"><span>📎 <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.nome)}</a> <small class="muted">· ${esc(nomeDe(a.enviado_por))} · ${fmtDataHora(a.created_at)}</small></span>
        ${podeEditar ? `<button class="icon-btn" style="width:26px;height:26px;font-size:13px" onclick="Tarefa.removerAnexo(${a.id})" aria-label="Remover anexo">✕</button>` : ''}</div>`).join('') || '<div class="small muted">Nenhum anexo.</div>'}
      ${podeEditar ? `<div class="row" style="margin-top:8px"><button class="btn btn-sm" onclick="Tarefa.formAnexo()">+ Link</button>
        <label class="btn btn-sm" style="cursor:pointer">+ Arquivo<input type="file" hidden onchange="Tarefa.enviarArquivo(this)"></label></div>` : ''}`;
  },

  aba_atualizacoes(t, d) {
    const form = aberta(t) && (ehGestor() || (S.me && envolve(t, S.me.id)))
      ? `<button class="btn btn-primary btn-sm" style="margin-bottom:14px" onclick="Tarefa.formAtualizacao()">+ Registrar atualização</button>` : '';
    const TIPO = { inicio: 'Início', avanco: 'Avanço', bloqueio: 'Bloqueio', desbloqueio: 'Desbloqueio', ajuda: 'Pedido de ajuda', revisao: 'Enviada para revisão', conclusao: 'Conclusão', status: 'Mudança de status' };
    const COR = { bloqueio: 'var(--bad)', ajuda: 'var(--warn)', conclusao: 'var(--ok)', revisao: 'var(--violet)' };
    return form + (d.upd.length ? `<ul class="tl">${d.upd.map(u => `<li style="--c:${COR[u.tipo] || 'var(--blue)'}">
      <div class="when">${fmtDataHora(u.created_at)} · ${esc(nomeDe(u.autor_id))} · <b>${esc(TIPO[u.tipo] || u.tipo)}</b>${u.progresso != null ? ' · ' + u.progresso + '%' : ''}${u.horas_gastas ? ' · ' + fmtNum(u.horas_gastas, 1) + ' h' : ''}</div>
      <div class="txt">${esc(u.texto)}</div>
      ${u.dificuldades ? `<div class="small" style="margin-top:4px"><b>Dificuldades:</b> ${esc(u.dificuldades)}</div>` : ''}
      ${u.proxima_etapa ? `<div class="small" style="margin-top:2px"><b>Próxima etapa:</b> ${esc(u.proxima_etapa)}</div>` : ''}</li>`).join('')}</ul>`
      : '<div class="empty">Nenhuma atualização registrada ainda. O status "Em andamento" sozinho não indica que a tarefa está sendo executada.</div>');
  },

  aba_comentarios(t, d) {
    return `${d.com.length ? `<ul class="tl">${d.com.map(c => `<li style="--c:${c.tipo === 'cobranca' ? 'var(--warn)' : 'var(--blue)'}">
      <div class="when">${fmtDataHora(c.created_at)} · ${esc(nomeDe(c.autor_id))}${c.tipo === 'cobranca' ? ' · <b>Cobrança do gestor</b>' : ''}</div>
      <div class="txt">${esc(c.texto)}</div></li>`).join('')}</ul>` : '<div class="empty">Sem comentários.</div>'}
      <div class="fg" style="margin-top:10px"><textarea class="ta" id="novo-com" placeholder="Escreva um comentário..." aria-label="Novo comentário"></textarea></div>
      <button class="btn btn-primary btn-sm" onclick="Tarefa.comentar(this)">Comentar</button>`;
  },

  aba_historico(t, d) {
    const ROT = {
      criada: 'Criou a demanda', migrada: 'Importou da aba antiga', designada: 'Designou o responsável', status_alterado: 'Alterou o status',
      prioridade_alterada: 'Alterou a prioridade', prazo_alterado: 'Alterou o prazo', responsavel_alterado: 'Trocou o responsável',
      progresso_alterado: 'Atualizou o progresso', editada: 'Editou', bloqueada: 'Bloqueou', ajuda_solicitada: 'Pediu ajuda',
      arquivada: 'Arquivou', restaurada: 'Restaurou', atualizacao: 'Registrou atualização', comentario: 'Comentou', cobranca: 'Cobrou atualização',
      participante_adicionado: 'Adicionou participante', participante_removido: 'Removeu participante', checklist_concluido: 'Concluiu etapa',
      checklist_reaberto: 'Reabriu etapa', anexo_adicionado: 'Anexou', anexo_removido: 'Removeu anexo',
    };
    const val = (campo, v) => campo === 'status' ? (ST[v] ? ST[v].l : v) : campo === 'prioridade' ? (PRIO[v] ? PRIO[v].l : v) : campo === 'prazo' || campo === 'data_inicio' ? fmtData(v) : v;
    return d.his.length ? `<ul class="tl">${d.his.map(h => `<li>
      <div class="when">${fmtDataHora(h.created_at)} · ${h.ator_id ? esc(nomeDe(h.ator_id)) : '<span class="muted">sistema</span>'}</div>
      <div class="what"><b>${esc(ROT[h.acao] || h.acao)}</b>${h.campo && h.acao === 'editada' ? ' · ' + esc(h.campo) : ''}
        ${h.valor_anterior != null || h.valor_novo != null ? `: ${h.valor_anterior != null ? '<s class="muted">' + esc(val(h.campo, h.valor_anterior)) + '</s> → ' : ''}${esc(val(h.campo, h.valor_novo) ?? '—')}` : ''}</div>
      ${h.detalhe ? `<div class="txt">${esc(h.detalhe)}</div>` : ''}</li>`).join('')}</ul>
      <p class="note" style="margin-top:10px">O histórico é gravado pelo próprio banco e não pode ser editado nem apagado.</p>` : '<div class="empty">Sem histórico.</div>';
  },

  // ---------- formulário de criação/edição ----------
  abrirForm(opts = {}) {
    if (!S.me) { App.escolherUsuario(); return; }
    const t = opts.id ? S.tasks.find(x => x.id === opts.id) : null;
    const base = t || Object.assign({
      titulo: '', descricao: '', categoria: '', department_id: S.me.department_id || '', responsavel_id: ehGestor() ? '' : S.me.id,
      prioridade: 'media', status: 'nao_iniciada', complexidade: 3, esforco_estimado_horas: '', data_inicio: hojeISO(), prazo: '',
      motivo: '', resultado_esperado: '', participantes: [], parent_id: null,
    }, opts.copiaDe || {}, opts);
    const gest = ehGestor();
    const bloqueiaGestao = t && !gest; // colaborador não altera responsável/prazo/prioridade
    const ativos = S.profiles.filter(p => p.ativo || p.id === base.responsavel_id);
    const cats = S.cats.filter(c => c.ativo || c.nome === base.categoria);
    const pai = base.parent_id ? S.tasks.find(x => x.id === base.parent_id) : null;
    Modal.open(`${Modal.head(t ? 'Editar ' + t.codigo : (pai ? 'Nova subtarefa' : 'Nova demanda'))}
      <form class="modal-b" id="tf" novalidate>
        ${pai ? `<div class="alert alert-info">Subtarefa de <b>${esc(pai.codigo)}</b> · ${esc(pai.titulo)}</div>` : ''}
        ${bloqueiaGestao ? '<div class="alert alert-info">Responsável, prazo e prioridade só podem ser alterados pelo gestor.</div>' : ''}
        <div class="fg"><label for="f-titulo">Título <span class="req">*</span></label><input class="inp" id="f-titulo" maxlength="160" value="${esc(base.titulo)}" autofocus></div>
        <div class="fg"><label for="f-desc">Descrição detalhada</label><textarea class="ta" id="f-desc">${esc(base.descricao || '')}</textarea></div>
        <div class="fr">
          <div class="fg"><label for="f-resp">Responsável principal <span class="req">*</span></label>
            <select class="sel" id="f-resp" ${bloqueiaGestao ? 'disabled' : ''}><option value="">Selecione...</option>${ativos.map(p => `<option value="${p.id}" ${p.id === base.responsavel_id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
          <div class="fg"><label for="f-cat">Categoria</label>
            <select class="sel" id="f-cat"><option value="">—</option>${cats.map(c => `<option ${c.nome === base.categoria ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
        </div>
        <div class="fg"><label>Participantes</label><div class="pick" id="f-part">${S.profiles.filter(p => p.ativo).map(p => `<label><input type="checkbox" value="${p.id}" ${(base.participantes || []).includes(p.id) ? 'checked' : ''}>${avatar(p, 20)}${esc(p.nome)}</label>`).join('')}</div>
          <div class="hint">Pessoas que dividem a execução com o responsável.</div></div>
        <div class="fr3">
          <div class="fg"><label for="f-prio">Prioridade</label><select class="sel" id="f-prio" ${bloqueiaGestao ? 'disabled' : ''}>${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${k === base.prioridade ? 'selected' : ''}>${v.l}</option>`).join('')}</select></div>
          <div class="fg"><label for="f-status">Status ${t ? '' : 'inicial'}</label><select class="sel" id="f-status" ${t ? 'disabled title="Use as ações do painel para mudar o status"' : ''}>${STATUS.filter(s => t || !['concluida', 'cancelada', 'bloqueada'].includes(s.k)).map(s => `<option value="${s.k}" ${s.k === base.status ? 'selected' : ''}>${s.l}</option>`).join('')}</select></div>
          <div class="fg"><label for="f-dep">Departamento</label><select class="sel" id="f-dep"><option value="">—</option>${S.deps.filter(x => x.ativo || x.id === base.department_id).map(x => `<option value="${x.id}" ${x.id === Number(base.department_id) ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
        </div>
        <div class="fr3">
          <div class="fg"><label for="f-ini">Data de início</label><input class="inp" type="date" id="f-ini" value="${esc(base.data_inicio || '')}"></div>
          <div class="fg"><label for="f-prazo">Prazo final</label><input class="inp" type="date" id="f-prazo" value="${esc(base.prazo || '')}" ${bloqueiaGestao ? 'disabled' : ''} oninput="Tarefa._prazoMudou()"></div>
          <div class="fg"><label for="f-cx">Complexidade</label><select class="sel" id="f-cx">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === Number(base.complexidade) ? 'selected' : ''}>${n} · ${COMPLEX[n]}</option>`).join('')}</select></div>
        </div>
        <div class="fg" id="f-just-box" hidden><label for="f-just">Justificativa da mudança de prazo <span class="req">*</span></label><input class="inp" id="f-just" placeholder="Ex.: aguardando retorno do fornecedor"><div class="hint">Fica registrada no histórico.</div></div>
        <div class="fr">
          <div class="fg"><label for="f-esf">Tempo estimado (horas)</label><input class="inp" type="number" min="0" step="0.5" id="f-esf" value="${esc(base.esforco_estimado_horas ?? '')}"></div>
          <div class="fg"><label>Data de criação</label><input class="inp" value="${t ? fmtDataHora(t.created_at) : 'Automática ao salvar'}" disabled></div>
        </div>
        <div class="fg"><label for="f-mot">Motivo da demanda</label><textarea class="ta" id="f-mot" style="min-height:56px">${esc(base.motivo || '')}</textarea></div>
        <div class="fg"><label for="f-res">Resultado esperado</label><textarea class="ta" id="f-res" style="min-height:56px">${esc(base.resultado_esperado || '')}</textarea></div>
        ${t ? '' : `<div class="fg"><label for="f-chk">Checklist de etapas</label><textarea class="ta" id="f-chk" style="min-height:64px" placeholder="Uma etapa por linha">${esc((opts.checklist || []).join('\n'))}</textarea></div>
        <div class="fg"><label for="f-com">Comentário inicial</label><textarea class="ta" id="f-com" style="min-height:56px"></textarea></div>
        <p class="hint">Anexos e evidências podem ser adicionados depois de salvar, no painel da demanda.</p>`}
        <div class="err" id="f-err" role="alert"></div>
      </form>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="f-save" onclick="Tarefa.salvarForm(${t ? t.id : 'null'}, ${base.parent_id || 'null'})">${t ? 'Salvar alterações' : 'Criar demanda'}</button></div>`);
    this._prazoOriginal = t ? t.prazo : null;
  },
  _prazoMudou() {
    const v = $('f-prazo').value || null;
    $('f-just-box').hidden = !(this._prazoOriginal && v !== this._prazoOriginal);
  },

  async salvarForm(id, parentId) {
    const err = $('f-err'); err.textContent = '';
    const val = x => { const el = $(x); return el ? el.value.trim() : ''; };
    const titulo = val('f-titulo');
    const resp = val('f-resp');
    const ini = val('f-ini') || null, prazo = val('f-prazo') || null;
    if (titulo.length < 3) { err.textContent = 'Informe um título com pelo menos 3 caracteres.'; $('f-titulo').focus(); return; }
    if (!resp) { err.textContent = 'Escolha o responsável principal.'; $('f-resp').focus(); return; }
    if (ini && prazo && prazo < ini) { err.textContent = 'O prazo final não pode ser antes da data de início.'; return; }
    const old = id ? S.tasks.find(x => x.id === id) : null;
    const just = val('f-just');
    if (old && old.prazo && prazo !== old.prazo && just.length < 5) { err.textContent = 'Explique por que o prazo mudou (mínimo 5 caracteres).'; $('f-just').focus(); return; }
    const esf = val('f-esf');
    const row = {
      titulo, descricao: val('f-desc') || null, categoria: val('f-cat') || null, department_id: val('f-dep') ? Number(val('f-dep')) : null,
      responsavel_id: resp, prioridade: val('f-prio'), complexidade: Number(val('f-cx')), esforco_estimado_horas: esf === '' ? null : Number(esf),
      data_inicio: ini, prazo, motivo: val('f-mot') || null, resultado_esperado: val('f-res') || null, atualizado_por: S.me.id,
    };
    if (old && old.prazo && prazo !== old.prazo) row.justificativa_prazo = just;
    const partes = [...document.querySelectorAll('#f-part input:checked')].map(i => i.value).filter(p => p !== resp);
    await comCarregando($('f-save'), async () => {
      let taskId = id;
      if (old) {
        await q(sb.from('dem_tasks').update(row).eq('id', id));
      } else {
        row.status = val('f-status') || 'nao_iniciada'; row.criado_por = S.me.id; row.parent_id = parentId || null;
        const novo = await q(sb.from('dem_tasks').insert(row).select('id').single());
        taskId = novo.id;
        const etapas = val('f-chk').split('\n').map(s => s.trim()).filter(s => s.length >= 2);
        if (etapas.length) await q(sb.from('dem_task_checklists').insert(etapas.map((texto, i) => ({ task_id: taskId, texto, ordem: i }))));
        const com = val('f-com');
        if (com.length >= 2) await q(sb.from('dem_task_comments').insert({ task_id: taskId, autor_id: S.me.id, texto: com }));
      }
      // participantes: adiciona/remove só a diferença
      const atuais = old ? (old.participantes || []) : [];
      const add = partes.filter(p => !atuais.includes(p)), rem = atuais.filter(p => !partes.includes(p));
      if (add.length) await q(sb.from('dem_task_assignees').insert(add.map(p => ({ task_id: taskId, profile_id: p }))));
      if (rem.length) await q(sb.from('dem_task_assignees').delete().eq('task_id', taskId).in('profile_id', rem));
      Modal.close();
      toast(old ? 'Alterações salvas.' : 'Demanda criada.', 'ok');
      await App.refresh();
      if (!old || this.atual === taskId) this.abrir(taskId);
    }).catch(e => { err.textContent = msgErro(e); });
  },

  // ---------- ações de andamento ----------
  async iniciar() {
    const t = this.t; if (!t || !S.me) return;
    try {
      await q(sb.from('dem_tasks').update({ status: 'em_andamento', data_inicio: t.data_inicio || hojeISO(), atualizado_por: S.me.id }).eq('id', t.id));
      toast('Demanda iniciada. Registre atualizações conforme avançar.', 'ok');
      await this.recarregar();
    } catch (e) { toast(msgErro(e), 'bad'); }
  },

  formAtualizacao() {
    const t = this.t; if (!t) return; if (!S.me) { App.escolherUsuario(); return; }
    Modal.open(`${Modal.head('Registrar atualização · ' + t.codigo)}<div class="modal-b">
      <div class="fg"><label for="u-txt">Atualização da atividade <span class="req">*</span></label>
        <textarea class="ta" id="u-txt" placeholder="Ex.: Realizei a análise dos clientes com falha de comunicação. Identifiquei 12 equipamentos offline e encaminhei ao setor técnico. Permanecem 4 aguardando retorno." autofocus></textarea>
        <div class="hint">Descreva o que foi feito. Mínimo 10 caracteres.</div></div>
      <div class="fr">
        <div class="fg"><label for="u-prog">Percentual de conclusão: <b id="u-prog-v">${t.progresso}%</b></label><input type="range" id="u-prog" min="0" max="100" step="5" value="${t.progresso}" style="width:100%" oninput="$('u-prog-v').textContent=this.value+'%'"></div>
        <div class="fg"><label for="u-h">Horas gastas nesta etapa</label><input class="inp" type="number" min="0" step="0.5" id="u-h"></div>
      </div>
      <div class="fg"><label for="u-dif">Dificuldades</label><input class="inp" id="u-dif"></div>
      <div class="fg"><label for="u-prox">Próxima etapa</label><input class="inp" id="u-prox"></div>
      <div class="err" id="u-err" role="alert"></div></div>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="u-save" onclick="Tarefa.salvarAtualizacao()">Registrar</button></div>`);
  },
  async salvarAtualizacao() {
    const t = this.t; const txt = $('u-txt').value.trim();
    if (txt.length < 10) { $('u-err').textContent = 'Descreva a atualização com pelo menos 10 caracteres.'; $('u-txt').focus(); return; }
    const h = $('u-h').value;
    await comCarregando($('u-save'), async () => {
      if (t.status === 'nao_iniciada') await q(sb.from('dem_tasks').update({ status: 'em_andamento', data_inicio: t.data_inicio || hojeISO(), atualizado_por: S.me.id }).eq('id', t.id));
      await q(sb.from('dem_task_updates').insert({
        task_id: t.id, autor_id: S.me.id, tipo: 'avanco', texto: txt, progresso: Number($('u-prog').value),
        horas_gastas: h === '' ? null : Number(h), dificuldades: $('u-dif').value.trim() || null, proxima_etapa: $('u-prox').value.trim() || null,
      }));
      Modal.close(); toast('Atualização registrada.', 'ok');
      this.aba = 'atualizacoes'; await this.recarregar();
    }).catch(e => { $('u-err').textContent = msgErro(e); });
  },

  // bloquear / concluir / revisão / reabrir / desbloquear
  formStatus(novo, taskId) {
    if (taskId) { this.atual = taskId; }
    const t = this.t; if (!t) return; if (!S.me) { App.escolherUsuario(); return; }
    const cfg = {
      bloqueada:   { tit: 'Bloquear demanda', ok: 'Bloquear', tipo: 'bloqueio', extra: `<div class="fg"><label for="s-mot">Motivo do bloqueio <span class="req">*</span></label><input class="inp" id="s-mot" autofocus></div>`, ph: 'O que já foi feito e o que está impedindo o avanço.' },
      concluida:   { tit: 'Concluir demanda', ok: 'Concluir', tipo: 'conclusao', extra: `<div class="fg"><label for="s-ent">Descrição da entrega <span class="req">*</span></label><textarea class="ta" id="s-ent" autofocus placeholder="O que foi entregue, onde está o resultado."></textarea></div><div class="fg"><label for="s-h">Horas gastas nesta etapa</label><input class="inp" type="number" min="0" step="0.5" id="s-h"></div>`, semTexto: true },
      em_revisao:  { tit: 'Enviar para revisão', ok: 'Enviar', tipo: 'revisao', ph: 'O que deve ser revisado.' },
      em_andamento:{ tit: t.status === 'bloqueada' ? 'Desbloquear demanda' : 'Reabrir demanda', ok: 'Confirmar', tipo: t.status === 'bloqueada' ? 'desbloqueio' : 'status', ph: t.status === 'bloqueada' ? 'Como o bloqueio foi resolvido.' : 'Por que está sendo reaberta.' },
      aguardando_terceiros: { tit: 'Aguardando terceiros', ok: 'Confirmar', tipo: 'status', ph: 'De quem/qual retorno está aguardando.' },
      nao_iniciada: { tit: 'Voltar para "Não iniciada"', ok: 'Confirmar', tipo: 'status', ph: 'Motivo.', opcional: true },
    }[novo];
    if (!cfg) return this.mudarStatus(t, novo);
    Modal.open(`${Modal.head(cfg.tit + ' · ' + t.codigo)}<div class="modal-b">${cfg.extra || ''}
      ${cfg.semTexto ? '' : `<div class="fg"><label for="s-txt">Atualização da atividade ${cfg.opcional ? '' : '<span class="req">*</span>'}</label><textarea class="ta" id="s-txt" placeholder="${esc(cfg.ph)}" ${cfg.extra ? '' : 'autofocus'}></textarea></div>`}
      <div class="err" id="s-err" role="alert"></div></div>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="s-save" onclick="Tarefa.salvarStatus('${novo}')">${cfg.ok}</button></div>`, { small: true });
  },
  async salvarStatus(novo) {
    const t = this.t; const er = $('s-err'); er.textContent = '';
    const txtEl = $('s-txt'); const txt = txtEl ? txtEl.value.trim() : '';
    const upd = { status: novo, atualizado_por: S.me.id };
    let tipo = 'status', texto = txt;
    if (novo === 'bloqueada') {
      const mot = $('s-mot').value.trim();
      if (mot.length < 5) { er.textContent = 'Informe o motivo do bloqueio (mínimo 5 caracteres).'; return; }
      if (txt.length < 10) { er.textContent = 'A atualização da atividade é obrigatória ao bloquear (mínimo 10 caracteres).'; return; }
      upd.motivo_bloqueio = mot; tipo = 'bloqueio';
    } else if (novo === 'concluida') {
      const ent = $('s-ent').value.trim();
      if (ent.length < 10) { er.textContent = 'Descreva a entrega (mínimo 10 caracteres).'; return; }
      upd.entrega_descricao = ent; tipo = 'conclusao'; texto = 'Entrega: ' + ent;
    } else if (novo !== 'nao_iniciada' && txt.length < 10) {
      er.textContent = 'Escreva a atualização (mínimo 10 caracteres).'; return;
    } else {
      tipo = novo === 'em_revisao' ? 'revisao' : (t.status === 'bloqueada' ? 'desbloqueio' : 'status');
    }
    if (novo === 'em_andamento' && !t.data_inicio) upd.data_inicio = hojeISO();
    await comCarregando($('s-save'), async () => {
      await q(sb.from('dem_tasks').update(upd).eq('id', t.id));
      if (texto.length >= 10) {
        const h = $('s-h') ? $('s-h').value : '';
        await q(sb.from('dem_task_updates').insert({ task_id: t.id, autor_id: S.me.id, tipo, texto, progresso: novo === 'concluida' ? 100 : null, horas_gastas: h === '' ? null : Number(h) }));
      }
      Modal.close(); toast(`Status: ${ST[novo].l}.`, 'ok');
      await App.refresh(); if (this.atual) { await this.carregar(); this.render(); }
    }).catch(e => { er.textContent = msgErro(e); });
  },
  // usado pelo Kanban (arrastar/menu)
  async mudarStatus(t, novo) {
    if (!S.me) { App.escolherUsuario(); return; }
    if (t.status === novo) return;
    if (['bloqueada', 'concluida', 'em_revisao', 'aguardando_terceiros'].includes(novo) || t.status === 'bloqueada' || t.status === 'concluida') {
      this.atual = t.id; this.formStatus(novo);
      Modal._onClose = () => { if (!$('drawer').hidden) return; this.atual = null; };
      return;
    }
    try {
      const upd = { status: novo, atualizado_por: S.me.id };
      if (novo === 'em_andamento' && !t.data_inicio) upd.data_inicio = hojeISO();
      await q(sb.from('dem_tasks').update(upd).eq('id', t.id));
      toast(`${t.codigo} → ${ST[novo].l}`, 'ok');
      await App.refresh();
    } catch (e) { toast(msgErro(e), 'bad'); }
  },

  formAjuda() {
    const t = this.t; if (!t) return;
    Modal.open(`${Modal.head('Pedir ajuda ao gestor · ' + t.codigo)}<div class="modal-b">
      <div class="fg"><label for="a-txt">Do que você precisa? <span class="req">*</span></label><textarea class="ta" id="a-txt" autofocus></textarea></div>
      <div class="err" id="a-err"></div></div>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="a-save" onclick="Tarefa.salvarAjuda()">Pedir ajuda</button></div>`, { small: true });
  },
  async salvarAjuda() {
    const t = this.t; const txt = $('a-txt').value.trim();
    if (txt.length < 10) { $('a-err').textContent = 'Descreva o pedido (mínimo 10 caracteres).'; return; }
    await comCarregando($('a-save'), async () => {
      await q(sb.from('dem_tasks').update({ ajuda_solicitada: true, atualizado_por: S.me.id }).eq('id', t.id));
      await q(sb.from('dem_task_updates').insert({ task_id: t.id, autor_id: S.me.id, tipo: 'ajuda', texto: txt }));
      Modal.close(); toast('Pedido de ajuda registrado. Ele aparece em "Atenção do Gestor".', 'ok'); await this.recarregar();
    }).catch(e => { $('a-err').textContent = msgErro(e); });
  },

  formCobranca() {
    const t = this.t; if (!t) return;
    Modal.open(`${Modal.head('Cobrar atualização · ' + t.codigo)}<div class="modal-b">
      <div class="fg"><label for="c-txt">Mensagem para ${esc(nomeDe(t.responsavel_id))}</label><textarea class="ta" id="c-txt">Por favor, registre uma atualização sobre o andamento desta demanda.</textarea></div>
      <p class="hint">Fica registrada nos comentários e no histórico da demanda. O sistema não envia e-mail nem mensagem externa.</p></div>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="c-save" onclick="Tarefa.salvarCobranca()">Registrar cobrança</button></div>`, { small: true });
  },
  async salvarCobranca() {
    const t = this.t; const txt = $('c-txt').value.trim(); if (txt.length < 2) return;
    await comCarregando($('c-save'), async () => {
      await q(sb.from('dem_task_comments').insert({ task_id: t.id, autor_id: S.me.id, tipo: 'cobranca', texto: txt }));
      Modal.close(); toast('Cobrança registrada.', 'ok'); this.aba = 'comentarios'; await this.recarregar();
    }).catch(() => {});
  },

  async comentar(btn) {
    const t = this.t; const txt = $('novo-com').value.trim();
    if (!S.me) { App.escolherUsuario(); return; }
    if (txt.length < 2) { toast('Escreva o comentário.', 'bad'); return; }
    await comCarregando(btn, async () => {
      await q(sb.from('dem_task_comments').insert({ task_id: t.id, autor_id: S.me.id, texto: txt }));
      await this.recarregar();
    }).catch(() => {});
  },

  // checklist
  async marcarItem(id, feito) {
    try { await q(sb.from('dem_task_checklists').update({ feito, feito_por: feito && S.me ? S.me.id : null }).eq('id', id)); await this.recarregar(); }
    catch (e) { toast(msgErro(e), 'bad'); }
  },
  async addItem() {
    const el = $('novo-item'); const txt = el.value.trim(); if (txt.length < 2) return;
    try { await q(sb.from('dem_task_checklists').insert({ task_id: this.atual, texto: txt, ordem: (this.dados.chk.length || 0) })); await this.recarregar(); }
    catch (e) { toast(msgErro(e), 'bad'); }
  },
  async removerItem(id) {
    if (!await confirmar('Remover esta etapa do checklist?', { ok: 'Remover', perigo: true })) return;
    try { await q(sb.from('dem_task_checklists').delete().eq('id', id)); await this.recarregar(); } catch (e) { toast(msgErro(e), 'bad'); }
  },

  // anexos
  formAnexo() {
    Modal.open(`${Modal.head('Adicionar link')}<div class="modal-b">
      <div class="fg"><label for="x-nome">Nome</label><input class="inp" id="x-nome" placeholder="Ex.: Planilha de clientes offline" autofocus></div>
      <div class="fg"><label for="x-url">Endereço (https://...)</label><input class="inp" id="x-url" placeholder="https://"></div>
      <div class="err" id="x-err"></div></div>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="x-save" onclick="Tarefa.salvarAnexo()">Adicionar</button></div>`, { small: true });
  },
  async salvarAnexo(nome, url) {
    nome = nome || $('x-nome').value.trim(); url = url || $('x-url').value.trim();
    if (!/^https?:\/\//i.test(url)) { $('x-err').textContent = 'Informe um endereço começando com http:// ou https://'; return; }
    try {
      await q(sb.from('dem_task_attachments').insert({ task_id: this.atual, nome: nome || url, url, enviado_por: S.me ? S.me.id : null }));
      if (Modal.isOpen()) Modal.close(); toast('Anexo adicionado.', 'ok'); await this.recarregar();
    } catch (e) { const el = $('x-err'); if (el) el.textContent = msgErro(e); else toast(msgErro(e), 'bad'); }
  },
  async enviarArquivo(input) {
    const f = input.files[0]; if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast('Arquivo maior que 20 MB.', 'bad'); return; }
    toast('Enviando arquivo...');
    try {
      const path = `demandas/${this.atual}/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await sb.storage.from('documentos').upload(path, f, { upsert: false, contentType: f.type || undefined });
      if (up.error) throw up.error;
      const { data } = sb.storage.from('documentos').getPublicUrl(path);
      await this.salvarAnexo(f.name, data.publicUrl);
    } catch (e) { toast('Não foi possível enviar o arquivo: ' + msgErro(e) + ' Use "+ Link" como alternativa.', 'bad'); }
    input.value = '';
  },
  async removerAnexo(id) {
    if (!await confirmar('Remover este anexo? A remoção fica registrada no histórico.', { ok: 'Remover', perigo: true })) return;
    try { await q(sb.from('dem_task_attachments').delete().eq('id', id)); await this.recarregar(); } catch (e) { toast(msgErro(e), 'bad'); }
  },

  // outros
  duplicar() {
    const t = this.t; if (!t) return;
    const chk = (this.dados && this.dados.chk || []).map(c => c.texto);
    this.abrirForm({ copiaDe: { titulo: t.titulo + ' (cópia)', descricao: t.descricao, categoria: t.categoria, department_id: t.department_id,
      responsavel_id: t.responsavel_id, prioridade: t.prioridade, complexidade: t.complexidade, esforco_estimado_horas: t.esforco_estimado_horas,
      motivo: t.motivo, resultado_esperado: t.resultado_esperado, participantes: t.participantes || [], data_inicio: hojeISO(), prazo: '' }, checklist: chk });
  },
  async arquivar(sim) {
    const t = this.t;
    if (sim && !await confirmar(`Arquivar ${t.codigo}? Ela sai do quadro e dos indicadores, mas continua no histórico e pode ser restaurada.`, { ok: 'Arquivar', perigo: true })) return;
    try { await q(sb.from('dem_tasks').update({ arquivada: sim, atualizado_por: S.me ? S.me.id : null }).eq('id', t.id)); toast(sim ? 'Demanda arquivada.' : 'Demanda restaurada.', 'ok'); await this.recarregar(); }
    catch (e) { toast(msgErro(e), 'bad'); }
  },
  async excluirDemo() {
    const t = this.t;
    if (!await confirmar(`Excluir a demanda de demonstração ${t.codigo}? Esta ação não pode ser desfeita.`, { ok: 'Excluir', perigo: true })) return;
    try {
      await q(sb.from('dem_tasks').delete().eq('id', t.id).eq('is_demo', true));
      await q(sb.from('dem_task_history').delete().eq('task_id', t.id).eq('is_demo', true));
      this.fechar(); toast('Demonstração excluída.', 'ok'); await App.refresh();
    } catch (e) { toast(msgErro(e), 'bad'); }
  },
};
