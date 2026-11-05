// ===== TORRES =====
function renderTorres() {
  const T = DATA.torres;
  const somaQtd = lista => lista.reduce((s, d) => s + qtdTorres(d), 0);
  const instaladas = somaQtd(T.filter(d => d.status==='INSTALADA'));
  const autorizadas = somaQtd(T.filter(d => d.status==='AUTORIZADA'));
  const emAut = somaQtd(T.filter(d => d.status==='EM AUTORIZAÇÃO'));
  const totalTorres = somaQtd(T);
  const totalPago = T.reduce((s,d) => s + Number(d.pago_forn), 0);
  const totalCam = T.reduce((s,d) => s + d.cameras, 0);

  document.getElementById('torres-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--blue)"></div><div class="kpi-card-icon" style="background:var(--blue-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M4 21V10l8-7 8 7v11"/><path d="M9 21v-6h6v6"/></svg></div><div class="kpi-label">Total Torres</div><div class="kpi-value blue">${totalTorres}</div>${totalTorres !== T.length ? `<div class="kpi-sub">${T.length} clientes</div>` : ''}</div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--accent)"></div><div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="kpi-label">Instaladas</div><div class="kpi-value accent">${instaladas}</div><div class="kpi-sub"><span class="kpi-tag kpi-tag-up">${totalCam} cameras</span></div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:#2a78d6"></div><div class="kpi-card-icon" style="background:rgba(42,120,214,0.12)"><svg viewBox="0 0 24 24" fill="none" stroke="#2a78d6" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="kpi-label">Autorizadas</div><div class="kpi-value blue">${autorizadas}</div><div class="kpi-sub">aguardando instalacao</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--warning)"></div><div class="kpi-card-icon" style="background:var(--warning-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M12 2l10 18H2z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5"/></svg></div><div class="kpi-label">Em Autorizacao</div><div class="kpi-value warning">${emAut}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--accent)"></div><div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="kpi-label">Resultado mensal</div><div class="kpi-value ${(() => { const l = T.reduce((a, d) => a + custosTorre(d).lucro, 0); return l >= 0 ? 'accent' : 'danger'; })()}">${(() => { const l = T.reduce((a, d) => a + custosTorre(d).lucro, 0); return (l < 0 ? '−' : '') + fmtVal(Math.abs(l)); })()}</div><div class="kpi-sub">receita − fornecedores</div></div>`;

  // Charts
  const tSt = {}, tCid = {};
  T.forEach(d => { const q = qtdTorres(d); tSt[d.status] = (tSt[d.status]||0)+q; tCid[d.cidade] = (tCid[d.cidade]||0)+q; });
  document.getElementById('torres-charts').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Torres por Status</div></div><div class="chart-card-badge">pipeline</div></div><div class="chart-card-body" id="tc-st"></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Torres por Cidade</div></div><div class="chart-card-badge">top cidades</div></div><div class="chart-card-body" id="tc-cid"></div></div>`;
  hBar('tc-st', Object.entries(tSt).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,t:v+''})), ['#1abf8f','#2a78d6','#eda100','#e34948','#8a9bb5','#e87ba4','#4a3aa7']);
  hBar('tc-cid', Object.entries(tCid).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([l,v])=>({l,v,t:v+''})), ['#2a78d6','#1abf8f','#eb6834','#eda100','#e87ba4']);

  renderTorresFinanceiro();
  renderTorresTable();
}

function renderTorresTable() {
  const _ae = document.activeElement, _foco = _ae && _ae.closest && _ae.closest('#torres-filters') && _ae.dataset.filter ? { f: _ae.dataset.filter, s: _ae.selectionStart } : null;
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
    if (gr === 'gratificadas' && d.gratificada === false) return false;
    if (gr === 'pagas' && d.gratificada !== false) return false;
    if (gr === 'chkpend' && !(d.status === 'INSTALADA' && torreChecklist(d) < 4)) return false;
    if (iaF === 'sem' && d.forn_ia) return false;
    if (iaF && iaF !== 'sem' && d.forn_ia !== iaF) return false;
    if (search && !nzBusca([d.cliente, d.nome_fantasia, d.codigo_cliente, d.chave_sigma].filter(Boolean).join(' ')).includes(nzBusca(search))) return false;
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
      ${['Segware','Monuv','Octos'].map(x => `<option value="${x}" ${iaF===x?'selected':''}>${x}</option>`).join('')}
      <option value="sem" ${iaF==='sem'?'selected':''}>Sem IA</option>
    </select>
    <select class="filter-select" data-filter="grat" onchange="renderTorresTable()">
      <option value="">Gratificação / Checklist</option>
      <option value="vencendo" ${gr==='vencendo'?'selected':''}>Vencendo em 30 dias</option>
      <option value="vencidas" ${gr==='vencidas'?'selected':''}>Gratificação vencida</option>
      <option value="semdata" ${gr==='semdata'?'selected':''}>Sem data de término</option>
      <option value="chkpend" ${gr==='chkpend'?'selected':''}>Instaladas c/ checklist pendente</option>
      <option value="gratificadas" ${gr==='gratificadas'?'selected':''}>Só gratificadas</option>
      <option value="pagas" ${gr==='pagas'?'selected':''}>Só pagas pelo cliente</option>
    </select>
    <input class="filter-input" data-filter="search" placeholder="Buscar cliente, código ou chave..." oninput="renderTorresTable()" style="width:200px" value="${escAttr(srEl ? srEl.value : '')}">`;
  if (_foco) { const _el = document.querySelector('#torres-filters [data-filter="' + _foco.f + '"]'); if (_el) { _el.focus(); try { if (_foco.s != null) _el.setSelectionRange(_foco.s, _foco.s); } catch (e) {} } }

  document.getElementById('torres-table-wrap').innerHTML = `
    <table><thead><tr><th>Cliente</th><th>Cidade</th><th>Status</th><th>Modelo</th><th>Fornecedores</th><th style="text-align:right">Câmeras</th><th style="text-align:right">Pago Forn.</th><th style="text-align:right">Cobrado</th><th style="text-align:right">Margem</th><th>Fim Gratif.</th><th style="text-align:center">Checklist</th><th>Responsável</th><th>Ações</th></tr></thead>
    <tbody>${filtered.map(d => {
      const stBadge = d.status==='INSTALADA'?'badge-success':d.status==='AUTORIZADA'?'badge-blue':d.status==='EM AUTORIZAÇÃO'?'badge-warning':d.status==='NÃO AUTORIZADA'?'badge-danger':'badge-neutral';
      const dias = diasAte(d.data_fim_gratificacao);
      const gratCell = d.gratificada === false ? '<span class="badge badge-blue" title="Cliente paga pelo serviço">Paga</span>' : dias === null ? '<span style="color:var(--text-muted)">—</span>'
        : `<span class="badge ${dias < 0 ? 'badge-danger' : dias <= 30 ? 'badge-warning' : 'badge-neutral'}" title="${dias < 0 ? 'Vencida há ' + (-dias) + ' dia(s)' : 'Faltam ' + dias + ' dia(s)'}">${fmtDataBR(d.data_fim_gratificacao)}</span>`;
      const ck = torreChecklist(d);
      const ckTip = `App: ${d.chk_usando_app?'✔':'✘'} | Detecção: ${d.chk_deteccao_teste?'✔':'✘'} | Câmeras: ${d.chk_cameras_online?'✔':'✘'} | Treinado: ${d.chk_cliente_treinado?'✔':'✘'}${d.chk_data_verificacao ? ' — verificado em ' + fmtDataBR(d.chk_data_verificacao) : ''}`;
      const ckCell = `<span class="badge ${ck === 4 ? 'badge-success' : ck === 0 ? 'badge-neutral' : 'badge-warning'}" title="${ckTip}" style="cursor:help">${ck}/4</span>`;
      const obsIco = d.observacao ? `<span class="tm-obs-ico" title="${escAttr(d.observacao)}">📝</span>` : '';
      const qtdBadge = qtdTorres(d) > 1 ? ` <span class="badge badge-blue" title="Este cliente tem ${qtdTorres(d)} torres">${qtdTorres(d)} torres</span>` : '';
      return `<tr><td>${d.cliente}${qtdBadge}${obsIco}${torreIdent(d)}</td><td>${d.cidade}</td><td><span class="badge ${stBadge}">${d.status}</span></td><td>${d.modelo}</td><td>${fornTorreCell(d)}</td><td style="text-align:right">${d.cameras||'—'}</td><td style="text-align:right;font-variant-numeric:tabular-nums" title="${d.valor_imagem!=null||d.valor_ia!=null||d.valor_servidor!=null ? 'Visualização ' + (d.forn_imagem||'') + ': ' + fmtVal(d.valor_imagem||0) + ' | Inteligência ' + (d.forn_ia||'') + ': ' + fmtVal(Number(d.valor_ia||0) + Number(d.valor_licenca_ia||0)) + (d.valor_servidor ? ' | Servidor Adentro: ' + fmtVal(d.valor_servidor) : '') : 'Valor total (sem divisão)'}">${d.pago_forn?fmtVal(d.pago_forn):'—'}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${d.cobrado?fmtVal(d.cobrado):'—'}</td><td style="text-align:right">${margemCell(d)}</td><td>${gratCell}</td><td style="text-align:center">${ckCell}</td><td>${d.responsavel}</td><td style="white-space:nowrap"><button class="btn btn-outline btn-sm" onclick="openTorreModal(${d.id})" style="margin-right:4px">Editar</button><button class="btn btn-outline btn-sm" onclick="deleteTorre(${d.id})" style="color:var(--danger)">Excluir</button></td></tr>`;
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
    document.getElementById('tm-fantasia').value = d.nome_fantasia || '';
    document.getElementById('tm-codigo').value = d.codigo_cliente || '';
    document.getElementById('tm-chave-sigma').value = d.chave_sigma || '';
    document.getElementById('tm-cidade').value = d.cidade || 'FORTALEZA';
    document.getElementById('tm-status').value = d.status || 'EM AUTORIZAÇÃO';
    document.getElementById('tm-modelo').value = d.modelo || 'CORTESIA 6 MESES';
    document.getElementById('tm-cameras').value = d.cameras || '0';
    document.getElementById('tm-qtd-torres').value = qtdTorres(d);
    document.getElementById('tm-forn-imagem').value = d.forn_imagem == null ? 'Sigma Image' : d.forn_imagem;
    document.getElementById('tm-forn-ia').value = d.forn_ia || '';
    const semDivisao = d.valor_imagem == null && d.valor_ia == null;
    document.getElementById('tm-valor-imagem').value = semDivisao ? (d.pago_forn || '') : (d.valor_imagem ?? '');
    document.getElementById('tm-valor-ia').value = semDivisao ? '' : (d.valor_ia ?? '');
    document.getElementById('tm-valor-licenca').value = d.valor_servidor ?? '';
    somaFornTorre();
    document.getElementById('tm-cobrado').value = d.cobrado || '';
    document.getElementById('tm-responsavel').value = d.responsavel || '';
    document.getElementById('tm-data-fim').value = d.data_fim_gratificacao || '';
    document.getElementById('tm-gratificada').value = d.gratificada === false ? 'nao' : 'sim';
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
    document.getElementById('tm-fantasia').value = '';
    document.getElementById('tm-codigo').value = '';
    document.getElementById('tm-chave-sigma').value = '';
    document.getElementById('tm-cidade').value = 'FORTALEZA';
    document.getElementById('tm-status').value = 'EM AUTORIZAÇÃO';
    document.getElementById('tm-modelo').value = 'CORTESIA 6 MESES';
    document.getElementById('tm-cameras').value = '0';
    document.getElementById('tm-qtd-torres').value = '1';
    document.getElementById('tm-forn-imagem').value = 'Sigma Image';
    document.getElementById('tm-forn-ia').value = '';
    document.getElementById('tm-valor-imagem').value = '';
    document.getElementById('tm-valor-ia').value = '';
    document.getElementById('tm-valor-licenca').value = '';
    somaFornTorre();
    document.getElementById('tm-cobrado').value = '';
    document.getElementById('tm-responsavel').value = '';
    document.getElementById('tm-data-fim').value = '';
    document.getElementById('tm-gratificada').value = 'sim';
    document.getElementById('tm-obs').value = '';
    ['tm-chk-app','tm-chk-deteccao','tm-chk-cameras','tm-chk-treinado'].forEach(id => document.getElementById(id).checked = false);
    document.getElementById('tm-chk-data').value = '';
  }
  gratTipoChange();
  updateGratHint();
}
function gratTipoChange() {
  const sim = document.getElementById('tm-gratificada').value !== 'nao';
  document.getElementById('tm-grat-data-wrap').style.display = sim ? '' : 'none';
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
// Custos por câmera (mensais) de cada fornecedor
// Segware: visualização (Sigma Image) 6,50 + inteligência 4,50 + servidor Adentro 7,50 (R$ 11.262,02 / 1.500 licenças)
// Monuv: visualização 17,00 + inteligência 48,00
const CUSTO_VISUALIZACAO = { 'Sigma Image': 6.50, 'Monuv': 17.00 };
const CUSTO_INTELIGENCIA = { 'Segware': 4.50, 'Monuv': 48.00 };
const CUSTO_SERVIDOR = { 'Segware': 7.50 };
function iaSegwareAuto() {
  const n = Math.max(1, parseInt(document.getElementById('tm-cameras').value) || 0);
  const img = document.getElementById('tm-forn-imagem').value, ia = document.getElementById('tm-forn-ia').value;
  if (CUSTO_VISUALIZACAO[img]) document.getElementById('tm-valor-imagem').value = (n * CUSTO_VISUALIZACAO[img]).toFixed(2);
  if (CUSTO_INTELIGENCIA[ia]) document.getElementById('tm-valor-ia').value = (n * CUSTO_INTELIGENCIA[ia]).toFixed(2);
  if (CUSTO_SERVIDOR[ia]) document.getElementById('tm-valor-licenca').value = (n * CUSTO_SERVIDOR[ia]).toFixed(2);
  somaFornTorre();
}
function somaFornTorre() {
  const $i = id => document.getElementById(id);
  const img = $i('tm-valor-imagem'), ia = $i('tm-valor-ia'), srv = $i('tm-valor-licenca');
  const fornImg = $i('tm-forn-imagem').value, fornIa = $i('tm-forn-ia').value;
  const temSrv = !!CUSTO_SERVIDOR[fornIa];
  img.disabled = !fornImg; ia.disabled = !fornIa;
  img.placeholder = fornImg ? '0,00' : 'Sem fornecedor de imagem'; ia.placeholder = fornIa ? '0,00' : 'Sem IA';
  $i('tm-lic-wrap').style.display = temSrv ? 'grid' : 'none';
  const nomeImg = fornImg;
  if ($i('tm-valor-imagem-label')) $i('tm-valor-imagem-label').textContent = fornImg ? `Visualização ${nomeImg} (R$)` : 'Visualização (R$)';
  $i('tm-valor-ia-label').textContent = fornIa ? `Inteligência ${fornIa} (R$)` : 'Inteligência (R$)';
  const t = (fornImg ? parseFloat(img.value) || 0 : 0) + (fornIa ? parseFloat(ia.value) || 0 : 0) + (temSrv ? parseFloat(srv.value) || 0 : 0);
  $i('tm-pago').value = t ? t.toFixed(2) : '';
  const n = Math.max(1, parseInt($i('tm-cameras').value) || 0);
  const br = v => 'R$ ' + v.toFixed(2).replace('.', ',');
  const conta = (taxa) => taxa ? `${n} câmera(s) × ${br(taxa)} = ${br(n * taxa)}` : '';
  if ($i('tm-img-hint')) $i('tm-img-hint').textContent = conta(CUSTO_VISUALIZACAO[fornImg]);
  if ($i('tm-ia-hint')) $i('tm-ia-hint').textContent = conta(CUSTO_INTELIGENCIA[fornIa]) || (fornIa ? 'Digite o valor' : '');
  if ($i('tm-srv-hint')) $i('tm-srv-hint').textContent = conta(CUSTO_SERVIDOR[fornIa]);
}
// ---- financeiro das torres (valores mensais) ----
function custosTorre(d) {
  const semDivisao = d.valor_imagem == null && d.valor_ia == null && d.valor_licenca_ia == null && d.valor_servidor == null;
  const imagem = semDivisao ? Number(d.pago_forn || 0) : Number(d.valor_imagem || 0);
  const servidor = semDivisao ? 0 : Number(d.valor_servidor || 0);
  const licenca = semDivisao ? 0 : Number(d.valor_ia || 0) + Number(d.valor_licenca_ia || 0);
  const total = Number(d.pago_forn || 0) || (imagem + servidor + licenca);
  const receita = Number(d.cobrado || 0);
  return { imagem, ia: servidor + licenca, servidor, licenca, total, receita, lucro: receita - total };
}
function margemCell(d) {
  const c = custosTorre(d);
  if (!c.total && !c.receita) return '<span style="color:var(--text-muted)">—</span>';
  const cor = c.lucro > 0 ? 'var(--accent)' : c.lucro < 0 ? 'var(--danger)' : 'var(--text-muted)';
  const pct = c.receita ? Math.round(c.lucro / c.receita * 100) + '%' : (d.gratificada === false ? 'sem cobrança' : 'cortesia');
  return `<span style="color:${cor};font-weight:600;font-variant-numeric:tabular-nums">${c.lucro < 0 ? '−' : ''}${fmtVal(Math.abs(c.lucro))}</span><div style="font-size:11px;color:var(--text-muted)">${pct}</div>`;
}
function renderTorresFinanceiro() {
  let box = document.getElementById('torres-fin');
  if (!box) { box = document.createElement('div'); box.id = 'torres-fin'; document.getElementById('torres-charts').before(box); }
  const _TODOS = DATA.torres || [];
  const _filiais = [...new Set(_TODOS.map(d => d.filial || 'Sem filial'))].sort();
  window.TOR_FIN_FILIAL_L = _filiais;
  if (window.TOR_FIN_FILIAL && !_filiais.includes(window.TOR_FIN_FILIAL)) window.TOR_FIN_FILIAL = '';
  const T = window.TOR_FIN_FILIAL ? _TODOS.filter(d => (d.filial || 'Sem filial') === window.TOR_FIN_FILIAL) : _TODOS;
  const R = v => (v < 0 ? '−' : '') + fmtVal(Math.abs(v));
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const cor = v => v >= 0 ? 'var(--accent)' : 'var(--danger)';
  const resumo = lista => {
    const r = { n: 0, clientes: lista.length, total: 0, receita: 0, lucro: 0, custo: {} };
    const add = (k, v) => { if (Math.abs(v) >= 0.005) r.custo[k] = (r.custo[k] || 0) + v; };
    lista.forEach(d => {
      const c = custosTorre(d);
      r.n += qtdTorres(d); r.total += c.total; r.receita += c.receita; r.lucro += c.lucro;
      add('Imagem · ' + (d.forn_imagem || 'outros'), c.imagem);
      add('Inteligência · ' + (d.forn_ia || 'outros'), c.licenca);
      add('Servidor Adentro (IA Segware)', c.servidor);
      add('Ajustes manuais', c.total - c.imagem - c.ia);
    });
    return r;
  };
  const g = resumo(T), pagas = resumo(T.filter(d => d.gratificada === false)), grat = resumo(T.filter(d => d.gratificada !== false));
  const num = (l, v, s, c) => `<div style="padding:14px 16px;border:1px solid var(--border);border-radius:10px;background:var(--bg-soft)"><div style="font-size:12px;font-weight:600;color:var(--text-muted)">${l}</div><div style="font-size:22px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums;color:${c || 'var(--text-primary)'}">${v}</div>${s ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${s}</div>` : ''}</div>`;
  const barras = r => {
    const itens = Object.entries(r.custo).sort((a, b) => b[1] - a[1]);
    if (!itens.length) return '<div style="color:var(--text-muted);font-size:13px">Sem custos cadastrados.</div>';
    const max = Math.max(1, ...itens.map(([, v]) => v));
    return itens.map(([l, v]) => `<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px"><span style="color:var(--text-secondary)">${l}</span><span style="font-variant-numeric:tabular-nums">${fmtVal(v)} <span style="color:var(--text-muted)">· ${pct(v, r.total)}</span></span></div><div style="height:6px;border-radius:3px;background:var(--bg-soft)"><div style="height:6px;border-radius:3px;background:var(--primary);width:${Math.max(2, v / max * 100)}%"></div></div></div>`).join('');
  };
  const bloco = (titulo, sub, cTit, r, gratif) => `<div style="border:1px solid var(--border);border-left:4px solid ${cTit};border-radius:12px;padding:16px 18px;background:var(--bg-card)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px"><div style="font-weight:800;font-size:15px">${titulo}</div><div style="font-size:12.5px;color:var(--text-muted)">${r.n} torre(s) · ${r.clientes} cliente(s)</div></div>
      <div style="font-size:12.5px;color:var(--text-muted);margin:2px 0 12px">${sub}</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        ${num('Receita', fmtVal(r.receita), gratif ? 'cortesia — cliente não paga' : 'o que os clientes pagam')}
        ${num('Custo com fornecedores', fmtVal(r.total), 'por mês', 'var(--danger)')}
        ${gratif ? num('Investimento do mês', R(r.lucro), 'custo da cortesia', cor(r.lucro)) : num('Lucro', R(r.lucro), r.receita ? 'margem de ' + pct(r.lucro, r.receita) : 'sem receita', cor(r.lucro))}
      </div>
      <div style="font-weight:700;font-size:13px;margin:16px 0 8px">Custo por fornecedor</div>
      ${barras(r)}
    </div>`;

  const _ehPago = d => d.gratificada === false;
  const _tdN = 'padding:9px 10px;text-align:right;font-variant-numeric:tabular-nums';
  const _linhaF = (nome, lista, idx) => { const p = resumo(lista.filter(_ehPago)), q = resumo(lista.filter(d => !_ehPago(d))), res = p.lucro + q.lucro; const sel = idx !== null && window.TOR_FIN_FILIAL === nome;
    return `<tr style="${idx === null ? 'font-weight:800;border-top:2px solid var(--border)' : 'cursor:pointer'}${sel ? ';background:var(--row-hover)' : ''}" ${idx === null ? '' : `onclick="window.TOR_FIN_FILIAL=window.TOR_FIN_FILIAL===window.TOR_FIN_FILIAL_L[${idx}]?'':window.TOR_FIN_FILIAL_L[${idx}];renderTorresFinanceiro()" title="Clique para ver só esta filial"`}><td style="padding:9px 10px">${nome}</td><td style="${_tdN}">${p.n}</td><td style="${_tdN}">${fmtVal(p.receita)}</td><td style="${_tdN}">${fmtVal(p.total)}</td><td style="${_tdN};font-weight:700;color:${cor(p.lucro)}">${R(p.lucro)}</td><td style="${_tdN};color:var(--text-muted)">${p.receita ? pct(p.lucro, p.receita) : '—'}</td><td style="${_tdN};border-left:1px solid var(--border)">${q.n}</td><td style="${_tdN};color:var(--danger)">${fmtVal(q.total)}</td><td style="${_tdN};border-left:1px solid var(--border);font-weight:800;color:${cor(res)}">${R(res)}</td></tr>`; };
  const _comparativo = `<div style="font-weight:700;font-size:14px;margin:20px 0 4px">Comparativo por filial</div><div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Clique numa filial para ver os blocos acima só dela.</div>
    <div class="table-wrap"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="color:var(--text-muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.3px"><th style="padding:8px 10px;text-align:left">Filial</th><th style="padding:8px 10px;text-align:right">Pagas</th><th style="padding:8px 10px;text-align:right">Receita</th><th style="padding:8px 10px;text-align:right">Custo</th><th style="padding:8px 10px;text-align:right">Lucro</th><th style="padding:8px 10px;text-align:right">Margem</th><th style="padding:8px 10px;text-align:right;border-left:1px solid var(--border)">Gratif.</th><th style="padding:8px 10px;text-align:right">Custo cortesia</th><th style="padding:8px 10px;text-align:right;border-left:1px solid var(--border)">Resultado</th></tr></thead><tbody>
    ${_filiais.map((f, i) => _linhaF(f, _TODOS.filter(d => (d.filial || 'Sem filial') === f), i)).join('')}${_linhaF('Total', _TODOS, null)}</tbody></table></div>`;
  const _chips = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${['', ..._filiais].map((f, i) => `<button class="btn btn-sm ${(window.TOR_FIN_FILIAL || '') === f ? 'btn-accent' : 'btn-outline'}" onclick="window.TOR_FIN_FILIAL=${i ? `window.TOR_FIN_FILIAL_L[${i - 1}]` : "''"};renderTorresFinanceiro()">${f || 'Todas as filiais'}</button>`).join('')}</div>`;
  box.innerHTML = `<div class="card" style="margin-bottom:22px"><div class="card-body">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
      <div><div style="font-weight:700;font-size:16px">Resultado financeiro das torres${window.TOR_FIN_FILIAL ? ' · ' + window.TOR_FIN_FILIAL : ''}</div><div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">Valores por mês, separados entre torres pagas e gratificadas.</div>${_chips}</div>
      <div style="font-size:13px;color:var(--text-secondary)">Resultado geral: <b style="font-size:16px;color:${cor(g.lucro)};font-variant-numeric:tabular-nums">${R(g.lucro)}</b> <span style="color:var(--text-muted)">(lucro das pagas ${R(pagas.lucro)} − cortesia ${fmtVal(Math.abs(grat.lucro))})</span></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px;margin-top:14px">
      ${bloco('Torres pagas', 'Não gratificadas — o cliente paga a mensalidade', 'var(--accent)', pagas, false)}
      ${bloco('Torres gratificadas', 'Cortesia — não geram receita, a empresa arca com o custo', 'var(--warning)', grat, true)}
    </div>
    ${_comparativo}
  </div></div>`;
}
function nzBusca(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function torreIdent(d) {
  const e = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const p = [];
  if (d.nome_fantasia) p.push(e(d.nome_fantasia));
  if (d.codigo_cliente) p.push('Cód. ' + e(d.codigo_cliente));
  if (d.chave_sigma) p.push('Chave ' + e(d.chave_sigma));
  return p.length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${p.join(' · ')}</div>` : '';
}
function qtdTorres(d) { return Math.max(1, parseInt(d.qtd_torres) || 1); }
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
    nome_fantasia: document.getElementById('tm-fantasia').value.trim() || null,
    codigo_cliente: document.getElementById('tm-codigo').value.trim() || null,
    chave_sigma: document.getElementById('tm-chave-sigma').value.trim() || null,
    cidade: document.getElementById('tm-cidade').value.toUpperCase(),
    status: document.getElementById('tm-status').value,
    modelo: document.getElementById('tm-modelo').value,
    cameras: parseInt(document.getElementById('tm-cameras').value) || 0,
    qtd_torres: Math.max(1, parseInt(document.getElementById('tm-qtd-torres').value) || 1),
    forn_imagem: document.getElementById('tm-forn-imagem').value || null,
    forn_ia: document.getElementById('tm-forn-ia').value || null,
    valor_imagem: document.getElementById('tm-forn-imagem').value ? (parseFloat(document.getElementById('tm-valor-imagem').value) || 0) : null,
    valor_ia: document.getElementById('tm-forn-ia').value ? (parseFloat(document.getElementById('tm-valor-ia').value) || 0) : null,
    valor_servidor: CUSTO_SERVIDOR[document.getElementById('tm-forn-ia').value] ? (parseFloat(document.getElementById('tm-valor-licenca').value) || 0) : null,
    valor_licenca_ia: null,
    pago_forn: parseFloat(document.getElementById('tm-pago').value) || 0,
    cobrado: parseFloat(document.getElementById('tm-cobrado').value) || 0,
    responsavel: document.getElementById('tm-responsavel').value,
    gratificada: document.getElementById('tm-gratificada').value !== 'nao',
    data_fim_gratificacao: document.getElementById('tm-gratificada').value === 'nao' ? null : (document.getElementById('tm-data-fim').value || null),
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

