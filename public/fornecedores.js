// ===== FORNECEDORES =====
function showFornTab(btn, tab) {
  document.querySelectorAll('#sec-fornecedores .tab-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('forn-lista').style.display = tab === 'lista' ? '' : 'none';
  document.getElementById('forn-pagamentos').style.display = tab === 'pagamentos' ? '' : 'none';
  document.getElementById('forn-boletos').style.display = tab === 'boletos' ? '' : 'none';
  document.getElementById('forn-comparativo').style.display = tab === 'comparativo' ? '' : 'none';
  if (tab === 'boletos') renderBoletos();
  if (tab === 'comparativo') renderComparativo();
}

let currentFornComp = ''; // filtro de competencia fornecedores (YYYY-MM)

function getFornCompFilter() {
  if (!currentFornComp) {
    const now = new Date();
    currentFornComp = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
  return currentFornComp;
}

function getFornByComp() {
  const comp = getFornCompFilter();
  if (comp === 'todos') return DATA.fornecedores;
  return DATA.fornecedores.filter(d => {
    if (!d.dt_competencia) return false;
    return d.dt_competencia.substring(0,7) === comp;
  });
}

function renderFornecedores() {
  const comp = getFornCompFilter();
  const F = getFornByComp();
  const allF = DATA.fornecedores;
  const custoTotal = F.reduce((s,d) => s + Number(d.valor), 0);
  const pagos = F.filter(d => d.pagamento === 'SIM').length;
  const pend = F.filter(d => d.pagamento === 'PENDENTE' || (d.dt_vencimento && new Date(d.dt_vencimento) < new Date() && d.pagamento !== 'SIM')).length;

  // Build available months from data
  const compMonths = [...new Set(allF.map(d => d.dt_competencia ? d.dt_competencia.substring(0,7) : null).filter(Boolean))].sort();
  const now = new Date();
  const curMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  if (!compMonths.includes(curMonth)) compMonths.push(curMonth);
  compMonths.sort();

  const monthLabel = (m) => { const [y,mo] = m.split('-'); return MONTH_NAMES[parseInt(mo)] + ' ' + y; };
  const compTabs = compMonths.map(m =>
    `<button class="tab-pill ${m===comp?'active':''}" onclick="currentFornComp='${m}';renderFornecedores()" style="font-size:11px;padding:5px 12px">${monthLabel(m)}</button>`
  ).join('') + `<button class="tab-pill ${comp==='todos'?'active':''}" onclick="currentFornComp='todos';renderFornecedores()" style="font-size:11px;padding:5px 12px">Todos</button>`;

  // Month tabs (in separate container above KPIs)
  document.getElementById('forn-comp-tabs').innerHTML = compTabs;

  // KPIs
  document.getElementById('forn-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--blue)"></div><div class="kpi-card-icon" style="background:var(--blue-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div><div class="kpi-label">Serviços</div><div class="kpi-value blue">${F.length}</div><div class="kpi-sub">${comp==='todos'?'todos os meses':monthLabel(comp)}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--accent)"></div><div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="kpi-label">Custo Total</div><div class="kpi-value accent">R$ ${fmtK(custoTotal)}</div><div class="kpi-sub">mensal recorrente</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--accent)"></div><div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="kpi-label">Pagos</div><div class="kpi-value accent">${pagos}</div><div class="kpi-sub">de ${F.length}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--danger)"></div><div class="kpi-card-icon" style="background:var(--danger-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="kpi-label">Pendentes / Vencidos</div><div class="kpi-value danger">${pend}</div><div class="kpi-sub">${pend > 0 ? 'requerem atencao' : 'tudo em dia'}</div></div>`;

  // Charts
  const byTipo = {}, byFilial = {};
  F.forEach(d => { byTipo[d.tipo||'Outros'] = (byTipo[d.tipo||'Outros']||0) + Number(d.valor); byFilial[d.filial||'Outros'] = (byFilial[d.filial||'Outros']||0) + Number(d.valor); });
  document.getElementById('forn-charts').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Custo por Tipo de Serviço</div></div></div><div class="chart-card-body" id="fc-tipo"></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Custo por Filial</div></div></div><div class="chart-card-body" id="fc-filial"></div></div>`;
  hBar('fc-tipo', Object.entries(byTipo).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,t:'R$ '+fmtK(v)})), ['#2a78d6','#1abf8f','#eb6834','#eda100']);
  hBar('fc-filial', Object.entries(byFilial).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,t:'R$ '+fmtK(v)})), ['#1abf8f','#2a78d6','#eb6834','#eda100','#e87ba4']);

  // Table
  renderFornTable();

  // Pagamentos
  renderPagamentos();
}

function renderFornTable() {
  const F = getFornByComp();
  const filialFilter = document.querySelector('#forn-lista [data-filter="filial"]');
  const tipoFilter = document.querySelector('#forn-lista [data-filter="tipo"]');
  const searchFilter = document.querySelector('#forn-lista [data-filter="search"]');
  const filial = filialFilter ? filialFilter.value : '';
  const tipo = tipoFilter ? tipoFilter.value : '';
  const search = searchFilter ? searchFilter.value.toLowerCase() : '';

  let filtered = F.filter(d => {
    if (filial && d.filial !== filial) return false;
    if (tipo && d.tipo !== tipo) return false;
    if (search && !d.servico.toLowerCase().includes(search) && !(d.uso||'').toLowerCase().includes(search)) return false;
    return true;
  });
  const total = filtered.reduce((s,d) => s + Number(d.valor), 0);

  document.getElementById('forn-lista').innerHTML = `
    <div class="filters">
      <select class="filter-select" data-filter="filial" onchange="renderFornTable()">
        <option value="">Todas as Filiais</option>
        <option value="Geral" ${filial==='Geral'?'selected':''}>Geral</option>
        <option value="Ceara" ${filial==='Ceará'?'selected':''}>Ceara</option>
        <option value="Piauí" ${filial==='Piauí'?'selected':''}>Piaui</option>
        <option value="Maranhão" ${filial==='Maranhão'?'selected':''}>Maranhao</option>
        <option value="Amazonas" ${filial==='Amazonas'?'selected':''}>Amazonas</option>
      </select>
      <select class="filter-select" data-filter="tipo" onchange="renderFornTable()">
        <option value="">Todos os Tipos</option>
        <option value="Sistema" ${tipo==='Sistema'?'selected':''}>Sistema</option>
        <option value="Servidor" ${tipo==='Servidor'?'selected':''}>Servidor</option>
        <option value="Suporte" ${tipo==='Suporte'?'selected':''}>Suporte</option>
      </select>
      <input class="filter-input" data-filter="search" placeholder="Buscar servico..." oninput="renderFornTable()" style="width:200px" value="${search}">
      <div style="flex:1"></div>
      <div style="font-size:12px;color:var(--text-muted)">${filtered.length} servicos · Total: ${fmtVal(total)}</div>
    </div>
    <div class="card"><div class="card-body"><div class="table-wrap" style="max-height:60vh;overflow-y:auto">
      <table><thead><tr>
        <th>Serviço</th><th>Filial</th><th>Tipo</th><th>Uso</th><th style="text-align:right">Valor Mensal</th><th>Forn.</th><th>Competência</th><th>Vencimento</th><th>Fluxo</th><th>Pago</th><th>Ações</th>
      </tr></thead><tbody>${filtered.map(d => {
        const comp = d.dt_competencia ? d.dt_competencia.split('-').reverse().join('/') : '—';
        const venc = d.dt_vencimento ? d.dt_vencimento.split('-').reverse().join('/') : '—';
        const vencido = d.dt_vencimento && new Date(d.dt_vencimento) < new Date() && d.pagamento !== 'SIM';
        return `<tr>
          <td>${d.servico}</td><td>${d.filial}</td>
          <td><span class="badge badge-neutral">${d.tipo||'—'}</span></td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="${d.uso||''}">${d.uso||'—'}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.valor)}</td>
          <td>${d.fornecedor_id||'—'}</td><td>${comp}</td>
          <td>${vencido?'<span style="color:var(--danger)">'+venc+'</span>':venc}</td>
          <td><select class="editable-select" onchange="updateField('fornecedores',${d.id},'fluxo',this.value)" style="color:${d.fluxo==='SIM'?'var(--accent)':d.fluxo==='NÃO'?'var(--danger)':'var(--text-muted)'}">
            <option value="SIM" ${d.fluxo==='SIM'?'selected':''}>Sim</option>
            <option value="NÃO" ${d.fluxo==='NÃO'?'selected':''}>Nao</option>
            <option value="" ${!d.fluxo||d.fluxo===''?'selected':''}>—</option>
          </select></td>
          <td><select class="editable-select" onchange="updateField('fornecedores',${d.id},'pagamento',this.value)" style="color:${d.pagamento==='SIM'?'var(--accent)':d.pagamento==='PENDENTE'?'var(--warning)':'var(--text-muted)'}">
            <option value="SIM" ${d.pagamento==='SIM'?'selected':''}>Pago</option>
            <option value="PENDENTE" ${d.pagamento==='PENDENTE'?'selected':''}>Pendente</option>
            <option value="" ${!d.pagamento||d.pagamento===''?'selected':''}>—</option>
          </select></td>
          <td style="white-space:nowrap"><button class="btn btn-outline btn-sm" onclick="openFornModal(${d.id})" style="margin-right:4px">Editar</button><button class="btn btn-outline btn-sm" onclick="deleteFornecedor(${d.id})" style="color:var(--danger)">Excluir</button></td>
        </tr>`}).join('')}</tbody></table>
    </div></div></div>`;
}

let currentPagMonth = '';
const MONTH_NAMES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function renderPagamentos() {
  const F = DATA.fornecedores;
  const H = DATA.fornHistorico;

  // Build available months from fornecedores dt_competencia and historico
  const now = new Date();
  const currentComp = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const fornMonths = [...new Set(F.filter(d=>d.dt_competencia).map(d=>d.dt_competencia.substring(0,7)))];
  const histMonths = [...new Set(H.map(h => h.competencia))];
  const allMonths = [...new Set([...fornMonths, ...histMonths, currentComp])].sort();
  if (!currentPagMonth || !allMonths.includes(currentPagMonth)) currentPagMonth = currentComp;

  // Month tabs
  const monthTabs = allMonths.map(m => {
    const [y, mo] = m.split('-');
    const label = MONTH_NAMES[parseInt(mo)] + ' ' + y;
    const active = m === currentPagMonth ? 'active' : '';
    return `<button class="tab-pill ${active}" onclick="currentPagMonth='${m}';renderPagamentos()" style="font-size:11px;padding:5px 12px">${label}</button>`;
  }).join('');

  // Get data for selected month — always check both fornecedores and historico
  let rows = [];
  // Historico records for selected month
  const monthH = H.filter(h => h.competencia === currentPagMonth);
  const histFornIds = new Set(monthH.map(h => h.fornecedor_id));

  // Fornecedores with dt_competencia matching selected month (that DON'T already have a historico record)
  const filteredF = F.filter(d => d.dt_competencia && d.dt_competencia.substring(0,7) === currentPagMonth && !histFornIds.has(d.id));

  // Live fornecedor rows (no historico yet)
  rows = filteredF.map(d => ({
    fornecedor_nome: d.servico || '',
    servico: d.servico || '',
    filial: d.filial || '',
    recorrencia: 'Mensal',
    responsavel: 'LEMOS',
    lancado_fluxo: d.fluxo || '',
    enviado_cp: d.pagamento === 'SIM' ? 'SIM' : (d.pagamento === 'PENDENTE' ? 'PENDENTE' : 'NÃO'),
    uso: d.uso || '',
    tipo: d.tipo || '',
    valor: Number(d.valor) || 0,
    forn: d.fornecedor_id || '',
    data_nf: d.data_nf || '',
    dt_vencimento: d.dt_vencimento || '',
    id: d.id,
    is_live: true
  }));

  // Historico rows
  rows = rows.concat(monthH.map(h => {
    const forn = F.find(f => f.id === h.fornecedor_id);
    return {
      fornecedor_nome: forn ? forn.servico : '',
      servico: h.servico || (forn ? forn.servico : ''),
      filial: forn ? forn.filial : '',
      recorrencia: 'Mensal',
      responsavel: 'LEMOS',
      lancado_fluxo: h.fluxo || '',
      enviado_cp: h.enviado_contas_pagar ? 'SIM' : 'NÃO',
      lancado_sistema: !!h.lancado_sistema,
      uso: h.tipo_servico || (forn ? forn.uso : ''),
      tipo: forn ? forn.tipo : '',
      valor: Number(h.valor) || 0,
      forn: h.fornecedor_id || '',
      data_nf: h.data_nf || '',
      dt_vencimento: h.dt_vencimento || '',
      nota_url: h.nota_url || '',
      boleto_url: h.boleto_url || '',
      id: h.id,
      is_live: false
    };
  }));

  // KPIs for selected month
  const total = rows.reduce((s,r) => s + r.valor, 0);
  const lancados = rows.filter(r => r.lancado_fluxo === 'SIM').length;
  const enviadosCP = rows.filter(r => r.enviado_cp === 'SIM').length;
  const pendentes = rows.filter(r => r.enviado_cp === 'PENDENTE').length;

  // --- FILTERS ---
  const searchVal = (document.getElementById('pag-search') || {}).value || '';
  const filterFilial = (document.getElementById('pag-filter-filial') || {}).value || '';
  const filterStatus = (document.getElementById('pag-filter-status') || {}).value || '';
  if (searchVal) rows = rows.filter(r => (r.servico||'').toLowerCase().includes(searchVal.toLowerCase()));
  if (filterFilial) rows = rows.filter(r => (r.filial||'') === filterFilial);
  if (filterStatus === 'SIM') rows = rows.filter(r => r.enviado_cp === 'SIM');
  else if (filterStatus === 'NAO') rows = rows.filter(r => r.enviado_cp === 'NÃO' || r.enviado_cp === 'NAO');
  else if (filterStatus === 'PENDENTE') rows = rows.filter(r => r.enviado_cp === 'PENDENTE');

  // Unique filiais for filter dropdown
  const allFiliais = [...new Set(DATA.fornecedores.map(f => f.filial).filter(Boolean))].sort();

  // Filial color map
  const filialColor = (f) => {
    const fl = (f||'').toLowerCase();
    if (fl.includes('geral')) return '#1abf8f';
    if (fl.includes('cear')) return '#2a78d6';
    if (fl.includes('amazon')) return '#eda100';
    if (fl.includes('maranh')) return '#e87ba4';
    if (fl.includes('piau')) return '#9b59b6';
    if (fl.includes('teresin')) return '#9b59b6';
    return '#6c7a89';
  };
  const tipoColor = (t) => {
    const tl = (t||'').toLowerCase();
    if (tl.includes('servidor')) return '#2a78d6';
    if (tl.includes('sistema')) return '#1abf8f';
    if (tl.includes('suporte')) return '#eb6834';
    return '#6c7a89';
  };
  const statusCell = (val) => {
    if (val === 'SIM') return '<span style="display:inline-block;padding:2px 10px;border-radius:3px;background:#27ae60;color:#fff;font-size:11px;font-weight:600">SIM</span>';
    if (val === 'NÃO' || val === 'NAO') return '<span style="display:inline-block;padding:2px 10px;border-radius:3px;background:#e74c3c;color:#fff;font-size:11px;font-weight:600">NÃO</span>';
    if (val === 'PENDENTE') return '<span style="display:inline-block;padding:2px 10px;border-radius:3px;background:#f39c12;color:#fff;font-size:11px;font-weight:600">PENDENTE</span>';
    return '<span style="color:var(--text-muted)">—</span>';
  };

  // Vencimento alert: check if any due tomorrow or today
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const alertRows = rows.filter(r => {
    if (!r.dt_vencimento) return false;
    const vd = new Date(r.dt_vencimento+'T12:00:00'); vd.setHours(0,0,0,0);
    return vd.getTime() === today.getTime() || vd.getTime() === tomorrow.getTime();
  });

  const tableRows = rows.map(r => {
    const dnf = r.data_nf ? new Date(r.data_nf+'T12:00:00').toLocaleDateString('pt-BR') : '';
    const venc = r.dt_vencimento ? new Date(r.dt_vencimento+'T12:00:00').toLocaleDateString('pt-BR') : '';
    // Highlight if vence hoje ou amanha
    let vencStyle = '';
    if (r.dt_vencimento) {
      const vd = new Date(r.dt_vencimento+'T12:00:00'); vd.setHours(0,0,0,0);
      if (vd.getTime() === today.getTime()) vencStyle = 'color:#e74c3c;font-weight:700';
      else if (vd.getTime() === tomorrow.getTime()) vencStyle = 'color:#f39c12;font-weight:700';
      else if (vd < today) vencStyle = 'color:#e74c3c;font-weight:700;text-decoration:line-through';
    }
    const lancSist = r.lancado_sistema ? 'SIM' : (r.is_live ? '—' : 'NÃO');
    const clickFn = r.is_live ? '' : `onclick="editHistorico(${r.id})" style="cursor:pointer"`;
    const notaBtn = r.nota_url ? `<a href="${r.nota_url}" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:4px;background:rgba(26,191,143,0.15);color:#1abf8f;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap">📄 NF</a>` : '';
    const boletoBtn = r.boleto_url ? `<a href="${r.boleto_url}" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:4px;background:rgba(42,120,214,0.15);color:#2a78d6;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap">🧾 Boleto</a>` : '';
    const docsCell = (notaBtn || boletoBtn) ? `${notaBtn} ${boletoBtn}` : '<span style="color:var(--text-muted);font-size:11px">—</span>';
    return `<tr ${clickFn}>
      <td style="font-weight:600;white-space:nowrap">${r.fornecedor_nome}</td>
      <td style="white-space:nowrap">${r.servico}</td>
      <td><span style="display:inline-block;padding:2px 10px;border-radius:3px;background:${filialColor(r.filial)};color:#fff;font-size:11px;font-weight:500">${r.filial}</span></td>
      <td>${r.recorrencia}</td>
      <td>${r.responsavel}</td>
      <td>${statusCell(r.lancado_fluxo)}</td>
      <td>${statusCell(r.enviado_cp)}</td>
      <td>${statusCell(lancSist)}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis" title="${r.uso}">${r.uso}</td>
      <td><span style="display:inline-block;padding:2px 10px;border-radius:3px;background:${tipoColor(r.tipo)};color:#fff;font-size:11px;font-weight:500">${r.tipo || '—'}</span></td>
      <td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap">R$ ${Number(r.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${r.forn || '—'}</td>
      <td>${dnf}</td>
      <td style="${vencStyle}">${venc}${vencStyle && !vencStyle.includes('line-through') ? ' ⚠️' : ''}</td>
      <td style="white-space:nowrap">${docsCell}</td>
    </tr>`;
  }).join('');

  const [selY, selMo] = currentPagMonth.split('-');
  const selLabel = MONTH_NAMES[parseInt(selMo)] + ' ' + selY;

  document.getElementById('forn-pagamentos').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <div style="display:flex;gap:4px;flex-wrap:wrap;overflow-x:auto;padding-bottom:4px">${monthTabs}</div>
      <div style="flex:1"></div>
      <button class="btn-primary" onclick="openHistoricoModal()" style="font-size:11px">+ Novo Registro</button>
    </div>
    <div class="kpi-row" style="margin-bottom:16px">
      <div class="kpi-tile"><div class="kpi-label">Total Mensal</div><div class="kpi-value blue">R$ ${Number(total).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Lancados no Fluxo</div><div class="kpi-value accent">${lancados} de ${rows.length}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Enviado Contas a Pagar</div><div class="kpi-value" style="color:#27ae60">${enviadosCP}</div></div>
      <div class="kpi-tile"><div class="kpi-label">Pendentes</div><div class="kpi-value warning">${pendentes}</div></div>
    </div>
    ${alertRows.length ? `<div style="background:rgba(243,156,18,0.15);border:1px solid #f39c12;border-radius:6px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">⚠️</span>
      <span style="color:#f39c12;font-weight:600;font-size:13px">${alertRows.length} pagamento${alertRows.length>1?'s':''} vencendo hoje/amanha: ${alertRows.map(r=>r.servico).join(', ')}</span>
    </div>` : ''}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <input id="pag-search" type="text" placeholder="Buscar fornecedor/servico..." value="${searchVal}" oninput="renderPagamentos()" style="flex:1;min-width:180px;padding:7px 12px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:12px">
      <select id="pag-filter-filial" onchange="renderPagamentos()" style="padding:7px 10px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:12px">
        <option value="">Todas Filiais</option>
        ${allFiliais.map(f => `<option value="${f}" ${f===filterFilial?'selected':''}>${f}</option>`).join('')}
      </select>
      <select id="pag-filter-status" onchange="renderPagamentos()" style="padding:7px 10px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:12px">
        <option value="">Todos Status</option>
        <option value="SIM" ${filterStatus==='SIM'?'selected':''}>Enviado CP: SIM</option>
        <option value="NAO" ${filterStatus==='NAO'?'selected':''}>Enviado CP: NÃO</option>
        <option value="PENDENTE" ${filterStatus==='PENDENTE'?'selected':''}>Enviado CP: PENDENTE</option>
      </select>
      <button onclick="exportPagamentosExcel()" style="padding:7px 14px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap" title="Exportar para Excel">📥 Excel</button>
    </div>
    <div class="card"><div class="card-header"><div class="card-title">${selLabel} — ${rows.length} servicos</div></div>
    <div class="card-body"><div class="table-wrap" style="max-height:60vh;overflow-y:auto;overflow-x:auto">
      <table style="min-width:1500px"><thead><tr>
        <th>Fornecedor</th><th>Serviço</th><th>Filial</th><th>Recorrência</th><th>Responsaveis</th>
        <th>Lancado no Fluxo</th><th>Enviado Contas a Pagar</th><th>Lancado Sistema</th>
        <th>Uso</th><th>Tipo</th><th style="text-align:right">Valor Mensal</th>
        <th style="text-align:right">Forn.</th><th>Data NF</th><th>Vencimento</th><th>Docs</th>
      </tr></thead><tbody>${tableRows || '<tr><td colspan="15" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum registro para este mes. Clique em "+ Novo Registro" para adicionar.</td></tr>'}</tbody></table>
    </div></div></div>`;
}

// ===== EXPORT EXCEL =====
function exportPagamentosExcel() {
  const F = DATA.fornecedores || [];
  const H = DATA.fornHistorico || [];
  const now = new Date();
  const currentComp = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const month = currentPagMonth || currentComp;
  const [selY, selMo] = month.split('-');
  const selLabel = MONTH_NAMES[parseInt(selMo)] + ' ' + selY;

  let rows = [];
  if (month === currentComp) {
    rows = F.map(d => ({
      servico: d.servico||'', filial: d.filial||'', recorrencia: 'Mensal', responsavel: 'LEMOS',
      lancado_fluxo: d.fluxo||'', enviado_cp: d.pagamento==='SIM'?'SIM':(d.pagamento==='PENDENTE'?'PENDENTE':'NÃO'),
      uso: d.uso||'', tipo: d.tipo||'', valor: Number(d.valor)||0,
      data_nf: d.data_nf||'', dt_vencimento: d.dt_vencimento||'', lancado_sistema: '—'
    }));
  } else {
    rows = H.filter(h => h.competencia === month).map(h => {
      const forn = F.find(f => f.id === h.fornecedor_id);
      return {
        servico: h.servico||(forn?forn.servico:''), filial: forn?forn.filial:'', recorrencia: 'Mensal', responsavel: 'LEMOS',
        lancado_fluxo: h.fluxo||'', enviado_cp: h.enviado_contas_pagar?'SIM':'NÃO',
        uso: h.tipo_servico||(forn?forn.uso:''), tipo: forn?forn.tipo:'', valor: Number(h.valor)||0,
        data_nf: h.data_nf||'', dt_vencimento: h.dt_vencimento||'', lancado_sistema: h.lancado_sistema?'SIM':'NÃO'
      };
    });
  }
  // Apply current filters
  const sv = (document.getElementById('pag-search')||{}).value||'';
  const ff = (document.getElementById('pag-filter-filial')||{}).value||'';
  const fs = (document.getElementById('pag-filter-status')||{}).value||'';
  if (sv) rows = rows.filter(r => r.servico.toLowerCase().includes(sv.toLowerCase()));
  if (ff) rows = rows.filter(r => r.filial === ff);
  if (fs === 'SIM') rows = rows.filter(r => r.enviado_cp === 'SIM');
  else if (fs === 'NAO') rows = rows.filter(r => r.enviado_cp === 'NÃO' || r.enviado_cp === 'NAO');
  else if (fs === 'PENDENTE') rows = rows.filter(r => r.enviado_cp === 'PENDENTE');

  // Build CSV (Excel-compatible with BOM + semicolons for pt-BR)
  const headers = ['Servico','Filial','Recorrencia','Responsavel','Lancado Fluxo','Enviado CP','Lancado Sistema','Uso','Tipo','Valor','Data NF','Vencimento'];
  const csvRows = [headers.join(';')];
  rows.forEach(r => {
    csvRows.push([
      r.servico, r.filial, r.recorrencia, r.responsavel, r.lancado_fluxo, r.enviado_cp,
      r.lancado_sistema, r.uso, r.tipo, r.valor.toFixed(2).replace('.',','),
      r.data_nf, r.dt_vencimento
    ].join(';'));
  });
  // Totals by filial
  const filiais = [...new Set(rows.map(r => r.filial))].sort();
  csvRows.push('');
  csvRows.push('RESUMO POR FILIAL');
  filiais.forEach(f => {
    const t = rows.filter(r => r.filial === f).reduce((s,r) => s + r.valor, 0);
    csvRows.push(`${f};${t.toFixed(2).replace('.',',')}`);
  });
  const totalGeral = rows.reduce((s,r) => s + r.valor, 0);
  csvRows.push(`TOTAL GERAL;${totalGeral.toFixed(2).replace('.',',')}`);

  const bom = '﻿';
  const blob = new Blob([bom + csvRows.join('\n')], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `pagamentos_${selLabel.replace(/\s/g,'_')}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Exportado: ' + a.download);
}

// ===== BOLETOS =====
function openBoletoModal() {
  document.getElementById('boleto-modal').classList.add('open');
  const sel = document.getElementById('bol-fornecedor');
  const uniqueS = [...new Set(DATA.fornecedores.map(d => d.servico))].sort();
  sel.innerHTML = uniqueS.map(s => `<option>${s}</option>`).join('');
}
function closeBoletoModal() { document.getElementById('boleto-modal').classList.remove('open'); }

async function saveBoleto() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const b = {
    fornecedor: document.getElementById('bol-fornecedor').value,
    tipo_doc: document.getElementById('bol-tipo').value,
    numero: document.getElementById('bol-numero').value,
    valor: parseFloat(document.getElementById('bol-valor').value) || 0,
    competencia: document.getElementById('bol-competencia').value,
    vencimento: document.getElementById('bol-vencimento').value || null,
    status: document.getElementById('bol-status').value,
    observacoes: document.getElementById('bol-obs').value,
  };
  const { error } = await sb.from('boletos').insert(b);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  showToast('Boleto salvo!');
  closeBoletoModal();
  // Refresh boletos
  const { data } = await sb.from('boletos').select('*').order('created_at', { ascending: false });
  DATA.boletos = data || [];
  renderBoletos();
}

async function deleteBoleto(id) {
  if (!sb) return;
  const { error } = await sb.from('boletos').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.boletos = DATA.boletos.filter(b => b.id !== id);
  renderBoletos();
  showToast('Excluido!');
}

function renderBoletos() {
  const B = DATA.boletos;
  document.getElementById('forn-boletos').innerHTML = `
    <div class="card"><div class="card-header"><div class="card-title">Registro de Boletos e Notas Fiscais</div><button class="btn btn-accent" onclick="openBoletoModal()">+ Novo Registro</button></div>
    <div class="card-body"><div class="table-wrap" style="max-height:50vh;overflow-y:auto">
      <table><thead><tr><th>Fornecedor</th><th>Tipo Doc.</th><th>N Documento</th><th>Competência</th><th>Vencimento</th><th style="text-align:right">Valor</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>${B.length ? B.map(b => {
        const stBadge = b.status==='Pago'?'badge-success':b.status==='Vencido'?'badge-danger':b.status==='Lancado'?'badge-blue':'badge-warning';
        return `<tr><td>${b.fornecedor}</td><td><span class="badge badge-neutral">${b.tipo_doc}</span></td><td>${b.numero||'—'}</td><td>${b.competencia||'—'}</td><td>${b.vencimento||'—'}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${b.valor?fmtVal(b.valor):'—'}</td><td><span class="badge ${stBadge}">${b.status}</span></td><td><button class="btn btn-outline btn-sm" onclick="deleteBoleto(${b.id})">Excluir</button></td></tr>`;
      }).join('') : ''}</tbody></table></div>
      ${B.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">Nenhum registro. Clique em "+ Novo Registro" para adicionar.</div>' : ''}
    </div></div>`;
}


// ===== FORNECEDOR CRUD =====
function openFornModal(editId) {
  document.getElementById('forn-modal').classList.add('open');
  if (editId) {
    const d = DATA.fornecedores.find(f => f.id === editId);
    if (!d) return;
    document.getElementById('forn-modal-title').textContent = 'Editar Fornecedor';
    document.getElementById('forn-edit-id').value = d.id;
    document.getElementById('fm-servico').value = d.servico || '';
    document.getElementById('fm-filial').value = d.filial || 'Geral';
    document.getElementById('fm-tipo').value = d.tipo || 'Sistema';
    document.getElementById('fm-uso').value = d.uso || '';
    document.getElementById('fm-responsavel').value = d.responsavel || 'LEMOS';
    document.getElementById('fm-recorrencia').value = d.recorrencia || 'Mensal';
    document.getElementById('fm-valor').value = d.valor || '';
    document.getElementById('fm-fornecedor-id').value = d.fornecedor_id || '';
    document.getElementById('fm-competencia').value = d.dt_competencia || '';
    document.getElementById('fm-vencimento').value = d.dt_vencimento || '';
  } else {
    document.getElementById('forn-modal-title').textContent = 'Novo Fornecedor';
    document.getElementById('forn-edit-id').value = '';
    document.getElementById('fm-servico').value = '';
    document.getElementById('fm-filial').value = 'Geral';
    document.getElementById('fm-tipo').value = 'Sistema';
    document.getElementById('fm-uso').value = '';
    document.getElementById('fm-responsavel').value = 'LEMOS';
    document.getElementById('fm-recorrencia').value = 'Mensal';
    document.getElementById('fm-valor').value = '';
    document.getElementById('fm-fornecedor-id').value = '';
    // Default competencia to first day of current month (or selected month)
    const defComp = currentFornComp && currentFornComp !== 'todos' ? currentFornComp + '-01' : new Date().toISOString().substring(0,10);
    document.getElementById('fm-competencia').value = defComp;
    document.getElementById('fm-vencimento').value = '';
  }
}
function closeFornModal() { document.getElementById('forn-modal').classList.remove('open'); }

async function saveFornecedor() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const servico = document.getElementById('fm-servico').value.trim();
  if (!servico) { showToast('Preencha o nome do servico', true); return; }
  const obj = {
    servico,
    filial: document.getElementById('fm-filial').value,
    tipo: document.getElementById('fm-tipo').value,
    uso: document.getElementById('fm-uso').value,
    responsavel: document.getElementById('fm-responsavel').value,
    recorrencia: document.getElementById('fm-recorrencia').value,
    valor: parseFloat(document.getElementById('fm-valor').value) || 0,
    fornecedor_id: document.getElementById('fm-fornecedor-id').value,
    dt_competencia: document.getElementById('fm-competencia').value || null,
    dt_vencimento: document.getElementById('fm-vencimento').value || null,
  };
  const editId = document.getElementById('forn-edit-id').value;
  let error;
  if (editId) {
    ({ error } = await sb.from('fornecedores').update(obj).eq('id', parseInt(editId)));
  } else {
    ({ error } = await sb.from('fornecedores').insert(obj));
  }
  if (error) { showToast('Erro: ' + error.message, true); return; }
  showToast(editId ? 'Fornecedor atualizado!' : 'Fornecedor adicionado!');
  closeFornModal();
  await refreshData();
}

