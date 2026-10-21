// ===== DASHBOARD =====
function setDashFilial(v) { window.dashFilial = v; renderDashboard(); }

function renderDashboard() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('dash-greeting').innerHTML = greet + ', <span>BackTech</span>';
  const now = new Date();
  document.getElementById('dash-day').textContent = now.getDate();
  const months = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  document.getElementById('dash-month').textContent = months[now.getMonth()] + ' ' + now.getFullYear();

  const F = DATA.fornecedores;
  const fil = window.dashFilial || 'Todas';
  const T = DATA.torres.filter(d => fil === 'Todas' || d.filial === fil);
  const IA = DATA.iaFilial.filter(d => fil === 'Todas' || d.filial === fil);
  const ARM = DATA.armResumo.filter(d => fil === 'Todas' || d.filial === fil);
  const selFil = document.getElementById('dash-filial-sel');
  if (selFil && !selFil.options.length) {
    const nomes = [...new Set([...DATA.iaFilial, ...DATA.armResumo].map(d => d.filial).filter(Boolean))].sort();
    selFil.innerHTML = '<option value="Todas">Todas as filiais</option>' + nomes.map(n => `<option value="${n}">${n}</option>`).join('');
  }
  if (selFil) selFil.value = fil;

  const custoTotal = F.reduce((s,d) => s + Number(d.valor), 0);
  const totalCli = IA.reduce((s,d) => s + d.clientes, 0);
  const ativosCli = IA.reduce((s,d) => s + d.ativos, 0);
  const camCli = IA.reduce((s,d) => s + d.cameras, 0);
  const instaladas = T.filter(d => d.status === 'INSTALADA').length;
  const autorizadas = T.filter(d => d.status === 'AUTORIZADA').length;
  const totalArm = ARM.reduce((s,d) => s + d.cadastrados, 0);
  const ativosArm = ARM.reduce((s,d) => s + d.ativos, 0);
  const margemArm = ARM.reduce((s,d) => s + Number(d.margem), 0);
  const custoArm = ARM.reduce((s,d) => s + Number(d.custo_forn), 0);
  const receitaArm = ARM.reduce((s,d) => s + Number(d.valor_cli), 0);

  updateNavBadges();
  const alerts = [];
  const defArm = ARM.filter(d => Number(d.margem) < 0);
  if (defArm.length) alerts.push({cls:'red', go:'armarios', txt:`Armários em déficit: ${defArm.map(d => d.filial).join(', ')}`});
  const inatCli = totalCli - ativosCli;
  if (inatCli > 0) alerts.push({cls:'orange', go:'clientes', txt:`${inatCli} clientes IA inativos`});
  const inatArm = totalArm - ativosArm;
  if (inatArm > 0) alerts.push({cls:'orange', go:'armarios', txt:`${inatArm} armários inativos`});
  const semInst = T.length - instaladas;
  if (semInst > 0) alerts.push({cls:'amber', go:'torres', txt:`${semInst} torres ainda não instaladas`});
  const gratVenc = T.filter(d => { const n = diasAte(d.data_fim_gratificacao); return n !== null && n < 0; }).length;
  const gratProx = T.filter(d => { const n = diasAte(d.data_fim_gratificacao); return n !== null && n >= 0 && n <= 30; }).length;
  if (gratVenc > 0) alerts.push({cls:'red', go:'torres', txt:`${gratVenc} gratificações de torre vencidas`});
  if (gratProx > 0) alerts.push({cls:'amber', go:'torres', txt:`${gratProx} gratificações de torre vencem em 30 dias`});
  alerts.push(...opsAlerts());
  const vencFornAb = F.filter(d => d.dt_vencimento && d.pagamento !== 'SIM' && (diasAte(String(d.dt_vencimento).slice(0,10)) ?? 1) < 0).length;
  if (vencFornAb > 0) alerts.unshift({cls:'red', go:'fornecedores', txt:`${vencFornAb} pagamento${vencFornAb>1?'s':''} de fornecedor vencido${vencFornAb>1?'s':''}`});
  document.getElementById('dash-alerts').innerHTML = alerts.length
    ? alerts.map(a => `<button class="dash-alert ${a.cls}" onclick="showSection('${a.go}')">${a.txt}</button>`).join('')
    : '<span class="dash-alert ok">Nenhum alerta no momento</span>';

  document.getElementById('dash-kpis').innerHTML = `
    <div class="kpi-card clickable" onclick="showSection('fornecedores')"><div class="kpi-card-stripe" style="background:var(--blue)"></div>
      <div class="kpi-card-icon" style="background:var(--blue-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg></div>
      <div class="kpi-label">Fornecedores Lemos</div><div class="kpi-value blue">${F.length}</div>
      <div class="kpi-sub"><span class="kpi-tag kpi-tag-neutral">Supabase</span> servicos vinculados</div></div>
    <div class="kpi-card clickable" onclick="showSection('fornecedores')"><div class="kpi-card-stripe" style="background:var(--accent)"></div>
      <div class="kpi-card-icon" style="background:var(--accent-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
      <div class="kpi-label">Custo Mensal Lemos</div><div class="kpi-value accent">R$ ${fmtK(custoTotal)}</div>
      <div class="kpi-sub">sistemas + servidores + suporte</div></div>
    <div class="kpi-card clickable" onclick="showSection('clientes')"><div class="kpi-card-stripe" style="background:#8a9bb5"></div>
      <div class="kpi-card-icon" style="background:rgba(235,104,52,0.12)"><svg viewBox="0 0 24 24" fill="none" stroke="#eb6834" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
      <div class="kpi-label">Clientes IA</div><div class="kpi-value">${totalCli}</div>
      <div class="kpi-sub"><span class="kpi-tag kpi-tag-up">${ativosCli} ativos · ${totalCli ? Math.round(ativosCli/totalCli*100) : 0}%</span> ${camCli.toLocaleString('pt-BR')} câmeras</div></div>
    <div class="kpi-card clickable" onclick="showSection('torres')"><div class="kpi-card-stripe" style="background:#8a9bb5"></div>
      <div class="kpi-card-icon" style="background:var(--warning-dim)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M4 21V10l8-7 8 7v11"/><path d="M9 21v-6h6v6"/></svg></div>
      <div class="kpi-label">Torres</div><div class="kpi-value">${T.length}</div>
      <div class="kpi-sub"><span class="kpi-tag kpi-tag-up">${instaladas} instaladas · ${T.length ? Math.round(instaladas/T.length*100) : 0}%</span> ${autorizadas} autorizadas</div></div>
    <div class="kpi-card clickable" onclick="showSection('armarios')"><div class="kpi-card-stripe" style="background:#8a9bb5"></div>
      <div class="kpi-card-icon" style="background:rgba(232,123,164,0.12)"><svg viewBox="0 0 24 24" fill="none" stroke="#e87ba4" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div>
      <div class="kpi-label">Armários</div><div class="kpi-value">${totalArm}</div>
      <div class="kpi-sub"><span class="kpi-tag kpi-tag-up">${ativosArm} ativos · ${totalArm ? Math.round(ativosArm/totalArm*100) : 0}%</span> ${ARM.length} filiais</div></div>
    ${(() => { const pos = margemArm >= 0; const c = pos ? 'var(--accent)' : 'var(--danger)'; const cd = pos ? 'var(--accent-dim)' : 'var(--danger-dim)';
      return `<div class="kpi-card clickable" onclick="showSection('armarios')"><div class="kpi-card-stripe" style="background:${c}"></div>
      <div class="kpi-card-icon" style="background:${cd}">${pos ? `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M12 2l10 18H2z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5"/></svg>`}</div>
      <div class="kpi-label">Margem Armários</div><div class="kpi-value ${pos ? 'accent' : 'danger'}">${pos ? '' : '-'}R$ ${fmtK(Math.abs(margemArm))}</div>
      <div class="kpi-sub"><span class="kpi-tag ${pos ? 'kpi-tag-up' : 'kpi-tag-down'}">${pos ? 'superávit' : 'déficit'}</span> custo R$ ${fmtK(custoArm)} vs receita R$ ${fmtK(receitaArm)}</div></div>`; })()}`;

  renderDashOps();

  // Charts row 1
  const byTipo = {};
  F.forEach(d => { const t = d.tipo || 'Outros'; byTipo[t] = (byTipo[t] || 0) + Number(d.valor); });
  document.getElementById('dash-charts-1').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Fornecedores por Tipo</div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">Distribuição de custo mensal</div></div><div class="chart-card-badge">${F.length} servicos</div></div><div class="chart-card-body" id="dchart-tipo"></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Clientes IA por Filial</div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">Câmeras com inteligência artificial</div></div><div class="chart-card-badge">${IA.length} filiais</div></div><div class="chart-card-body" id="dchart-ia"></div></div>`;
  hBar('dchart-tipo', Object.entries(byTipo).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,t:'R$ '+fmtK(v)})), ['#2a78d6','#1abf8f','#eb6834','#eda100','#e87ba4']);
  hBar('dchart-ia', IA.map(d=>({l:d.filial.replace('Servis ','').replace('Secopi ',''), v:d.cameras, t:`${d.cameras} cam. · ${d.clientes ? Math.round(d.ativos/d.clientes*100) : 0}% ativos`})), ['#2a78d6']);

  // Charts row 2
  const tSt = {};
  T.forEach(d => { tSt[d.status] = (tSt[d.status] || 0) + 1; });
  document.getElementById('dash-charts-2').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Funil de torres</div></div><div class="chart-card-badge">${T.length} torres</div></div><div class="chart-card-body" id="dchart-torres"></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Armários — Margem por Filial</div></div><div class="chart-card-badge">${ARM.length} filiais</div></div><div class="chart-card-body" id="dchart-arm"></div></div>`;
  const ordemFunil = ['EM AUTORIZAÇÃO','AUTORIZADA','INSTALADA'];
  hBar('dchart-torres', Object.entries(tSt).sort((a,b) => { const ia = ordemFunil.indexOf(a[0]), ib = ordemFunil.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).map(([l,v]) => ({l,v,t:v+' torres'})), ['#8a9bb5','#eda100','#1abf8f']);

  // Arm margem custom chart
  const armData = ARM.map(d => ({l: d.filial, v: Math.abs(Number(d.margem)), t: (Number(d.margem) >= 0 ? '+' : '-') + fmtVal(Math.abs(Number(d.margem)))}));
  const armColors = ARM.map(d => Number(d.margem) >= 0 ? '#1abf8f' : '#e34948');
  if (armData.length) {
    const maxV = Math.max(...armData.map(d => d.v));
    const bH = 28, g = 8, lW = 100, cW = 300;
    const hh = armData.length * (bH + g) + 10;
    let s = `<svg width="100%" viewBox="0 0 ${lW+cW+120} ${hh}" style="display:block;max-width:100%">`;
    armData.forEach((d,i) => { const y = i*(bH+g)+4; const w = maxV>0?(d.v/maxV)*cW:0;
      s += `<g class="chart-bar-group"><text x="${lW-8}" y="${y+bH/2+4}" text-anchor="end" fill="var(--text-secondary)" font-size="11" font-family="Inter,sans-serif">${d.l}</text>`;
      s += `<rect x="${lW}" y="${y}" width="${Math.max(w,2)}" height="${bH}" rx="4" fill="${armColors[i]}"/>`;
      s += `<text x="${lW+w+8}" y="${y+bH/2+4}" fill="${armColors[i]}" font-size="11" font-weight="600" font-family="Inter,sans-serif">${d.t}</text></g>`;
    });
    s += `</svg>`;
    document.getElementById('dchart-arm').innerHTML = s;
  }

  // Bottom: vencimentos + payment donut
  const pagos = F.filter(d => d.pagamento === 'SIM').length;
  const pend = F.filter(d => d.pagamento === 'PENDENTE').length;
  const semInfo = F.length - pagos - pend;
  const pctPago = F.length > 0 ? pagos / F.length * 100 : 0;
  const pctPend = F.length > 0 ? pend / F.length * 100 : 0;
  const pctSem = 100 - pctPago - pctPend;
  const r = 54, cx = 70, cy = 70, sw = 14;
  const circ = 2 * Math.PI * r;
  const s1 = pctPago/100*circ, s2 = pctPend/100*circ, s3 = pctSem/100*circ;

  // Somente não pagos: vencidos + próximos 30 dias (máx. 8)
  const upcoming = F.filter(d => d.dt_vencimento && d.pagamento !== 'SIM')
    .map(d => ({s:d.servico, venc:String(d.dt_vencimento).slice(0,10), v:Number(d.valor), n:diasAte(String(d.dt_vencimento).slice(0,10))}))
    .filter(d => d.n !== null && d.n <= 30)
    .sort((a,b) => a.venc.localeCompare(b.venc));
  const upShow = upcoming.slice(0, 8);
  document.getElementById('dash-bottom').innerHTML = `
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Próximos Vencimentos</div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">Não pagos · vencidos e próximos 30 dias</div></div><div class="chart-card-badge">${upcoming.length} em aberto</div></div><div class="chart-card-body"><div id="dash-venc">${
      upShow.length ? upShow.map(d => {
        const vencido = d.n < 0;
        const dt = d.venc.split('-').reverse().join('/');
        const stCls = vencido ? 'badge-danger' : d.n <= 7 ? 'badge-warning' : 'badge-neutral';
        const stTxt = vencido ? `Vencido há ${-d.n}d` : d.n === 0 ? 'Vence hoje' : `Em ${d.n}d`;
        return `<div class="timeline-item"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong style="font-size:13px">${d.s}</strong><span class="badge ${stCls}">${stTxt}</span></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--text-muted)"><span>${dt}</span><span style="font-weight:600;color:var(--text-secondary)">${fmtVal(d.v)}</span></div></div>`;
      }).join('') + (upcoming.length > upShow.length ? `<div style="padding-top:10px"><button class="btn btn-outline btn-sm" onclick="showSection('fornecedores')">Ver todos (${upcoming.length})</button></div>` : '')
      : '<div class="empty-state">Nenhum vencimento em aberto nos próximos 30 dias</div>'
    }</div></div></div>
    <div class="chart-card"><div class="chart-card-header"><div><div class="chart-card-title">Status dos Pagamentos</div></div></div><div class="chart-card-body">
      <div class="donut-wrap">
        <svg viewBox="0 0 140 140" width="140" height="140">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${sw}" stroke-dasharray="${s1} ${circ-s1}" stroke-dashoffset="0" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--warning)" stroke-width="${sw}" stroke-dasharray="${s2} ${circ-s2}" stroke-dashoffset="${circ-s1}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}" stroke-dasharray="${s3} ${circ-s3}" stroke-dashoffset="${circ-s1-s2}" transform="rotate(-90 ${cx} ${cy})"/>
          <text x="${cx}" y="${cy-6}" text-anchor="middle" fill="var(--text-primary)" font-size="22" font-weight="700" font-family="Inter,sans-serif">${F.length}</text>
          <text x="${cx}" y="${cy+12}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="Inter,sans-serif">fornecedores</text>
        </svg>
        <div class="donut-legend">
          <div class="donut-legend-item"><span class="donut-dot" style="background:var(--accent)"></span> Pagos <strong>${pagos}</strong></div>
          <div class="donut-legend-item"><span class="donut-dot" style="background:var(--warning)"></span> Pendentes <strong>${pend}</strong></div>
          <div class="donut-legend-item"><span class="donut-dot" style="background:var(--border)"></span> Sem info <strong>${semInfo}</strong></div>
        </div>
      </div>
      <div style="margin-top:16px"><div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:6px"><span>Fluxo concluido</span><span style="font-weight:600">${Math.round(pctPago)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pctPago}%"></div></div></div>
    </div></div>`;
}

