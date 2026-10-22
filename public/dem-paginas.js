/* Servis — Demandas: páginas */
'use strict';

// ---------- filtros e listas compartilhados ----------
function aplicarFiltros(lista, f) {
  const qn = norm(f.q || '');
  return lista.filter(t => {
    if (qn) {
      const alvo = norm([t.codigo, t.titulo, t.descricao, t.categoria, nomeDe(t.responsavel_id)].join(' '));
      if (!alvo.includes(qn)) return false;
    }
    if (f.resp && !envolve(t, f.resp)) return false;
    if (f.prio && t.prioridade !== f.prio) return false;
    if (f.cat && t.categoria !== f.cat) return false;
    if (f.dep && String(t.department_id) !== String(f.dep)) return false;
    if (f.status && t.status !== f.status) return false;
    if (!f.fechadas && !aberta(t)) return false;
    switch (f.flag) {
      case 'atrasadas': return atrasada(t);
      case 'proximas': return proxima(t);
      case 'sem_atualizacao': return semAtualizacao(t);
      case 'criticas': return aberta(t) && t.prioridade === 'critica';
      case 'alta': return aberta(t) && (t.prioridade === 'critica' || t.prioridade === 'alta');
      case 'bloqueadas': return t.status === 'bloqueada';
      case 'ajuda': return aberta(t) && t.ajuda_solicitada;
      case 'abertas': return aberta(t);
      case 'concluidas': return t.status === 'concluida';
      case 'demo': return t.is_demo;
    }
    return true;
  });
}
const ORDENS = {
  prazo: (a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || PRIO[b.prioridade].w - PRIO[a.prioridade].w,
  prioridade: (a, b) => PRIO[b.prioridade].w - PRIO[a.prioridade].w || (a.prazo || '9999').localeCompare(b.prazo || '9999'),
  responsavel: (a, b) => nomeDe(a.responsavel_id).localeCompare(nomeDe(b.responsavel_id)) || ORDENS.prazo(a, b),
  atualizacao: (a, b) => String(ultimaMov(a)).localeCompare(String(ultimaMov(b))),
  recentes: (a, b) => b.id - a.id,
};
const FLAGS = { atrasadas: 'Atrasadas', proximas: 'Prazo próximo', sem_atualizacao: 'Sem atualização', criticas: 'Críticas abertas', alta: 'Alta prioridade (abertas)', bloqueadas: 'Bloqueadas', ajuda: 'Pediram ajuda', abertas: 'Abertas', concluidas: 'Concluídas', demo: 'Demonstração' };

function linhaTabela(t, cols = 'padrao') {
  const ult = t.ultima_atualizacao_em ? fmtRel(t.ultima_atualizacao_em) : '<span class="muted">nenhuma</span>';
  return `<tr onclick="Tarefa.abrir(${t.id})">
    <td class="code">${esc(t.codigo)}</td>
    <td><div class="tt" title="${esc(t.titulo)}">${esc(t.titulo)}</div><div class="row" style="gap:4px;margin-top:2px">${tagsAlerta(t)}${t.qtd_subtarefas ? `<span class="tag">${t.qtd_subtarefas} subtarefa(s)</span>` : ''}</div></td>
    <td><div class="row" style="flex-wrap:nowrap">${avatar(t.responsavel_id, 22)}<span>${esc(nomeDe(t.responsavel_id))}</span></div></td>
    <td>${tagPrio(t.prioridade)}</td>
    <td>${tagStatus(t.status)}</td>
    <td style="white-space:nowrap">${fmtData(t.prazo)}</td>
    <td style="min-width:90px"><div class="prog${t.status === 'concluida' ? ' ok' : ''}"><i style="width:${t.progresso}%"></i></div><span class="small muted">${t.progresso}%</span></td>
    <td class="small" style="white-space:nowrap">${ult}</td>
  </tr>`;
}
function tabelaTarefas(lista, { paginar = true, pagina = 1, onPage = '', vazio = 'Nenhuma demanda encontrada.' } = {}) {
  if (!lista.length) return `<div class="empty">${esc(vazio)}</div>`;
  const POR = 25, total = lista.length, pags = Math.max(1, Math.ceil(total / POR));
  const p = Math.min(Math.max(1, pagina), pags);
  const fatia = paginar ? lista.slice((p - 1) * POR, p * POR) : lista;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Demanda</th><th>Responsável</th><th>Prioridade</th><th>Status</th><th>Prazo</th><th>Progresso</th><th>Últ. atualização</th></tr></thead>
    <tbody>${fatia.map(t => linhaTabela(t)).join('')}</tbody></table></div>
    ${paginar && pags > 1 ? `<div class="pager">${(p - 1) * POR + 1}–${Math.min(p * POR, total)} de ${total}
      <button class="btn btn-sm" ${p <= 1 ? 'disabled' : ''} onclick="${onPage}(${p - 1})">‹ Anterior</button>
      <button class="btn btn-sm" ${p >= pags ? 'disabled' : ''} onclick="${onPage}(${p + 1})">Próxima ›</button></div>` : ''}`;
}
function cardKanban(t) {
  const pc = PRIO[t.prioridade].c;
  const chk = t.qtd_checklist ? ` · ☑ ${t.qtd_checklist_feito}/${t.qtd_checklist}` : '';
  return `<article class="kcard" draggable="true" style="--pc:${pc}" data-id="${t.id}" onclick="Tarefa.abrir(${t.id})"
      ondragstart="Paginas.drag(event, ${t.id})" ondragend="this.classList.remove('dragging')">
    <div class="row" style="gap:4px"><span class="code">${esc(t.codigo)}</span>${tagPrio(t.prioridade)}<span class="spacer"></span>
      <button class="kmenu" onclick="event.stopPropagation();Paginas.menuStatus(${t.id}, this)" aria-label="Mudar status de ${esc(t.codigo)}">⋯</button></div>
    <div class="kcard-t">${esc(t.titulo)}</div>
    <div class="kcard-m">${tagsAlerta(t)}${t.prazo ? `<span>📅 ${fmtData(t.prazo)}</span>` : ''}</div>
    ${t.progresso > 0 || t.status === 'em_andamento' ? `<div class="prog" style="margin-top:8px"><i style="width:${t.progresso}%"></i></div>` : ''}
    <div class="kcard-f"><span class="who">${avatar(t.responsavel_id, 22)}<span>${esc(nomeDe(t.responsavel_id))}</span></span>
      ${t.qtd_comentarios ? `<span title="Comentários">💬 ${t.qtd_comentarios}</span>` : ''}<span title="Última atualização">${t.ultima_atualizacao_em ? '⟳ ' + fmtRel(t.ultima_atualizacao_em) : '⟳ —'}${chk}</span></div>
  </article>`;
}
function barraFiltros(f, onchange, { mostrarResp = true, mostrarStatus = true } = {}) {
  const o = (v, l, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  return `<button class="btn btn-sm only-mobile" style="margin-bottom:10px" onclick="Paginas.filtrosAbertos=!Paginas.filtrosAbertos;this.nextElementSibling.classList.toggle('open')">Filtros ▾</button>
  <div class="filters collapsible${Paginas.filtrosAbertos ? ' open' : ''}">
    <input class="inp" type="search" placeholder="Buscar..." value="${esc(f.q)}" style="width:200px" aria-label="Buscar" oninput="${onchange}('q', this.value, true)">
    ${mostrarResp ? `<select class="sel" aria-label="Responsável" onchange="${onchange}('resp', this.value)">${o('', 'Todos os responsáveis', f.resp)}${S.profiles.filter(p => p.ativo).map(p => o(p.id, p.nome, f.resp)).join('')}</select>` : ''}
    <select class="sel" aria-label="Prioridade" onchange="${onchange}('prio', this.value)">${o('', 'Todas as prioridades', f.prio)}${Object.entries(PRIO).map(([k, v]) => o(k, v.l, f.prio)).join('')}</select>
    ${mostrarStatus ? `<select class="sel" aria-label="Status" onchange="${onchange}('status', this.value)">${o('', 'Todos os status', f.status)}${STATUS.map(s => o(s.k, s.l, f.status)).join('')}</select>` : ''}
    <select class="sel" aria-label="Categoria" onchange="${onchange}('cat', this.value)">${o('', 'Todas as categorias', f.cat)}${S.cats.map(c => o(c.nome, c.nome, f.cat)).join('')}</select>
    <select class="sel" aria-label="Departamento" onchange="${onchange}('dep', this.value)">${o('', 'Todos os departamentos', f.dep)}${S.deps.map(d => o(d.id, d.nome, f.dep)).join('')}</select>
    <select class="sel" aria-label="Situação" onchange="${onchange}('flag', this.value)">${o('', 'Qualquer situação', f.flag)}${Object.entries(FLAGS).map(([k, v]) => o(k, v, f.flag)).join('')}</select>
    <label class="small row" style="gap:4px"><input type="checkbox" ${f.fechadas ? 'checked' : ''} onchange="${onchange}('fechadas', this.checked)"> Incluir concluídas</label>
  </div>`;
}
function inicioSemana(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const dw = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dw); return x; }
function semanas(n) { const out = []; let s = inicioSemana(new Date()); for (let i = n - 1; i >= 0; i--) { const d = new Date(s); d.setDate(d.getDate() - 7 * i); out.push(d); } return out; }
const rotSem = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
function noIntervalo(ts, ini, fim) { if (!ts) return false; const x = new Date(ts); return x >= ini && x < fim; }

const CHART_FONT = { family: 'Inter, sans-serif', size: 11 };
if (window.Chart) { Chart.defaults.font = CHART_FONT; Chart.defaults.color = '#475569'; Chart.defaults.plugins.legend.labels.boxWidth = 10; Chart.defaults.maintainAspectRatio = false; Chart.defaults.datasets.bar.maxBarThickness = 34; }

// métricas por pessoa (usadas em Equipe e Relatórios)
function metricasPessoa(pid, lista, ini) {
  const minhas = lista.filter(t => t.responsavel_id === pid && t.status !== 'cancelada');
  const abertas = minhas.filter(aberta);
  const conclPer = minhas.filter(t => t.status === 'concluida' && t.concluida_em && (!ini || new Date(t.concluida_em) >= ini));
  const comPrazo = conclPer.filter(t => t.prazo);
  const noPrazo = comPrazo.filter(t => String(t.concluida_em).slice(0, 10) <= t.prazo);
  const ptsEnt = conclPer.reduce((s, t) => s + pontos(t), 0);
  const ptsAb = abertas.reduce((s, t) => s + pontos(t), 0);
  const tempos = conclPer.filter(t => !t.legacy_id).map(t => (new Date(t.concluida_em) - new Date(t.data_inicio ? dataLocal(t.data_inicio) : t.created_at)) / 86400000).filter(x => x >= 0);
  return {
    total: minhas.length, abertas: abertas.length, ptsAb, atrasadas: abertas.filter(atrasada).length,
    bloqueadas: abertas.filter(t => t.status === 'bloqueada').length, andamento: abertas.filter(t => t.status === 'em_andamento').length,
    pendentes: abertas.filter(t => t.status === 'nao_iniciada').length,
    concluidas: conclPer.length, ptsEnt, noPrazo: comPrazo.length ? pct(noPrazo.length, comPrazo.length) : null,
    ponderada: ptsEnt + ptsAb ? pct(ptsEnt, ptsEnt + ptsAb) : null,
    horasEst: minhas.reduce((s, t) => s + Number(t.esforco_estimado_horas || 0), 0), horasGastas: minhas.reduce((s, t) => s + Number(t.horas_gastas || 0), 0),
    tempoMedio: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null,
    semAtual: abertas.filter(semAtualizacao).length,
  };
}

// =====================================================================
const Paginas = {
  volModo: 'semana', filtrosAbertos: false,
  cal: { modo: 'mes', ref: new Date(), resp: '' },
  pessoaF: { periodo: '90', status: '', prio: '', cat: '' },
  rel: null, hist: { pagina: 0, ator: '', acao: '', de: '', ate: '', q: '' },

  subtitulo(p) {
    const vis = tarefasVisiveis();
    return {
      dashboard: `${vis.filter(aberta).length} demandas abertas · atualizado ${fmtRel(S.loadedAt)}`,
      quadro: 'Arraste os cartões entre as colunas ou use ⋯ para mudar o status',
      minhas: S.me ? `Demandas de ${S.me.nome} (responsável ou participante)` : '',
      equipe: 'Volume, conclusão, atrasos e cumprimento de prazos por pessoa',
      calendario: 'Prazos das demandas por dia',
      atrasadas: 'Prazo vencido e ainda não concluídas',
      relatorios: 'Indicadores calculados a partir dos dados registrados',
      historico: 'Todas as alterações registradas automaticamente pelo banco',
      config: 'Equipe, parâmetros, modelos e dados de demonstração',
    }[p] || '';
  },

  // ======================= DASHBOARD =======================
  dashboard() {
    const vis = tarefasVisiveis();
    const ativas = vis.filter(t => t.status !== 'cancelada');
    const cnt = s => vis.filter(t => t.status === s).length;
    const atras = vis.filter(atrasada), altas = vis.filter(t => aberta(t) && (t.prioridade === 'critica' || t.prioridade === 'alta'));
    const pessoasPend = new Set(vis.filter(aberta).map(t => t.responsavel_id));
    const k = (l, v, s, cor, acao) => `<button class="kpi" style="--k:${cor}" onclick="${acao}"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div><div class="kpi-s">${s}</div></button>`;
    const conc = cnt('concluida');
    const html = [];
    if (!vis.length) html.push(`<div class="alert alert-info">Nenhuma demanda cadastrada ainda. Clique em <b>+ Nova Demanda</b> para começar.</div>`);
    html.push(`<div class="kpis">
      ${k('Total cadastradas', ativas.length, 'sem canceladas', '#0f1e3d', "App.irLista({})")}
      ${k('Pendentes', cnt('nao_iniciada'), 'não iniciadas', ST.nao_iniciada.c, "App.irLista({status:'nao_iniciada'})")}
      ${k('Em andamento', cnt('em_andamento'), `${vis.filter(t => t.status === 'em_andamento' && semAtualizacao(t)).length} sem atualização recente`, ST.em_andamento.c, "App.irLista({status:'em_andamento'})")}
      ${k('Aguardando terceiros', cnt('aguardando_terceiros'), 'dependem de retorno', ST.aguardando_terceiros.c, "App.irLista({status:'aguardando_terceiros'})")}
      ${k('Em revisão', cnt('em_revisao'), 'aguardando validação', ST.em_revisao.c, "App.irLista({status:'em_revisao'})")}
      ${k('Concluídas', conc, `${ativas.filter(t => t.concluida_em && diasDesde(t.concluida_em) <= 7).length} nos últimos 7 dias`, ST.concluida.c, "App.irLista({status:'concluida'})")}
      ${k('Atrasadas', atras.length, 'prazo vencido', '#dc2626', "App.irLista({flag:'atrasadas'})")}
      ${k('Alta prioridade', altas.length, `${altas.filter(t => t.prioridade === 'critica').length} críticas`, PRIO.alta.c, "App.irLista({flag:'alta'})")}
      ${k('% de conclusão', pct(conc, ativas.length) + '%', `${conc} de ${ativas.length}`, '#16a34a', "App.irLista({flag:'concluidas'})")}
      ${k('Pessoas com pendências', pessoasPend.size, `de ${S.profiles.filter(p => p.ativo).length} ativas`, '#0891b2', "location.hash='#/equipe'")}
    </div>`);
    html.push(this._atencao(vis));
    html.push(`<div class="grid g3 mb">
      <div class="card"><div class="card-h"><h3>Tarefas por status</h3></div><div class="card-b"><div class="chart-box"><canvas id="c-status"></canvas></div></div></div>
      <div class="card"><div class="card-h"><h3>Distribuição das prioridades</h3><small>abertas</small></div><div class="card-b"><div class="chart-box"><canvas id="c-prio"></canvas></div></div></div>
      <div class="card"><div class="card-h"><h3>Atrasadas por responsável</h3></div><div class="card-b"><div class="chart-box"><canvas id="c-atras"></canvas></div></div></div>
    </div>
    <div class="grid g2 mb">
      <div class="card"><div class="card-h"><h3>Tarefas por colaborador</h3></div><div class="card-b"><div class="chart-box tall"><canvas id="c-pessoa"></canvas></div></div></div>
      <div class="card"><div class="card-h"><h3>Concluídas por semana</h3><small>últimas 10 semanas</small></div><div class="card-b"><div class="chart-box tall"><canvas id="c-concl"></canvas></div></div></div>
    </div>
    <div class="grid g2 mb">
      <div class="card"><div class="card-h"><h3>Volume de demandas criadas</h3>
        <div class="seg"><button class="${this.volModo === 'semana' ? 'on' : ''}" onclick="Paginas.volModo='semana';App.render()">Semana</button><button class="${this.volModo === 'mes' ? 'on' : ''}" onclick="Paginas.volModo='mes';App.render()">Mês</button></div></div>
        <div class="card-b"><div class="chart-box"><canvas id="c-vol"></canvas></div></div></div>
      <div class="card"><div class="card-h"><h3>Evolução das entregas da equipe</h3><small>acumulado · 12 semanas</small></div><div class="card-b"><div class="chart-box"><canvas id="c-evo"></canvas></div></div></div>
    </div>`);
    $('view').innerHTML = html.join('');
    this._graficosDash(vis);
  },

  _atencao(vis) {
    const ab = vis.filter(aberta);
    const lim = S.cfg.limite_abertas_por_pessoa;
    const carga = {}; ab.forEach(t => { carga[t.responsavel_id] = (carga[t.responsavel_id] || 0) + 1; });
    const excesso = Object.entries(carga).filter(([, n]) => n > lim).sort((a, b) => b[1] - a[1]);
    const box = (tit, cls, itens, flag, render) => `<div class="attn-box ${itens.length ? cls : ''}"><h4>${tit}<span class="n">${itens.length}</span></h4>
      ${itens.slice(0, 5).map(render).join('') || '<div class="small muted">Nada aqui. 👍</div>'}
      ${itens.length > 5 ? `<button class="btn btn-ghost btn-sm" onclick="${flag}">Ver todas (${itens.length})</button>` : ''}</div>`;
    const it = t => `<div class="attn-item" onclick="Tarefa.abrir(${t.id})">${avatar(t.responsavel_id, 20)}<span class="t">${esc(t.titulo)}</span>${tagsAlerta(t).replace(/<span class="tag tag-demo">DEMONSTRAÇÃO<\/span>/, '')}</div>`;
    const sort = (a, b) => (a.prazo || '').localeCompare(b.prazo || '');
    return `<div class="card mb"><div class="card-h"><h3>⚠ Atenção do Gestor</h3><small>Atualizado automaticamente · sem atualização = ${S.cfg.dias_sem_atualizacao}+ dias · prazo próximo = até ${S.cfg.dias_prazo_proximo} dias</small></div>
      <div class="card-b attn">
        ${box('Atividades vencidas', 'bad', ab.filter(atrasada).sort(sort), "App.irLista({flag:'atrasadas'})", it)}
        ${box('Próximas do prazo', 'warn', ab.filter(proxima).sort(sort), "App.irLista({flag:'proximas'})", it)}
        ${box(`Sem atualização há ${S.cfg.dias_sem_atualizacao}+ dias`, 'warn', ab.filter(semAtualizacao).sort((a, b) => String(ultimaMov(a)).localeCompare(String(ultimaMov(b)))), "App.irLista({flag:'sem_atualizacao'})",
          t => `<div class="attn-item" onclick="Tarefa.abrir(${t.id})">${avatar(t.responsavel_id, 20)}<span class="t">${esc(t.titulo)}</span><span class="tag tag-stale">${t.ultima_atualizacao_em ? fmtRel(t.ultima_atualizacao_em) : 'nunca'}</span></div>`)}
        ${box(`Excesso de atividades (> ${lim} abertas)`, 'warn', excesso, "location.hash='#/equipe'",
          ([pid, n]) => `<div class="attn-item" onclick="location.hash='#/equipe/${pid}'">${avatar(pid, 20)}<span class="t">${esc(nomeDe(pid))}</span><span class="tag tag-near">${n} abertas</span></div>`)}
        ${box('Críticas não concluídas', 'bad', ab.filter(t => t.prioridade === 'critica').sort(sort), "App.irLista({flag:'criticas'})", it)}
        ${box('Bloqueadas / pedindo ajuda', 'bad', ab.filter(t => t.status === 'bloqueada' || t.ajuda_solicitada), "App.irLista({flag:'bloqueadas'})",
          t => `<div class="attn-item" onclick="Tarefa.abrir(${t.id})">${avatar(t.responsavel_id, 20)}<span class="t" title="${esc(t.motivo_bloqueio || '')}">${esc(t.titulo)}</span>${t.status === 'bloqueada' ? '<span class="tag tag-late">Bloqueada</span>' : '<span class="tag tag-near">Ajuda</span>'}</div>`)}
      </div></div>`;
  },

  _graficosDash(vis) {
    const ativas = vis.filter(t => t.status !== 'cancelada');
    const ab = vis.filter(aberta);
    const sts = STATUS.filter(s => s.k !== 'cancelada');
    App.chart($('c-status'), { type: 'doughnut', data: { labels: sts.map(s => s.l), datasets: [{ data: sts.map(s => vis.filter(t => t.status === s.k).length), backgroundColor: sts.map(s => s.c), borderWidth: 2 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'right' } }, onClick: (e, el) => { if (el[0]) App.irLista({ status: sts[el[0].index].k }); } } });
    const ps = Object.keys(PRIO);
    App.chart($('c-prio'), { type: 'doughnut', data: { labels: ps.map(p => PRIO[p].l), datasets: [{ data: ps.map(p => ab.filter(t => t.prioridade === p).length), backgroundColor: ps.map(p => PRIO[p].c), borderWidth: 2 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'right' } }, onClick: (e, el) => { if (el[0]) App.irLista({ prio: ps[el[0].index], fechadas: false }); } } });
    const pessoas = S.profiles.filter(p => p.ativo || ativas.some(t => t.responsavel_id === p.id));
    const atrasP = pessoas.map(p => ({ p, n: ab.filter(t => t.responsavel_id === p.id && atrasada(t)).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
    App.chart($('c-atras'), { type: 'bar', data: { labels: atrasP.map(x => x.p.nome), datasets: [{ label: 'Atrasadas', data: atrasP.map(x => x.n), backgroundColor: '#dc2626', borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } } }, onClick: (e, el) => { if (el[0]) App.irLista({ resp: atrasP[el[0].index].p.id, flag: 'atrasadas' }); } } });
    const pp = pessoas.map(p => ({ p, ab: ab.filter(t => t.responsavel_id === p.id && !atrasada(t)).length, at: ab.filter(t => t.responsavel_id === p.id && atrasada(t)).length, co: ativas.filter(t => t.responsavel_id === p.id && t.status === 'concluida').length }))
      .filter(x => x.ab + x.at + x.co).sort((a, b) => (b.ab + b.at) - (a.ab + a.at));
    App.chart($('c-pessoa'), { type: 'bar', data: { labels: pp.map(x => x.p.nome), datasets: [
      { label: 'Abertas no prazo', data: pp.map(x => x.ab), backgroundColor: '#2563eb', borderRadius: 3 },
      { label: 'Atrasadas', data: pp.map(x => x.at), backgroundColor: '#dc2626', borderRadius: 3 },
      { label: 'Concluídas', data: pp.map(x => x.co), backgroundColor: '#16a34a', borderRadius: 3 }] },
      options: { indexAxis: 'y', scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } }, onClick: (e, el) => { if (el[0]) location.hash = '#/equipe/' + pp[el[0].index].p.id; } } });
    const sem = semanas(10);
    const fimSem = d => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; };
    App.chart($('c-concl'), { type: 'bar', data: { labels: sem.map(rotSem), datasets: [
      { label: 'Concluídas', data: sem.map(d => ativas.filter(t => noIntervalo(t.concluida_em, d, fimSem(d))).length), backgroundColor: '#16a34a', borderRadius: 4 },
      { label: 'No prazo', type: 'line', data: sem.map(d => ativas.filter(t => noIntervalo(t.concluida_em, d, fimSem(d)) && t.prazo && String(t.concluida_em).slice(0, 10) <= t.prazo).length), borderColor: '#0f1e3d', backgroundColor: '#0f1e3d', tension: .3 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    let labels, data;
    if (this.volModo === 'semana') {
      labels = sem.map(rotSem); data = sem.map(d => ativas.filter(t => noIntervalo(t.created_at, d, fimSem(d))).length);
    } else {
      const meses = []; const h = new Date(); for (let i = 5; i >= 0; i--) meses.push(new Date(h.getFullYear(), h.getMonth() - i, 1));
      labels = meses.map(m => m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
      data = meses.map(m => ativas.filter(t => noIntervalo(t.created_at, m, new Date(m.getFullYear(), m.getMonth() + 1, 1))).length);
    }
    App.chart($('c-vol'), { type: 'bar', data: { labels, datasets: [{ label: 'Criadas', data, backgroundColor: '#0f1e3d', borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    const s12 = semanas(12);
    App.chart($('c-evo'), { type: 'line', data: { labels: s12.map(rotSem), datasets: [
      { label: 'Criadas (acum.)', data: s12.map(d => ativas.filter(t => new Date(t.created_at) < fimSem(d)).length), borderColor: '#64748b', backgroundColor: '#64748b', tension: .3 },
      { label: 'Concluídas (acum.)', data: s12.map(d => ativas.filter(t => t.concluida_em && new Date(t.concluida_em) < fimSem(d)).length), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.12)', fill: true, tension: .3 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  },

  // ======================= QUADRO =======================
  quadro() {
    const f = S.f;
    const filtros = Object.entries({ q: f.q && `"${f.q}"`, resp: f.resp && nomeDe(f.resp), status: f.status && ST[f.status].l, prio: f.prio && PRIO[f.prio].l, flag: f.flag && FLAGS[f.flag], cat: f.cat, dep: f.dep && nomeDep(Number(f.dep)) }).filter(([, v]) => v);
    let lista = aplicarFiltros(tarefasVisiveis(), f);
    const html = [`<div class="row mb">
      <div class="seg"><button class="${f.view === 'kanban' ? 'on' : ''}" onclick="Paginas.setF('view','kanban')">Kanban</button><button class="${f.view === 'lista' ? 'on' : ''}" onclick="Paginas.setF('view','lista')">Lista</button></div>
      <span class="small muted">${lista.length} demanda(s)</span>
      ${filtros.map(([k, v]) => `<span class="chip-f">${esc(v)}<button onclick="Paginas.setF('${k}','')" aria-label="Remover filtro">✕</button></span>`).join('')}
      ${filtros.length ? `<button class="btn btn-ghost btn-sm" onclick="S.f=Object.assign(filtrosPadrao(),{view:S.f.view});App.render()">Limpar filtros</button>` : ''}
      <span class="spacer"></span>
      <label class="small">Ordenar por <select class="sel" onchange="Paginas.setF('sort', this.value)">${[['prazo', 'Prazo'], ['prioridade', 'Prioridade'], ['responsavel', 'Responsável'], ['atualizacao', 'Sem atualização há mais tempo'], ['recentes', 'Mais recentes']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>`, barraFiltros(f, 'Paginas.setF', { mostrarStatus: f.view === 'lista' })];
    lista.sort(ORDENS[f.sort] || ORDENS.prazo);
    if (f.view === 'kanban') {
      const LIM = 40;
      html.push(`<div class="kanban">${KANBAN.map(s => {
        let col = lista.filter(t => t.status === s.k);
        if (s.k === 'concluida' && !f.status) col = col.sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em)));
        const extra = col.length - LIM;
        return `<section class="kcol" data-status="${s.k}" ondragover="Paginas.over(event)" ondragleave="this.classList.remove('drag')" ondrop="Paginas.drop(event,'${s.k}')" aria-label="${esc(s.l)}">
          <div class="kcol-h"><span class="tag-dot" style="color:${s.c}"></span>${esc(s.l)}<span class="n">${col.length}</span></div>
          ${col.slice(0, LIM).map(cardKanban).join('') || '<div class="small muted" style="padding:10px;text-align:center">Arraste cartões para cá</div>'}
          ${extra > 0 ? `<button class="btn btn-sm kmore" onclick="App.irLista(Object.assign({}, S.f, {status:'${s.k}'}))">+ ${extra} na lista</button>` : ''}
        </section>`;
      }).join('')}</div>`);
    } else {
      html.push(`<div class="card">${tabelaTarefas(lista, { pagina: f.page, onPage: 'Paginas.pagQuadro' })}</div>`);
    }
    $('view').innerHTML = html.join('');
  },
  _deb: null,
  setF(k, v, debounce) {
    S.f[k] = v; if (k !== 'page') S.f.page = 1;
    if (debounce) { clearTimeout(this._deb); this._deb = setTimeout(() => { App.render(); const i = document.querySelector('.filters input[type=search]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); }
    else App.render();
  },
  pagQuadro(p) { S.f.page = p; App.render(); },
  drag(e, id) { e.dataTransfer.setData('text/plain', String(id)); e.dataTransfer.effectAllowed = 'move'; e.target.classList.add('dragging'); },
  over(e) { e.preventDefault(); e.currentTarget.classList.add('drag'); },
  drop(e, status) {
    e.preventDefault(); e.currentTarget.classList.remove('drag');
    const t = S.tasks.find(x => x.id === Number(e.dataTransfer.getData('text/plain')));
    if (t) Tarefa.mudarStatus(t, status);
  },
  menuStatus(id, btn) {
    const t = S.tasks.find(x => x.id === id);
    Modal.open(`${Modal.head('Mover ' + t.codigo + ' para...')}<div class="modal-b"><div class="who-list">
      ${STATUS.filter(s => s.k !== t.status && s.k !== 'cancelada').map(s => `<button onclick="Modal.close();Tarefa.mudarStatus(S.tasks.find(x=>x.id===${id}),'${s.k}')"><span class="tag tag-dot" style="color:${s.c};background:${s.c}14">${s.l}</span></button>`).join('')}
      ${ehGestor() && aberta(t) ? `<button onclick="Modal.close();Paginas.cancelar(${id})"><span class="tag">Cancelar demanda</span></button>` : ''}
    </div></div>`, { small: true });
  },
  async cancelar(id) {
    const t = S.tasks.find(x => x.id === id);
    if (!await confirmar(`Cancelar ${t.codigo}? Ela sai do quadro, mas continua no histórico e pode ser reaberta.`, { ok: 'Cancelar demanda', perigo: true })) return;
    try { await q(sb.from('dem_tasks').update({ status: 'cancelada', atualizado_por: S.me.id }).eq('id', id)); toast(t.codigo + ' cancelada.', 'ok'); await App.refresh(); }
    catch (e) { toast(msgErro(e), 'bad'); }
  },

  // ======================= MINHAS =======================
  minhas() {
    if (!S.me) { $('view').innerHTML = '<div class="empty">Escolha quem está usando para ver suas demandas. <br><br><button class="btn btn-primary" onclick="App.escolherUsuario()">Escolher</button></div>'; return; }
    this._pessoa(S.me.id, true);
  },

  // ======================= EQUIPE =======================
  equipe(pid) {
    if (pid) { const p = perfil(pid); if (p) { $('page-title').textContent = p.nome; $('page-sub').textContent = (p.cargo || PAPEL[p.papel]) + ' · ' + nomeDep(p.department_id); return this._pessoa(pid, false); } }
    const per = this.pessoaF.periodo;
    const ini = per === 'todos' ? null : new Date(Date.now() - Number(per) * 86400000);
    const vis = tarefasVisiveis();
    const pessoas = S.profiles.filter(p => p.ativo || vis.some(t => t.responsavel_id === p.id && aberta(t)));
    const M = pessoas.map(p => ({ p, m: metricasPessoa(p.id, vis, ini) }));
    const v = x => x == null ? '<span class="muted">—</span>' : x;
    $('view').innerHTML = `
      <div class="row mb"><span class="small muted">Período das entregas:</span>
        <div class="seg">${[['30', '30 dias'], ['90', '90 dias'], ['365', '12 meses'], ['todos', 'Tudo']].map(([k, l]) => `<button class="${per === k ? 'on' : ''}" onclick="Paginas.pessoaF.periodo='${k}';App.render()">${l}</button>`).join('')}</div></div>
      <div class="people mb">${M.map(({ p, m }) => `<div class="person" onclick="location.hash='#/equipe/${p.id}'" role="button" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">
        <div class="person-h">${avatar(p, 40)}<div><b>${esc(p.nome)}</b><span class="small muted">${esc(p.cargo || PAPEL[p.papel])}${p.ativo ? '' : ' · inativo'}</span></div></div>
        <div class="person-n"><div><b>${m.abertas}</b><span>abertas</span></div><div><b style="color:${m.atrasadas ? 'var(--bad)' : 'inherit'}">${m.atrasadas}</b><span>atrasadas</span></div>
          <div><b>${m.concluidas}</b><span>concluídas</span></div><div><b>${m.noPrazo == null ? '—' : m.noPrazo + '%'}</b><span>no prazo</span></div></div>
        ${m.semAtual ? `<div class="small" style="margin-top:8px;color:var(--warn)">${m.semAtual} aberta(s) sem atualização recente</div>` : ''}
      </div>`).join('') || '<div class="empty">Nenhum colaborador cadastrado.</div>'}</div>
      <div class="card"><div class="card-h"><h3>Comparativo da equipe</h3><small>responsável principal · entregas no período selecionado</small></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Colaborador</th><th class="num">Abertas</th><th class="num">Carga aberta (pts)</th><th class="num">Atrasadas</th><th class="num">Bloqueadas</th><th class="num">Concluídas</th><th class="num">Pontos entregues</th><th class="num">No prazo</th><th class="num">Conclusão ponderada</th><th class="num">Horas est./gastas</th><th class="num">Tempo médio</th></tr></thead>
        <tbody>${M.map(({ p, m }) => `<tr onclick="location.hash='#/equipe/${p.id}'"><td><div class="row" style="flex-wrap:nowrap">${avatar(p, 22)}${esc(p.nome)}</div></td>
          <td class="num">${m.abertas}</td><td class="num">${m.ptsAb}</td><td class="num" style="color:${m.atrasadas ? 'var(--bad)' : ''}">${m.atrasadas}</td><td class="num">${m.bloqueadas}</td>
          <td class="num">${m.concluidas}</td><td class="num">${m.ptsEnt}</td><td class="num">${v(m.noPrazo == null ? null : m.noPrazo + '%')}</td><td class="num">${v(m.ponderada == null ? null : m.ponderada + '%')}</td>
          <td class="num">${fmtNum(m.horasEst, 1)} / ${fmtNum(m.horasGastas, 1)}</td><td class="num">${v(m.tempoMedio == null ? null : fmtNum(m.tempoMedio, 1) + ' d')}</td></tr>`).join('')}</tbody></table></div>
        <div class="card-b"><p class="note"><b>Como ler:</b> <b>pontos</b> = complexidade da demanda (1 a 5), para que uma tarefa complexa não valha o mesmo que uma simples.
          <b>Conclusão ponderada</b> = pontos entregues no período ÷ (pontos entregues + pontos ainda abertos). <b>No prazo</b> considera só demandas concluídas que tinham prazo.
          <b>Tempo médio</b> vai do início (ou criação) até a conclusão e ignora demandas importadas da aba antiga. Use estes números junto com os bloqueios e a carga de cada pessoa — não isoladamente.</p></div></div>`;
  },

  _pessoa(pid, eu) {
    const p = perfil(pid);
    const F = this.pessoaF;
    const ini = F.periodo === 'todos' ? null : new Date(Date.now() - Number(F.periodo) * 86400000);
    const vis = tarefasVisiveis();
    const minhas = vis.filter(t => envolve(t, pid));
    const m = metricasPessoa(pid, vis, ini);
    let lista = minhas.filter(t => (!F.status || t.status === F.status) && (!F.prio || t.prioridade === F.prio) && (!F.cat || t.categoria === F.cat)
      && (!ini || new Date(t.created_at) >= ini || aberta(t) || (t.concluida_em && new Date(t.concluida_em) >= ini)));
    lista.sort(ORDENS.prazo);
    const agora = minhas.filter(t => t.status === 'em_andamento');
    const prox = minhas.filter(t => aberta(t) && t.prazo).sort(ORDENS.prazo).slice(0, 6);
    const bloq = minhas.filter(t => t.status === 'bloqueada');
    const entregas = minhas.filter(t => t.status === 'concluida').sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em))).slice(0, 8);
    const k = (l, v, cor, acao) => `<button class="kpi" style="--k:${cor}" onclick="${acao}"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div></button>`;
    const sel = (campo, opts) => `<select class="sel" onchange="Paginas.pessoaF.${campo}=this.value;App.render()">${opts.map(([v, l]) => `<option value="${v}" ${F[campo] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    $('view').innerHTML = `
      ${eu ? '' : `<div class="row mb"><a class="btn btn-sm" href="#/equipe">‹ Equipe</a></div>`}
      <div class="card mb"><div class="card-b row">${avatar(p, 52)}<div><h2 style="font-size:20px;color:var(--navy)">${esc(p.nome)}</h2><div class="muted small">${esc(p.cargo || PAPEL[p.papel])} · ${esc(nomeDep(p.department_id))}</div></div>
        <span class="spacer"></span>${ehGestor() || eu ? `<button class="btn btn-primary" onclick="Tarefa.abrirForm({responsavel_id:'${pid}'})">+ Demanda para ${esc(p.nome.split(' ')[0])}</button>` : ''}</div></div>
      <div class="kpis">
        ${k('Total atribuídas', m.total, '#0f1e3d', `Paginas.pessoaF.status='';App.render()`)}
        ${k('Pendentes', m.pendentes, ST.nao_iniciada.c, `Paginas.pessoaF.status='nao_iniciada';App.render()`)}
        ${k('Em andamento', m.andamento, ST.em_andamento.c, `Paginas.pessoaF.status='em_andamento';App.render()`)}
        ${k('Atrasadas', m.atrasadas, '#dc2626', `App.irLista({resp:'${pid}',flag:'atrasadas'})`)}
        ${k('Concluídas no período', m.concluidas, ST.concluida.c, `Paginas.pessoaF.status='concluida';App.render()`)}
        ${k('Conclusão ponderada', m.ponderada == null ? '—' : m.ponderada + '%', '#16a34a', '')}
        ${k('No prazo', m.noPrazo == null ? '—' : m.noPrazo + '%', '#0891b2', '')}
        ${k('Bloqueadas', m.bloqueadas, ST.bloqueada.c, `Paginas.pessoaF.status='bloqueada';App.render()`)}
        ${k('Horas estimadas', fmtNum(m.horasEst, 1), '#64748b', '')}
        ${k('Horas registradas', fmtNum(m.horasGastas, 1), '#64748b', '')}
      </div>
      <div class="grid g2 mb">
        <div class="card"><div class="card-h"><h3>O que está fazendo agora</h3><small>status "Em andamento" + última atualização registrada</small></div><div class="card-b">
          ${agora.length ? agora.map(t => { const d = t.ultima_atualizacao_em ? diasDesde(t.ultima_atualizacao_em) : null; const velha = d == null || d >= S.cfg.dias_sem_atualizacao;
            return `<div class="now${velha ? ' stale' : ''}" onclick="Tarefa.abrir(${t.id})"><div class="row"><b>${esc(t.titulo)}</b><span class="spacer"></span><span class="small muted">${t.progresso}%</span></div>
              ${t.ultima_atualizacao_texto ? `<q>"${esc(t.ultima_atualizacao_texto.slice(0, 220))}${t.ultima_atualizacao_texto.length > 220 ? '…' : ''}"</q><div class="small muted">${fmtRel(t.ultima_atualizacao_em)}</div>` : ''}
              ${velha ? `<div class="small" style="color:var(--warn);margin-top:3px">${t.ultima_atualizacao_em ? 'Sem atualização há ' + d + ' dia(s)' : 'Nenhuma atualização registrada'} — não é possível afirmar que está em execução agora.</div>` : ''}</div>`; }).join('')
            : '<div class="small muted">Nenhuma demanda marcada como "Em andamento".</div>'}
        </div></div>
        <div class="card"><div class="card-h"><h3>Próximos prazos</h3></div><div class="card-b">
          ${prox.map(t => `<div class="attn-item" onclick="Tarefa.abrir(${t.id})"><span class="t">${esc(t.titulo)}</span>${tagsAlerta(t)}<span class="small muted">${fmtData(t.prazo)}</span></div>`).join('') || '<div class="small muted">Sem prazos em aberto.</div>'}
          ${bloq.length ? `<div class="sec-t">Bloqueadas</div>${bloq.map(t => `<div class="attn-item" onclick="Tarefa.abrir(${t.id})"><span class="t">${esc(t.titulo)}</span><span class="small" style="color:var(--bad)">${esc(t.motivo_bloqueio || '')}</span></div>`).join('')}` : ''}
        </div></div>
      </div>
      <div class="grid g2 mb">
        <div class="card"><div class="card-h"><h3>Últimas atualizações</h3></div><div class="card-b" id="p-upd"><div class="spin" style="margin:10px auto"></div></div></div>
        <div class="card"><div class="card-h"><h3>Histórico de entregas</h3></div><div class="card-b">
          ${entregas.map(t => `<div class="attn-item" onclick="Tarefa.abrir(${t.id})"><span class="t">${esc(t.titulo)}</span><span class="small muted">${t.concluida_em ? fmtData(String(t.concluida_em).slice(0, 10)) : '—'}</span>${t.prazo && t.concluida_em ? (String(t.concluida_em).slice(0, 10) <= t.prazo ? '<span class="tag" style="color:var(--ok);background:var(--ok-50)">no prazo</span>' : '<span class="tag tag-late">após o prazo</span>') : ''}</div>`).join('') || '<div class="small muted">Nenhuma entrega registrada.</div>'}
        </div></div>
      </div>
      <div class="card"><div class="card-h"><h3>Atividades (${lista.length})</h3>
        <div class="row">${sel('periodo', [['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['365', 'Últimos 12 meses'], ['todos', 'Todo o período']])}
          ${sel('status', [['', 'Todos os status'], ...STATUS.map(s => [s.k, s.l])])}${sel('prio', [['', 'Todas as prioridades'], ...Object.entries(PRIO).map(([k2, v2]) => [k2, v2.l])])}
          ${sel('cat', [['', 'Todas as categorias'], ...S.cats.map(c => [c.nome, c.nome])])}</div></div>
        ${tabelaTarefas(lista, { paginar: false, vazio: 'Nenhuma atividade com esses filtros.' })}</div>`;
    // últimas atualizações (consulta ao banco)
    q(sb.from('dem_task_updates').select('*').eq('autor_id', pid).order('created_at', { ascending: false }).limit(10)).then(rows => {
      const el = $('p-upd'); if (!el) return;
      el.innerHTML = rows.length ? `<ul class="tl">${rows.map(u => { const t = S.tasks.find(x => x.id === u.task_id); return `<li><div class="when">${fmtDataHora(u.created_at)} · <a href="javascript:void(0)" onclick="Tarefa.abrir(${u.task_id},'atualizacoes')">${esc(t ? t.codigo + ' · ' + t.titulo : '#' + u.task_id)}</a></div><div class="txt">${esc(u.texto)}</div></li>`; }).join('')}</ul>` : '<div class="small muted">Nenhuma atualização registrada.</div>';
    }).catch(e => { const el = $('p-upd'); if (el) el.innerHTML = `<div class="small" style="color:var(--bad)">${esc(msgErro(e))}</div>`; });
  },

  // ======================= CALENDÁRIO =======================
  calendario() {
    const C = this.cal;
    if (!C.resp && !ehGestor() && S.me) C.resp = S.me.id;
    const tarefas = tarefasVisiveis().filter(t => t.prazo && t.status !== 'cancelada' && (!C.resp || envolve(t, C.resp)));
    const porDia = {}; tarefas.forEach(t => { (porDia[t.prazo] = porDia[t.prazo] || []).push(t); });
    Object.values(porDia).forEach(l => l.sort((a, b) => PRIO[b.prioridade].w - PRIO[a.prioridade].w));
    const ref = new Date(C.ref); ref.setHours(0, 0, 0, 0);
    const hoje = hojeISO();
    const ev = t => `<div class="cal-ev${t.status === 'concluida' ? ' done' : ''}${atrasada(t) ? ' late' : ''}" style="--pc:${PRIO[t.prioridade].c}" title="${esc(t.codigo + ' · ' + t.titulo + ' · ' + ST[t.status].l + ' · ' + nomeDe(t.responsavel_id))}" onclick="event.stopPropagation();Tarefa.abrir(${t.id})">${esc(t.titulo)}</div>`;
    let titulo = '', corpo = '';
    const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    if (C.modo === 'mes') {
      titulo = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const prim = new Date(ref.getFullYear(), ref.getMonth(), 1); const ini = inicioSemana(prim);
      corpo = `<div class="cal">${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}${Array.from({ length: 42 }, (_, i) => {
        const d = new Date(ini); d.setDate(ini.getDate() + i); const iso = isoDe(d); const l = porDia[iso] || [];
        return `<div class="cal-d${d.getMonth() !== ref.getMonth() ? ' out' : ''}${iso === hoje ? ' today' : ''}" onclick="Paginas.novaNoDia('${iso}')" title="Clique para criar uma demanda com prazo em ${fmtData(iso)}">
          <span class="cal-n">${d.getDate()}</span>${l.slice(0, 3).map(ev).join('')}${l.length > 3 ? `<span class="cal-more" onclick="event.stopPropagation();Paginas.cal.modo='dia';Paginas.cal.ref=new Date(${d.getTime()});App.render()">+${l.length - 3} mais</span>` : ''}</div>`;
      }).join('')}</div>`;
    } else if (C.modo === 'semana') {
      const ini = inicioSemana(ref); const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      titulo = `${fmtData(isoDe(ini))} a ${fmtData(isoDe(fim))}`;
      corpo = `<div class="cal cal-week">${DOW.map((d, i) => { const x = new Date(ini); x.setDate(ini.getDate() + i); return `<div class="cal-dow">${d} ${x.getDate()}</div>`; }).join('')}${Array.from({ length: 7 }, (_, i) => {
        const d = new Date(ini); d.setDate(ini.getDate() + i); const iso = isoDe(d); const l = porDia[iso] || [];
        return `<div class="cal-d${iso === hoje ? ' today' : ''}" onclick="Paginas.novaNoDia('${iso}')">${l.map(ev).join('')}</div>`;
      }).join('')}</div>`;
    } else {
      const iso = isoDe(ref); const l = porDia[iso] || [];
      titulo = ref.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      corpo = `<div class="card">${tabelaTarefas(l, { paginar: false, vazio: 'Nenhuma demanda com prazo neste dia.' })}<div class="card-b"><button class="btn btn-sm" onclick="Paginas.novaNoDia('${iso}')">+ Nova demanda com prazo neste dia</button></div></div>`;
    }
    $('view').innerHTML = `<div class="row mb">
      <div class="seg">${[['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(([k, l]) => `<button class="${C.modo === k ? 'on' : ''}" onclick="Paginas.cal.modo='${k}';App.render()">${l}</button>`).join('')}</div>
      <button class="btn btn-sm" onclick="Paginas.navCal(-1)" aria-label="Anterior">‹</button><button class="btn btn-sm" onclick="Paginas.cal.ref=new Date();App.render()">Hoje</button><button class="btn btn-sm" onclick="Paginas.navCal(1)" aria-label="Próximo">›</button>
      <b style="text-transform:capitalize;font-size:15px">${esc(titulo)}</b><span class="spacer"></span>
      <select class="sel" onchange="Paginas.cal.resp=this.value;App.render()" aria-label="Responsável"><option value="">Toda a equipe</option>${S.profiles.filter(p => p.ativo).map(p => `<option value="${p.id}" ${C.resp === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
    </div>
    <div class="row small muted mb">${Object.values(PRIO).map(p => `<span class="row" style="gap:4px"><i style="width:10px;height:10px;border-radius:2px;background:${p.c};display:inline-block"></i>${p.l}</span>`).join('')}
      <span>· vermelho claro = atrasada · riscada = concluída · clique em um dia para criar</span></div>${corpo}`;
  },
  navCal(n) { const C = this.cal; const d = new Date(C.ref); if (C.modo === 'mes') d.setMonth(d.getMonth() + n); else if (C.modo === 'semana') d.setDate(d.getDate() + 7 * n); else d.setDate(d.getDate() + n); C.ref = d; App.render(); },
  novaNoDia(iso) { const h = hojeISO(); Tarefa.abrirForm({ prazo: iso, data_inicio: iso < h ? iso : h, responsavel_id: this.cal.resp || (ehGestor() ? '' : S.me && S.me.id) }); },

  // ======================= ATRASADAS =======================
  atrasadas() {
    let lista = tarefasVisiveis().filter(atrasada);
    if (!ehGestor() && S.me) lista = lista.filter(t => envolve(t, S.me.id));
    lista.sort((a, b) => a.prazo.localeCompare(b.prazo));
    const grupos = {}; lista.forEach(t => { (grupos[t.responsavel_id] = grupos[t.responsavel_id] || []).push(t); });
    $('view').innerHTML = lista.length ? Object.entries(grupos).sort((a, b) => b[1].length - a[1].length).map(([pid, ts]) => `
      <div class="card mb"><div class="card-h"><div class="row">${avatar(pid, 30)}<h3>${esc(nomeDe(pid))}</h3><span class="tag tag-late">${ts.length} atrasada(s)</span></div>
        <a class="btn btn-sm" href="#/equipe/${pid}">Ver página</a></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Demanda</th><th>Prazo</th><th class="num">Dias de atraso</th><th>Prioridade</th><th>Status</th><th>Última atualização</th><th></th></tr></thead><tbody>
        ${ts.map(t => `<tr onclick="Tarefa.abrir(${t.id})"><td class="code">${esc(t.codigo)}</td><td><div class="tt">${esc(t.titulo)}</div>${t.is_demo ? '<span class="tag tag-demo">DEMONSTRAÇÃO</span>' : ''}</td><td>${fmtData(t.prazo)}</td>
          <td class="num" style="color:var(--bad);font-weight:700">${-diasAte(t.prazo)}</td><td>${tagPrio(t.prioridade)}</td><td>${tagStatus(t.status)}</td><td class="small">${t.ultima_atualizacao_em ? fmtRel(t.ultima_atualizacao_em) : '<span class="muted">nenhuma</span>'}</td>
          <td>${ehGestor() ? `<button class="btn btn-sm" onclick="event.stopPropagation();Tarefa.atual=${t.id};Tarefa.formCobranca();Modal._onClose=()=>{if($('drawer').hidden)Tarefa.atual=null}">Cobrar</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>`).join('')
      : '<div class="card"><div class="empty">🎉 Nenhuma demanda atrasada.</div></div>';
  },

  // ======================= RELATÓRIOS =======================
  relatorios() {
    if (!this.rel) { const h = new Date(); const d = new Date(); d.setDate(d.getDate() - 29); this.rel = { de: isoDe(d), ate: isoDe(h), resp: '', cat: '', status: '', prio: '', dep: '' }; }
    const R = this.rel;
    const ini = dataLocal(R.de), fim = dataLocal(R.ate); fim.setDate(fim.getDate() + 1);
    const base = tarefasVisiveis().filter(t => (!R.resp || t.responsavel_id === R.resp) && (!R.cat || t.categoria === R.cat) && (!R.status || t.status === R.status) && (!R.prio || t.prioridade === R.prio) && (!R.dep || String(t.department_id) === String(R.dep)));
    const criadas = base.filter(t => noIntervalo(t.created_at, ini, fim));
    const concl = base.filter(t => t.status === 'concluida' && noIntervalo(t.concluida_em, ini, fim));
    const atrasAgora = base.filter(atrasada);
    const atrasPer = base.filter(t => t.prazo && dataLocal(t.prazo) >= ini && dataLocal(t.prazo) < fim && ((aberta(t) && diasAte(t.prazo) < 0) || (t.concluida_em && String(t.concluida_em).slice(0, 10) > t.prazo)));
    const comPrazo = concl.filter(t => t.prazo), noPrazo = comPrazo.filter(t => String(t.concluida_em).slice(0, 10) <= t.prazo);
    const tempos = concl.filter(t => !t.legacy_id).map(t => (new Date(t.concluida_em) - (t.data_inicio ? dataLocal(t.data_inicio) : new Date(t.created_at))) / 86400000).filter(x => x >= 0);
    const criticas = base.filter(t => t.prioridade === 'critica' && (noIntervalo(t.created_at, ini, fim) || (aberta(t))));
    const pessoas = S.profiles.filter(p => base.some(t => t.responsavel_id === p.id));
    const o = (v, l, s) => `<option value="${esc(v)}" ${String(s) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
    const set = k => `onchange="Paginas.rel.${k}=this.value;App.render()"`;
    const k = (l, v, s, cor) => `<div class="kpi" style="--k:${cor};cursor:default"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div><div class="kpi-s">${s}</div></div>`;
    $('view').innerHTML = `
      <div class="card mb no-print"><div class="card-b"><div class="filters" style="margin:0">
        <label class="small">De <input class="inp" type="date" value="${R.de}" ${set('de')}></label><label class="small">até <input class="inp" type="date" value="${R.ate}" ${set('ate')}></label>
        <select class="sel" ${set('resp')} aria-label="Colaborador">${o('', 'Todos os colaboradores', R.resp)}${S.profiles.map(p => o(p.id, p.nome, R.resp)).join('')}</select>
        <select class="sel" ${set('cat')} aria-label="Categoria">${o('', 'Todas as categorias', R.cat)}${S.cats.map(c => o(c.nome, c.nome, R.cat)).join('')}</select>
        <select class="sel" ${set('status')} aria-label="Status">${o('', 'Todos os status', R.status)}${STATUS.map(s => o(s.k, s.l, R.status)).join('')}</select>
        <select class="sel" ${set('prio')} aria-label="Prioridade">${o('', 'Todas as prioridades', R.prio)}${Object.entries(PRIO).map(([a, b]) => o(a, b.l, R.prio)).join('')}</select>
        <select class="sel" ${set('dep')} aria-label="Departamento">${o('', 'Todos os departamentos', R.dep)}${S.deps.map(d => o(d.id, d.nome, R.dep)).join('')}</select>
        <span class="spacer"></span>
        <button class="btn btn-sm" onclick="Paginas.exportar('csv')">CSV</button><button class="btn btn-sm" onclick="Paginas.exportar('xlsx')">Excel</button><button class="btn btn-sm" onclick="window.print()" title="Use 'Salvar como PDF' na janela de impressão">PDF / Imprimir</button>
      </div></div></div>
      <h2 style="font-size:16px;color:var(--navy);margin-bottom:10px">Relatório de ${fmtData(R.de)} a ${fmtData(R.ate)}</h2>
      <div class="kpis">
        ${k('Criadas no período', criadas.length, '', '#0f1e3d')}
        ${k('Concluídas no período', concl.length, `${concl.reduce((s, t) => s + pontos(t), 0)} pontos`, '#16a34a')}
        ${k('Atrasadas agora', atrasAgora.length, `${atrasPer.length} venceram no período`, '#dc2626')}
        ${k('Concluídas no prazo', comPrazo.length ? pct(noPrazo.length, comPrazo.length) + '%' : '—', `${noPrazo.length} de ${comPrazo.length} com prazo`, '#0891b2')}
        ${k('Tempo médio de conclusão', tempos.length ? fmtNum(tempos.reduce((a, b) => a + b, 0) / tempos.length, 1) + ' d' : '—', tempos.length ? `base: ${tempos.length} demanda(s)` : 'sem dados válidos', '#7c3aed')}
      </div>
      <div class="grid g2 mb">
        <div class="card"><div class="card-h"><h3>Evolução da equipe</h3><small>por semana no período</small></div><div class="card-b"><div class="chart-box tall"><canvas id="r-evo"></canvas></div></div></div>
        <div class="card"><div class="card-h"><h3>Demandas críticas por semana</h3></div><div class="card-b"><div class="chart-box tall"><canvas id="r-crit"></canvas></div></div></div>
      </div>
      <div class="card mb"><div class="card-h"><h3>Pendências e desempenho por colaborador</h3></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Colaborador</th><th class="num">Pendências abertas</th><th class="num">Carga (pts)</th><th class="num">Atrasadas</th><th class="num">Bloqueadas</th><th class="num">Concluídas no período</th><th class="num">Pontos entregues</th><th class="num">No prazo</th><th class="num">Conclusão ponderada</th><th class="num">Horas est./gastas</th></tr></thead>
        <tbody>${pessoas.map(p => { const m = metricasPessoa(p.id, base, ini); const mc = concl.filter(t => t.responsavel_id === p.id);
          return `<tr onclick="location.hash='#/equipe/${p.id}'"><td>${esc(p.nome)}</td><td class="num">${m.abertas}</td><td class="num">${m.ptsAb}</td><td class="num">${m.atrasadas}</td><td class="num">${m.bloqueadas}</td>
          <td class="num">${mc.length}</td><td class="num">${mc.reduce((s, t) => s + pontos(t), 0)}</td><td class="num">${m.noPrazo == null ? '—' : m.noPrazo + '%'}</td><td class="num">${m.ponderada == null ? '—' : m.ponderada + '%'}</td><td class="num">${fmtNum(m.horasEst, 1)} / ${fmtNum(m.horasGastas, 1)}</td></tr>`; }).join('') || '<tr><td colspan="10" class="empty">Sem dados para os filtros.</td></tr>'}</tbody></table></div>
        <div class="card-b"><p class="note">Produtividade não é medida só pela quantidade de tarefas: considere a <b>carga em pontos</b> (complexidade), o cumprimento de prazos, os bloqueios (que dependem de terceiros) e as horas estimadas. O tempo médio exclui demandas importadas da aba antiga, que não têm data real de início.</p></div></div>
      <div class="card"><div class="card-h"><h3>Demandas críticas</h3><small>criadas no período ou ainda abertas</small></div>${tabelaTarefas(criticas, { paginar: false, vazio: 'Nenhuma demanda crítica.' })}</div>`;
    // gráficos semanais
    const sem = []; let s = inicioSemana(ini); while (s < fim) { sem.push(new Date(s)); s.setDate(s.getDate() + 7); }
    const fs = d => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; };
    App.chart($('r-evo'), { type: 'line', data: { labels: sem.map(rotSem), datasets: [
      { label: 'Criadas', data: sem.map(d => base.filter(t => noIntervalo(t.created_at, d, fs(d))).length), borderColor: '#0f1e3d', backgroundColor: '#0f1e3d', tension: .3 },
      { label: 'Concluídas', data: sem.map(d => base.filter(t => noIntervalo(t.concluida_em, d, fs(d))).length), borderColor: '#16a34a', backgroundColor: '#16a34a', tension: .3 },
      { label: 'Concluídas no prazo', data: sem.map(d => base.filter(t => noIntervalo(t.concluida_em, d, fs(d)) && t.prazo && String(t.concluida_em).slice(0, 10) <= t.prazo).length), borderColor: '#0891b2', borderDash: [4, 4], tension: .3 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    App.chart($('r-crit'), { type: 'bar', data: { labels: sem.map(rotSem), datasets: [
      { label: 'Críticas criadas', data: sem.map(d => base.filter(t => t.prioridade === 'critica' && noIntervalo(t.created_at, d, fs(d))).length), backgroundColor: '#b91c1c', borderRadius: 4 },
      { label: 'Críticas concluídas', data: sem.map(d => base.filter(t => t.prioridade === 'critica' && noIntervalo(t.concluida_em, d, fs(d))).length), backgroundColor: '#16a34a', borderRadius: 4 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    this._relBase = base; this._relIni = ini; this._relFim = fim;
  },
  async exportar(tipo) {
    const R = this.rel, ini = this._relIni, fim = this._relFim;
    const linhas = this._relBase.filter(t => noIntervalo(t.created_at, ini, fim) || noIntervalo(t.concluida_em, ini, fim) || aberta(t)).map(t => ({
      'Código': t.codigo, 'Título': t.titulo, 'Responsável': nomeDe(t.responsavel_id), 'Participantes': (t.participantes || []).map(nomeDe).join(', '),
      'Categoria': t.categoria || '', 'Departamento': nomeDep(t.department_id) === '—' ? '' : nomeDep(t.department_id), 'Prioridade': PRIO[t.prioridade].l, 'Status': ST[t.status].l,
      'Complexidade': t.complexidade, 'Horas estimadas': t.esforco_estimado_horas ?? '', 'Horas registradas': Number(t.horas_gastas || 0),
      'Criada em': fmtDataHora(t.created_at), 'Início': fmtData(t.data_inicio), 'Prazo': fmtData(t.prazo), 'Concluída em': t.concluida_em ? fmtDataHora(t.concluida_em) : '',
      'No prazo': t.concluida_em && t.prazo ? (String(t.concluida_em).slice(0, 10) <= t.prazo ? 'Sim' : 'Não') : '', 'Atrasada': atrasada(t) ? 'Sim' : 'Não',
      'Progresso (%)': t.progresso, 'Última atualização': t.ultima_atualizacao_em ? fmtDataHora(t.ultima_atualizacao_em) : '', 'Demonstração': t.is_demo ? 'Sim' : 'Não',
    }));
    if (!linhas.length) { toast('Nada para exportar com esses filtros.', 'bad'); return; }
    const nome = `demandas_${R.de}_a_${R.ate}`;
    if (tipo === 'csv') {
      const cols = Object.keys(linhas[0]);
      const cel = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = '﻿' + cols.map(cel).join(';') + '\n' + linhas.map(l => cols.map(c => cel(l[c])).join(';')).join('\n');
      baixar(new Blob([csv], { type: 'text/csv;charset=utf-8' }), nome + '.csv');
    } else {
      try {
        if (!window.XLSX) await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Demandas');
        XLSX.writeFile(wb, nome + '.xlsx');
      } catch (e) { toast('Não foi possível gerar o Excel agora. Use o CSV (abre no Excel).', 'bad'); }
    }
  },

  // ======================= HISTÓRICO =======================
  async historico() {
    const H = this.hist; const POR = 50;
    const ACOES = { criada: 'Criação', migrada: 'Importação', status_alterado: 'Status', prazo_alterado: 'Prazo', prioridade_alterada: 'Prioridade', responsavel_alterado: 'Responsável', atualizacao: 'Atualização', comentario: 'Comentário', cobranca: 'Cobrança', bloqueada: 'Bloqueio', arquivada: 'Arquivamento', editada: 'Edição' };
    const o = (v, l, s) => `<option value="${esc(v)}" ${String(s) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
    $('view').innerHTML = `<div class="filters">
      <select class="sel" onchange="Paginas.hist.ator=this.value;Paginas.hist.pagina=0;App.render()" aria-label="Pessoa">${o('', 'Todas as pessoas', H.ator)}${S.profiles.map(p => o(p.id, p.nome, H.ator)).join('')}</select>
      <select class="sel" onchange="Paginas.hist.acao=this.value;Paginas.hist.pagina=0;App.render()" aria-label="Ação">${o('', 'Todas as ações', H.acao)}${Object.entries(ACOES).map(([k, v]) => o(k, v, H.acao)).join('')}</select>
      <label class="small">De <input class="inp" type="date" value="${H.de}" onchange="Paginas.hist.de=this.value;Paginas.hist.pagina=0;App.render()"></label>
      <label class="small">até <input class="inp" type="date" value="${H.ate}" onchange="Paginas.hist.ate=this.value;Paginas.hist.pagina=0;App.render()"></label>
      <input class="inp" placeholder="Código (ex.: DEM-0012)" value="${esc(H.q)}" onkeydown="if(event.key==='Enter'){Paginas.hist.q=this.value;Paginas.hist.pagina=0;App.render()}" aria-label="Código da demanda">
    </div><div class="card" id="h-box"><div class="empty"><div class="spin" style="margin:auto"></div></div></div>`;
    try {
      let qy = sb.from('dem_task_history').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(H.pagina * POR, H.pagina * POR + POR - 1);
      if (H.ator) qy = qy.eq('ator_id', H.ator);
      if (H.acao) qy = qy.eq('acao', H.acao);
      if (H.de) qy = qy.gte('created_at', H.de + 'T00:00:00');
      if (H.ate) qy = qy.lte('created_at', H.ate + 'T23:59:59');
      const cod = String(H.q || '').match(/(\d+)/); if (H.q && cod) qy = qy.eq('task_id', Number(cod[1]));
      if (!S.showDemo) qy = qy.eq('is_demo', false);
      const r = await qy; if (r.error) throw r.error;
      const rows = r.data, total = r.count || 0;
      const box = $('h-box'); if (!box) return;
      box.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Quem</th><th>Demanda</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>
        ${rows.map(h => { const t = S.tasks.find(x => x.id === h.task_id); const de = h.valor_anterior, para = h.valor_novo;
          const fmt = v => h.campo === 'status' && ST[v] ? ST[v].l : h.campo === 'prioridade' && PRIO[v] ? PRIO[v].l : h.campo === 'prazo' ? fmtData(v) : v;
          return `<tr onclick="${t ? `Tarefa.abrir(${t.id},'historico')` : ''}"><td class="small" style="white-space:nowrap">${fmtDataHora(h.created_at)}</td><td>${h.ator_id ? esc(nomeDe(h.ator_id)) : '<span class="muted">sistema</span>'}</td>
            <td><span class="code">${t ? esc(t.codigo) : '#' + h.task_id}</span> <span class="tt" style="display:inline-block;max-width:260px;vertical-align:bottom">${t ? esc(t.titulo) : ''}</span></td>
            <td><b>${esc(h.acao.replace(/_/g, ' '))}</b>${h.campo && !['status', 'prazo', 'prioridade'].includes(h.campo) ? ' · ' + esc(h.campo) : ''}</td>
            <td class="small" style="max-width:380px;white-space:normal">${de != null || para != null ? `${de != null ? '<s class="muted">' + esc(fmt(de)) + '</s> → ' : ''}${esc(fmt(para) ?? '')}` : ''}${h.detalhe ? `<div class="muted">${esc(String(h.detalhe).slice(0, 200))}</div>` : ''}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="pager">${H.pagina * POR + 1}–${Math.min((H.pagina + 1) * POR, total)} de ${total}
          <button class="btn btn-sm" ${H.pagina <= 0 ? 'disabled' : ''} onclick="Paginas.hist.pagina--;App.render()">‹ Anterior</button>
          <button class="btn btn-sm" ${(H.pagina + 1) * POR >= total ? 'disabled' : ''} onclick="Paginas.hist.pagina++;App.render()">Próxima ›</button></div>`
        : '<div class="empty">Nenhum registro com esses filtros.</div>';
    } catch (e) { const box = $('h-box'); if (box) box.innerHTML = `<div class="alert alert-bad" style="margin:12px">${esc(msgErro(e))}</div>`; }
  },
};

function baixar(blob, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function carregarScript(src) { return new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = err; document.head.appendChild(s); }); }
