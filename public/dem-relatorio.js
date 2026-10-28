/* Servis — Demandas: Relatório Diário (atividades do dia + movimentação das demandas) */
'use strict';
(function () {
  ICON.diario = '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>';
  if (!PAGES.some(p => p.id === 'diario')) PAGES.splice(PAGES.findIndex(p => p.id === 'minhas') + 1, 0, { id: 'diario', l: 'Relatório Diário', i: 'diario', sec: 'Visão geral' });

  const _sub = Paginas.subtitulo.bind(Paginas);
  Paginas.subtitulo = p => p === 'diario' ? 'O que cada pessoa fez no dia: atividades registradas e demandas movimentadas' : _sub(p);

  const R = { dia: hojeISO(), pessoa: '' };
  const ACAO = { criada: 'Criou', status_alterado: 'Status', prazo_alterado: 'Mudou o prazo', prioridade_alterada: 'Mudou a prioridade', responsavel_alterado: 'Mudou o responsável', atualizacao: 'Registrou atualização', comentario: 'Comentou', cobranca: 'Cobrou', bloqueada: 'Bloqueou', arquivada: 'Arquivou', editada: 'Editou' };
  const hora = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diaSemana = iso => { const s = dataLocal(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const podeEditar = l => S.me && (S.me.id === l.pessoa_id || ehGestor());

  function mudarDia(delta) { const d = dataLocal(R.dia); d.setDate(d.getDate() + delta); R.dia = isoDe(d); App.render(); }

  Paginas.diario = async function () {
    const o = (v, l, s) => `<option value="${esc(v)}" ${String(s) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
    const ativos = S.profiles.filter(p => p.ativo);
    const ehHoje = R.dia === hojeISO();
    $('view').innerHTML = `
      <div class="filters">
        <button class="btn btn-sm" onclick="Diario.mudarDia(-1)" aria-label="Dia anterior">‹</button>
        <input class="inp" type="date" value="${R.dia}" onchange="Diario.R.dia=this.value||hojeISO();App.render()" aria-label="Dia">
        <button class="btn btn-sm" onclick="Diario.mudarDia(1)" aria-label="Próximo dia">›</button>
        ${ehHoje ? '' : '<button class="btn btn-sm" onclick="Diario.R.dia=hojeISO();App.render()">Hoje</button>'}
        <select class="sel" onchange="Diario.R.pessoa=this.value;App.render()" aria-label="Pessoa">${o('', 'Todas as pessoas', R.pessoa)}${ativos.map(p => o(p.id, p.nome, R.pessoa)).join('')}</select>
        <span class="small muted">${esc(diaSemana(R.dia))}</span>
      </div>
      <div id="td-box"></div>
      ${S.me ? `<div class="card mb"><div class="card-h"><h3>Registrar atividade${ehHoje ? '' : ' em ' + fmtData(R.dia)}</h3><span class="small muted">como ${esc(S.me.nome)}</span></div><div class="card-b">
        <textarea class="inp" id="dr-txt" rows="3" style="width:100%;resize:vertical" placeholder="O que você fez? Uma atividade por linha. Ex.: Conferi os e-mails das seguradoras"></textarea>
        <div class="row" style="justify-content:space-between;margin-top:8px;gap:8px;flex-wrap:wrap"><span class="small muted">Dica: também dá para escrever no botão <b>Assistente</b> (ex.: "registra que liguei pro Cond. X").</span>
        <button class="btn btn-primary btn-sm" onclick="Diario.adicionar(this)">Adicionar</button></div></div></div>` : ''}
      <div id="dr-box"><div class="card"><div class="empty"><div class="spin" style="margin:auto"></div></div></div></div>`;
    carregarTarefas();
    try {
      const ini = dataLocal(R.dia), fim = new Date(ini); fim.setDate(fim.getDate() + 1);
      let ql = sb.from('dem_daily_log').select('*').eq('data', R.dia).order('created_at');
      let qh = sb.from('dem_task_history').select('*').gte('created_at', ini.toISOString()).lt('created_at', fim.toISOString()).not('ator_id', 'is', null).order('created_at');
      if (R.pessoa) { ql = ql.eq('pessoa_id', R.pessoa); qh = qh.eq('ator_id', R.pessoa); }
      if (!S.showDemo) qh = qh.eq('is_demo', false);
      let qt = sb.from('dem_daily_todo').select('pessoa_id,feito').eq('data', R.dia);
      if (R.pessoa) qt = qt.eq('pessoa_id', R.pessoa);
      const [logs, hist, tods] = await Promise.all([q(ql), q(qh), q(qt).catch(() => [])]);
      const box = $('dr-box'); if (!box || App.page !== 'diario') return;
      const pessoas = (R.pessoa ? [perfil(R.pessoa)] : ativos).filter(Boolean);
      const dados = pessoas.map(p => {
        const at = logs.filter(l => l.pessoa_id === p.id);
        const hs = hist.filter(h => h.ator_id === p.id && h.acao !== 'migrada');
        const porTarefa = {}; hs.forEach(h => { (porTarefa[h.task_id] = porTarefa[h.task_id] || []).push(h); });
        const concl = hs.filter(h => h.acao === 'status_alterado' && h.valor_novo === 'concluida').length;
        const td = tods.filter(t => t.pessoa_id === p.id);
        return { p, at, porTarefa, nTarefas: Object.keys(porTarefa).length, concl, tdTot: td.length, tdOk: td.filter(t => t.feito).length };
      });
      const comAlgo = dados.filter(d => d.at.length || d.nTarefas);
      const semNada = dados.filter(d => !d.at.length && !d.nTarefas);
      const tot = k => dados.reduce((s, d) => s + (k === 'at' ? d.at.length : d[k]), 0);
      const resumoAcoes = hs => {
        const partes = []; hs.forEach(h => {
          let t = ACAO[h.acao] || h.acao.replace(/_/g, ' ');
          if (h.acao === 'status_alterado') t = '→ ' + ((ST[h.valor_novo] || {}).l || h.valor_novo);
          if (!partes.includes(t)) partes.push(t);
        }); return partes.join(' · ');
      };
      box.innerHTML = `
        <div class="kpis mb">
          <div class="kpi"><div class="kpi-l">Atividades registradas</div><div class="kpi-v">${tot('at')}</div></div>
          <div class="kpi"><div class="kpi-l">Demandas movimentadas</div><div class="kpi-v">${tot('nTarefas')}</div></div>
          <div class="kpi"><div class="kpi-l">Demandas concluídas</div><div class="kpi-v" style="color:var(--ok,#16a34a)">${tot('concl')}</div></div>
          <div class="kpi"><div class="kpi-l">Pessoas com registro</div><div class="kpi-v">${comAlgo.length}<small class="muted" style="font-size:14px"> / ${dados.length}</small></div></div>
        </div>
        ${comAlgo.map(d => `<div class="card mb"><div class="card-h"><div class="row">${avatar(d.p, 30)}<h3>${esc(d.p.nome)}</h3>
            ${d.tdTot ? `<span class="tag" style="color:${d.tdOk === d.tdTot ? '#16a34a' : '#d97706'};background:${d.tdOk === d.tdTot ? '#16a34a' : '#d97706'}14" title="Tarefas do dia concluídas">✓ ${d.tdOk}/${d.tdTot} tarefas</span>` : ''}<span class="tag">${d.at.length} atividade(s)</span><span class="tag">${d.nTarefas} demanda(s)</span>${d.concl ? `<span class="tag" style="color:#16a34a;background:#16a34a14">${d.concl} concluída(s)</span>` : ''}</div></div>
          <div class="card-b" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px">
            <div><div class="small muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Atividades do dia</div>
              ${d.at.length ? `<ul style="list-style:none;margin:0;padding:0">${d.at.map(l => `<li style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line,#e3e8ef)">
                <span class="small muted" style="min-width:40px">${hora(l.created_at)}</span>
                <span style="flex:1;white-space:pre-wrap">${esc(l.texto)}${l.origem === 'assistente' ? ' <span class="tag" title="Registrado pelo Assistente">IA</span>' : ''}</span>
                ${podeEditar(l) ? `<span style="white-space:nowrap"><button class="icon-btn" title="Editar" onclick="Diario.editar(${l.id})">✎</button><button class="icon-btn" title="Excluir" onclick="Diario.excluir(${l.id})">🗑</button></span>` : ''}</li>`).join('')}</ul>`
                : '<div class="small muted">Nenhuma atividade escrita.</div>'}</div>
            <div><div class="small muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Demandas no dia</div>
              ${d.nTarefas ? `<ul style="list-style:none;margin:0;padding:0">${Object.entries(d.porTarefa).map(([tid, hs]) => { const t = S.tasks.find(x => x.id === Number(tid));
                return `<li style="padding:7px 0;border-bottom:1px solid var(--line,#e3e8ef);cursor:${t ? 'pointer' : 'default'}" ${t ? `onclick="Tarefa.abrir(${t.id})"` : ''}>
                  <span class="code">${t ? esc(t.codigo) : '#' + tid}</span> ${t ? esc(t.titulo) : ''}<div class="small muted">${esc(resumoAcoes(hs))}</div></li>`; }).join('')}</ul>`
                : '<div class="small muted">Nenhuma demanda movimentada.</div>'}</div>
          </div></div>`).join('')}
        ${!comAlgo.length ? '<div class="card mb"><div class="empty">Nada registrado neste dia ainda.</div></div>' : ''}
        ${semNada.length && comAlgo.length ? `<div class="small muted">Sem registro neste dia: ${semNada.map(d => esc(d.p.nome)).join(', ')}.</div>` : ''}`;
    } catch (e) {
      const box = $('dr-box'); if (box) box.innerHTML = `<div class="alert alert-bad">${esc(msgErro(e))}</div>`;
    }
  };

  async function adicionar(btn) {
    const linhas = String(($('dr-txt') || {}).value || '').split('\n').map(s => s.trim()).filter(s => s.length >= 3);
    if (!linhas.length) { toast('Escreva a atividade (mínimo 3 letras).', 'bad'); return; }
    await comCarregando(btn, async () => {
      await q(sb.from('dem_daily_log').insert(linhas.map(texto => ({ data: R.dia, pessoa_id: S.me.id, texto, origem: 'manual' }))));
      toast(linhas.length > 1 ? `${linhas.length} atividades registradas.` : 'Atividade registrada.', 'ok');
    });
    App.render();
  }
  async function editar(id) {
    const l = (await q(sb.from('dem_daily_log').select('*').eq('id', id)))[0]; if (!l) return;
    Modal.open(`${Modal.head('Editar atividade')}<div class="modal-b"><textarea class="inp" id="dr-ed" rows="4" style="width:100%">${esc(l.texto)}</textarea></div>
      <div class="modal-f"><button class="btn" onclick="Modal.close()">Cancelar</button><button class="btn btn-primary" id="dr-ok">Salvar</button></div>`, { small: true });
    $('dr-ok').onclick = async () => {
      const t = $('dr-ed').value.trim(); if (t.length < 3) { toast('Mínimo 3 letras.', 'bad'); return; }
      await comCarregando($('dr-ok'), () => q(sb.from('dem_daily_log').update({ texto: t, updated_at: new Date().toISOString() }).eq('id', id)));
      Modal.close(); App.render();
    };
  }
  async function excluir(id) {
    if (!(await confirmar('Excluir esta atividade do relatório?', { ok: 'Excluir', perigo: true }))) return;
    try { await q(sb.from('dem_daily_log').delete().eq('id', id)); toast('Atividade excluída.', 'ok'); App.render(); } catch (e) { toast(msgErro(e), 'bad'); }
  }

  // atualiza a tela quando alguém (ou o Assistente) registra algo
  try {
    if (typeof sb.channel === 'function') sb.channel('dem-diario').on('postgres_changes', { event: '*', schema: 'public', table: 'dem_daily_log' }, () => {
      if (App.page === 'diario' && !Modal.isOpen() && !(($('dr-txt') || {}).value || '').trim()) { clearTimeout(window.__drT); window.__drT = setTimeout(() => App.render(), 800); }
    }).subscribe();
  } catch (e) {}

  // ---------- Tarefas do dia (lembretes que não podem ser esquecidos) ----------
  const TD = { pend: 0, avisado: false };
  async function carregarTarefas() {
    const box = $('td-box'); if (!box) return;
    const pid = R.pessoa || (S.me && S.me.id);
    if (!pid) { box.innerHTML = ''; return; }
    const hoje = hojeISO(), ehHoje = R.dia === hoje;
    const pode = S.me && (S.me.id === pid || ehGestor());
    let lista = [];
    try {
      let qy = sb.from('dem_daily_todo').select('*').eq('pessoa_id', pid).order('data').order('created_at');
      qy = ehHoje ? qy.or(`data.eq.${hoje},and(data.lt.${hoje},feito.is.false)`) : qy.eq('data', R.dia);
      lista = await q(qy);
    } catch (e) { box.innerHTML = `<div class="alert alert-bad mb">${esc(msgErro(e))}</div>`; return; }
    if (!$('td-box') || App.page !== 'diario') return;
    const ok = lista.filter(t => t.feito).length;
    const titulo = R.dia === hoje ? 'Tarefas de hoje' : R.dia > hoje ? 'Tarefas planejadas para ' + fmtData(R.dia) : 'Tarefas de ' + fmtData(R.dia);
    $('td-box').innerHTML = `<div class="card mb" style="border-left:4px solid ${lista.length && ok === lista.length ? 'var(--ok)' : 'var(--warn)'}">
      <div class="card-h"><h3>📋 ${titulo}</h3><span class="small muted">${esc(nomeDe(pid))} · ${ok} de ${lista.length} concluída(s)</span></div>
      <div class="card-b">
        ${lista.length ? lista.map(t => {
          const atraso = !t.feito && t.data < hoje ? `<span class="tag tag-late" title="Ficou pendente">desde ${fmtData(t.data)}</span>` : '';
          return `<label class="chk${t.feito ? ' done' : ''}"><input type="checkbox" ${t.feito ? 'checked' : ''} ${pode ? '' : 'disabled'} onchange="Diario.marcar(${t.id}, this.checked)"><span>${esc(t.texto)}</span>${atraso}${pode ? `<button class="icon-btn" title="Excluir tarefa" onclick="event.preventDefault();Diario.excluirTarefa(${t.id})">✕</button>` : ''}</label>`;
        }).join('') : `<div class="small muted" style="padding:4px 0 8px">Nenhuma tarefa ${R.dia >= hoje ? 'para este dia ainda' : 'neste dia'}.</div>`}
        ${pode ? `<div class="row" style="gap:8px;margin-top:10px"><input class="inp" id="td-txt" style="flex:1" placeholder="Nova tarefa${R.dia === hoje ? ' para hoje' : ''}... (Enter para adicionar)" onkeydown="if(event.key==='Enter'){event.preventDefault();Diario.addTarefa()}"><button class="btn btn-sm" onclick="Diario.addTarefa()">Adicionar</button></div>
        <div class="small muted" style="margin-top:6px">O que não for marcado continua aparecendo nos dias seguintes até ser concluído.</div>` : ''}
      </div></div>`;
  }
  async function addTarefa() {
    const el = $('td-txt'); const texto = String((el || {}).value || '').trim();
    if (texto.length < 3) { toast('Escreva a tarefa (mínimo 3 letras).', 'bad'); return; }
    const pid = R.pessoa || (S.me && S.me.id);
    try { await q(sb.from('dem_daily_todo').insert({ data: R.dia, pessoa_id: pid, texto })); toast('Tarefa adicionada.', 'ok'); }
    catch (e) { toast(msgErro(e), 'bad'); return; }
    await carregarTarefas(); contarPend(); const n = $('td-txt'); if (n) n.focus();
  }
  async function marcar(id, feito) {
    try { await q(sb.from('dem_daily_todo').update({ feito, feito_em: feito ? new Date().toISOString() : null }).eq('id', id)); }
    catch (e) { toast(msgErro(e), 'bad'); }
    await carregarTarefas(); contarPend();
  }
  async function excluirTarefa(id) {
    if (!(await confirmar('Excluir esta tarefa?', { ok: 'Excluir', perigo: true }))) return;
    try { await q(sb.from('dem_daily_todo').delete().eq('id', id)); } catch (e) { toast(msgErro(e), 'bad'); }
    await carregarTarefas(); contarPend();
  }
  // contador no menu + aviso ao abrir o sistema
  async function contarPend() {
    if (!S.me) return;
    try {
      const r = await sb.from('dem_daily_todo').select('id', { count: 'exact', head: true }).eq('pessoa_id', S.me.id).eq('feito', false).lte('data', hojeISO());
      TD.pend = r.count || 0;
    } catch (e) { return; }
    App.renderNav();
    if (!TD.avisado && TD.pend > 0) { TD.avisado = true; toast(`Você tem ${TD.pend} tarefa(s) do dia pendente(s). Veja em Relatório Diário.`, ''); }
  }
  const _renderNav = App.renderNav.bind(App);
  App.renderNav = function () {
    _renderNav();
    const a = document.querySelector('#side-nav a[href="#/diario"]');
    if (a && TD.pend > 0 && !a.querySelector('.cnt')) a.insertAdjacentHTML('beforeend', `<span class="cnt bad" title="Tarefas do dia pendentes">${TD.pend}</span>`);
  };
  (function esperarUsuario() { if (S.me && S.loadedAt) { contarPend(); setInterval(contarPend, 120000); } else setTimeout(esperarUsuario, 1500); })();
  try {
    if (typeof sb.channel === 'function') sb.channel('dem-todo').on('postgres_changes', { event: '*', schema: 'public', table: 'dem_daily_todo' }, () => {
      clearTimeout(window.__tdT); window.__tdT = setTimeout(() => { contarPend(); if (App.page === 'diario' && !(($('td-txt') || {}).value || '').trim()) carregarTarefas(); }, 800);
    }).subscribe();
  } catch (e) {}

  window.Diario = { R, mudarDia, adicionar, editar, excluir, addTarefa, marcar, excluirTarefa, contarPend };
})();
