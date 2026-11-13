// ===== VIGILANTES — CARNEIRO SECURITY =====
// Sub-aba dentro de Seguros. Valor = vigilantes x plantoes x valor_unitario (R$250 por padrao, editavel).
function switchSegSub(which) {
  const abas = ['seguros', 'vigilantes'];
  abas.forEach(a => {
    const panel = document.getElementById('seg-sub-' + a);
    const btn = document.getElementById('seg-subtab-' + a);
    if (panel) panel.style.display = (a === which) ? '' : 'none';
    if (btn) { btn.classList.toggle('btn-accent', a === which); btn.classList.toggle('btn-outline', a !== which); }
  });
}

function vigTotal(r) { return (Number(r.vigilantes) || 0) * (Number(r.plantoes) || 0) * (Number(r.valor_unitario) || 0); }

function renderVigilantes() {
  const s = DATA.vigilantes || [];
  const emAberto = s.filter(x => ['Solicitado', 'Confirmado', 'Em andamento'].includes(x.status));
  const ativos = s.filter(x => x.status !== 'Cancelado');
  const plantoes = ativos.reduce((t, x) => t + (Number(x.plantoes) || 0) * (Number(x.vigilantes) || 0), 0);
  const custo = ativos.reduce((t, x) => t + (Number(x.valor) || vigTotal(x)), 0);

  const kpiEl = document.getElementById('vig-kpis');
  if (kpiEl) kpiEl.innerHTML =
    kpiCard({ label: 'Total de solicitações', value: s.length, color: 'neutral', icon: 'shield' }) +
    kpiCard({ label: 'Em aberto', value: emAberto.length, color: emAberto.length ? 'danger' : 'neutral', icon: 'clock', tag: emAberto.length ? 'requer ação' : 'em dia', tagCls: emAberto.length ? 'kpi-tag-down' : 'kpi-tag-up' }) +
    kpiCard({ label: 'Plantões (12h)', value: plantoes, color: 'blue', icon: 'clock', sub: 'vigilantes × plantões (não cancelados)' }) +
    kpiCard({ label: 'Custo total', value: fmtVal(custo), color: 'accent', icon: 'dollar', sub: 'solicitações não canceladas' });

  let filtered = [...s];
  const fsEl = document.getElementById('vig-filter-status');
  const fs = fsEl ? fsEl.value : '';
  if (fs) filtered = filtered.filter(x => x.status === fs);
  filtered.sort((a, b) => (b.data_solicitacao || '').localeCompare(a.data_solicitacao || ''));

  const tbody = document.getElementById('vig-tbody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(r => {
    const tot = Number(r.valor) || vigTotal(r);
    return `<tr>
      <td style="font-weight:500">${r.cliente || '—'}</td>
      <td>${r.conta || '—'}</td>
      <td>${r.data_solicitacao ? new Date(r.data_solicitacao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td>${r.vigilantes || 0}</td>
      <td>${r.plantoes || 0}</td>
      <td>${r.valor_unitario != null ? fmtVal(r.valor_unitario) : '—'}</td>
      <td style="font-weight:600">${fmtVal(tot)}</td>
      <td><span class="badge ${statusBadge(r.status)}">${r.status || '—'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px" onclick="editVigilante(${r.id})">Editar</button>
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)" onclick="deleteVigilante(${r.id})">Excluir</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:18px">Nenhuma solicitação. Clique em "+ Nova Solicitação".</td></tr>`;
}

function vigRecalc() {
  const g = id => document.getElementById(id);
  const v = (Number(g('vig-vigilantes').value) || 0) * (Number(g('vig-plantoes').value) || 0) * (Number(g('vig-unit').value) || 0);
  if (g('vig-total')) g('vig-total').textContent = fmtVal(v);
}

function openVigilanteModal() {
  document.getElementById('vig-modal').classList.add('open');
  document.getElementById('vig-edit-id').value = '';
  document.getElementById('vig-modal-title').textContent = 'Nova Solicitação de Vigilante';
  document.getElementById('vig-cliente').value = '';
  document.getElementById('vig-conta').value = '';
  document.getElementById('vig-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('vig-vigilantes').value = '1';
  document.getElementById('vig-plantoes').value = '1';
  document.getElementById('vig-unit').value = '250';
  document.getElementById('vig-status').value = 'Solicitado';
  document.getElementById('vig-obs').value = '';
  vigRecalc();
}
function closeVigilanteModal() { document.getElementById('vig-modal').classList.remove('open'); }

function editVigilante(id) {
  const r = (DATA.vigilantes || []).find(s => s.id === id);
  if (!r) return;
  openVigilanteModal();
  document.getElementById('vig-modal-title').textContent = 'Editar Solicitação';
  document.getElementById('vig-edit-id').value = id;
  document.getElementById('vig-cliente').value = r.cliente || '';
  document.getElementById('vig-conta').value = r.conta || '';
  document.getElementById('vig-data').value = r.data_solicitacao || '';
  document.getElementById('vig-vigilantes').value = r.vigilantes != null ? r.vigilantes : 1;
  document.getElementById('vig-plantoes').value = r.plantoes != null ? r.plantoes : 1;
  document.getElementById('vig-unit').value = r.valor_unitario != null ? r.valor_unitario : 250;
  document.getElementById('vig-status').value = r.status || 'Solicitado';
  document.getElementById('vig-obs').value = r.observacoes || '';
  vigRecalc();
}

async function saveVigilante() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const g = id => document.getElementById(id);
  const vigilantes = parseInt(g('vig-vigilantes').value) || 0;
  const plantoes = parseInt(g('vig-plantoes').value) || 0;
  const valor_unitario = parseFloat(g('vig-unit').value) || 0;
  const obj = {
    cliente: g('vig-cliente').value.trim(),
    conta: g('vig-conta').value.trim(),
    data_solicitacao: g('vig-data').value || null,
    vigilantes, plantoes, valor_unitario,
    valor: vigilantes * plantoes * valor_unitario,
    fornecedor: 'Carneiro Security',
    status: g('vig-status').value,
    observacoes: g('vig-obs').value.trim(),
  };
  if (!obj.cliente) { showToast('Preencha o cliente / local', true); return; }
  const editId = g('vig-edit-id').value;
  if (editId) {
    const { error } = await sb.from('solicitacoes_vigilante').update(obj).eq('id', parseInt(editId));
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Solicitação atualizada!');
  } else {
    const { error } = await sb.from('solicitacoes_vigilante').insert(obj);
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Solicitação adicionada!');
  }
  closeVigilanteModal();
  await refreshData();
}

async function deleteVigilante(id) {
  if (!sb || !confirm('Excluir esta solicitação de vigilante?')) return;
  const { error } = await sb.from('solicitacoes_vigilante').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.vigilantes = (DATA.vigilantes || []).filter(r => r.id !== id);
  showToast('Solicitação excluída');
  renderVigilantes();
}

function exportVigilantesCSV() {
  const rows = DATA.vigilantes || [];
  if (!rows.length) { showToast('Sem dados para exportar', true); return; }
  const BOM = '﻿';
  let csv = BOM + 'Cliente/Local;Conta;Data;Vigilantes;Plantoes 12h;Valor unitario;Valor total;Fornecedor;Status;Observacoes\n';
  rows.forEach(r => {
    const tot = Number(r.valor) || vigTotal(r);
    csv += `"${r.cliente || ''}";"${r.conta || ''}";"${r.data_solicitacao || ''}";"${r.vigilantes || 0}";"${r.plantoes || 0}";"${r.valor_unitario || ''}";"${tot}";"${r.fornecedor || 'Carneiro Security'}";"${r.status || ''}";"${(r.observacoes || '').replace(/"/g, '""')}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'solicitacoes_vigilante.csv'; a.click();
}