async function deleteFornecedor(id) {
  if (!sb || !confirm('Excluir este fornecedor?')) return;
  const { error } = await sb.from('fornecedores').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.fornecedores = DATA.fornecedores.filter(d => d.id !== id);
  renderFornecedores();
  showToast('Excluido!');
}


// ===== FORNECEDORES COMPARATIVO =====
let selectedFornComparativo = null;

function renderComparativo() {
  const H = DATA.fornHistorico;
  const F = DATA.fornecedores;
  if (!H.length) {
    document.getElementById('forn-comparativo').innerHTML = '<div class="card"><div class="card-body" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum historico de pagamentos registrado ainda.<br>Adicione registros no historico para ver o comparativo.</div></div>';
    return;
  }

  // Group by fornecedor
  const byForn = {};
  H.forEach(h => {
    const forn = F.find(f => f.id === h.fornecedor_id);
    const name = forn ? forn.servico : ('Forn #' + h.fornecedor_id);
    if (!byForn[name]) byForn[name] = { id: h.fornecedor_id, records: [] };
    byForn[name].records.push(h);
  });

  // Get all unique competencias sorted
  const allComp = [...new Set(H.map(h => h.competencia))].sort();
  const lastTwo = allComp.slice(-2);

  // Build comparison table
  let rows = '';
  Object.entries(byForn).sort((a,b) => a[0].localeCompare(b[0])).forEach(([name, info]) => {
    const recs = info.records;
    const valByComp = {};
    recs.forEach(r => { valByComp[r.competencia] = (valByComp[r.competencia] || 0) + Number(r.valor); });
    const currentVal = lastTwo.length >= 1 ? (valByComp[lastTwo[lastTwo.length-1]] || 0) : 0;
    const prevVal = lastTwo.length >= 2 ? (valByComp[lastTwo[0]] || 0) : 0;
    const diff = currentVal - prevVal;
    const pct = prevVal > 0 ? ((diff / prevVal) * 100).toFixed(1) : '—';
    const arrow = diff > 0 ? '<span style="color:var(--danger)">▲ +' + fmtVal(diff) + ' (' + pct + '%)</span>' :
                  diff < 0 ? '<span style="color:var(--accent)">▼ ' + fmtVal(diff) + ' (' + pct + '%)</span>' :
                  '<span style="color:var(--text-muted)">= Sem alteracao</span>';
    rows += `<tr style="cursor:pointer" onclick="showFornTrend('${name.replace(/'/g,"\\'")}', ${info.id})">
      <td>${name}</td>
      <td style="text-align:right">${fmtVal(prevVal)}</td>
      <td style="text-align:right">${fmtVal(currentVal)}</td>
      <td>${arrow}</td>
    </tr>`;
  });

  document.getElementById('forn-comparativo').innerHTML = `
    <div class="card" style="margin-bottom:16px"><div class="card-body">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:14px;font-weight:600;color:var(--text)">Comparativo Mensal de Fornecedores</h3>
        <button class="btn-primary" onclick="openHistoricoModal()">+ Novo Historico</button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Comparando: ${lastTwo.join(' vs ') || 'sem dados'} · Clique em um fornecedor para ver o grafico de tendencia</div>
      <div class="table-wrap"><table><thead><tr>
        <th>Fornecedor</th><th style="text-align:right">${lastTwo[0] || 'Anterior'}</th><th style="text-align:right">${lastTwo[lastTwo.length-1] || 'Atual'}</th><th>Variacao</th>
      </tr></thead><tbody>${rows}</tbody></table></div>
    </div></div>
    <div id="forn-trend-chart" class="card" style="display:none"><div class="card-body">
      <h3 id="forn-trend-title" style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:var(--text)"></h3>
      <div id="forn-trend-svg"></div>
    </div></div>`;
}

