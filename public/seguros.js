// ===== SEGUROS =====
function renderSeguros() {
  const s = DATA.seguros;
  const total = s.length;
  const pendente = s.filter(x => x.status === 'Pendente').length;
  const aprovado = s.filter(x => x.status === 'Aprovado').length;
  const analise = s.filter(x => x.status === 'Em análise' || x.status === 'Em analise').length;

  const kpiEl = document.getElementById('seg-kpis');
  const valorAberto = s.filter(x => x.status === 'Pendente' || x.status === 'Em análise' || x.status === 'Em analise').reduce((t, x) => t + Number(x.valor || 0), 0);
  kpiEl.innerHTML =
    kpiCard({ label:'Total de solicitações', value: total, color:'neutral', icon:'shield' }) +
    kpiCard({ label:'Pendentes', value: pendente, color: pendente ? 'danger' : 'neutral', icon:'clock', tag: pendente ? 'requer ação' : 'em dia', tagCls: pendente ? 'kpi-tag-down' : 'kpi-tag-up' }) +
    kpiCard({ label:'Em análise', value: analise, color:'blue', icon:'search', sub: valorAberto ? fmtVal(valorAberto) + ' em aberto (pend. + análise)' : '' }) +
    kpiCard({ label:'Aprovadas', value: aprovado, color:'accent', icon:'check', tag: total ? Math.round(aprovado/total*100)+'%' : '', tagCls:'kpi-tag-up' });

  let filtered = [...s];
  const fs = document.getElementById('seg-filter-status').value;
  if (fs) filtered = filtered.filter(x => x.status === fs);
  filtered.sort((a,b) => (b.data_solicitacao||'').localeCompare(a.data_solicitacao||''));

  const statusColors = {'Pendente':'#eda100','Em análise':'#2a78d6','Em analise':'#2a78d6','Aprovado':'#1abf8f','Negado':'#e34948','Concluído':'#8b5cf6','Concluido':'#8b5cf6'};

  const tbody = document.getElementById('seg-tbody');
  tbody.innerHTML = filtered.map(r => {
    const sc = statusColors[r.status] || '#6b7280';
    return `<tr>
      <td style="font-weight:500">${r.cliente||'—'}</td>
      <td>${r.conta||'—'}</td>
      <td>${r.tipo_seguro||'—'}</td>
      <td>${r.data_solicitacao ? new Date(r.data_solicitacao+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td>${r.seguradora||'—'}</td>
      <td>${r.numero_sinistro||'—'}</td>
      <td>${r.valor ? fmtVal(r.valor) : '—'}</td>
      <td><span class="badge ${statusBadge(r.status)}">${r.status||'—'}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px" onclick="editSeguro(${r.id})">Editar</button>
        <button class="btn btn-outline" style="padding:2px 8px;font-size:11px;color:var(--danger);border-color:var(--danger)" onclick="deleteSeguro(${r.id})">Excluir</button>
      </td>
    </tr>`;
  }).join('');
}

function openSeguroModal() {
  document.getElementById('seg-modal').classList.add('open');
  document.getElementById('seg-edit-id').value = '';
  document.getElementById('seg-modal-title').textContent = 'Nova Solicitacao de Seguro';
  document.getElementById('seg-cliente').value = '';
  document.getElementById('seg-conta').value = '';
  document.getElementById('seg-tipo').value = '';
  document.getElementById('seg-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('seg-status').value = 'Pendente';
  document.getElementById('seg-valor').value = '';
  document.getElementById('seg-seguradora').value = '';
  document.getElementById('seg-sinistro').value = '';
  document.getElementById('seg-obs').value = '';
  document.getElementById('seg-email').value = '';
}
function closeSeguroModal() { document.getElementById('seg-modal').classList.remove('open'); }

function editSeguro(id) {
  const r = DATA.seguros.find(s => s.id === id);
  if (!r) return;
  openSeguroModal();
  document.getElementById('seg-modal-title').textContent = 'Editar Solicitacao';
  document.getElementById('seg-edit-id').value = id;
  document.getElementById('seg-cliente').value = r.cliente || '';
  document.getElementById('seg-conta').value = r.conta || '';
  document.getElementById('seg-tipo').value = r.tipo_seguro || '';
  document.getElementById('seg-data').value = r.data_solicitacao || '';
  document.getElementById('seg-status').value = r.status || 'Pendente';
  document.getElementById('seg-valor').value = r.valor || '';
  document.getElementById('seg-seguradora').value = r.seguradora || '';
  document.getElementById('seg-sinistro').value = r.numero_sinistro || '';
  document.getElementById('seg-obs').value = r.observacoes || '';
  document.getElementById('seg-email').value = r.email_origem || '';
}

async function saveSeguro() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const obj = {
    cliente: document.getElementById('seg-cliente').value.trim(),
    conta: document.getElementById('seg-conta').value.trim(),
    tipo_seguro: document.getElementById('seg-tipo').value.trim(),
    data_solicitacao: document.getElementById('seg-data').value || null,
    status: document.getElementById('seg-status').value,
    valor: parseFloat(document.getElementById('seg-valor').value) || null,
    seguradora: document.getElementById('seg-seguradora').value.trim(),
    numero_sinistro: document.getElementById('seg-sinistro').value.trim(),
    observacoes: document.getElementById('seg-obs').value.trim(),
    email_origem: document.getElementById('seg-email').value.trim(),
  };
  if (!obj.cliente) { showToast('Preencha o nome do cliente', true); return; }
  const editId = document.getElementById('seg-edit-id').value;
  if (editId) {
    const { error } = await sb.from('solicitacoes_seguro').update(obj).eq('id', parseInt(editId));
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Solicitacao atualizada!');
  } else {
    const { error } = await sb.from('solicitacoes_seguro').insert(obj);
    if (error) { showToast('Erro: ' + error.message, true); return; }
    showToast('Solicitacao adicionada!');
  }
  closeSeguroModal();
  await refreshData();
}

async function deleteSeguro(id) {
  if (!sb || !confirm('Excluir esta solicitacao?')) return;
  const { error } = await sb.from('solicitacoes_seguro').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  DATA.seguros = DATA.seguros.filter(r => r.id !== id);
  showToast('Solicitacao excluida');
  renderSeguros();
}

function exportSegurosCSV() {
  const rows = DATA.seguros;
  if (!rows.length) { showToast('Sem dados para exportar', true); return; }
  const BOM = '﻿';
  let csv = BOM + 'Cliente;Conta;Tipo Seguro;Data;Status;Valor;Seguradora;Sinistro;Observacoes;Email\n';
  rows.forEach(r => {
    csv += `"${r.cliente||''}";"${r.conta||''}";"${r.tipo_seguro||''}";"${r.data_solicitacao||''}";"${r.status||''}";"${r.valor||''}";"${r.seguradora||''}";"${r.numero_sinistro||''}";"${(r.observacoes||'').replace(/"/g,'""')}";"${r.email_origem||''}"\n`;
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'solicitacoes_seguro.csv'; a.click();
}

