// ===== CHECKLIST PORTARIA =====
function renderChecklist() {
  const chk = DATA.checklists;
  const conds = DATA.condominios.filter(c => c.ativo !== false);

  // KPIs
  const totalConds = conds.length;
  const dates = [...new Set(chk.map(c => c.data_checklist))].sort().reverse();
  const lastDate = dates[0] || '—';
  const lastChecks = chk.filter(c => c.data_checklist === lastDate);
  const allOk = lastChecks.filter(c => c.todas_gravando_dvr && c.central_alarme_comunicando).length;

  const kpiEl = document.getElementById('chk-kpis');
  const probl = lastChecks.length - allOk;
  const diasUlt = lastDate !== '—' ? -diasAte(lastDate) : null;
  kpiEl.innerHTML =
    kpiCard({ label:'Condomínios ativos', value: totalConds, color:'neutral', icon:'building' }) +
    kpiCard({ label:'Checklists feitos', value: dates.length, color:'blue', icon:'history', sub:'datas registradas' }) +
    kpiCard({ label:'Tudo OK (último)', value: `${allOk}/${lastChecks.length}`, color: probl ? 'danger' : 'accent', icon: probl ? 'alert' : 'check', tag: probl ? `${probl} com falha` : 'sem falhas', tagCls: probl ? 'kpi-tag-down' : 'kpi-tag-up', sub:'DVR gravando + alarme comunicando' }) +
    kpiCard({ label:'Último checklist', value: lastDate !== '—' ? new Date(lastDate+'T12:00:00').toLocaleDateString('pt-BR') : '—', small:true, color: (diasUlt ?? 99) > 7 ? 'warning' : 'neutral', icon:'calendar', tag: diasUlt === null ? '' : diasUlt === 0 ? 'hoje' : `há ${diasUlt} dias`, tagCls: (diasUlt ?? 99) > 7 ? 'kpi-tag-down' : 'kpi-tag-up' });

  // Date filter
  const fData = document.getElementById('chk-filter-data');
  const curD = fData.value;
  fData.innerHTML = '<option value="">Todas Datas</option>' + dates.map(dt => {
    const label = new Date(dt+'T12:00:00').toLocaleDateString('pt-BR');
    return `<option value="${dt}" ${dt===curD?'selected':''}>${label}</option>`;
  }).join('');

  // Table
  let filtered = [...chk];
  const fd = document.getElementById('chk-filter-data').value;
  if (fd) filtered = filtered.filter(c => c.data_checklist === fd);
  filtered.sort((a,b) => (b.data_checklist||'').localeCompare(a.data_checklist||''));

  // Get previous checklist for change detection
  const prevDate = dates.length > 1 ? dates[1] : null;
  const prevChecks = prevDate ? chk.filter(c => c.data_checklist === prevDate) : [];

  const tbody = document.getElementById('chk-tbody');
  tbody.innerHTML = filtered.map(r => {
    const cond = DATA.condominios.find(c => c.id === r.condominio_id);
    const condNome = cond ? cond.nome : 'ID:'+r.condominio_id;
    const prev = prevChecks.find(p => p.condominio_id === r.condominio_id);
    let changes = [];
    if (prev) {
      if (prev.qtd_cameras !== r.qtd_cameras) changes.push(`Cam: ${prev.qtd_cameras}→${r.qtd_cameras}`);
      if (prev.todas_gravando_dvr !== r.todas_gravando_dvr) changes.push('DVR mudou');
      if (prev.cameras_portao_gravando !== r.cameras_portao_gravando) changes.push('Portao mudou');
      if (prev.central_alarme_comunicando !== r.central_alarme_comunicando) changes.push('Alarme mudou');
      if (prev.ia_funcionando !== r.ia_funcionando) changes.push('IA mudou');
    }
    const tick = '<span style="color:var(--accent)">✓</span>';
    const cross = '<span style="color:var(--danger)">✗</span>';
    return `<tr>
      <td style="font-weight:500">${condNome}<br><span style="font-size:10px;color:var(--text-muted)">${r.data_checklist ? new Date(r.data_checklist+'T12:00:00').toLocaleDateString('pt-BR') : ''}</span></td>
      <td style="text-align:center">${r.qtd_cameras ?? '—'}</td>
      <td style="text-align:center">${r.todas_gravando_dvr ? tick : cross}</td>
      <td style="text-align:center">${r.cameras_portao_gravando ? tick : cross}</td>
      <td style="text-align:center">${r.cameras_botoes_acoes ? tick : cross}</td>
      <td style="text-align:center">${r.central_alarme_comunicando ? tick : cross}</td>
      <td style="text-align:center">${r.tem_ia ? tick : cross}</td>
      <td style="text-align:center">${r.ia_funcionando ? tick : cross}</td>
      <td>${r.qual_ia || '—'}</td>
      <td style="text-align:center">${r.tem_torre ? tick : cross}</td>
      <td>${changes.length ? '<span style="color:#eda100;font-size:11px">'+changes.join(', ')+'</span>' : '<span style="color:var(--text-muted);font-size:11px">—</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px" onclick="editChecklist(${r.id})">Editar</button>
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)" onclick="deleteChecklist(${r.id})">Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

// === Condominio autocomplete logic ===
let chkCondList = [];
function initCondAutocomplete() {
  chkCondList = DATA.condominios.filter(c => c.ativo !== false).sort((a,b) => a.nome.localeCompare(b.nome));
  const input = document.getElementById('chk-condominio-search');
  const dd = document.getElementById('chk-cond-dropdown');
  const hidden = document.getElementById('chk-condominio');

  function renderDD(filter) {
    const q = (filter || '').toUpperCase();
    const filtered = q ? chkCondList.filter(c => c.nome.toUpperCase().includes(q)) : chkCondList;
    if (!filtered.length) { dd.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted)">Nenhum resultado</div>'; dd.style.display='block'; return; }
    dd.innerHTML = filtered.map(c => `<div class="cond-dd-item" data-id="${c.id}" style="padding:8px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);transition:background .15s">${c.nome}</div>`).join('');
    dd.style.display = 'block';
    dd.querySelectorAll('.cond-dd-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background='var(--bg-card-hover)');
      el.addEventListener('mouseleave', () => el.style.background='transparent');
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        hidden.value = el.dataset.id;
        input.value = el.textContent;
        dd.style.display = 'none';
      });
    });
  }

  input.addEventListener('focus', () => renderDD(input.value));
  input.addEventListener('input', () => { hidden.value = ''; renderDD(input.value); });
  input.addEventListener('blur', () => { setTimeout(() => dd.style.display='none', 180); });
}

function openChecklistModal(editId) {
  document.getElementById('chk-modal').classList.add('open');
  document.getElementById('chk-edit-id').value = '';
  document.getElementById('chk-modal-title').textContent = 'Novo Checklist';
  initCondAutocomplete();
  document.getElementById('chk-condominio').value = '';
  document.getElementById('chk-condominio-search').value = '';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('chk-data').value = today;
  document.getElementById('chk-qtd-cameras').value = '';
  document.getElementById('chk-dvr').checked = false;
  document.getElementById('chk-portao-grav').checked = false;
  document.getElementById('chk-portao-lista').value = '';
  document.getElementById('chk-botoes').checked = false;
  document.getElementById('chk-alarme').checked = false;
  document.getElementById('chk-tem-ia').checked = false;
  document.getElementById('chk-ia-func').checked = false;
  document.getElementById('chk-qual-ia').value = '';
  document.getElementById('chk-torre').checked = false;
  document.getElementById('chk-obs').value = '';
}
function closeChecklistModal() { document.getElementById('chk-modal').classList.remove('open'); }

function editChecklist(id) {
  const r = DATA.checklists.find(c => c.id === id);
  if (!r) return;
  openChecklistModal();
  document.getElementById('chk-modal-title').textContent = 'Editar Checklist';
  document.getElementById('chk-edit-id').value = id;
  document.getElementById('chk-condominio').value = r.condominio_id || '';
  const condMatch = DATA.condominios.find(c => c.id === r.condominio_id);
  document.getElementById('chk-condominio-search').value = condMatch ? condMatch.nome : '';
  document.getElementById('chk-data').value = r.data_checklist || '';
  document.getElementById('chk-qtd-cameras').value = r.qtd_cameras || '';
  document.getElementById('chk-dvr').checked = !!r.todas_gravando_dvr;
  document.getElementById('chk-portao-grav').checked = !!r.cameras_portao_gravando;
  document.getElementById('chk-portao-lista').value = r.cameras_portao_lista || '';
  document.getElementById('chk-botoes').checked = !!r.cameras_botoes_acoes;
  document.getElementById('chk-alarme').checked = !!r.central_alarme_comunicando;
  document.getElementById('chk-tem-ia').checked = !!r.tem_ia;
  document.getElementById('chk-ia-func').checked = !!r.ia_funcionando;
  document.getElementById('chk-qual-ia').value = r.qual_ia || '';
  document.getElementById('chk-torre').checked = !!r.tem_torre;
  document.getElementById('chk-obs').value = r.observacoes || '';
}

async function saveChecklist() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const condId = document.getElementById('chk-condominio').value;
  const dataChk = document.getElementById('chk-data').value;
  if (!condId || !dataChk) { showToast('Selecione condominio e data', true); return; }
  const obj = {
    condominio_id: parseInt(condId),
    data_checklist: dataChk,
    qtd_cameras: parseInt(document.getElementById('chk-qtd-cameras').value) || 0,
    todas_gravando_dvr: document.getElementById('chk-dvr').checked,
    cameras_portao_gravando: document.getElementById('chk-portao-grav').checked,
    cameras_portao_lista: document.getElementById('chk-portao-lista').value.trim(),
    cameras_botoes_acoes: document.getElementById('chk-botoes').checked,
    central_alarme_comunicando: document.getElementById('chk-alarme').checked,
    tem_ia: document.getElementById('chk-tem-ia').checked,
    ia_funcionando: document.getElementById('chk-ia-func').checked,
    qual_ia: document.getElementById('chk-qual-ia').value.trim(),
    tem_torre: document.getElementById('chk-torre').checked,
    observacoes: document.getElementById('chk-obs').value.trim(),
  };
  const editId = document.getElementById('chk-edit-id').value;
  if (editId) {
    const { error } = await sb.from('checklist_portaria').update(obj).eq('id', parseInt(editId));
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Checklist atualizado!');
  } else {
    const { error } = await sb.from('checklist_portaria').insert(obj);
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Checklist adicionado!');
  }
  closeChecklistModal();
  await refreshData();
}

async function deleteChecklist(id) {
  if (!sb || !confirm('Excluir este checklist?')) return;
  const { error } = await sb.from('checklist_portaria').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.checklists = DATA.checklists.filter(r => r.id !== id);
  showToast('Checklist excluido');
  renderChecklist();
}

// Condominio management
function openCondominioModal() {
  document.getElementById('cond-modal').classList.add('open');
  renderCondominioList();
}
function closeCondominioModal() { document.getElementById('cond-modal').classList.remove('open'); }

function renderCondominioList() {
  const list = document.getElementById('cond-list');
  list.innerHTML = DATA.condominios.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-weight:500">${c.nome}</span>
      <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${c.ativo!==false?'var(--accent)22':'var(--danger)22'};color:${c.ativo!==false?'var(--accent)':'var(--danger)'}">${c.ativo!==false?'Ativo':'Inativo'}</span>
      <button class="btn btn-outline" style="padding:2px 8px;font-size:11px" onclick="toggleCondominio(${c.id},${c.ativo===false})">${c.ativo!==false?'Desativar':'Ativar'}</button>
      <button class="btn btn-outline" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)" onclick="deleteCondominio(${c.id})">Excluir</button>
    </div>`).join('') || '<p style="color:var(--text-muted)">Nenhum condominio cadastrado</p>';
}

async function addCondominio() {
  if (!sb) return;
  const nome = document.getElementById('cond-novo-nome').value.trim();
  if (!nome) { showToast('Digite o nome do condominio', true); return; }
  const { error } = await sb.from('condominios_portaria').insert({ nome, ativo: true });
  if (error) { showToast('Erro: ' + error.message, true); return; }
  document.getElementById('cond-novo-nome').value = '';
  showToast('Condominio adicionado!');
  await refreshData();
  renderCondominioList();
}

async function toggleCondominio(id, activate) {
  if (!sb) return;
  const { error } = await sb.from('condominios_portaria').update({ ativo: activate }).eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  const c = DATA.condominios.find(x => x.id === id);
  if (c) c.ativo = activate;
  renderCondominioList();
  renderChecklist();
}

async function deleteCondominio(id) {
  if (!sb || !confirm('Excluir este condominio?')) return;
  const { error } = await sb.from('condominios_portaria').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.condominios = DATA.condominios.filter(c => c.id !== id);
  renderCondominioList();
  renderChecklist();
  showToast('Condominio excluido');
}

