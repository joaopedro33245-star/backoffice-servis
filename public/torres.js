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

  renderTorresDetalhe();
  renderTorresTable();
}

// ===== Visão geral + câmeras + resultado por cliente (fases 1) =====
function torreSemLinha(d) { return d.linha_contrato !== true; }
function classifTorre(c, d) { if (d && d.gratificada !== false) return 'CORTESIA'; if (!c.receita) return c.total ? 'DEFICITÁRIA' : 'EQUILÍBRIO'; return c.lucro > 0.005 ? 'RENTÁVEL' : c.lucro < -0.005 ? 'DEFICITÁRIA' : 'EQUILÍBRIO'; }
function torresFiltroAtivo() {
  const g = id => { const el = document.querySelector('#torres-filters [data-filter="' + id + '"]'); return el ? el.value : ''; };
  return { filial: window.TOR_FIN_FILIAL || '', st: g('status'), iaF: g('ia'), tp: g('tipo'), gr: g('grat'), search: (g('search') || '').toLowerCase() };
}
function torreCasaFiltro(d, f) {
  if (f.filial && (d.filial || 'Sem filial') !== f.filial) return false;
  if (f.st && d.status !== f.st) return false;
  const dias = diasAte(d.data_fim_gratificacao);
  if (f.gr === 'vencendo' && !(dias !== null && dias >= 0 && dias <= 30)) return false;
  if (f.gr === 'vencidas' && !(dias !== null && dias < 0)) return false;
  if (f.gr === 'semdata' && d.data_fim_gratificacao) return false;
  if (f.gr === 'gratificadas' && d.gratificada === false) return false;
  if (f.gr === 'pagas' && d.gratificada !== false) return false;
  if (f.gr === 'chkpend' && !(d.status === 'INSTALADA' && torreChecklist(d) < 4)) return false;
  if (f.gr === 'semlinha' && d.linha_contrato === true) return false;
  if (f.gr === 'seminstal' && d.data_instalacao) return false;
  if (f.gr === 'deficit' && classifTorre(custosTorre(d), d) !== 'DEFICITÁRIA') return false;
  if (f.tp && (d.tipo_operacao || '') !== f.tp) return false;
  if (f.iaF === 'sem' && d.forn_ia) return false;
  if (f.iaF && f.iaF !== 'sem' && d.forn_ia !== f.iaF) return false;
  if (f.search && !nzBusca([d.cliente, d.nome_fantasia, d.codigo_cliente, d.chave_sigma].filter(Boolean).join(' ')).includes(nzBusca(f.search))) return false;
  return true;
}
function torresFiltradas() { const f = torresFiltroAtivo(); return (DATA.torres || []).filter(d => torreCasaFiltro(d, f)); }
function torresRender() { renderTorresDetalhe(); renderTorresTable(); }
function renderTorresPorCliente() {
  let box = document.getElementById('torres-por-cliente');
  if (!box) {
    box = document.createElement('div'); box.id = 'torres-por-cliente'; box.style.marginTop = '22px';
    const tw = document.getElementById('torres-table-wrap');
    const card = tw ? tw.closest('.card') : null;
    (card || document.getElementById('torres-filters') || document.body).after(box);
  }
  const T = torresFiltradas();
  const R = v => (v < 0 ? '−' : '') + fmtVal(Math.abs(v));
  const corV = v => v >= 0 ? 'var(--accent)' : 'var(--danger)';
  const nCam = d => Number(d.cameras || 0);
  const ordenadas = T.slice().sort((a, b) => custosTorre(a).lucro - custosTorre(b).lucro);
  const badge = cl => { const cor = cl === 'RENTÁVEL' ? 'badge-success' : cl === 'DEFICITÁRIA' ? 'badge-danger' : 'badge-warning'; return `<span class="badge ${cor}">${cl}</span>`; };
  const linhaCli = d => { const c = custosTorre(d); const cl = classifTorre(c, d); return `<tr><td style="padding:8px 10px">${d.cliente || '—'}${d.filial ? `<div style="font-size:11px;color:var(--text-muted)">${d.filial}</div>` : ''}</td><td style="${_tdN2}">${nCam(d) || '—'}</td><td style="${_tdN2}">${c.receita ? fmtVal(c.receita) : '—'}</td><td style="${_tdN2}">${fmtVal(c.ia)}</td><td style="${_tdN2}">${fmtVal(c.servidor + c.servidorImg)}</td><td style="${_tdN2};color:var(--danger)">${fmtVal(c.total)}</td><td style="${_tdN2};font-weight:700;color:${corV(c.lucro)}">${R(c.lucro)}</td><td style="text-align:center">${badge(cl)}</td></tr>`; };
  const rentaveis = T.filter(d => classifTorre(custosTorre(d), d) === 'RENTÁVEL').length;
  const deficit = T.filter(d => classifTorre(custosTorre(d), d) === 'DEFICITÁRIA').length;
  const cliHtml = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 10px"><span class="badge badge-success">${rentaveis} rentáveis</span><span class="badge badge-danger">${deficit} deficitárias</span></div>
    <div class="table-wrap"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.3px"><th style="padding:8px 10px;text-align:left">Cliente</th><th style="${_thN2}">Câm.</th><th style="${_thN2}">Faturamento</th><th style="${_thN2}">Custo IA</th><th style="${_thN2}">Servidores</th><th style="${_thN2}">Custo total</th><th style="${_thN2}">Resultado</th><th style="${_thN2.replace('right','center')}">Situação</th></tr></thead><tbody>${ordenadas.map(linhaCli).join('')}</tbody></table></div>`;
  box.innerHTML = `<div class="card"><div class="card-body"><div style="font-weight:700;font-size:16px;margin-bottom:4px">Resultado por cliente${window.TOR_FIN_FILIAL ? ' · ' + window.TOR_FIN_FILIAL : ''} <span style="font-weight:400;font-size:13px;color:var(--text-muted)">(do pior para o melhor)</span></div>${cliHtml}</div></div>`;
}
function renderTorresDetalhe() {
  let box = document.getElementById('torres-detalhe');
  if (!box) { box = document.createElement('div'); box.id = 'torres-detalhe'; const fin = document.getElementById('torres-fin'); (fin || document.getElementById('torres-charts')).after(box); }
  const _fin = torresFinExtras();
  const _filiaisL = window.TOR_FIN_FILIAL_L || [];
  const fA = torresFiltroAtivo();
  const T = torresFiltradas();
  const Tbase = (DATA.torres || []).filter(d => !fA.filial || (d.filial || 'Sem filial') === fA.filial);
  const filChips = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 2px">${['', ..._filiaisL].map((f, i) => `<button class="btn btn-sm ${(window.TOR_FIN_FILIAL || '') === f ? 'btn-accent' : 'btn-outline'}" onclick="window.TOR_FIN_FILIAL=${i ? `window.TOR_FIN_FILIAL_L[${i - 1}]` : "''"};torresRender()">${f || 'Todas as filiais'}</button>`).join('')}</div>`;
  const R = v => (v < 0 ? '−' : '') + fmtVal(Math.abs(v));
  const corV = v => v >= 0 ? 'var(--accent)' : 'var(--danger)';
  const nCam = d => Number(d.cameras || 0);
  const soma = (lista, fn) => lista.reduce((s, d) => s + fn(d), 0);
  const cobradas = T.filter(d => d.gratificada === false);
  const gratis = T.filter(d => d.gratificada !== false);
  const semLinha = T.filter(torreSemLinha);
  const cam2 = T.filter(d => nCam(d) === 2), cam3 = T.filter(d => nCam(d) >= 3);
  const faturamento = soma(T, d => custosTorre(d).receita);
  const custoTotal = soma(T, d => custosTorre(d).total);
  const custoServidores = soma(T, d => custosTorre(d).servidor + custosTorre(d).servidorImg);
  const lucro = faturamento - custoTotal;

  // ---- Resumo executivo (diretoria): 3 números grandes + contexto enxuto ----
  const bCobr = Tbase.filter(d => d.gratificada === false).length, bGrat = Tbase.filter(d => d.gratificada !== false).length, bSemL = Tbase.filter(torreSemLinha).length;
  const bPort = Tbase.filter(d => d.tipo_operacao === 'portaria').length, bMon = Tbase.filter(d => d.tipo_operacao === 'monitoramento').length;
  const qfOn = (dim, val) => (dim === 'grat' ? fA.gr : fA.tp) === val ? ';outline:2px solid var(--primary);outline-offset:1px' : '';
  const big = (l, v, s, c) => `<div style="border:1px solid var(--border);border-radius:14px;padding:18px 20px;background:var(--bg-card)"><div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">${l}</div><div style="font-size:30px;font-weight:800;margin-top:6px;font-variant-numeric:tabular-nums;color:${c || 'var(--text-primary)'}">${v}</div>${s ? `<div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">${s}</div>` : ''}</div>`;
  const hero = (l, v, s, c) => `<div style="border:2px solid ${c};border-radius:14px;padding:18px 20px;background:var(--bg-card)"><div style="font-size:12px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:.4px">${l}</div><div style="font-size:34px;font-weight:900;margin-top:4px;font-variant-numeric:tabular-nums;color:${c}">${v}</div>${s ? `<div style="font-size:13px;color:var(--text-muted);margin-top:2px">${s}</div>` : ''}</div>`;
  const cardsHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      ${big('Faturamento / mês', fmtVal(faturamento), 'o que os clientes pagam')}
      ${big('Custo / mês', fmtVal(custoTotal), 'fornecedores + servidores', 'var(--danger)')}
      ${hero('Lucro líquido / mês', R(lucro), faturamento ? 'margem de ' + Math.round(lucro / faturamento * 100) + '%' : 'sem receita', corV(lucro))}
    </div>
    <div style="font-size:11.5px;color:var(--text-muted);margin-top:14px">Clique para filtrar toda a tela (clique de novo para limpar):</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">
      <span class="badge ${!fA.gr && !fA.tp ? 'badge-blue' : 'badge-neutral'}" style="cursor:pointer" onclick="torresQuickFilter('grat','')" title="Ver todas">${soma(Tbase, qtdTorres)} torres · ${Tbase.length} clientes</span>
      <span class="badge badge-blue" style="cursor:pointer${qfOn('grat','pagas')}" onclick="torresQuickFilter('grat','pagas')">${bCobr} cobradas</span>
      <span class="badge badge-warning" style="cursor:pointer${qfOn('grat','gratificadas')}" onclick="torresQuickFilter('grat','gratificadas')">${bGrat} gratificadas</span>
      <span class="badge ${bSemL ? 'badge-danger' : 'badge-neutral'}" style="cursor:pointer${qfOn('grat','semlinha')}" onclick="torresQuickFilter('grat','semlinha')">${bSemL} sem linha no contrato</span>
      <span class="badge badge-neutral" style="cursor:pointer;border-left:3px solid var(--blue)${qfOn('tipo','portaria')}" onclick="torresQuickFilter('tipo','portaria')">🏢 ${bPort} portaria</span>
      <span class="badge badge-neutral" style="cursor:pointer;border-left:3px solid var(--accent)${qfOn('tipo','monitoramento')}" onclick="torresQuickFilter('tipo','monitoramento')">📹 ${bMon} monitoramento</span>
    </div>`;

  // ---- Por quantidade de câmeras (seção 4) ----
  const linhaCam = (lbl, lista) => { const rec = soma(lista, d => custosTorre(d).receita); const cia = soma(lista, d => custosTorre(d).ia); const csrv = soma(lista, d => custosTorre(d).servidor + custosTorre(d).servidorImg); const ct = soma(lista, d => custosTorre(d).total); const luc = rec - ct;
    return `<tr><td style="padding:8px 10px;font-weight:600">${lbl}</td><td style="${_tdN2}">${soma(lista, qtdTorres)}</td><td style="${_tdN2}">${lista.filter(d => d.gratificada !== false).length}</td><td style="${_tdN2}">${lista.filter(d => d.gratificada === false).length}</td><td style="${_tdN2}">${fmtVal(rec)}</td><td style="${_tdN2}">${fmtVal(cia)}</td><td style="${_tdN2}">${fmtVal(csrv)}</td><td style="${_tdN2};font-weight:700;color:${corV(luc)}">${R(luc)}</td><td style="${_tdN2};color:var(--text-muted)">${rec ? Math.round(luc / rec * 100) + '%' : '—'}</td></tr>`; };
  const camHtml = `<div class="table-wrap" style="margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.3px"><th style="padding:8px 10px;text-align:left">Categoria</th><th style="${_thN2}">Torres</th><th style="${_thN2}">Gratif.</th><th style="${_thN2}">Cobradas</th><th style="${_thN2}">Receita</th><th style="${_thN2}">Custo IA</th><th style="${_thN2}">Servidores</th><th style="${_thN2}">Lucro</th><th style="${_thN2}">Margem</th></tr></thead><tbody>
    ${linhaCam('2 câmeras', cam2)}${linhaCam('3+ câmeras', cam3)}${(() => { const outras = T.filter(d => nCam(d) < 2); return outras.length ? linhaCam('Outras', outras) : ''; })()}</tbody></table></div>`;


  // ---- Alertas gerenciais (seção 9.6) ----
  const alertas = [];
  if (semLinha.length) alertas.push(`${semLinha.length} torre(s) sem linha de serviço no contrato`);
  const gratCaro = gratis.filter(d => custosTorre(d).total >= 50).length; if (gratCaro) alertas.push(`${gratCaro} gratificada(s) com custo mensal acima de R$ 50`);
  const recMenor = cobradas.filter(d => { const c = custosTorre(d); return c.receita && c.receita < c.total; }).length; if (recMenor) alertas.push(`${recMenor} cobrada(s) onde a mensalidade não cobre o custo`);
  const semData = T.filter(d => !d.data_instalacao).length; if (semData) alertas.push(`${semData} torre(s) sem data de instalação`);
  const alertasHtml = alertas.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${alertas.map(a => `<div style="display:flex;gap:8px;align-items:center;font-size:13px;padding:8px 10px;border:1px solid var(--warning);border-radius:8px;background:var(--warning-dim)"><span>⚠️</span><span>${a}</span></div>`).join('')}</div>` : '<div style="color:var(--text-muted);font-size:13px">Nenhum alerta. 🎉</div>';

  // ---- Instalações por mês (seção 6) ----
  const porMes = {}; T.forEach(d => { if (d.data_instalacao) { const m = d.data_instalacao.slice(0, 7); porMes[m] = (porMes[m] || 0) + qtdTorres(d); } });
  const mesesOrd = Object.keys(porMes).sort();
  const semDataN = T.filter(d => !d.data_instalacao).length;
  const instalHtml = mesesOrd.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${mesesOrd.map(m => { const [y, mm] = m.split('-'); return `<span class="badge badge-neutral">${mm}/${y}: ${porMes[m]}</span>`; }).join('')}</div>${semDataN ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">${semDataN} torre(s) ainda sem data de instalação.</div>` : ''}` : '<div style="color:var(--text-muted);font-size:13px">Nenhuma torre com data de instalação cadastrada ainda. Preencha no cadastro da torre.</div>';

  // ---- Comparativos (seção 9.5) ----
  const barCmp = itens => { const max = Math.max(1, ...itens.map(i => Math.abs(i.v))); return itens.map(i => `<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px"><span style="color:var(--text-secondary)">${i.l}</span><span style="font-variant-numeric:tabular-nums;font-weight:600;color:${i.c || 'var(--text-primary)'}">${i.t}</span></div><div style="height:7px;border-radius:4px;background:var(--bg-soft)"><div style="height:7px;border-radius:4px;background:${i.bg || 'var(--primary)'};width:${Math.max(3, Math.abs(i.v) / max * 100)}%"></div></div></div>`).join(''); };
  const lucro2 = soma(cam2, d => custosTorre(d).lucro), lucro3 = soma(cam3, d => custosTorre(d).lucro);
  const custoCob = soma(cobradas, d => custosTorre(d).total), custoGra = soma(gratis, d => custosTorre(d).total);
  const comparativoHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
    <div><div style="font-weight:700;font-size:13px;margin-bottom:8px">Lucro por câmeras</div>${barCmp([{ l: '2 câmeras', v: lucro2, t: R(lucro2), c: corV(lucro2), bg: 'var(--accent)' }, { l: '3+ câmeras', v: lucro3, t: R(lucro3), c: corV(lucro3), bg: 'var(--blue)' }])}</div>
    <div><div style="font-weight:700;font-size:13px;margin-bottom:8px">Custo mensal · cobradas × gratificadas</div>${barCmp([{ l: 'Cobradas', v: custoCob, t: fmtVal(custoCob), bg: 'var(--accent)' }, { l: 'Gratificadas', v: custoGra, t: fmtVal(custoGra), bg: 'var(--warning)' }])}</div>
  </div>`;

  const secTitle = t => `<div style="font-weight:700;font-size:15px;margin:18px 0 6px">${t}</div>`;
  box.innerHTML = `<div class="card" style="margin-bottom:22px"><div class="card-body">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div style="font-weight:700;font-size:16px">Resultado da operação de Torres${window.TOR_FIN_FILIAL ? ' · ' + window.TOR_FIN_FILIAL : ''}</div><button class="btn btn-outline btn-sm" onclick="exportTorresCSV()" title="Exportar todas as torres com custos e resultado">⬇ Exportar CSV</button></div>
    ${filChips}
    <div style="margin-top:12px">${cardsHtml}</div>
    ${secTitle('Pagas × gratificadas · custo por fornecedor')}<div style="margin-bottom:8px">${_fin.geral}</div>${_fin.blocos}
    ${secTitle('Por quantidade de câmeras')}${camHtml}
    ${secTitle('Comparativos')}${comparativoHtml}
    ${_fin.filial}
    ${secTitle('Instalações por mês')}${instalHtml}
    ${secTitle('Alertas gerenciais')}${alertasHtml}
  </div></div>`;
  renderTorresPorCliente();
}
const _tdN2 = 'padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums';
const _thN2 = 'padding:8px 10px;text-align:right';
function pctTxt(a, b) { return b ? Math.round(a / b * 100) + '% do total' : '—'; }
function torresQuickFilter(dim, valor) {
  const el = document.querySelector('#torres-filters [data-filter="' + dim + '"]');
  if (el) el.value = (el.value === valor ? '' : valor);
  torresRender();
  const tbl = document.getElementById('torres-table-wrap');
  if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function exportTorresCSV() {
  const T = DATA.torres || [];
  if (!T.length) { showToast('Sem torres para exportar', true); return; }
  const BOM = '﻿';
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const cab = ['Cliente', 'Nome fantasia', 'Codigo', 'Filial', 'Cidade', 'Status', 'Modelo', 'Cameras', 'Qtd torres', 'Modalidade', 'Linha no contrato', 'Data instalacao', 'Forn. imagem', 'Forn. IA', 'Usa servidor imagem', 'Custo imagem', 'Custo IA', 'Custo servidores', 'Custo total', 'Cobrado', 'Resultado', 'Situacao'];
  let csv = BOM + cab.join(';') + '\n';
  T.forEach(d => {
    const c = custosTorre(d);
    csv += [d.cliente, d.nome_fantasia, d.codigo_cliente, d.filial, d.cidade, d.status, d.modelo, d.cameras, qtdTorres(d),
      d.gratificada === false ? 'Cobrada' : 'Gratificada',
      d.linha_contrato === true ? 'Sim' : d.linha_contrato === false ? 'Nao' : '',
      d.data_instalacao || '', d.forn_imagem || '', d.forn_ia || '', d.usa_servidor_imagem ? 'Sim' : 'Nao',
      c.imagem.toFixed(2), c.ia.toFixed(2), (c.servidor + c.servidorImg).toFixed(2), c.total.toFixed(2), c.receita.toFixed(2), c.lucro.toFixed(2), classifTorre(c, d)
    ].map(esc).join(';') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'torres_rentabilidade.csv'; a.click();
}

function renderTorresTable() {
  const _ae = document.activeElement, _foco = _ae && _ae.closest && _ae.closest('#torres-filters') && _ae.dataset.filter ? { f: _ae.dataset.filter, s: _ae.selectionStart } : null;
  const T = DATA.torres;
  const stEl = document.querySelector('#torres-filters [data-filter="status"]');
  const srEl = document.querySelector('#torres-filters [data-filter="search"]');
  const grEl = document.querySelector('#torres-filters [data-filter="grat"]');
  const iaEl = document.querySelector('#torres-filters [data-filter="ia"]');
  const tpEl = document.querySelector('#torres-filters [data-filter="tipo"]');
  const tp = tpEl ? tpEl.value : '';
  const iaF = iaEl ? iaEl.value : '';
  const st = stEl ? stEl.value : '';
  const search = srEl ? srEl.value.toLowerCase() : '';
  const gr = grEl ? grEl.value : '';

  const _f = { filial: window.TOR_FIN_FILIAL || '', st, iaF, tp, gr, search };
  let filtered = T.filter(d => torreCasaFiltro(d, _f));

  document.getElementById('torres-filters').innerHTML = `
    <select class="filter-select" data-filter="status" onchange="torresRender()">
      <option value="">Todos os Status</option>
      <option value="INSTALADA" ${st==='INSTALADA'?'selected':''}>Instalada</option>
      <option value="AUTORIZADA" ${st==='AUTORIZADA'?'selected':''}>Autorizada</option>
      <option value="EM AUTORIZAÇÃO" ${st==='EM AUTORIZAÇÃO'?'selected':''}>Em Autorizacao</option>
      <option value="NÃO AUTORIZADA" ${st==='NÃO AUTORIZADA'?'selected':''}>Nao Autorizada</option>
      <option value="SEGUNDO PLANO" ${st==='SEGUNDO PLANO'?'selected':''}>Segundo Plano</option>
      <option value="AVALIAR/AGUARDAR" ${st==='AVALIAR/AGUARDAR'?'selected':''}>Avaliar/Aguardar</option>
    </select>
    <select class="filter-select" data-filter="ia" onchange="torresRender()">
      <option value="">Todas as IAs</option>
      ${['Segware','Monuv','Octos'].map(x => `<option value="${x}" ${iaF===x?'selected':''}>${x}</option>`).join('')}
      <option value="sem" ${iaF==='sem'?'selected':''}>Sem IA</option>
    </select>
    <select class="filter-select" data-filter="tipo" onchange="torresRender()">
      <option value="">Portaria + Monitoramento</option>
      <option value="portaria" ${tp==='portaria'?'selected':''}>Só Portaria</option>
      <option value="monitoramento" ${tp==='monitoramento'?'selected':''}>Só Monitoramento</option>
    </select>
    <select class="filter-select" data-filter="grat" onchange="torresRender()">
      <option value="">Gratificação / Checklist</option>
      <option value="vencendo" ${gr==='vencendo'?'selected':''}>Vencendo em 30 dias</option>
      <option value="vencidas" ${gr==='vencidas'?'selected':''}>Gratificação vencida</option>
      <option value="semdata" ${gr==='semdata'?'selected':''}>Sem data de término</option>
      <option value="chkpend" ${gr==='chkpend'?'selected':''}>Instaladas c/ checklist pendente</option>
      <option value="semlinha" ${gr==='semlinha'?'selected':''}>Sem linha no contrato</option>
      <option value="seminstal" ${gr==='seminstal'?'selected':''}>Sem data de instalação</option>
      <option value="deficit" ${gr==='deficit'?'selected':''}>Só deficitárias</option>
      <option value="gratificadas" ${gr==='gratificadas'?'selected':''}>Só gratificadas</option>
      <option value="pagas" ${gr==='pagas'?'selected':''}>Só pagas pelo cliente</option>
    </select>
    <input class="filter-input" data-filter="search" placeholder="Buscar cliente, código ou chave..." oninput="torresRender()" style="width:200px" value="${escAttr(srEl ? srEl.value : '')}">`;
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
    document.getElementById('tm-filial').value = d.filial || 'Servis Ceará';
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
    document.getElementById('tm-data-instalacao').value = d.data_instalacao || '';
    document.getElementById('tm-linha-contrato').value = d.linha_contrato === true ? 'sim' : d.linha_contrato === false ? 'nao' : '';
    document.getElementById('tm-usa-srv-img').value = d.usa_servidor_imagem ? 'sim' : 'nao';
    document.getElementById('tm-tipo-operacao').value = d.tipo_operacao || 'monitoramento';
  } else {
    document.getElementById('torre-modal-title').textContent = 'Nova Torre';
    document.getElementById('torre-edit-id').value = '';
    document.getElementById('tm-cliente').value = '';
    document.getElementById('tm-fantasia').value = '';
    document.getElementById('tm-codigo').value = '';
    document.getElementById('tm-chave-sigma').value = '';
    document.getElementById('tm-filial').value = 'Servis Ceará';
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
    document.getElementById('tm-data-instalacao').value = '';
    document.getElementById('tm-linha-contrato').value = '';
    document.getElementById('tm-usa-srv-img').value = 'nao';
    document.getElementById('tm-tipo-operacao').value = 'monitoramento';
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
// Servidor de imagens (gravação): R$ 540,00/mês para 80 câmeras = R$ 6,75 por câmera.
const CUSTO_SERVIDOR_IMAGEM = 6.75;
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
  // custo do servidor de imagens (gravação) — só para torres marcadas como usuárias desse servidor
  const servidorImg = d.usa_servidor_imagem ? (Number(d.valor_servidor_imagem || 0) || Number(d.cameras || 0) * CUSTO_SERVIDOR_IMAGEM) : 0;
  const base = Number(d.pago_forn || 0) || (imagem + servidor + licenca);
  const total = base + servidorImg;
  const receita = Number(d.cobrado || 0);
  return { imagem, ia: servidor + licenca, servidor, servidorImg, licenca, total, receita, lucro: receita - total };
}
function margemCell(d) {
  const c = custosTorre(d);
  if (!c.total && !c.receita) return '<span style="color:var(--text-muted)">—</span>';
  const cor = c.lucro > 0 ? 'var(--accent)' : c.lucro < 0 ? 'var(--danger)' : 'var(--text-muted)';
  const pct = c.receita ? Math.round(c.lucro / c.receita * 100) + '%' : (d.gratificada === false ? 'sem cobrança' : 'cortesia');
  return `<span style="color:${cor};font-weight:600;font-variant-numeric:tabular-nums">${c.lucro < 0 ? '−' : ''}${fmtVal(Math.abs(c.lucro))}</span><div style="font-size:11px;color:var(--text-muted)">${pct}</div>`;
}
function torresFinExtras() {
  const _TODOS = DATA.torres || [];
  const _filiais = [...new Set(_TODOS.map(d => d.filial || 'Sem filial'))].sort();
  window.TOR_FIN_FILIAL_L = _filiais;
  if (window.TOR_FIN_FILIAL && !_filiais.includes(window.TOR_FIN_FILIAL)) window.TOR_FIN_FILIAL = '';
  const T = torresFiltradas();
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
    return `<tr style="${idx === null ? 'font-weight:800;border-top:2px solid var(--border)' : 'cursor:pointer'}${sel ? ';background:var(--row-hover)' : ''}" ${idx === null ? '' : `onclick="window.TOR_FIN_FILIAL=window.TOR_FIN_FILIAL===window.TOR_FIN_FILIAL_L[${idx}]?'':window.TOR_FIN_FILIAL_L[${idx}];torresRender()" title="Clique para ver só esta filial"`}><td style="padding:9px 10px">${nome}</td><td style="${_tdN}">${p.n}</td><td style="${_tdN}">${fmtVal(p.receita)}</td><td style="${_tdN}">${fmtVal(p.total)}</td><td style="${_tdN};font-weight:700;color:${cor(p.lucro)}">${R(p.lucro)}</td><td style="${_tdN};color:var(--text-muted)">${p.receita ? pct(p.lucro, p.receita) : '—'}</td><td style="${_tdN};border-left:1px solid var(--border)">${q.n}</td><td style="${_tdN};color:var(--danger)">${fmtVal(q.total)}</td><td style="${_tdN};border-left:1px solid var(--border);font-weight:800;color:${cor(res)}">${R(res)}</td></tr>`; };
  const _comparativo = `<div style="font-weight:700;font-size:14px;margin:20px 0 4px">Comparativo por filial</div><div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Clique numa filial para ver os blocos acima só dela.</div>
    <div class="table-wrap"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="color:var(--text-muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.3px"><th style="padding:8px 10px;text-align:left">Filial</th><th style="padding:8px 10px;text-align:right">Pagas</th><th style="padding:8px 10px;text-align:right">Receita</th><th style="padding:8px 10px;text-align:right">Custo</th><th style="padding:8px 10px;text-align:right">Lucro</th><th style="padding:8px 10px;text-align:right">Margem</th><th style="padding:8px 10px;text-align:right;border-left:1px solid var(--border)">Gratif.</th><th style="padding:8px 10px;text-align:right">Custo cortesia</th><th style="padding:8px 10px;text-align:right;border-left:1px solid var(--border)">Resultado</th></tr></thead><tbody>
    ${_filiais.map((f, i) => _linhaF(f, _TODOS.filter(d => (d.filial || 'Sem filial') === f), i)).join('')}${_linhaF('Total', _TODOS, null)}</tbody></table></div>`;
  const geral = `<div style="font-size:13px;color:var(--text-secondary)">Resultado geral: <b style="font-size:16px;color:${cor(g.lucro)};font-variant-numeric:tabular-nums">${R(g.lucro)}</b> <span style="color:var(--text-muted)">(lucro das pagas ${R(pagas.lucro)} − cortesia ${fmtVal(Math.abs(grat.lucro))})</span></div>`;
  const blocos = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px">
      ${bloco('Torres pagas', 'Não gratificadas — o cliente paga a mensalidade', 'var(--accent)', pagas, false)}
      ${bloco('Torres gratificadas', 'Cortesia — não geram receita, a empresa arca com o custo', 'var(--warning)', grat, true)}
    </div>`;
  return { geral, blocos, filial: _comparativo };
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
    data_instalacao: document.getElementById('tm-data-instalacao').value || null,
    linha_contrato: (() => { const v = document.getElementById('tm-linha-contrato').value; return v === 'sim' ? true : v === 'nao' ? false : null; })(),
    usa_servidor_imagem: document.getElementById('tm-usa-srv-img').value === 'sim',
    valor_servidor_imagem: document.getElementById('tm-usa-srv-img').value === 'sim' ? (parseInt(document.getElementById('tm-cameras').value) || 0) * CUSTO_SERVIDOR_IMAGEM : null,
    tipo_operacao: document.getElementById('tm-tipo-operacao').value || null,
  };
  obj.filial = document.getElementById('tm-filial').value || null;
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

