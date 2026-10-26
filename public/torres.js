// ===== TORRES =====
function renderTorres() {
  const T = DATA.torres;
  const instaladas = T.filter(d => d.status==='INSTALADA').length;
  const autorizadas = T.filter(d => d.status==='AUTORIZADA').length;
  const emAut = T.filter(d => d.status==='EM AUTORIZAÇÃO').length;
  const totalPago = T.reduce((s,d) => s + Number(d.pago_forn), 0);
  const totalCam = T.reduce((s,d) => s + d.cameras, 0);

  document.getElementById('torres-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--blue)"></div><div class="kpi-card-icon" style="background:var(--blue-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M4 21V10l8-7 8 7v11"/><path d="M9 21v-6h6v6"/></svg></div><div class="kpi-label">Total Torres</div><div class="kpi-value blue">${T.length}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--accent)"></div><div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="kpi-label">Instaladas</div><div class="kpi-value accent">${instaladas}</div><div class="kpi-sub"><span class="kpi-tag kpi-tag-up">${totalCam} cameras</span></div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:#2a78d6"></div><div class="kpi-card-icon" style="background:rgba(42,120,214,0.12)"><svg viewBox="0 0 24 24" fill="none" stroke="#2a78d6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="kpi-label">Autorizadas</div><div class="kpi-value blue">${autorizadas}</div><div class="kpi-sub">aguardando instalacao</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--warning)"></div><div class="kpi-card-icon" style="background:var(--warning-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M12 2l10 18H2z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5"/></svg></div><div class="kpi-label">Em Autorizacao</div><div class="kpi-value warning">${emAut}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--danger)"></div><div class="kpi-card-icon" style="background:var(--danger-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="kpi-label">Pago ao Fornecedor</div><div class="kpi-value danger">${fmtVal(totalPago)}</div></div>`;

  // Charts
  const tSt = {}, tCid = {};
  T.forEach(d => { tSt[d.status] = (tSt[d.status]||0)+1; tCid[d.cidade] = (tCid[d.cidade]||0)+1; });
  document.getElementById('torres-charts').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Torres por Status</div></div><div class="chart-card-badge">pipeline</div></div><div class="chart-card-body" id="tc-st"></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Torres por Cidade</div></div><div class="chart-card-badge">top cidades</div></div><div class="chart-card-body" id="tc-cid"></div></div>`;
  hBar('tc-st', Object.entries(tSt).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,t:v+''})), ['#1abf8f','#2a78d6','#eda100','#e34948','#8a9bb5','#e87ba4','#4a3aa7']);
  hBar('tc-cid', Object.entries(tCid).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([l,v])=>({l,v,t:v+''})), ['#2a78d6','#1abf8f','#eb6834','#eda100','#e87ba4']);

  renderTorresTable();
}

function renderTorresTable() {
  const T = DATA.torres;
  const stEl = document.querySelector('#torres-filters [data-filter="status"]');
  const srEl = document.querySelector('#torres-filters [data-filter="search"]');
  const grEl = document.querySelector('#torres-filters [data-filter="grat"]');
  const iaEl = document.querySelector('#torres-filters [data-filter="ia"]');
  const iaF = iaEl ? iaEl.value : '';
  const st = stEl ? stEl.value : '';
  const search = srEl ? srEl.value.toLowerCase() : '';
  const gr = grEl ? grEl.value : '';

  let filtered = T.filter(d => {
    if (st && d.status !== st) return false;
    const dias = diasAte(d.data_fim_gratificacao);
    if (gr === 'vencendo' && !(dias !== null && dias >= 0 && dias <= 30)) return false;
    if (gr === 'vencidas' && !(dias !== null && dias < 0)) return false;
    if (gr === 'semdata' && d.data_fim_gratificacao) return false;
    if (gr === 'chkpend' && !(d.status === 'INSTALADA' && torreChecklist(d) < 4)) return false;
    if (iaF === 'sem' && d.forn_ia) return false;
    if (iaF && iaF !== 'sem' && d.forn_ia !== iaF) return false;
    if (search && !d.cliente.toLowerCase().includes(search)) return false;
    return true;
  });

  document.getElementById('torres-filters').innerHTML = `
    <select class="filter-select" data-filter="status" onchange="renderTorresTable()">
      <option value="">Todos os Status</option>
      <option value="INSTALADA" ${st==='INSTALADA'?'selected':''}>Instalada</option>
      <option value="AUTORIZADA" ${st==='AUTORIZADA'?'selected':''}>Autorizada</option>
      <option value="EM AUTORIZAÇÃO" ${st==='EM AUTORIZAÇÃO'?'selected':''}>Em Autorizacao</option>
      <option value="NÃO AUTORIZADA" ${st==='NÃO AUTORIZADA'?'selected':''}>Nao Autorizada</option>
      <option value="SEGUNDO PLANO" ${st==='SEGUNDO PLANO'?'selected':''}>Segundo Plano</option>
      <option value="AVALIAR/AGUARDAR" ${st==='AVALIAR/AGUARDAR'?'selected':''}>Avaliar/Aguardar</option>
    </select>
    <select class="filter-select" data-filter="ia" onchange="renderTorresTable()">
      <option value="">Todas as IAs</option>
      ${['Segware','Octos','Monuv'].map(x => `<option value="${x}" ${iaF===x?'selected':''}>${x}</option>`).join('')}
      <option value="sem" ${iaF==='sem'?'selected':''}>Sem IA</option>
    </select>
    <select class="filter-select" data-filter="grat" onchange="renderTorresTable()">
      <option value="">Gratificação / Checklist</option>
      <option value="vencendo" ${gr==='vencendo'?'selected':''}>Vencendo em 30 dias</option>
      <option value="vencidas" ${gr==='vencidas'?'selected':''}>Gratificação vencida</option>
      <option value="semdata" ${gr==='semdata'?'selected':''}>Sem data de término</option>
      <option value="chkpend" ${gr==='chkpend'?'selected':''}>Instaladas c/ checklist pendente</option>
    </select>
    <input class="filter-input" data-filter="search" placeholder="Buscar cliente..." oninput="renderTorresTable()" style="width:200px" value="${search}">`;

  document.getElementById('torres-table-wrap').innerHTML = `
    <table><thead><tr><th>Cliente</th><th>Cidade</th><th>Status</th><th>Modelo</th><th>Fornecedores</th><th style="text-align:right">Câmeras</th><th style="text-align:right">Pago Forn.</th><th style="text-align:right">Cobrado</th><th>Fim Gratif.</th><th style="text-align:center">Checklist</th><th>Responsável</th><th>Ações</th></tr></thead>
    <tbody>${filtered.map(d => {
      const stBadge = d.status==='INSTALADA'?'badge-success':d.status==='AUTORIZADA'?'badge-blue':d.status==='EM AUTORIZAÇÃO'?'badge-warning':d.status==='NÃO AUTORIZADA'?'badge-danger':'badge-neutral';
      const dias = diasAte(d.data_fim_gratificacao);
      const gratCell = dias === null ? '<span style="color:var(--text-muted)">—</span>'
        : `<span class="badge ${dias < 0 ? 'badge-danger' : dias <= 30 ? 'badge-warning' : 'badge-neutral'}" title="${dias < 0 ? 'Vencida há ' + (-dias) + ' dia(s)' : 'Faltam ' + dias + ' dia(s)'}">${fmtDataBR(d.data_fim_gratificacao)}</span>`;
      const ck = torreChecklist(d);
      const ckTip = `App: ${d.chk_usando_app?'✔':'✘'} | Detecção: ${d.chk_deteccao_teste?'✔':'✘'} | Câmeras: ${d.chk_cameras_online?'✔':'✘'} | Treinado: ${d.chk_cliente_treinado?'✔':'✘'}${d.chk_data_verificacao ? ' — verificado em ' + fmtDataBR(d.chk_data_verificacao) : ''}`;
      const ckCell = `<span class="badge ${ck === 4 ? 'badge-success' : ck === 0 ? 'badge-neutral' : 'badge-warning'}" title="${ckTip}" style="cursor:help">${ck}/4</span>`;
      const obsIco = d.observacao ? `<span class="tm-obs-ico" title="${escAttr(d.observacao)}">📝</span>` : '';
      return `<tr><td>${d.cliente}${obsIco}</td><td>${d.cidade}</td><td><span class="badge ${stBadge}">${d.status}</span></td><td>${d.modelo}</td><td>${fornTorreCell(d)}</td><td style="text-align:right">${d.cameras||'—'}</td><td style="text-align:right;font-variant-numeric:tabular-nums" title="${d.valor_imagem!=null||d.valor_ia!=null ? 'Sigma Image: ' + fmtVal(d.valor_imagem||0) + ' | IA: ' + fmtVal(d.valor_ia||0) : 'Valor total (sem divisão)'}">${d.pago_forn?fmtVal(d.pago_forn):'—'}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${d.cobrado?fmtVal(d.cobrado):'—'}</td><td>${gratCell}</td><td style="text-align:center">${ckCell}</td><td>${d.responsavel}</td><td style="white-space:nowrap"><button class="btn btn-outline btn-sm" onclick="openTorreModal(${d.id})" style="margin-right:4px">Editar</button><button class="btn btn-outline btn-sm" onclick="deleteTorre(${d.id})" style="color:var(--danger)">Excluir</button></td></tr>`;
    }).join('')}</tbody></table>`;
}


// ===== TORRE CRUD =====
function normCidade(s) { return (s || '').trim().toUpperCase(); }
function filialDaCidade(cidade) {
  const r = (DATA.cidadesFilial || []).find(c => c.cidade === normCidade(cidade));
  return r ? r.filial : null;
}
function openCidadeModal() {
  const sel = document.getElementById('cid-filial');
  const nomes = [...new Set(['Servis Ceará','Servis Amazonas','Servis Maranhão','Secopi Piauí',
    ...DATA.iaFilial.map(d => d.filial), ...DATA.armResumo.map(d => d.filial)].filter(Boolean))].sort();
  sel.innerHTML = nomes.map(n => `<option value="${n}">${n}</option>`).join('');
  document.getElementById('cid-nome').value = '';
  document.getElementById('cid-modal').classList.add('open');
}
function closeCidadeModal() { document.getElementById('cid-modal').classList.remove('open'); }
async function saveCidadeFilial() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const cidade = normCidade(document.getElementById('cid-nome').value);
  const filial = document.getElementById('cid-filial').value;
  if (!cidade) { showToast('Informe o nome da cidade', true); return; }
  const { error } = await sb.from('cidades_filial').upsert({ cidade, filial });
  if (error) { showToast('Erro: ' + error.message, true); return; }
  showToast('Cidade salva!');
  closeCidadeModal();
  await refreshData();
}
function openTorreModal(editId) {
  document.getElementById('torre-modal').classList.add('open');
  if (editId) {
    const d = DATA.torres.find(t => t.id === editId);
    if (!d) return;
    document.getElementById('torre-modal-title').textContent = 'Editar Torre';
    document.getElementById('torre-edit-id').value = d.id;
    document.getElementById('tm-cliente').value = d.cliente || '';
    document.getElementById('tm-cidade').value = d.cidade || 'FORTALEZA';
    document.getElementById('tm-status').value = d.status || 'EM AUTORIZAÇÃO';
    document.getElementById('tm-modelo').value = d.modelo || 'CORTESIA 6 MESES';
    document.getElementById('tm-cameras').value = d.cameras || '0';
    document.getElementById('tm-forn-imagem').value = d.forn_imagem == null ? 'Sigma Image' : d.forn_imagem;
    document.getElementById('tm-forn-ia').value = d.forn_ia || '';
    const semDivisao = d.valor_imagem == null && d.valor_ia == null;
    document.getElementById('tm-valor-imagem').value = semDivisao ? (d.pago_forn || '') : (d.valor_imagem ?? '');
    document.getElementById('tm-valor-ia').value = semDivisao ? '' : (d.valor_ia ?? '');
    somaFornTorre();
    document.getElementById('tm-cobrado').value = d.cobrado || '';
    document.getElementById('tm-responsavel').value = d.responsavel || '';
    document.getElementById('tm-data-fim').value = d.data_fim_gratificacao || '';
    document.getElementById('tm-obs').value = d.observacao || '';
    document.getElementById('tm-chk-app').checked = !!d.chk_usando_app;
    document.getElementById('tm-chk-deteccao').checked = !!d.chk_deteccao_teste;
    document.getElementById('tm-chk-cameras').checked = !!d.chk_cameras_online;
    document.getElementById('tm-chk-treinado').checked = !!d.chk_cliente_treinado;
    document.getElementById('tm-chk-data').value = d.chk_data_verificacao || '';
  } else {
    document.getElementById('torre-modal-title').textContent = 'Nova Torre';
    document.getElementById('torre-edit-id').value = '';
    document.getElementById('tm-cliente').value = '';
    document.getElementById('tm-cidade').value = 'FORTALEZA';
    document.getElementById('tm-status').value = 'EM AUTORIZAÇÃO';
    document.getElementById('tm-modelo').value = 'CORTESIA 6 MESES';
    document.getElementById('tm-cameras').value = '0';
    document.getElementById('tm-forn-imagem').value = 'Sigma Image';
    document.getElementById('tm-forn-ia').value = '';
    document.getElementById('tm-valor-imagem').value = '';
    document.getElementById('tm-valor-ia').value = '';
    somaFornTorre();
    document.getElementById('tm-cobrado').value = '';
    document.getElementById('tm-responsavel').value = '';
    document.getElementById('tm-data-fim').value = '';
    document.getElementById('tm-obs').value = '';
    ['tm-chk-app','tm-chk-deteccao','tm-chk-cameras','tm-chk-treinado'].forEach(id => document.getElementById(id).checked = false);
    document.getElementById('tm-chk-data').value = '';
  }
  updateGratHint();
}
function hojeISO() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function diasAte(iso) {
  if (!iso) return null;
  const [y,m,d] = iso.split('-').map(Number);
  const alvo = new Date(y, m-1, d); const h = new Date(); h.setHours(0,0,0,0);
  return Math.round((alvo - h) / 86400000);
}
function fmtDataBR(iso) { if (!iso) return '—'; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; }
function escAttr(t) { return String(t||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function chkTouched() { const el = document.getElementById('tm-chk-data'); if (!el.value) el.value = hojeISO(); }
function sugerirFimGrat() {
  const m = (document.getElementById('tm-modelo').value.match(/(\d+)\s*MES/i) || [])[1];
  if (!m) { showToast('O modelo não tem quantidade de meses (ex.: CORTESIA 6 MESES)', true); return; }
  const d = new Date(); d.setMonth(d.getMonth() + parseInt(m));
  document.getElementById('tm-data-fim').value = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  updateGratHint();
}
function updateGratHint() {
  const el = document.getElementById('tm-grat-hint'); if (!el) return;
  const n = diasAte(document.getElementById('tm-data-fim').value);
  if (n === null) { el.textContent = 'Sem data definida'; el.style.color = ''; return; }
  if (n < 0) { el.textContent = `Vencida há ${-n} dia(s)`; el.style.color = 'var(--danger)'; }
  else if (n <= 30) { el.textContent = `Vence em ${n} dia(s)`; el.style.color = 'var(--warning)'; }
  else { el.textContent = `Faltam ${n} dias`; el.style.color = 'var(--accent)'; }
}
function torreChecklist(d) {
  return [d.chk_usando_app, d.chk_deteccao_teste, d.chk_cameras_online, d.chk_cliente_treinado].filter(Boolean).length;
}
function somaFornTorre() {
  const img = document.getElementById('tm-valor-imagem'), ia = document.getElementById('tm-valor-ia');
  const temImg = !!document.getElementById('tm-forn-imagem').value, temIa = !!document.getElementById('tm-forn-ia').value;
  img.disabled = !temImg; ia.disabled = !temIa;
  img.placeholder = temImg ? '0,00' : 'Sem fornecedor de imagem'; ia.placeholder = temIa ? '0,00' : 'Sem IA';
  const t = (temImg ? parseFloat(img.value) || 0 : 0) + (temIa ? parseFloat(ia.value) || 0 : 0);
  document.getElementById('tm-pago').value = t ? t.toFixed(2) : '';
}
function fornTorreCell(d) {
  const cor = { Segware: '#2563eb', Octos: '#7c3aed', Monuv: '#0891b2' };
  const p = [];
  if (d.forn_imagem) p.push(`<span class="badge badge-neutral" title="Fornecedor de imagem">${d.forn_imagem}</span>`);
  if (d.forn_ia) p.push(`<span class="badge" title="Fornecedor da IA" style="color:${cor[d.forn_ia]||'#475569'};background:${(cor[d.forn_ia]||'#475569')}1a">IA · ${d.forn_ia}</span>`);
  return p.length ? `<span style="display:inline-flex;gap:4px;flex-wrap:wrap">${p.join('')}</span>` : '<span style="color:var(--text-muted)">—</span>';
}
function closeTorreModal() { document.getElementById('torre-modal').classList.remove('open'); }

async function saveTorre() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const cliente = document.getElementById('tm-cliente').value.trim();
  if (!cliente) { showToast('Preencha o nome do cliente', true); return; }
  const obj = {
    cliente,
    cidade: document.getElementById('tm-cidade').value.toUpperCase(),
    status: document.getElementById('tm-status').value,
    modelo: document.getElementById('tm-modelo').value,
    cameras: parseInt(document.getElementById('tm-cameras').value) || 0,
    forn_imagem: document.getElementById('tm-forn-imagem').value || null,
    forn_ia: document.getElementById('tm-forn-ia').value || null,
    valor_imagem: document.getElementById('tm-forn-imagem').value ? (parseFloat(document.getElementById('tm-valor-imagem').value) || 0) : null,
    valor_ia: document.getElementById('tm-forn-ia').value ? (parseFloat(document.getElementById('tm-valor-ia').value) || 0) : null,
    pago_forn: parseFloat(document.getElementById('tm-pago').value) || 0,
    cobrado: parseFloat(document.getElementById('tm-cobrado').value) || 0,
    responsavel: document.getElementById('tm-responsavel').value,
    data_fim_gratificacao: document.getElementById('tm-data-fim').value || null,
    observacao: document.getElementById('tm-obs').value.trim() || null,
    chk_usando_app: document.getElementById('tm-chk-app').checked,
    chk_deteccao_teste: document.getElementById('tm-chk-deteccao').checked,
    chk_cameras_online: document.getElementById('tm-chk-cameras').checked,
    chk_cliente_treinado: document.getElementById('tm-chk-treinado').checked,
    chk_data_verificacao: document.getElementById('tm-chk-data').value || null,
  };
  const filial = filialDaCidade(obj.cidade);
  if (!filial) { showToast('Cidade "' + obj.cidade + '" não cadastrada. Use "+ Cidade" no dashboard.', true); return; }
  obj.filial = filial;
  obj.updated_at = new Date().toISOString();
  const editId = document.getElementById('torre-edit-id').value;
  let error;
  if (editId) {
    ({ error } = await sb.from('torres').update(obj).eq('id', parseInt(editId)));
  } else {
    ({ error } = await sb.from('torres').insert(obj));
  }
  if (error) { showToast('Erro: ' + error.message, true); return; }
  showToast(editId ? 'Torre atualizada!' : 'Torre adicionada!');
  closeTorreModal();
  await refreshData();
}

async function deleteTorre(id) {
  if (!sb || !confirm('Excluir esta torre?')) return;
  const { error } = await sb.from('torres').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.torres = DATA.torres.filter(d => d.id !== id);
  renderTorres();
  showToast('Excluido!');
}

