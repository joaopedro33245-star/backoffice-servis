// ===== DEMANDAS EQUIPE =====
function renderDemandas() {
  const d = DATA.demandas;
  // KPIs
  const total = d.length;
  const pendente = d.filter(x => x.status === 'Pendente').length;
  const emAndamento = d.filter(x => x.status === 'Em andamento').length;
  const concluido = d.filter(x => x.status === 'Concluído' || x.status === 'Concluído').length;
  const kpiEl = document.getElementById('dem-kpis');
  kpiEl.innerHTML =
    kpiCard({ label:'Total de demandas', value: total, color:'neutral', icon:'list' }) +
    kpiCard({ label:'Pendentes', value: pendente, color: pendente ? 'warning' : 'neutral', icon:'clock', tag: total ? Math.round(pendente/total*100)+'%' : '', tagCls:'kpi-tag-neutral' }) +
    kpiCard({ label:'Em andamento', value: emAndamento, color:'blue', icon:'play', tag: total ? Math.round(emAndamento/total*100)+'%' : '', tagCls:'kpi-tag-neutral' }) +
    kpiCard({ label:'Concluídas', value: concluido, color:'accent', icon:'check', tag: total ? Math.round(concluido/total*100)+'%' : '', tagCls:'kpi-tag-up' });

  // Populate filters
  const pessoas = [...new Set(d.map(x => x.responsavel).filter(Boolean))].sort();
  const fPessoa = document.getElementById('dem-filter-pessoa');
  const curP = fPessoa.value;
  fPessoa.innerHTML = '<option value="">Todos</option>' + pessoas.map(p => `<option value="${p}" ${p===curP?'selected':''}>${p}</option>`).join('');
  const statuses = [...new Set(d.map(x => x.status).filter(Boolean))].sort();
  const fStatus = document.getElementById('dem-filter-status');
  const curS = fStatus.value;
  fStatus.innerHTML = '<option value="">Todos Status</option>' + statuses.map(s => `<option value="${s}" ${s===curS?'selected':''}>${s}</option>`).join('');

  // Charts
  const byPessoa = {};
  pessoas.forEach(p => byPessoa[p] = d.filter(x => x.responsavel === p).length);
  hBar('dem-chart-pessoa', Object.entries(byPessoa).map(([l,v]) => ({l,v,t:v})), ['#1abf8f','#2a78d6','#eda100','#e34948','#8b5cf6','#ec4899']);

  const byStatus = {};
  d.forEach(x => { byStatus[x.status] = (byStatus[x.status]||0) + 1; });
  const statusColors = {'Pendente':'#eda100','Em andamento':'#2a78d6','Concluído':'#1abf8f','Concluido':'#1abf8f','Negado':'#e34948'};
  hBar('dem-chart-status', Object.entries(byStatus).map(([l,v]) => ({l,v,t:v})), Object.entries(byStatus).map(([l]) => statusColors[l] || '#6b7280'));

  const byCat = {};
  d.forEach(x => { const c = x.categoria || 'Sem cat.'; byCat[c] = (byCat[c]||0) + 1; });
  const catEntries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  hBar('dem-chart-cat', catEntries.map(([l,v]) => ({l:l.length>25?l.slice(0,22)+'...':l,v,t:v})), ['#1abf8f','#2a78d6','#eda100','#e34948','#8b5cf6','#ec4899','#14b8a6','#f97316']);

  const byFreq = {};
  d.forEach(x => { const f = x.frequencia || 'N/A'; byFreq[f] = (byFreq[f]||0) + 1; });
  hBar('dem-chart-freq', Object.entries(byFreq).sort((a,b)=>b[1]-a[1]).map(([l,v]) => ({l,v,t:v})), ['#8b5cf6','#2a78d6','#1abf8f','#eda100','#e34948','#ec4899']);

  // Table
  let filtered = [...d];
  const fp = document.getElementById('dem-filter-pessoa').value;
  const fs = document.getElementById('dem-filter-status').value;
  if (fp) filtered = filtered.filter(x => x.responsavel === fp);
  if (fs) filtered = filtered.filter(x => x.status === fs);
  filtered.sort((a,b) => (a.responsavel||'').localeCompare(b.responsavel||'') || (a.numero||0) - (b.numero||0));

  const tbody = document.getElementById('dem-tbody');
  tbody.innerHTML = filtered.map(r => {
    const sc = statusColors[r.status] || '#6b7280';
    return `<tr>
      <td style="font-weight:500">${r.responsavel||'—'}</td>
      <td>${r.categoria||'—'}</td>
      <td>${r.tarefa||'—'}</td>
      <td>${r.frequencia||'—'}</td>
      <td><span class="badge ${statusBadge(r.status)}">${r.status||'—'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px" onclick="editDemanda(${r.id})">Editar</button>
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)" onclick="deleteDemanda(${r.id})">Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

function openDemandaModal(editId) {
  document.getElementById('dem-modal').classList.add('open');
  document.getElementById('dem-edit-id').value = '';
  document.getElementById('dem-modal-title').textContent = 'Nova Demanda';
  document.getElementById('dem-responsavel').value = '';
  document.getElementById('dem-numero').value = '';
  document.getElementById('dem-categoria').value = '';
  document.getElementById('dem-tarefa').value = '';
  document.getElementById('dem-frequencia').value = '';
  document.getElementById('dem-prazo-obs').value = '';
  document.getElementById('dem-status').value = 'Pendente';
}
function closeDemandaModal() { document.getElementById('dem-modal').classList.remove('open'); }

function editDemanda(id) {
  const r = DATA.demandas.find(d => d.id === id);
  if (!r) return;
  openDemandaModal();
  document.getElementById('dem-modal-title').textContent = 'Editar Demanda';
  document.getElementById('dem-edit-id').value = id;
  document.getElementById('dem-responsavel').value = r.responsavel || '';
  document.getElementById('dem-numero').value = r.numero || '';
  document.getElementById('dem-categoria').value = r.categoria || '';
  document.getElementById('dem-tarefa').value = r.tarefa || '';
  document.getElementById('dem-frequencia').value = r.frequencia || '';
  document.getElementById('dem-prazo-obs').value = r.prazo_obs || '';
  document.getElementById('dem-status').value = r.status || 'Pendente';
}

async function saveDemanda() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const obj = {
    responsavel: document.getElementById('dem-responsavel').value.trim(),
    numero: parseInt(document.getElementById('dem-numero').value) || null,
    categoria: document.getElementById('dem-categoria').value.trim(),
    tarefa: document.getElementById('dem-tarefa').value.trim(),
    frequencia: document.getElementById('dem-frequencia').value,
    prazo_obs: document.getElementById('dem-prazo-obs').value.trim(),
    status: document.getElementById('dem-status').value,
  };
  if (!obj.responsavel || !obj.tarefa) { showToast('Preencha responsavel e tarefa', true); return; }
  const editId = document.getElementById('dem-edit-id').value;
  if (editId) {
    obj.updated_at = new Date().toISOString();
    const { error } = await sb.from('demandas_equipe').update(obj).eq('id', parseInt(editId));
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Demanda atualizada!');
  } else {
    const { error } = await sb.from('demandas_equipe').insert(obj);
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Demanda adicionada!');
  }
  closeDemandaModal();
  await refreshData();
}

async function deleteDemanda(id) {
  if (!sb || !confirm('Excluir esta demanda?')) return;
  const { error } = await sb.from('demandas_equipe').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.demandas = DATA.demandas.filter(r => r.id !== id);
  showToast('Demanda excluida');
  renderDemandas();
}

function exportDemandasCSV() {
  const rows = DATA.demandas;
  if (!rows.length) { showToast('Sem dados para exportar', true); return; }
  const BOM = '﻿';
  let csv = BOM + 'Responsavel;Numero;Categoria;Tarefa;Frequencia;Prazo/Obs;Status\n';
  rows.forEach(r => {
    csv += `"${r.responsavel||''}";"${r.numero||''}";"${r.categoria||''}";"${(r.tarefa||'').replace(/"/g,'""')}";"${r.frequencia||''}";"${(r.prazo_obs||'').replace(/"/g,'""')}";"${r.status||''}"\n`;
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'demandas_equipe.csv'; a.click();
}

