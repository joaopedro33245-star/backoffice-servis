// ===== ARMARIOS =====
let currentArmTab = 'geral';
function showArmTab(btn, tab) {
  document.querySelectorAll('#sec-armarios .tab-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  currentArmTab = tab;
  renderArmDetail();
}

function renderArmarios() {
  const AD = DATA.armDetail;
  // Compute resumo from detail data (more accurate than separate resumo table)
  const byFilial = {};
  AD.forEach(d => {
    const f = d.filial || 'Outros';
    if (!byFilial[f]) byFilial[f] = { filial: f, cadastrados: 0, ativos: 0, inativos: 0, gratificados: 0, valor_gestao: 0, valor_locacao: 0, custo_forn: 0, valor_cli: 0, margem: 0 };
    const g = byFilial[f];
    g.cadastrados++;
    if (d.status === 'Ativo') g.ativos++; else g.inativos++;
    if (d.gratificacao === 'Sim') g.gratificados++;
    g.valor_gestao += Number(d.custo_gestao || 0);
    g.valor_locacao += Number(d.custo_locacao || 0);
    g.custo_forn += Number(d.custo_forn || 0);
    g.valor_cli += Number(d.valor_cli || 0);
    g.margem += Number(d.margem || (Number(d.valor_cli||0) - Number(d.custo_forn||0)));
  });
  const ARM = Object.values(byFilial).sort((a,b) => b.cadastrados - a.cadastrados);

  const totalArm = ARM.reduce((s,d)=>s+d.cadastrados,0);
  const ativosArm = ARM.reduce((s,d)=>s+d.ativos,0);
  const inativosArm = ARM.reduce((s,d)=>s+d.inativos,0);
  const gratArm = ARM.reduce((s,d)=>s+d.gratificados,0);
  const custoArm = ARM.reduce((s,d)=>s+d.custo_forn,0);
  const receitaArm = ARM.reduce((s,d)=>s+d.valor_cli,0);
  const margemArm = ARM.reduce((s,d)=>s+d.margem,0);

  document.getElementById('arm-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:#e87ba4"></div><div class="kpi-card-icon" style="background:rgba(232,123,164,0.12)"><svg viewBox="0 0 24 24" fill="none" stroke="#e87ba4" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><div class="kpi-label">Total Armários</div><div class="kpi-value" style="color:#e87ba4">${totalArm}</div><div class="kpi-sub">${ativosArm} ativos · ${inativosArm} inativos</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--accent)"></div><div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="kpi-label">Gratificados</div><div class="kpi-value accent">${gratArm}</div><div class="kpi-sub">de ${totalArm} armários</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--warning)"></div><div class="kpi-card-icon" style="background:var(--warning-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="kpi-label">Custo Fornecedor</div><div class="kpi-value warning">R$ ${fmtK(custoArm)}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:var(--blue)"></div><div class="kpi-card-icon" style="background:var(--blue-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div><div class="kpi-label">Valor Cliente</div><div class="kpi-value blue">R$ ${fmtK(receitaArm)}</div></div>
    <div class="kpi-card"><div class="kpi-card-stripe" style="background:${margemArm>=0?'var(--accent)':'var(--danger)'}"></div><div class="kpi-card-icon" style="background:${margemArm>=0?'var(--accent-dim)':'var(--danger-dim)'}"><svg viewBox="0 0 24 24" fill="none" stroke="${margemArm>=0?'var(--accent)':'var(--danger)'}" stroke-width="2"><path d="M12 2l10 18H2z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5"/></svg></div><div class="kpi-label">Margem Total</div><div class="kpi-value ${margemArm>=0?'accent':'danger'}">${margemArm>=0?'':'-'}R$ ${fmtK(Math.abs(margemArm))}</div><div class="kpi-sub">${receitaArm>0?((margemArm/receitaArm)*100).toFixed(1):'0'}%</div></div>`;

  // Charts
  document.getElementById('arm-charts').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Margem por Filial</div></div></div><div class="chart-card-body" id="ac-mar"></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Status dos Armários</div></div></div><div class="chart-card-body" id="ac-st"></div></div>`;

  // Margem chart
  const armMData = ARM.map(d=>({l:d.filial,v:Math.abs(d.margem),t:(d.margem>=0?'+':'-')+fmtVal(Math.abs(d.margem))}));
  const armMCols = ARM.map(d=>d.margem>=0?'#1abf8f':'#e34948');
  if (armMData.length) {
    const mx = Math.max(...armMData.map(d=>d.v));
    const bH=28,g=8,lW=100,cW=260,hh=armMData.length*(bH+g)+10;
    let s = `<svg width="100%" viewBox="0 0 ${lW+cW+120} ${hh}" style="display:block;max-width:100%">`;
    armMData.forEach((d,i)=>{const y=i*(bH+g)+4;const w=mx>0?(d.v/mx)*cW:0;s+=`<g class="chart-bar-group"><text x="${lW-8}" y="${y+bH/2+4}" text-anchor="end" fill="var(--text-secondary)" font-size="11" font-family="Inter,sans-serif">${d.l}</text><rect x="${lW}" y="${y}" width="${Math.max(w,2)}" height="${bH}" rx="4" fill="${armMCols[i]}"/><text x="${lW+w+8}" y="${y+bH/2+4}" fill="${armMCols[i]}" font-size="11" font-weight="600" font-family="Inter,sans-serif">${d.t}</text></g>`;});
    s += `</svg>`;
    document.getElementById('ac-mar').innerHTML = s;
  }

  // Status donut
  const pctAt = totalArm>0?ativosArm/totalArm*100:0;
  const r2=50,cx2=60,cy2=60,sw2=12;
  const circ2=2*Math.PI*r2;
  const s1_2=pctAt/100*circ2;
  document.getElementById('ac-st').innerHTML = `
    <div class="donut-wrap">
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="none" stroke="var(--accent)" stroke-width="${sw2}" stroke-dasharray="${s1_2} ${circ2-s1_2}" stroke-dashoffset="0" transform="rotate(-90 ${cx2} ${cy2})" stroke-linecap="round"/>
        <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="none" stroke="var(--border)" stroke-width="${sw2}" stroke-dasharray="${circ2-s1_2} ${s1_2}" stroke-dashoffset="${-s1_2}" transform="rotate(-90 ${cx2} ${cy2})"/>
        <text x="${cx2}" y="${cy2-4}" text-anchor="middle" fill="var(--text-primary)" font-size="20" font-weight="700" font-family="Inter,sans-serif">${totalArm}</text>
        <text x="${cx2}" y="${cy2+12}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="Inter,sans-serif">armários</text>
      </svg>
      <div class="donut-legend">
        <div class="donut-legend-item"><span class="donut-dot" style="background:var(--accent)"></span> Ativos <strong>${ativosArm}</strong></div>
        <div class="donut-legend-item"><span class="donut-dot" style="background:var(--border)"></span> Inativos <strong>${inativosArm}</strong></div>
      </div>
    </div>`;

  // Resumo por Filial — matching spreadsheet columns
  const totalGestao = ARM.reduce((s,d)=>s+d.valor_gestao,0);
  const totalLocacao = ARM.reduce((s,d)=>s+d.valor_locacao,0);
  const totalFatura = totalGestao + totalLocacao;
  const difFatura = totalFatura - custoArm;
  const margemPct = receitaArm > 0 ? ((margemArm / receitaArm) * 100).toFixed(1) : '0.0';

  document.getElementById('arm-resumo-card').innerHTML = `
    <div class="card-header"><div class="card-title">Resumo por Filial</div></div>
    <div class="card-body"><div class="table-wrap" style="overflow-x:auto"><table><thead><tr><th>Filial</th><th style="text-align:right">Cad.</th><th style="text-align:right">Ativos</th><th style="text-align:right">Inativos</th><th style="text-align:right">Gratif.</th><th style="text-align:right">Vl. Gestão</th><th style="text-align:right">Vl. Locação</th><th style="text-align:right">Total Fatura</th><th style="text-align:right">Custo Forn.</th><th style="text-align:right">Diferenca</th><th style="text-align:right">Vl. Cliente</th><th style="text-align:right">Margem R$</th><th style="text-align:right">Margem %</th></tr></thead>
    <tbody>${ARM.map(d=>{
      const tf = d.valor_gestao + d.valor_locacao;
      const dif = tf - d.custo_forn;
      const mp = d.valor_cli > 0 ? ((d.margem / d.valor_cli) * 100).toFixed(1) : '0.0';
      return `<tr><td>${d.filial}</td><td style="text-align:right">${d.cadastrados}</td><td style="text-align:right">${d.ativos}</td><td style="text-align:right">${d.inativos}</td><td style="text-align:right">${d.gratificados}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.valor_gestao)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.valor_locacao)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(tf)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.custo_forn)}</td><td style="text-align:right;font-variant-numeric:tabular-nums" class="${dif>=0?'val-pos':'val-neg'}">${fmtVal(dif)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.valor_cli)}</td><td style="text-align:right;font-variant-numeric:tabular-nums" class="${d.margem>=0?'val-pos':'val-neg'}">${fmtVal(d.margem)}</td><td style="text-align:right">${mp}%</td></tr>`;
    }).join('')}
    <tr style="font-weight:700;border-top:2px solid var(--border)"><td>TOTAL</td><td style="text-align:right">${totalArm}</td><td style="text-align:right">${ativosArm}</td><td style="text-align:right">${inativosArm}</td><td style="text-align:right">${gratArm}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(totalGestao)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(totalLocacao)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(totalFatura)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(custoArm)}</td><td style="text-align:right;font-variant-numeric:tabular-nums" class="${difFatura>=0?'val-pos':'val-neg'}">${fmtVal(difFatura)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(receitaArm)}</td><td style="text-align:right;font-variant-numeric:tabular-nums" class="${margemArm>=0?'val-pos':'val-neg'}">${fmtVal(margemArm)}</td><td style="text-align:right">${margemPct}%</td></tr>
    </tbody></table></div></div>`;

  // Resumo por Fornecedor
  const byForn = {};
  AD.forEach(d => {
    const f = d.fornecedor || 'Outros';
    if (!byForn[f]) byForn[f] = { total: 0, ativos: 0, custo: 0, valor: 0 };
    byForn[f].total++;
    if (d.status === 'Ativo') byForn[f].ativos++;
    byForn[f].custo += Number(d.custo_forn || 0);
    byForn[f].valor += Number(d.valor_cli || 0);
  });
  document.getElementById('arm-resumo-forn').innerHTML = `
    <div class="card-header"><div class="card-title">Resumo por Fornecedor</div></div>
    <div class="card-body"><div class="table-wrap"><table><thead><tr><th>Fornecedor</th><th style="text-align:right">Armários</th><th style="text-align:right">Ativos</th><th style="text-align:right">Custo Forn.</th><th style="text-align:right">Valor Cli.</th><th style="text-align:right">Margem</th></tr></thead>
    <tbody>${Object.entries(byForn).sort((a,b)=>b[1].total-a[1].total).map(([f,v])=>{
      const m = v.valor - v.custo;
      return `<tr><td>${f}</td><td style="text-align:right">${v.total}</td><td style="text-align:right">${v.ativos}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(v.custo)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(v.valor)}</td><td style="text-align:right;font-variant-numeric:tabular-nums" class="${m>=0?'val-pos':'val-neg'}">${fmtVal(m)}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;

  renderArmFinanceiro();
  renderArmDetail();
}

