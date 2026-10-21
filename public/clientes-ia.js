// ===== CLIENTES IA =====
let currentIATab = 'todos';
function showIATab(btn, tab) {
  document.querySelectorAll('#sec-clientes .tab-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  currentIATab = tab;
  renderIA();
}

let iaSearchVal = '', iaFilterFilial = '', iaFilterStatus = '', iaFilterBonif = '';
function renderIA() {
  const ALL = DATA.iaDetail;
  const tabFiltered = currentIATab === 'todos' ? ALL : ALL.filter(d => (d.provedor||'') === currentIATab);

  // Apply search/filters
  let filtered = tabFiltered;
  if (iaSearchVal) filtered = filtered.filter(r => (r.nome_cliente||'').toLowerCase().includes(iaSearchVal.toLowerCase()));
  if (iaFilterFilial) filtered = filtered.filter(r => (r.filial||'') === iaFilterFilial);
  if (iaFilterStatus) filtered = filtered.filter(r => (r.status||'') === iaFilterStatus);
  if (iaFilterBonif) filtered = filtered.filter(r => (r.tipo_bonificacao||'') === iaFilterBonif);

  // KPI calculations from ALL data (not filtered)
  const totalCli = tabFiltered.length;
  const ativosCli = tabFiltered.filter(d => d.status === 'Ativo').length;
  const inativosCli = tabFiltered.filter(d => d.status !== 'Ativo').length;
  const totalIA = tabFiltered.reduce((s,d) => s + (d.qtd_ia || 0), 0);
  const totalCamIA = tabFiltered.reduce((s,d) => s + (d.camera_com_ia || d.qtd_ia || 0), 0);
  const bonifPropria = tabFiltered.filter(d => (d.tipo_bonificacao||'') === 'Própria').length;
  const bonifCruzada = tabFiltered.filter(d => (d.tipo_bonificacao||'') === 'Cruzada').length;
  const semIA = tabFiltered.filter(d => (d.tipo_bonificacao||'') === 'Sem IA').length;
  const comGrat = tabFiltered.filter(d => (d.gratificacao||'') === 'Sim').length;
  const semGrat = tabFiltered.filter(d => (d.gratificacao||'') !== 'Sim').length;

  document.getElementById('ia-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:#eb6834"></div><div class="kpi-card-icon" style="background:rgba(235,104,52,0.12)"><svg viewBox="0 0 24 24" fill="none" stroke="#eb6834" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="kpi-label">Clientes</div><div class="kpi-value" style="color:#eb6834">${totalCli}</div><div class="kpi-sub"><span class="kpi-tag kpi-tag-up">${ativosCli} ativos</span> ${inativosCli} inativos</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--blue)"></div><div class="kpi-card-icon" style="background:var(--blue-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><circle cx="12" cy="12" r="4"/></svg></div><div class="kpi-label">Câmeras com IA</div><div class="kpi-value blue">${totalCamIA}</div><div class="kpi-sub">${totalIA} IAs instaladas</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--accent)"></div><div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="kpi-label">Bonif. Propria</div><div class="kpi-value accent">${bonifPropria}</div><div class="kpi-sub">Cruzada: ${bonifCruzada} · Sem IA: ${semIA}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--warning)"></div><div class="kpi-card-icon" style="background:var(--warning-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="kpi-label">Gratificacao</div><div class="kpi-value warning">${comGrat}</div><div class="kpi-sub">com gratif. · ${semGrat} sem</div></div>`;

  // Charts: IA by provedor and by filial
  const byProv = {}, byFilial = {};
  const src = currentIATab === 'todos' ? ALL : tabFiltered;
  src.forEach(d => {
    byProv[d.provedor||'Outros'] = (byProv[d.provedor||'Outros']||0) + 1;
    byFilial[d.filial||'Outros'] = (byFilial[d.filial||'Outros']||0) + 1;
  });
  document.getElementById('ia-charts').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Clientes por Provedor</div></div></div><div class="chart-card-body" id="ic-prov"></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Clientes por Filial</div></div></div><div class="chart-card-body" id="ic-fil"></div></div>`;
  hBar('ic-prov', Object.entries(byProv).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,t:v+' clientes'})), ['#eb6834','#2a78d6','#1abf8f','#eda100']);
  hBar('ic-fil', Object.entries(byFilial).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,t:v+' clientes'})), ['#2a78d6','#1abf8f','#eb6834','#eda100']);

  // Summary breakdowns: por Filial, por Modalidade, por Provedor
  const byFilialSummary = {}, byModalidade = {}, byProvSummary = {};
  tabFiltered.forEach(d => {
    const fil = d.filial || 'Outros';
    const mod = d.modalidade || 'Outros';
    const prov = d.provedor || 'Outros';
    if (!byFilialSummary[fil]) byFilialSummary[fil] = { total: 0, propria: 0, cruzada: 0, semIA: 0 };
    if (!byModalidade[mod]) byModalidade[mod] = { total: 0, propria: 0, cruzada: 0, semIA: 0 };
    if (!byProvSummary[prov]) byProvSummary[prov] = { total: 0, propria: 0, cruzada: 0, semIA: 0 };
    [byFilialSummary[fil], byModalidade[mod], byProvSummary[prov]].forEach(g => {
      g.total++;
      if ((d.tipo_bonificacao||'') === 'Própria') g.propria++;
      else if ((d.tipo_bonificacao||'') === 'Cruzada') g.cruzada++;
      else g.semIA++;
    });
  });

  function summaryTable(title, data) {
    const entries = Object.entries(data).sort((a,b) => b[1].total - a[1].total);
    return `<div class="card"><div class="card-header"><div class="card-title">${title}</div></div><div class="card-body"><div class="table-wrap"><table><thead><tr><th>${title.replace('Por ','')}</th><th style="text-align:right">Total</th><th style="text-align:right">Propria</th><th style="text-align:right">Cruzada</th><th style="text-align:right">Sem IA</th></tr></thead><tbody>${entries.map(([k,v])=>`<tr><td>${k}</td><td style="text-align:right;font-weight:600">${v.total}</td><td style="text-align:right">${v.propria}</td><td style="text-align:right">${v.cruzada}</td><td style="text-align:right">${v.semIA}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  }
  document.getElementById('ia-summary-breakdowns').innerHTML =
    summaryTable('Por Filial', byFilialSummary) +
    summaryTable('Por Modalidade', byModalidade) +
    summaryTable('Por Provedor', byProvSummary);

  // Filters
  const allFiliais = [...new Set(ALL.map(d => d.filial).filter(Boolean))].sort();
  document.getElementById('ia-filters').innerHTML = `
    <input class="form-input" style="max-width:240px;padding:7px 12px;font-size:12px" placeholder="Buscar cliente..." value="${iaSearchVal}" oninput="iaSearchVal=this.value;renderIA()">
    <select class="filter-select" onchange="iaFilterFilial=this.value;renderIA()">
      <option value="">Todas as Filiais</option>
      ${allFiliais.map(f=>`<option value="${f}" ${iaFilterFilial===f?'selected':''}>${f}</option>`).join('')}
    </select>
    <select class="filter-select" onchange="iaFilterStatus=this.value;renderIA()">
      <option value="">Todos os Status</option>
      <option value="Ativo" ${iaFilterStatus==='Ativo'?'selected':''}>Ativo</option>
      <option value="Inativo" ${iaFilterStatus==='Inativo'?'selected':''}>Inativo</option>
    </select>
    <select class="filter-select" onchange="iaFilterBonif=this.value;renderIA()">
      <option value="">Todas as Bonif.</option>
      <option value="Própria" ${iaFilterBonif==='Própria'?'selected':''}>Propria</option>
      <option value="Cruzada" ${iaFilterBonif==='Cruzada'?'selected':''}>Cruzada</option>
      <option value="Sem IA" ${iaFilterBonif==='Sem IA'?'selected':''}>Sem IA</option>
    </select>
    <div style="flex:1"></div>
    <button class="btn btn-outline btn-sm" onclick="exportIAExcel()" style="font-size:11px">Exportar Excel</button>
    <div style="font-size:12px;color:var(--text-muted)">${filtered.length} de ${tabFiltered.length} registros</div>`;

  // Detail table - matching spreadsheet "Base Tratada"
  document.getElementById('ia-detail-table').innerHTML = `
    <div class="card-header"><div class="card-title">Base Tratada — ${currentIATab==='todos'?'Todos os Provedores':currentIATab}</div></div>
    <div class="card-body"><div class="table-wrap" style="max-height:55vh;overflow-y:auto">
      <table><thead><tr><th>ID</th><th>Nome do Cliente</th><th>Filial</th><th>Modalidade</th><th>IA Instalada</th>${currentIATab==='todos'?'<th>Provedor</th>':''}<th>Tipo Bonif.</th><th style="text-align:right">Qtd IA</th><th style="text-align:right">Cam. IA</th><th>Modelo DVR</th><th>Servidor</th><th>Status</th><th>Gratif.</th><th>Obs.</th><th>Ações</th></tr></thead>
      <tbody>${filtered.map(d => {
        const stBadge = d.status==='Ativo'?'badge-success':'badge-neutral';
        const bonifMap = {'Própria':'badge-warning','Cruzada':'badge-blue','Sem IA':'badge-neutral'};
        const bonBadge = bonifMap[d.tipo_bonificacao] || 'badge-neutral';
        const gratBadge = d.gratificacao==='Sim'?'badge-success':'badge-neutral';
        return `<tr>
          <td style="color:var(--text-muted);font-size:11px">${d.id}</td>
          <td>${d.nome_cliente||''}</td>
          <td>${d.filial||''}</td>
          <td>${d.modalidade||''}</td>
          <td><span class="badge ${d.ia_instalada==='Sim'||!d.ia_instalada?'badge-success':'badge-neutral'}">${d.ia_instalada||'Sim'}</span></td>
          ${currentIATab==='todos'?`<td><span class="badge badge-blue">${d.provedor||''}</span></td>`:''}
          <td><span class="badge ${bonBadge}">${d.tipo_bonificacao||'Própria'}</span></td>
          <td style="text-align:right">${d.qtd_ia||0}</td>
          <td style="text-align:right">${d.camera_com_ia||d.qtd_ia||0}</td>
          <td style="font-size:11px">${d.modelo_dvr||'—'}</td>
          <td style="font-size:11px">${d.servidor||'—'}</td>
          <td><span class="badge ${stBadge}">${d.status||''}</span></td>
          <td><span class="badge ${gratBadge}">${d.gratificacao||'Não'}</span></td>
          <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(d.observacoes||'').replace(/"/g,'&quot;')}">${d.observacoes||'—'}</td>
          <td style="white-space:nowrap"><button class="btn btn-outline btn-sm" onclick="editIADetail(${d.id})" style="margin-right:4px">Editar</button><button class="btn btn-outline btn-sm" onclick="deleteIADetail(${d.id})" style="color:var(--danger)">Excluir</button></td>
        </tr>`;
      }).join('')}${filtered.length===0?'<tr><td colspan="15" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum registro encontrado</td></tr>':''}</tbody></table>
    </div></div>`;
}

function exportIAExcel() {
  const ALL = DATA.iaDetail;
  const tabFiltered = currentIATab === 'todos' ? ALL : ALL.filter(d => (d.provedor||'') === currentIATab);
  let rows = tabFiltered;
  if (iaSearchVal) rows = rows.filter(r => (r.nome_cliente||'').toLowerCase().includes(iaSearchVal.toLowerCase()));
  if (iaFilterFilial) rows = rows.filter(r => (r.filial||'') === iaFilterFilial);
  if (iaFilterStatus) rows = rows.filter(r => (r.status||'') === iaFilterStatus);
  if (iaFilterBonif) rows = rows.filter(r => (r.tipo_bonificacao||'') === iaFilterBonif);

  let csv = '﻿';
  csv += 'ID;Nome do Cliente;Filial;Modalidade;IA Instalada;Provedor;Tipo Bonificacao;Qtd IA;Camera com IA;Modelo DVR;Servidor;Status;Gratificacao;Observacoes\n';
  rows.forEach(d => {
    csv += [d.id,d.nome_cliente||'',d.filial||'',d.modalidade||'',d.ia_instalada||'Sim',d.provedor||'',d.tipo_bonificacao||'',d.qtd_ia||0,d.camera_com_ia||d.qtd_ia||0,d.modelo_dvr||'',d.servidor||'',d.status||'',d.gratificacao||'Não',d.observacoes||''].join(';') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'clientes_ia.csv'; a.click();
  URL.revokeObjectURL(url);
}


// ===== CLIENTES IA CRUD =====
function openIAModal() {
  document.getElementById('ia-modal').classList.add('open');
  document.getElementById('ia-modal-title').textContent = 'Novo Registro IA';
  document.getElementById('ia-edit-id').value = '';
  document.getElementById('iam-nome').value = '';
  document.getElementById('iam-filial').value = 'FORTALEZA';
  document.getElementById('iam-modalidade').value = 'Mensal';
  document.getElementById('iam-ia-instalada').value = 'Sim';
  document.getElementById('iam-provedor').value = currentIATab !== 'todos' ? currentIATab : '';
  document.getElementById('iam-tipo-bonif').value = 'Própria';
  document.getElementById('iam-qtd').value = '0';
  document.getElementById('iam-camera-ia').value = '0';
  document.getElementById('iam-modelo-dvr').value = '';
  document.getElementById('iam-servidor').value = '';
  document.getElementById('iam-status').value = 'Ativo';
  document.getElementById('iam-gratificacao').value = 'Não';
  document.getElementById('iam-bonificacao').value = 'Não';
  document.getElementById('iam-custo').value = '';
  document.getElementById('iam-receita').value = '';
  document.getElementById('iam-observacoes').value = '';
}
function editIADetail(id) {
  const d = DATA.iaDetail.find(r => r.id === id);
  if (!d) return;
  document.getElementById('ia-modal').classList.add('open');
  document.getElementById('ia-modal-title').textContent = 'Editar Registro IA';
  document.getElementById('ia-edit-id').value = d.id;
  document.getElementById('iam-nome').value = d.nome_cliente || '';
  document.getElementById('iam-filial').value = d.filial || 'FORTALEZA';
  document.getElementById('iam-modalidade').value = d.modalidade || 'Mensal';
  document.getElementById('iam-ia-instalada').value = d.ia_instalada || 'Sim';
  document.getElementById('iam-provedor').value = d.provedor_bonifica || d.provedor || '';
  document.getElementById('iam-tipo-bonif').value = d.tipo_bonificacao || 'Própria';
  document.getElementById('iam-qtd').value = d.qtd_ia || '0';
  document.getElementById('iam-camera-ia').value = d.camera_com_ia || '0';
  document.getElementById('iam-modelo-dvr').value = d.modelo_dvr || '';
  document.getElementById('iam-servidor').value = d.servidor || '';
  document.getElementById('iam-status').value = d.status || 'Ativo';
  document.getElementById('iam-gratificacao').value = d.gratificacao || 'Não';
  document.getElementById('iam-bonificacao').value = d.bonificacao || 'Não';
  document.getElementById('iam-custo').value = d.custo_mensal || '';
  document.getElementById('iam-receita').value = d.receita_mensal || '';
  document.getElementById('iam-observacoes').value = d.observacoes || '';
}
function closeIAModal() { document.getElementById('ia-modal').classList.remove('open'); }

async function saveIA() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const nome = document.getElementById('iam-nome').value.trim();
  if (!nome) { showToast('Preencha o nome do cliente', true); return; }
  const obj = {
    nome_cliente: nome,
    filial: document.getElementById('iam-filial').value,
    modalidade: document.getElementById('iam-modalidade').value,
    ia_instalada: document.getElementById('iam-ia-instalada').value,
    provedor_bonifica: document.getElementById('iam-provedor').value,
    provedor: document.getElementById('iam-provedor').value || 'Sem Provedor',
    tipo_bonificacao: document.getElementById('iam-tipo-bonif').value,
    bonificacao: document.getElementById('iam-bonificacao').value,
    status: document.getElementById('iam-status').value,
    qtd_ia: parseInt(document.getElementById('iam-qtd').value) || 0,
    camera_com_ia: parseInt(document.getElementById('iam-camera-ia').value) || 0,
    modelo_dvr: document.getElementById('iam-modelo-dvr').value.trim(),
    servidor: document.getElementById('iam-servidor').value.trim(),
    gratificacao: document.getElementById('iam-gratificacao').value,
    custo_mensal: parseFloat(document.getElementById('iam-custo').value) || 0,
    receita_mensal: parseFloat(document.getElementById('iam-receita').value) || 0,
    observacoes: document.getElementById('iam-observacoes').value.trim(),
  };
  const editId = document.getElementById('ia-edit-id').value;
  let error;
  if (editId) {
    ({ error } = await sb.from('clientes_ia_detail').update(obj).eq('id', parseInt(editId)));
  } else {
    ({ error } = await sb.from('clientes_ia_detail').insert(obj));
  }
  if (error) { showToast('Erro: ' + error.message, true); return; }
  showToast(editId ? 'Registro atualizado!' : 'Registro adicionado!');
  closeIAModal();
  await refreshData();
}

async function deleteIADetail(id) {
  if (!sb || !confirm('Excluir este registro?')) return;
  const { error } = await sb.from('clientes_ia_detail').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.iaDetail = DATA.iaDetail.filter(d => d.id !== id);
  renderIA();
  showToast('Excluido!');
}