function showFornTrend(name, fornId) {
  const H = DATA.fornHistorico.filter(h => h.fornecedor_id === fornId);
  if (!H.length) return;

  const byComp = {};
  H.forEach(h => { byComp[h.competencia] = (byComp[h.competencia] || 0) + Number(h.valor); });
  const sorted = Object.entries(byComp).sort((a,b) => a[0].localeCompare(b[0]));

  document.getElementById('forn-trend-chart').style.display = '';
  document.getElementById('forn-trend-title').textContent = 'Tendencia: ' + name;

  // SVG line chart
  const W = 600, H2 = 220, pad = { t:20, r:20, b:40, l:70 };
  const cw = W - pad.l - pad.r, ch = H2 - pad.t - pad.b;
  const vals = sorted.map(s => s[1]);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;

  let pts = sorted.map((s, i) => {
    const x = pad.l + (sorted.length > 1 ? (i / (sorted.length - 1)) * cw : cw / 2);
    const y = pad.t + ch - ((s[1] - minV) / range) * ch;
    return { x, y, comp: s[0], val: s[1] };
  });

  const pathD = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');

  let labels = pts.map(p => `<text x="${p.x}" y="${H2 - 8}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${p.comp}</text>`).join('');
  let dots = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent)" stroke="var(--bg-card)" stroke-width="2"/>
    <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" fill="var(--text)" font-size="10" font-weight="600">${fmtVal(p.val)}</text>`).join('');

  // Y-axis ticks
  let yTicks = '';
  for (let i = 0; i <= 4; i++) {
    const v = minV + (range * i / 4);
    const y = pad.t + ch - (i / 4) * ch;
    yTicks += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3"/>`;
    yTicks += `<text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${fmtVal(v)}</text>`;
  }

  document.getElementById('forn-trend-svg').innerHTML = `
    <svg viewBox="0 0 ${W} ${H2}" style="width:100%;max-width:${W}px;font-family:Inter,sans-serif">
      ${yTicks}
      <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${labels}
    </svg>`;
}