// ---- resultado financeiro dos armários (valores mensais) ----
function renderArmFinanceiro() {
  let box = document.getElementById('arm-fin');
  if (!box) { box = document.createElement('div'); box.id = 'arm-fin'; document.getElementById('arm-charts').before(box); }
  const AD = DATA.armDetail || [];
  const soma = lista => lista.reduce((a, d) => { const custo = Number(d.custo_forn || 0), rec = Number(d.valor_cli || 0); a.n++; if (d.status === 'Ativo') a.ativos++; a.custo += custo; a.receita += rec; a.lucro += rec - custo; return a; }, { n: 0, ativos: 0, custo: 0, receita: 0, lucro: 0 });
  const g = soma(AD), grat = soma(AD.filter(d => d.gratificacao === 'Sim')), pagos = soma(AD.filter(d => d.gratificacao !== 'Sim'));
  const forns = [...new Set(AD.map(d => d.fornecedor || 'Outros'))].sort().map(f => [f, soma(AD.filter(d => (d.fornecedor || 'Outros') === f))]);
  const pct = s => s.receita ? Math.round(s.lucro / s.receita * 100) + '%' : '—';
  const din = v => (v < 0 ? '−' : '') + fmtVal(Math.abs(v));
  const item = (l, v, s, cor) => `<div style="padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card)"><div style="font-size:11.5px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px">${l}</div><div style="font-size:20px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums;color:${cor || 'var(--text-primary)'}">${v}</div>${s ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${s}</div>` : ''}</div>`;
  const linha = (l, s) => `<tr><td>${l}</td><td style="text-align:right">${s.n}</td><td style="text-align:right">${s.ativos}</td><td style="text-align:right">${fmtVal(s.receita)}</td><td style="text-align:right">${fmtVal(s.custo)}</td><td style="text-align:right;font-weight:700;color:${s.lucro >= 0 ? 'var(--accent)' : 'var(--danger)'}">${din(s.lucro)}</td><td style="text-align:right">${pct(s)}</td></tr>`;
  box.innerHTML = `<div class="card" style="margin-bottom:22px"><div class="card-body">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:12px"><div style="font-weight:700;font-size:15px">Resultado financeiro dos armários <span style="font-weight:500;color:var(--text-muted);font-size:12.5px">· valores mensais</span></div><div style="font-size:12px;color:var(--text-muted)">Lucro = valor cobrado do cliente − custo do fornecedor</div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
      ${item('Cobrado dos clientes', fmtVal(g.receita), pagos.n + ' armário(s) pagos')}
      ${item('Custo fornecedores', fmtVal(g.custo), '', 'var(--danger)')}
      ${item('Custo dos gratificados', fmtVal(grat.custo), grat.n + ' armário(s) em cortesia')}
      ${item('Lucro', din(g.lucro), g.receita ? 'margem ' + pct(g) : 'sem receita', g.lucro >= 0 ? 'var(--accent)' : 'var(--danger)')}
    </div>
    <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Grupo</th><th style="text-align:right">Armários</th><th style="text-align:right">Ativos</th><th style="text-align:right">Cobrado</th><th style="text-align:right">Custo forn.</th><th style="text-align:right">Lucro</th><th style="text-align:right">Margem</th></tr></thead><tbody>
      ${linha('Gratificados (cortesia)', grat)}${linha('Pagos pelo cliente', pagos)}${forns.map(([f, s]) => linha('Fornecedor ' + f, s)).join('')}
    </tbody></table></div>
  </div></div>`;
}

let armSearchVal = '';
function renderArmDetail() {
  const AD = DATA.armDetail;
  const fEl = document.querySelector('#arm-filters [data-filter="filial"]');
  const sEl = document.querySelector('#arm-filters [data-filter="status"]');
  const filial = fEl ? fEl.value : '';
  const status = sEl ? sEl.value : '';

  let filtered = AD.filter(d => {
    if (currentArmTab === 'bicateca' && (d.fornecedor||'').toUpperCase() !== 'BICATECA') return false;
    if (currentArmTab === 'meulocker' && (d.fornecedor||'').toUpperCase() !== 'MEU LOCKER' && (d.fornecedor||'').toUpperCase() !== 'MEU LOKER') return false;
    if (filial && d.filial !== filial) return false;
    if (status && d.status !== status) return false;
    if (armSearchVal) {
      const s = armSearchVal.toLowerCase();
      if (!(d.condominio||'').toLowerCase().includes(s) && !(d.endereco||'').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const tabLabel = currentArmTab === 'geral' ? 'Todos' : currentArmTab === 'bicateca' ? 'Bicateca' : 'Meu Locker';
  const allFiliais = [...new Set(AD.map(d => d.filial).filter(Boolean))].sort();

  document.getElementById('arm-filters').innerHTML = `
    <input class="form-input" style="max-width:240px;padding:7px 12px;font-size:12px" placeholder="Buscar condominio..." value="${armSearchVal}" oninput="armSearchVal=this.value;renderArmDetail()">
    <select class="filter-select" data-filter="filial" onchange="renderArmDetail()">
      <option value="">Todas as Filiais</option>
      ${allFiliais.map(f=>`<option value="${f}" ${filial===f?'selected':''}>${f}</option>`).join('')}
    </select>
    <select class="filter-select" data-filter="status" onchange="renderArmDetail()">
      <option value="">Todos os Status</option>
      <option value="Ativo" ${status==='Ativo'?'selected':''}>Ativo</option>
      <option value="Inativo" ${status==='Inativo'?'selected':''}>Inativo</option>
    </select>
    <div style="flex:1"></div>
    <div style="font-size:12px;color:var(--text-muted)">${filtered.length} armários — ${tabLabel}</div>`;

  document.getElementById('arm-detail-card').innerHTML = `
    <div class="card-header"><div class="card-title">Detalhamento de Armários — ${tabLabel}</div></div>
    <div class="card-body"><div class="table-wrap" style="max-height:50vh;overflow-y:auto">
      <table><thead><tr><th>Condomínio</th><th>Endereço</th><th>Filial</th><th>Fornecedor</th><th style="text-align:center">Portas</th><th>Status</th><th>Grat.</th><th style="text-align:right">Vl. Gestão</th><th style="text-align:right">Vl. Locação</th><th style="text-align:right">Custo Forn.</th><th style="text-align:right">Vl. Cliente</th><th style="text-align:right">Margem</th><th>Obs.</th><th>Ações</th></tr></thead>
      <tbody>${filtered.map(d=>{
        const m = Number(d.margem || (Number(d.valor_cli||0) - Number(d.custo_forn||0)));
        return `<tr><td>${d.condominio||''}</td><td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(d.endereco||'').replace(/"/g,'&quot;')}">${d.endereco||'—'}</td><td>${d.filial||''}</td><td>${d.fornecedor||''}</td><td style="text-align:center">${d.portas||0}</td><td><span class="badge ${d.status==='Ativo'?'badge-success':'badge-neutral'}">${d.status||''}</span></td><td><span class="badge ${d.gratificacao==='Sim'?'badge-success':'badge-neutral'}">${d.gratificacao||'Não'}</span></td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.custo_gestao||0)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.custo_locacao||0)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${fmtVal(d.custo_forn||0)}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${d.valor_cli?fmtVal(d.valor_cli):'—'}</td><td style="text-align:right;font-variant-numeric:tabular-nums" class="${m>=0?'val-pos':'val-neg'}">${fmtVal(m)}<div style="font-size:11px;color:var(--text-muted);font-weight:400">${Number(d.valor_cli||0) ? Math.round(m / Number(d.valor_cli) * 100) + '%' : (d.gratificacao === 'Sim' ? 'cortesia' : '—')}</div></td><td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(d.observacoes||'').replace(/"/g,'&quot;')}">${d.observacoes||'—'}</td><td style="white-space:nowrap"><button class="btn btn-outline btn-sm" onclick="editArmDetail(${d.id})" style="margin-right:4px">Editar</button><button class="btn btn-outline btn-sm" onclick="deleteArmDetail(${d.id})" style="color:var(--danger)">Excluir</button></td></tr>`;
      }).join('')}</tbody></table>
    </div></div>`;
}

function exportArmExcel() {
  const AD = DATA.armDetail;
  let csv = '﻿';
  csv += 'Condominio;Endereco;Filial;Fornecedor;Portas;Status;Gratificado;Vl. Gestao;Vl. Locacao;Custo Forn.;Valor Cliente;Margem;Observacoes\n';
  AD.forEach(d => {
    const m = Number(d.margem || (Number(d.valor_cli||0) - Number(d.custo_forn||0)));
    csv += [d.condominio||'',d.endereco||'',d.filial||'',d.fornecedor||'',d.portas||0,d.status||'',d.gratificacao||'Não',d.custo_gestao||0,d.custo_locacao||0,d.custo_forn||0,d.valor_cli||0,m,d.observacoes||''].join(';') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'armarios.csv'; a.click();
  URL.revokeObjectURL(url);
}


// ===== ARMARIO CRUD =====
function openArmModal() {
  document.getElementById('arm-modal').classList.add('open');
  document.getElementById('arm-condominio').value = '';
  document.getElementById('arm-filial').value = 'FORTALEZA';
  document.getElementById('arm-fornecedor').value = '';
  document.getElementById('arm-portas').value = '0';
  document.getElementById('arm-status').value = 'Ativo';
  document.getElementById('arm-grat').value = 'Não';
  document.getElementById('arm-ordem-compra').value = '';
  document.getElementById('arm-numero-nf').value = '';
  document.getElementById('arm-pdf-nf').value = '';
  document.getElementById('arm-custo-gestao').value = '';
  document.getElementById('arm-custo-locacao').value = '';
  document.getElementById('arm-custo').value = '';
  document.getElementById('arm-valor-cli').value = '';
  document.getElementById('arm-endereco').value = '';
  document.getElementById('arm-observacoes').value = '';
  editingArmId = null;
  document.querySelector('#arm-modal h3').textContent = 'Novo Armario';
}
function closeArmModal() { document.getElementById('arm-modal').classList.remove('open'); }
let editingArmId = null;

function editArmDetail(id) {
  const d = DATA.armDetail.find(r => r.id === id);
  if (!d) return;
  editingArmId = id;
  document.getElementById('arm-modal').classList.add('open');
  document.querySelector('#arm-modal h3').textContent = 'Editar Armario';
  document.getElementById('arm-condominio').value = d.condominio || '';
  document.getElementById('arm-filial').value = d.filial || 'FORTALEZA';
  document.getElementById('arm-fornecedor').value = d.fornecedor || '';
  document.getElementById('arm-portas').value = d.portas || 0;
  document.getElementById('arm-status').value = d.status || 'Ativo';
  document.getElementById('arm-grat').value = d.gratificacao || 'Não';
  document.getElementById('arm-ordem-compra').value = d.ordem_compra || '';
  document.getElementById('arm-numero-nf').value = d.numero_nf || '';
  document.getElementById('arm-pdf-nf').value = d.pdf_nf_url || '';
  document.getElementById('arm-custo-gestao').value = d.custo_gestao || '';
  document.getElementById('arm-custo-locacao').value = d.custo_locacao || '';
  document.getElementById('arm-custo').value = d.custo_forn || '';
  document.getElementById('arm-valor-cli').value = d.valor_cli || '';
  document.getElementById('arm-endereco').value = d.endereco || '';
  document.getElementById('arm-observacoes').value = d.observacoes || '';
}

async function deleteArmDetail(id) {
  if (!sb || !confirm('Excluir este armario?')) return;
  const { error } = await sb.from('armarios_detail').delete().eq('id', id);
  if (error) { showToast('Erro: ' + error.message, true); return; }
  showToast('Armario excluido');
  await refreshData();
}

async function saveArmario() {
  if (!sb) { showToast('Sem conexao', true); return; }
  const condominio = document.getElementById('arm-condominio').value.trim();
  if (!condominio) { showToast('Preencha o condominio', true); return; }
  const custoGestao = parseFloat(document.getElementById('arm-custo-gestao').value) || 0;
  const custoLocacao = parseFloat(document.getElementById('arm-custo-locacao').value) || 0;
  const custoForn = parseFloat(document.getElementById('arm-custo').value) || 0;
  const valorCli = parseFloat(document.getElementById('arm-valor-cli').value) || 0;
  const obj = {
    condominio,
    filial: document.getElementById('arm-filial').value,
    fornecedor: document.getElementById('arm-fornecedor').value,
    portas: parseInt(document.getElementById('arm-portas').value) || 0,
    status: document.getElementById('arm-status').value,
    gratificacao: document.getElementById('arm-grat').value,
    ordem_compra: document.getElementById('arm-ordem-compra').value.trim(),
    numero_nf: document.getElementById('arm-numero-nf').value.trim(),
    pdf_nf_url: document.getElementById('arm-pdf-nf').value.trim(),
    custo_gestao: custoGestao,
    custo_locacao: custoLocacao,
    custo_forn: custoForn,
    valor_cli: valorCli,
    margem: valorCli - custoForn,
    endereco: document.getElementById('arm-endereco').value.trim(),
    observacoes: document.getElementById('arm-observacoes').value.trim(),
  };
  let error;
  if (editingArmId) {
    ({ error } = await sb.from('armarios_detail').update(obj).eq('id', editingArmId));
  } else {
    ({ error } = await sb.from('armarios_detail').insert(obj));
  }
  if (error) { showToast('Erro: ' + error.message, true); return; }
  showToast(editingArmId ? 'Armario atualizado!' : 'Armario adicionado!');
  closeArmModal();
  await refreshData();
}

