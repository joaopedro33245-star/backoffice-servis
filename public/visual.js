// ===== VISUAL v2: Atenção no Dashboard, Quadro de Torres, Resumos com abas, Cartões do Checklist =====
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ler = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const idsVisiveis = (tbody, fn) => [...(tbody ? tbody.querySelectorAll('tr') : [])].filter(tr => tr.style.display !== 'none').map(tr => {
    const b = [...tr.querySelectorAll('button[onclick]')].find(x => x.getAttribute('onclick').startsWith(fn + '('));
    const m = b && b.getAttribute('onclick').match(/\((\d+)\)/); return m ? Number(m[1]) : null;
  }).filter(x => x !== null);
  const seg = (nome, atual, opcoes) => `<div class="vw-seg" role="group">${opcoes.map(([k, l]) => `<button class="${atual === k ? 'on' : ''}" onclick="Visual.${nome}('${k}')">${l}</button>`).join('')}</div>`;

  async function ir(sec, ent, id) {
    await showSection(sec);
    if (ent && window.Painel) setTimeout(() => Painel.abrir(ent, id), 50);
  }

  // =================== 1. ATENÇÃO NO DASHBOARD ===================
  function atencao() {
    const tb = document.querySelector('#sec-dashboard .dash-toolbar'); if (!tb) return;
    let box = $('dash-atencao');
    if (!box) { box = document.createElement('div'); box.id = 'dash-atencao'; box.className = 'card at-card'; tb.after(box); }
    const pills = $('dash-alerts'); if (pills) pills.classList.add('at-hidden');
    const fil = window.dashFilial || 'Todas';
    const T = (DATA.torres || []).filter(d => fil === 'Todas' || d.filial === fil);
    const prazos = [], falhas = [], pend = [];

    // Prazos: gratificação de torre vencida / vencendo, fornecedores vencidos (só gestor)
    T.map(d => ({ d, n: diasAte(d.data_fim_gratificacao) })).filter(x => x.n !== null && x.n <= 30).sort((a, b) => a.n - b.n).forEach(({ d, n }) =>
      prazos.push({ cls: n < 0 ? 'bad' : 'warn', t: d.cliente, s: n < 0 ? `gratificação vencida há ${-n}d` : n === 0 ? 'gratificação vence hoje' : `gratificação vence em ${n}d`, go: () => ir('torres', 'torres', d.id) }));
    if (typeof boAdmin !== 'undefined' && boAdmin) (DATA.fornecedores || []).filter(d => d.dt_vencimento && d.pagamento !== 'SIM').map(d => ({ d, n: diasAte(String(d.dt_vencimento).slice(0, 10)) })).filter(x => x.n !== null && x.n <= 7).sort((a, b) => a.n - b.n).forEach(({ d, n }) =>
      prazos.push({ cls: n < 0 ? 'bad' : 'warn', t: d.servico, s: n < 0 ? `pagamento vencido há ${-n}d` : `pagamento vence em ${n}d`, go: () => ir('fornecedores', 'forn', d.id) }));

    // Falhas: checklist (último), checklist atrasado, armários em déficit
    const C = DATA.checklists || [];
    const datas = [...new Set(C.map(c => c.data_checklist).filter(Boolean))].sort();
    const ult = datas[datas.length - 1];
    if (ult) {
      const dias = -diasAte(ult);
      if (dias > 7) falhas.push({ cls: 'warn', t: 'Checklist de portaria atrasado', s: `último em ${fmtDataBR(ult)} (há ${dias} dias)`, go: () => ir('checklist') });
      C.filter(c => c.data_checklist === ult && !(c.todas_gravando_dvr && c.central_alarme_comunicando)).forEach(c => {
        const cond = (DATA.condominios || []).find(x => x.id === c.condominio_id);
        const q = [!c.todas_gravando_dvr && 'DVR', !c.central_alarme_comunicando && 'alarme'].filter(Boolean).join(' e ');
        falhas.push({ cls: 'bad', t: cond ? cond.nome : 'Condomínio #' + c.condominio_id, s: `falha em ${q} (${fmtDataBR(ult)})`, go: () => ir('checklist', 'chk', c.id) });
      });
    }
    (DATA.armResumo || []).filter(d => (fil === 'Todas' || d.filial === fil) && Number(d.margem) < 0).forEach(d =>
      falhas.push({ cls: 'bad', t: 'Armários ' + d.filial, s: `margem negativa: -${fmtVal(Math.abs(Number(d.margem)))}`, go: () => ir('armarios') }));

    // Pendências: seguros, demandas, torres aguardando
    (DATA.seguros || []).filter(s => s.status === 'Pendente').forEach(s =>
      pend.push({ cls: 'bad', t: s.cliente || 'Seguro', s: `seguro pendente${s.valor ? ' · ' + fmtVal(s.valor) : ''}`, go: () => ir('seguros', 'seg', s.id) }));
    const D = (DATA.demTasks || []).filter(x => !x.arquivada && !x.is_demo && x.status !== 'concluida' && x.status !== 'cancelada');
    const atr = D.filter(x => x.prazo && (diasAte(String(x.prazo).slice(0, 10)) ?? 0) < 0).length;
    if (atr) pend.push({ cls: 'bad', t: `${atr} demanda${atr > 1 ? 's' : ''} atrasada${atr > 1 ? 's' : ''}`, s: 'abrir no sistema de Demandas', go: () => { location.href = 'demandas.html#/atrasadas'; } });
    const ni = D.filter(x => x.status === 'nao_iniciada').length;
    if (ni) pend.push({ cls: 'warn', t: `${ni} demanda${ni > 1 ? 's' : ''} não iniciada${ni > 1 ? 's' : ''}`, s: 'abrir no sistema de Demandas', go: () => { location.href = 'demandas.html#/minhas'; } });
    const emAut = T.filter(d => d.status === 'EM AUTORIZAÇÃO').length;
    if (emAut) pend.push({ cls: 'warn', t: `${emAut} torre${emAut > 1 ? 's' : ''} em autorização`, s: 'ver no quadro de torres', go: async () => { gravar('bo_torres_view', 'quadro'); await showSection('torres'); } });

    const grupos = [['bad', 'Falhas', falhas], ['warn', 'Prazos e vencimentos', prazos], ['', 'Pendências', pend]];
    window.__atItens = grupos.map(g => g[2]);
    const total = falhas.length + prazos.length + pend.length;
    box.innerHTML = `<div class="card-header"><div class="card-title">Atenção</div><small class="at-sub">${total ? `${total} ponto${total > 1 ? 's' : ''} para acompanhar` : 'nada pendente agora'} · atualizado automaticamente</small></div>
      <div class="at-grid">${grupos.map(([cls, tit, itens], gi) => `<div class="at-box ${cls}"><h4>${tit}<span class="n">${itens.length}</span></h4>
        ${itens.length ? itens.slice(0, 6).map((it, i) => `<button class="at-item" onclick="Visual.at(${gi},${i})"><i class="at-dot ${it.cls}"></i><span class="t"><b>${esc(it.t)}</b><small>${esc(it.s)}</small></span><span class="at-go">›</span></button>`).join('') + (itens.length > 6 ? `<button class="at-more" onclick="Visual.atMais(${gi})">+ ${itens.length - 6} mais</button>` : '')
        : '<div class="at-empty">Nada aqui.</div>'}</div>`).join('')}</div>`;
  }
  function at(g, i) { const it = (window.__atItens || [])[g]?.[i]; if (it) it.go(); }
  function atMais(g) {
    const box = $('dash-atencao'); const itens = (window.__atItens || [])[g] || [];
    const alvo = box.querySelectorAll('.at-box')[g]; if (!alvo) return;
    alvo.querySelector('.at-more')?.remove();
    alvo.insertAdjacentHTML('beforeend', itens.slice(6).map((it, i) => `<button class="at-item" onclick="Visual.at(${g},${i + 6})"><i class="at-dot ${it.cls}"></i><span class="t"><b>${esc(it.t)}</b><small>${esc(it.s)}</small></span><span class="at-go">›</span></button>`).join(''));
  }

  // =================== 2. QUADRO DE TORRES ===================
  const ORDEM_T = ['EM AUTORIZAÇÃO', 'AUTORIZADA', 'INSTALADA', 'AVALIAR/AGUARDAR', 'SEGUNDO PLANO', 'NÃO AUTORIZADA'];
  const COR_T = { 'EM AUTORIZAÇÃO': 'var(--warning)', 'AUTORIZADA': 'var(--blue)', 'INSTALADA': 'var(--accent)', 'NÃO AUTORIZADA': 'var(--danger)' };
  function torresView(v) { gravar('bo_torres_view', v); quadroTorres(); }
  function quadroTorres() {
    const wrap = $('torres-table-wrap'); if (!wrap) return;
    const card = wrap.closest('.card');
    const modo = ler('bo_torres_view', 'tabela');
    const acoes = document.querySelector('#tb-torres .tb-acoes');
    if (acoes) { let s = acoes.querySelector('.vw-seg'); if (s) s.remove(); acoes.insertAdjacentHTML('afterbegin', seg('torresView', modo, [['tabela', 'Tabela'], ['quadro', 'Quadro']])); }
    let board = $('torres-board');
    if (!board) { board = document.createElement('div'); board.id = 'torres-board'; board.className = 'kb'; card.after(board); }
    if (modo !== 'quadro') { card.style.display = ''; board.style.display = 'none'; return; }
    card.style.display = 'none'; board.style.display = '';
    const ids = new Set(idsVisiveis(wrap.querySelector('tbody'), 'openTorreModal'));
    const T = (DATA.torres || []).filter(d => ids.has(d.id));
    const status = [...ORDEM_T, ...new Set(T.map(d => d.status).filter(s => !ORDEM_T.includes(s)))];
    const cols = status.filter((s, i) => i < 3 || T.some(d => d.status === s));
    board.innerHTML = cols.map(s => {
      const itens = T.filter(d => d.status === s).sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''));
      return `<div class="kb-col"><div class="kb-h" style="--c:${COR_T[s] || 'var(--text-muted)'}"><span>${esc(s)}</span><b>${itens.length}</b></div><div class="kb-list">
        ${itens.map(d => {
          const n = diasAte(d.data_fim_gratificacao); const ck = torreChecklist(d);
          return `<button class="kb-card" onclick="Painel.abrir('torres',${d.id})"><b>${esc(d.cliente)}</b><small>${esc(d.cidade || '')}${d.responsavel ? ' · ' + esc(d.responsavel) : ''}</small>
            <span class="kb-tags">${d.cameras ? `<span class="badge badge-neutral">${d.cameras} câm.</span>` : ''}${n !== null ? `<span class="badge ${n < 0 ? 'badge-danger' : n <= 30 ? 'badge-warning' : 'badge-neutral'}">${n < 0 ? 'grat. vencida' : 'grat. ' + n + 'd'}</span>` : ''}${d.status === 'INSTALADA' ? `<span class="badge ${ck === 4 ? 'badge-success' : 'badge-warning'}">checklist ${ck}/4</span>` : ''}</span></button>`;
        }).join('') || '<div class="kb-empty">Nenhuma torre</div>'}</div></div>`;
    }).join('');
  }

  // =================== 3. RESUMOS COM ABAS ===================
  function resumoIA() {
    const c = $('ia-summary-breakdowns'); if (!c) return;
    const cards = [...c.children].filter(x => x.classList.contains('card')); if (!cards.length) return;
    const sel = Number(ler('bo_ia_resumo', '0')) || 0;
    const nomes = cards.map(x => (x.querySelector('.card-title')?.textContent || '').replace(/^Por /, ''));
    c.classList.add('card', 'rs-wrap');
    c.querySelector(':scope > .rs-h')?.remove();
    c.insertAdjacentHTML('afterbegin', `<div class="card-header rs-h"><div class="card-title">Resumo da base</div>${seg('iaResumo', String(sel), nomes.map((n, i) => [String(i), 'Por ' + n]))}</div>`);
    cards.forEach((x, i) => { x.classList.add('rs-item'); x.style.display = i === sel ? '' : 'none'; });
  }
  function iaResumo(i) { gravar('bo_ia_resumo', i); resumoIA(); }
  function resumoArm() {
    const a = $('arm-resumo-card'), b = $('arm-resumo-forn'); if (!a || !b) return;
    let w = $('arm-rs');
    if (!w) { w = document.createElement('div'); w.id = 'arm-rs'; w.className = 'card rs-wrap'; a.before(w); w.appendChild(a); w.appendChild(b); }
    const sel = ler('bo_arm_resumo', 'filial');
    w.querySelector(':scope > .rs-h')?.remove();
    w.insertAdjacentHTML('afterbegin', `<div class="card-header rs-h"><div class="card-title">Resumo</div>${seg('armResumo', sel, [['filial', 'Por filial'], ['forn', 'Por fornecedor']])}</div>`);
    [a, b].forEach(x => x.classList.add('rs-item'));
    a.style.display = sel === 'filial' ? '' : 'none'; b.style.display = sel === 'forn' ? '' : 'none';
  }
  function armResumo(v) { gravar('bo_arm_resumo', v); resumoArm(); }

  // =================== 4. CARTÕES DO CHECKLIST ===================
  function chkView(v) { gravar('bo_chk_view', v); cartoesChecklist(); }
  function cartoesChecklist() {
    const tbody = $('chk-tbody'); if (!tbody) return;
    const tw = tbody.closest('.table-wrap'); const card = tbody.closest('.card'); if (!tw || !card) return;
    const modo = ler('bo_chk_view', 'cartoes');
    const head = card.querySelector('.card-header > div:last-child');
    if (head) { head.querySelector('.vw-seg')?.remove(); head.insertAdjacentHTML('afterbegin', seg('chkView', modo, [['cartoes', 'Cartões'], ['tabela', 'Tabela']])); }
    let box = $('chk-cards');
    if (!box) { box = document.createElement('div'); box.id = 'chk-cards'; box.className = 'ck-grid'; tw.after(box); }
    if (modo !== 'cartoes') { tw.style.display = ''; box.style.display = 'none'; return; }
    tw.style.display = 'none'; box.style.display = '';
    const ids = idsVisiveis(tbody, 'editChecklist');
    const R = ids.map(id => (DATA.checklists || []).find(c => c.id === id)).filter(Boolean);
    if (!R.length) { box.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Nenhum checklist com esses filtros.</div>'; return; }
    box.innerHTML = R.map(r => {
      const cond = (DATA.condominios || []).find(c => c.id === r.condominio_id);
      const falha = !(r.todas_gravando_dvr && r.central_alarme_comunicando);
      const itens = [['DVR', r.todas_gravando_dvr], ['Portão', r.cameras_portao_gravando], ['Botões', r.cameras_botoes_acoes], ['Alarme', r.central_alarme_comunicando], ['IA', r.tem_ia ? r.ia_funcionando : null], ['Torre', r.tem_torre ? true : null]];
      return `<button class="ck-card ${falha ? 'falha' : ''}" onclick="Painel.abrir('chk',${r.id})">
        <div class="ck-top"><b>${esc(cond ? cond.nome : 'Condomínio #' + r.condominio_id)}</b><span class="badge ${falha ? 'badge-danger' : 'badge-success'}">${falha ? 'Falha' : 'OK'}</span></div>
        <small>${r.data_checklist ? fmtDataBR(r.data_checklist) : '—'} · ${r.qtd_cameras ?? '—'} câmeras${r.qual_ia ? ' · ' + esc(r.qual_ia) : ''}</small>
        <div class="ck-itens">${itens.map(([l, v]) => v === null ? `<span class="ck-i na">${l}</span>` : `<span class="ck-i ${v ? 'ok' : 'bad'}">${v ? '✓' : '✗'} ${l}</span>`).join('')}</div></button>`;
    }).join('');
  }

  // =================== ligação com as abas ===================
  function depois(nomeFn, fn) {
    const orig = window[nomeFn]; if (typeof orig !== 'function') return;
    window[nomeFn] = function () { const r = orig.apply(this, arguments); try { fn(); } catch (e) { console.error('[visual ' + nomeFn + ']', e); } return r; };
  }
  depois('renderDashboard', atencao);
  depois('renderTorres', quadroTorres); depois('renderTorresTable', quadroTorres);
  depois('renderIA', resumoIA);
  depois('renderArmarios', resumoArm);
  depois('renderChecklist', cartoesChecklist);
  // cartões do topo filtram a tabela; o quadro e os cartões acompanham
  document.addEventListener('click', e => {
    if (e.target.closest('#torres-kpis, #kf-torres')) setTimeout(quadroTorres, 0);
    if (e.target.closest('#chk-kpis, #kf-chk')) setTimeout(cartoesChecklist, 0);
  });

  window.Visual = { at, atMais, torresView, iaResumo, armResumo, chkView };
})();