// ===== HISTORICO MODAL =====
async function uploadPDF(file, folder) {
  if (!sb || !file) return null;
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${ts}_${safeName}`;
  const { data, error } = await sb.storage.from('documentos').upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (error) { showToast('Erro upload: ' + error.message, true); return null; }
  const { data: urlData } = sb.storage.from('documentos').getPublicUrl(path);
  return urlData.publicUrl;
}

function resetFileLinks() {
  document.getElementById('hist-nota-file').value = '';
  document.getElementById('hist-boleto-file').value = '';
  const nl = document.getElementById('hist-nota-link');
  const bl = document.getElementById('hist-boleto-link');
  nl.style.display = 'none'; nl.href = '#';
  bl.style.display = 'none'; bl.href = '#';
}

function openHistoricoModal() {
  document.getElementById('hist-modal').classList.add('open');
  document.querySelector('#hist-modal h3').textContent = 'Novo Registro de Historico';
  document.getElementById('hist-edit-id').value = '';
  document.getElementById('hist-fornecedor-id').value = '';
  document.getElementById('hist-servico').value = '';
  const now = new Date();
  document.getElementById('hist-competencia').value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('hist-valor').value = '';
  document.getElementById('hist-fluxo').value = '';
  document.getElementById('hist-enviado-cp').checked = false;
  document.getElementById('hist-lancado').checked = false;
  document.getElementById('hist-lancado-sistema').checked = false;
  document.getElementById('hist-tipo-servico').value = '';
  document.getElementById('hist-data-nf').value = '';
  document.getElementById('hist-vencimento').value = '';
  document.getElementById('hist-obs').value = '';
  document.getElementById('hist-nota-url').value = '';
  document.getElementById('hist-boleto-url').value = '';
  resetFileLinks();

  // Populate fornecedor select
  const sel = document.getElementById('hist-fornecedor-id');
  sel.innerHTML = '<option value="">Selecione o Fornecedor</option>';
  DATA.fornecedores.forEach(f => {
    sel.innerHTML += `<option value="${f.id}">${f.servico} (${f.filial})</option>`;
  });
}
function closeHistoricoModal() { document.getElementById('hist-modal').classList.remove('open'); }

function editHistorico(id) {
  const h = DATA.fornHistorico.find(r => r.id === id);
  if (!h) return;
  openHistoricoModal();
  document.querySelector('#hist-modal h3').textContent = 'Editar Registro';
  document.getElementById('hist-edit-id').value = id;
  document.getElementById('hist-fornecedor-id').value = h.fornecedor_id || '';
  document.getElementById('hist-servico').value = h.servico || '';
  document.getElementById('hist-competencia').value = h.competencia || '';
  document.getElementById('hist-valor').value = h.valor || '';
  document.getElementById('hist-fluxo').value = h.fluxo || '';
  document.getElementById('hist-enviado-cp').checked = !!h.enviado_contas_pagar;
  document.getElementById('hist-lancado').checked = !!h.lancado_pagamento;
  document.getElementById('hist-lancado-sistema').checked = !!h.lancado_sistema;
  document.getElementById('hist-tipo-servico').value = h.tipo_servico || '';
  document.getElementById('hist-data-nf').value = h.data_nf || '';
  document.getElementById('hist-vencimento').value = h.dt_vencimento || '';
  document.getElementById('hist-obs').value = h.observacoes || '';
  document.getElementById('hist-nota-url').value = h.nota_url || '';
  document.getElementById('hist-boleto-url').value = h.boleto_url || '';
  // Show existing PDF links
  const nl = document.getElementById('hist-nota-link');
  const bl = document.getElementById('hist-boleto-link');
  if (h.nota_url) { nl.href = h.nota_url; nl.style.display = 'inline'; nl.textContent = 'Ver Nota'; }
  else { nl.style.display = 'none'; }
  if (h.boleto_url) { bl.href = h.boleto_url; bl.style.display = 'inline'; bl.textContent = 'Ver Boleto'; }
  else { bl.style.display = 'none'; }
}

function enviarEmailFinanceiro() {
  const servico = document.getElementById('hist-servico').value.trim() || '—';
  const fornSel = document.getElementById('hist-fornecedor-id');
  const fornNome = fornSel.options[fornSel.selectedIndex]?.text || '—';
  const competencia = document.getElementById('hist-competencia').value || '—';
  const valor = document.getElementById('hist-valor').value || '0';
  const fluxo = document.getElementById('hist-fluxo').value || '—';
  const dataNf = document.getElementById('hist-data-nf').value || '—';
  const vencimento = document.getElementById('hist-vencimento').value || '—';
  const obs = document.getElementById('hist-obs').value || '';
  const tipoServico = document.getElementById('hist-tipo-servico').value || '—';
  const enviadoCP = document.getElementById('hist-enviado-cp').checked ? 'Sim' : 'Não';
  const lancado = document.getElementById('hist-lancado').checked ? 'Sim' : 'Não';
  const lancadoSist = document.getElementById('hist-lancado-sistema').checked ? 'Sim' : 'Não';
  const notaUrl = document.getElementById('hist-nota-url').value || document.getElementById('hist-nota-link').href || '';
  const boletoUrl = document.getElementById('hist-boleto-url').value || document.getElementById('hist-boleto-link').href || '';

  const to = 'contasapagar@serviseletronica.com.br;backoffice@serviseletronica.com.br;pedro.netto@serviseletronica.com.br';
  const subject = `[Backoffice] ${servico} - ${fornNome} - Competência ${competencia}`;

  let body = `Segue informações do registro de pagamento:\n\n`;
  body += `SERVIÇO: ${servico}\n`;
  body += `FORNECEDOR: ${fornNome}\n`;
  body += `TIPO: ${tipoServico}\n`;
  body += `COMPETÊNCIA: ${competencia}\n`;
  body += `VALOR: R$ ${Number(valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
  body += `DATA NF: ${dataNf}\n`;
  body += `VENCIMENTO: ${vencimento}\n`;
  body += `FLUXO: ${fluxo}\n\n`;
  body += `STATUS:\n`;
  body += `• Enviado ao Contas a Pagar: ${enviadoCP}\n`;
  body += `• Lançado para Pagamento: ${lancado}\n`;
  body += `• Lançado no Sistema: ${lancadoSist}\n`;
  if (obs) body += `\nOBSERVAÇÕES: ${obs}\n`;
  const notaReal = (notaUrl && notaUrl !== '' && !notaUrl.endsWith('#')) ? notaUrl : '';
  const boletoReal = (boletoUrl && boletoUrl !== '' && !boletoUrl.endsWith('#')) ? boletoUrl : '';
  body += `\nDOCUMENTOS:\n`;
  body += `• Nota Fiscal: ${notaReal || 'Não anexada'}\n`;
  body += `• Boleto: ${boletoReal || 'Não anexado'}\n`;
  body += `\n---\nEnviado via Backoffice Servis`;

  // Tenta abrir no Zimbra Ajax compose, senão usa mailto
  const zimbraUrl = `https://webmail.servisgr.com.br/?view=compose&to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(zimbraUrl, '_blank');
  showToast('Zimbra aberto! Verifique e envie o email.');
}

async function deleteHistorico(id) {
  if (!sb || !confirm('Excluir este registro?')) return;
  const { error } = await sb.from('fornecedores_historico').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.fornHistorico = DATA.fornHistorico.filter(r => r.id !== id);
  showToast('Registro excluido');
  renderPagamentos();
}

async function saveHistorico() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const fornId = document.getElementById('hist-fornecedor-id').value;
  if (!fornId) { showToast('Selecione um fornecedor', true); return; }
  const servico = document.getElementById('hist-servico').value.trim();
  if (!servico) { showToast('Preencha o servico', true); return; }

  // Upload PDFs if selected
  const notaFile = document.getElementById('hist-nota-file').files[0];
  const boletoFile = document.getElementById('hist-boleto-file').files[0];
  let notaUrl = document.getElementById('hist-nota-url').value || null;
  let boletoUrl = document.getElementById('hist-boleto-url').value || null;
  if (notaFile) {
    showToast('Enviando nota fiscal...');
    const url = await uploadPDF(notaFile, 'notas');
    if (url) {
      notaUrl = url;
      const nl = document.getElementById('hist-nota-link');
      nl.href = url; nl.style.display = 'inline'; nl.textContent = 'Ver Nota';
      document.getElementById('hist-nota-url').value = url;
    }
  }
  if (boletoFile) {
    showToast('Enviando boleto...');
    const url = await uploadPDF(boletoFile, 'boletos');
    if (url) {
      boletoUrl = url;
      // Show link immediately in modal
      const bl = document.getElementById('hist-boleto-link');
      bl.href = url; bl.style.display = 'inline'; bl.textContent = 'Ver Boleto';
      document.getElementById('hist-boleto-url').value = url;
    }
  }

  const obj = {
    fornecedor_id: parseInt(fornId),
    servico,
    competencia: document.getElementById('hist-competencia').value,
    valor: parseFloat(document.getElementById('hist-valor').value) || 0,
    fluxo: document.getElementById('hist-fluxo').value,
    enviado_contas_pagar: document.getElementById('hist-enviado-cp').checked,
    lancado_pagamento: document.getElementById('hist-lancado').checked,
    lancado_sistema: document.getElementById('hist-lancado-sistema').checked,
    tipo_servico: document.getElementById('hist-tipo-servico').value,
    data_nf: document.getElementById('hist-data-nf').value || null,
    dt_vencimento: document.getElementById('hist-vencimento').value || null,
    observacoes: document.getElementById('hist-obs').value,
    nota_url: notaUrl,
    boleto_url: boletoUrl,
  };
  const editId = document.getElementById('hist-edit-id').value;
  if (editId) {
    const { error, data } = await sb.from('fornecedores_historico').update(obj).eq('id', parseInt(editId)).select();
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Registro atualizado!');
  } else {
    const { error } = await sb.from('fornecedores_historico').insert(obj);
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Historico adicionado!');
  }
  closeHistoricoModal();
  await refreshData();
}

