// ===== PAINEL LATERAL + CARTÕES QUE FILTRAM + BARRA DE FERRAMENTAS =====
// Camada visual que envolve as abas existentes sem alterar a lógica delas.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dt = iso => iso ? fmtDataBR(String(iso).slice(0, 10)) : '—';
  const money = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '—' : fmtVal(Number(v));
  const val = v => (v === null || v === undefined || v === '') ? '<span class="pn-muted">—</span>' : esc(v);
  const tag = (txt, cls) => `<span class="badge ${cls || 'badge-neutral'}">${esc(txt)}</span>`;
  const ok = (b, sim, nao) => b ? `<span class="pn-ok">✓ ${esc(sim || 'Sim')}</span>` : `<span class="pn-bad">✗ ${esc(nao || 'Não')}</span>`;
  const link = (url, txt) => url && /^https?:\/\//i.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(txt || 'Abrir')}</a>` : val(url);
  const stTorre = s => s === 'INSTALADA' ? 'badge-success' : s === 'AUTORIZADA' ? 'badge-blue' : s === 'EM AUTORIZAÇÃO' ? 'badge-warning' : s === 'NÃO AUTORIZADA' ? 'badge-danger' : 'badge-neutral';

  function ultimoChecklist() { const ds = [...new Set((DATA.checklists || []).map(c => c.data_checklist).filter(Boolean))].sort(); return ds[ds.length - 1] || null; }
  const chkFalha = r => !(r.todas_gravando_dvr && r.central_alarme_comunicando);

  // ---------- configuração por aba ----------
  const ENT = {
    torres: {
      sec: 'torres', wrap: 'torres-table-wrap', kpis: 'torres-kpis', filters: 'torres-filters', edit: 'openTorreModal', del: 'deleteTorre', nome: 'torre',
      data: () => DATA.torres || [],
      cards: [null, { l: 'Instaladas', f: d => d.status === 'INSTALADA' }, { l: 'Autorizadas', f: d => d.status === 'AUTORIZADA' }, { l: 'Em autorização', f: d => d.status === 'EM AUTORIZAÇÃO' }, null],
      view: d => {
        const dias = diasAte(d.data_fim_gratificacao);
        const grat = dias === null ? '<span class="pn-muted">sem data</span>' : `${dt(d.data_fim_gratificacao)} ${tag(dias < 0 ? `vencida há ${-dias}d` : `faltam ${dias}d`, dias < 0 ? 'badge-danger' : dias <= 30 ? 'badge-warning' : 'badge-neutral')}`;
        const n = torreChecklist(d);
        return {
          titulo: d.cliente, sub: d.cidade, badges: [tag(d.status, stTorre(d.status))],
          kpis: [['Câmeras', d.cameras || 0], ['Pago ao fornecedor', money(d.pago_forn)], ['Cobrado do cliente', money(d.cobrado)]],
          blocos: [
            { t: 'Dados da torre', campos: [['Cidade', val(d.cidade)], ['Modelo', val(d.modelo)], ['Fornecedor de imagem', val(d.forn_imagem)], ['Fornecedor da IA', val(d.forn_ia || 'Sem IA')], ['Responsável', val(d.responsavel)], ['Fim da gratificação', grat]] },
            { t: `Checklist pós-teste · ${n}/4`, html: `<div class="pn-checks">${[['Cliente usando o app', d.chk_usando_app], ['Teste de detecção', d.chk_deteccao_teste], ['Câmeras online', d.chk_cameras_online], ['Cliente treinado', d.chk_cliente_treinado]].map(([l, b]) => `<div class="pn-check ${b ? 'on' : ''}"><span>${b ? '✓' : '✗'}</span>${l}</div>`).join('')}</div>${d.chk_data_verificacao ? `<div class="pn-muted pn-small">Verificado em ${dt(d.chk_data_verificacao)}</div>` : ''}` },
            d.observacao ? { t: 'Observação', html: `<div class="pn-text">${esc(d.observacao)}</div>` } : null,
          ],
        };
      },
    },
    ia: {
      sec: 'clientes', wrap: 'ia-detail-table', kpis: 'ia-kpis', filters: 'ia-filters', edit: 'editIADetail', del: 'deleteIADetail', nome: 'registro',
      data: () => DATA.iaDetail || [],
      cards: [null, { l: 'Com câmeras de IA', f: d => Number(d.camera_com_ia || d.qtd_ia || 0) > 0 }, { l: 'Bonificação própria', f: d => d.tipo_bonificacao === 'Própria' }, { l: 'Com gratificação', f: d => d.gratificacao === 'Sim' }],
      view: d => ({
        titulo: d.nome_cliente, sub: [d.filial, d.provedor].filter(Boolean).join(' · '),
        badges: [tag(d.status || '—', d.status === 'Ativo' ? 'badge-success' : 'badge-neutral'), tag(d.tipo_bonificacao || 'Própria', { 'Própria': 'badge-warning', 'Cruzada': 'badge-blue' }[d.tipo_bonificacao] || 'badge-neutral')],
        kpis: [['IAs', d.qtd_ia || 0], ['Câmeras c/ IA', d.camera_com_ia || d.qtd_ia || 0], ['Margem mensal', money(Number(d.receita_mensal || 0) - Number(d.custo_mensal || 0))]],
        blocos: [
          { t: 'Cliente', campos: [['Filial', val(d.filial)], ['Modalidade', val(d.modalidade)], ['Provedor', val(d.provedor)], ['IA instalada', val(d.ia_instalada || 'Sim')]] },
          { t: 'Equipamento', campos: [['Modelo do DVR', val(d.modelo_dvr)], ['Servidor', val(d.servidor)]] },
          { t: 'Financeiro', campos: [['Gratificação', val(d.gratificacao || 'Não')], ['Bonificação', val(d.bonificacao)], ['Custo mensal', money(d.custo_mensal)], ['Receita mensal', money(d.receita_mensal)]] },
          d.observacoes ? { t: 'Observações', html: `<div class="pn-text">${esc(d.observacoes)}</div>` } : null,
        ],
      }),
    },
    arm: {
      sec: 'armarios', wrap: 'arm-detail-card', kpis: 'arm-kpis', filters: 'arm-filters', edit: 'editArmDetail', del: 'deleteArmDetail', nome: 'armário',
      data: () => DATA.armDetail || [],
      cards: [null, { l: 'Gratificados', f: d => d.gratificacao === 'Sim' }, null, null, { l: 'Margem negativa', f: d => Number(d.margem || (Number(d.valor_cli || 0) - Number(d.custo_forn || 0))) < 0 }],
      view: d => {
        const m = Number(d.margem || (Number(d.valor_cli || 0) - Number(d.custo_forn || 0)));
        return {
          titulo: d.condominio, sub: [d.filial, d.fornecedor].filter(Boolean).join(' · '),
          badges: [tag(d.status || '—', d.status === 'Ativo' ? 'badge-success' : 'badge-neutral'), d.gratificacao === 'Sim' ? tag('Gratificado', 'badge-blue') : ''],
          kpis: [['Portas', d.portas || 0], ['Valor do cliente', money(d.valor_cli)], ['Margem', `<span class="${m >= 0 ? 'val-pos' : 'val-neg'}">${money(m)}</span>`]],
          blocos: [
            { t: 'Local', campos: [['Endereço', val(d.endereco)], ['Filial', val(d.filial)], ['Fornecedor', val(d.fornecedor)]] },
            { t: 'Custos', campos: [['Gestão', money(d.custo_gestao)], ['Locação', money(d.custo_locacao)], ['Custo fornecedor', money(d.custo_forn)], ['Valor cliente', money(d.valor_cli)]] },
            { t: 'Documentos', campos: [['Ordem de compra', val(d.ordem_compra)], ['Nº da NF', val(d.numero_nf)], ['PDF da NF', link(d.pdf_nf_url, 'Abrir PDF')]] },
            d.observacoes ? { t: 'Observações', html: `<div class="pn-text">${esc(d.observacoes)}</div>` } : null,
          ],
        };
      },
    },
    chk: {
      sec: 'checklist', wrap: 'chk-tbody', kpis: 'chk-kpis', edit: 'editChecklist', del: 'deleteChecklist', nome: 'checklist', toolbarIn: 'chk-table',
      data: () => DATA.checklists || [],
      cards: [null, null, { l: 'Com falha no último', f: d => d.data_checklist === ultimoChecklist() && chkFalha(d) }, { l: 'Último checklist', f: d => d.data_checklist === ultimoChecklist() }],
      view: d => {
        const cond = (DATA.condominios || []).find(c => c.id === d.condominio_id);
        const hist = (DATA.checklists || []).filter(c => c.condominio_id === d.condominio_id).sort((a, b) => (b.data_checklist || '').localeCompare(a.data_checklist || '')).slice(0, 8);
        const itens = [['DVR gravando todas as câmeras', d.todas_gravando_dvr], ['Câmeras do portão gravando', d.cameras_portao_gravando], ['Câmeras com botões de ação', d.cameras_botoes_acoes], ['Central de alarme comunicando', d.central_alarme_comunicando], ['Tem IA', d.tem_ia], ['IA funcionando', d.ia_funcionando], ['Tem torre', d.tem_torre]];
        return {
          titulo: cond ? cond.nome : 'Condomínio #' + d.condominio_id, sub: 'Checklist de ' + dt(d.data_checklist),
          badges: [chkFalha(d) ? tag('Falha em DVR ou alarme', 'badge-danger') : tag('DVR e alarme OK', 'badge-success')],
          kpis: [['Câmeras', d.qtd_cameras ?? '—'], ['Itens OK', `${itens.filter(i => i[1]).length}/${itens.length}`], ['IA', val(d.qual_ia)]],
          blocos: [
            { t: 'Itens verificados', html: `<div class="pn-checks">${itens.map(([l, b]) => `<div class="pn-check ${b ? 'on' : ''}"><span>${b ? '✓' : '✗'}</span>${l}</div>`).join('')}</div>${d.cameras_portao_lista ? `<div class="pn-small pn-muted">Câmeras do portão: ${esc(d.cameras_portao_lista)}</div>` : ''}` },
            d.observacoes ? { t: 'Observações', html: `<div class="pn-text">${esc(d.observacoes)}</div>` } : null,
            { t: 'Histórico deste condomínio', html: `<ul class="pn-tl">${hist.map(h => `<li class="${chkFalha(h) ? 'bad' : 'ok'}${h.id === d.id ? ' cur' : ''}"><b>${dt(h.data_checklist)}</b> ${chkFalha(h) ? 'falha em DVR/alarme' : 'DVR e alarme OK'} · ${h.qtd_cameras ?? '—'} câmeras</li>`).join('')}</ul>` },
          ],
        };
      },
    },
    seg: {
      sec: 'seguros', wrap: 'seg-tbody', kpis: 'seg-kpis', edit: 'editSeguro', del: 'deleteSeguro', nome: 'solicitação', toolbarIn: 'seg-tbody',
      data: () => DATA.seguros || [],
      cards: [null, { l: 'Pendentes', f: d => d.status === 'Pendente' }, { l: 'Em análise', f: d => /^em an[aá]lise$/i.test(d.status || '') }, { l: 'Aprovadas', f: d => d.status === 'Aprovado' }],
      view: d => {
        const etapas = ['Pendente', 'Em análise', 'Aprovado', 'Concluído'];
        const st = /^em an/i.test(d.status || '') ? 'Em análise' : d.status === 'Concluido' ? 'Concluído' : d.status;
        const negado = st === 'Negado';
        const idx = negado ? 2 : etapas.indexOf(st);
        const passos = negado ? ['Pendente', 'Em análise', 'Negado'] : etapas;
        return {
          titulo: d.cliente, sub: [d.conta ? 'Conta ' + d.conta : '', d.tipo_seguro].filter(Boolean).join(' · '),
          badges: [tag(d.status || '—', statusBadge(d.status))],
          kpis: [['Valor', money(d.valor)], ['Solicitado em', dt(d.data_solicitacao)], ['Seguradora', val(d.seguradora)]],
          blocos: [
            { t: 'Andamento', html: `<div class="pn-steps">${passos.map((p, i) => `<div class="pn-step ${i < idx ? 'done' : i === idx ? (negado ? 'neg' : 'cur') : ''}"><i></i><span>${p}</span></div>`).join('')}</div>` },
            { t: 'Dados', campos: [['Tipo de seguro', val(d.tipo_seguro)], ['Nº do sinistro', val(d.numero_sinistro)], ['E-mail de origem', val(d.email_origem)]] },
            d.observacoes ? { t: 'Observações', html: `<div class="pn-text">${esc(d.observacoes)}</div>` } : null,
          ],
        };
      },
    },
    forn: {
      sec: 'fornecedores', wrap: 'forn-lista', kpis: 'forn-kpis', edit: 'openFornModal', del: 'deleteFornecedor', nome: 'serviço', toolbarIn: 'forn-lista',
      data: () => DATA.fornecedores || [], admin: true,
      cards: [null, null, { l: 'Pagos', f: d => d.pagamento === 'SIM' }, { l: 'Pendentes / vencidos', f: d => d.pagamento === 'PENDENTE' || (d.dt_vencimento && new Date(d.dt_vencimento) < new Date() && d.pagamento !== 'SIM') }],
      view: d => {
        const venc = d.dt_vencimento ? diasAte(String(d.dt_vencimento).slice(0, 10)) : null;
        const H = (DATA.fornHistorico || []).filter(h => h.fornecedor_id === d.id).sort((a, b) => String(b.competencia || '').localeCompare(String(a.competencia || ''))).slice(0, 8);
        return {
          titulo: d.servico, sub: [d.filial, d.tipo].filter(Boolean).join(' · '),
          badges: [d.pagamento === 'SIM' ? tag('Pago', 'badge-success') : d.pagamento === 'PENDENTE' ? tag('Pendente', 'badge-warning') : '', venc !== null && venc < 0 && d.pagamento !== 'SIM' ? tag(`Vencido há ${-venc}d`, 'badge-danger') : ''],
          kpis: [['Valor mensal', money(d.valor)], ['Vencimento', dt(d.dt_vencimento)], ['Competência', dt(d.dt_competencia)]],
          blocos: [
            { t: 'Serviço', campos: [['Uso', val(d.uso)], ['Fornecedor', val(d.fornecedor_id)], ['Lançado no fluxo', val(d.fluxo)]] },
            { t: 'Pagamentos registrados', html: H.length ? `<ul class="pn-tl">${H.map(h => `<li class="${h.enviado_contas_pagar ? 'ok' : ''}"><b>${esc(h.competencia || '—')}</b> · ${money(h.valor)}${h.dt_vencimento ? ' · venc. ' + dt(h.dt_vencimento) : ''}${h.nota_url ? ' · ' + link(h.nota_url, 'nota') : ''}${h.boleto_url ? ' · ' + link(h.boleto_url, 'boleto') : ''}</li>`).join('')}</ul>` : '<div class="pn-muted pn-small">Nenhum pagamento registrado para este serviço.</div>' },
          ],
        };
      },
    },
  };

  // ---------- painel lateral ----------
  const P = { ent: null, id: null };
  function montarPainel() {
    if ($('pn')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="pn-scrim" id="pn-scrim" onclick="Painel.fechar()"></div>
      <aside class="pn" id="pn" aria-label="Detalhes" aria-hidden="true"><div class="pn-in" id="pn-in"></div></aside>`);
  }
  function desenhar() {
    const cfg = ENT[P.ent]; if (!cfg) return;
    const d = cfg.data().find(x => x.id === P.id);
    if (!d) { fechar(); return; }
    const v = cfg.view(d);
    $('pn-in').innerHTML = `
      <div class="pn-h"><div class="pn-h-t"><h3>${esc(v.titulo || '—')}</h3>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}<div class="pn-badges">${(v.badges || []).join(' ')}</div></div>
        <button class="pn-x" onclick="Painel.fechar()" aria-label="Fechar">✕</button></div>
      <div class="pn-b">
        ${v.kpis ? `<div class="pn-kpis">${v.kpis.map(([l, x]) => `<div class="pn-kpi"><small>${esc(l)}</small><b>${x}</b></div>`).join('')}</div>` : ''}
        ${(v.blocos || []).filter(Boolean).map(b => `<div class="pn-sec"><div class="pn-sec-t">${esc(b.t)}</div>${b.campos ? `<dl class="pn-dl">${b.campos.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${x}</dd>`).join('')}</dl>` : ''}${b.html || ''}</div>`).join('')}
      </div>
      <div class="pn-f"><button class="btn btn-outline" style="color:var(--danger)" onclick="Painel.excluir()">Excluir</button><span style="flex:1"></span>
        <button class="btn btn-outline" onclick="Painel.fechar()">Fechar</button><button class="btn btn-accent" onclick="Painel.editar()">Editar</button></div>`;
  }
  function abrir(ent, id) {
    montarPainel(); P.ent = ent; P.id = id; desenhar();
    $('pn').classList.add('on'); $('pn-scrim').classList.add('on'); $('pn').setAttribute('aria-hidden', 'false');
    destacarLinha();
  }
  function fechar() {
    P.ent = null; P.id = null;
    if ($('pn')) { $('pn').classList.remove('on'); $('pn-scrim').classList.remove('on'); $('pn').setAttribute('aria-hidden', 'true'); }
    destacarLinha();
  }
  function editar() { const c = ENT[P.ent], id = P.id; fechar(); if (c && typeof window[c.edit] === 'function') window[c.edit](id); }
  async function excluir() { const c = ENT[P.ent], id = P.id; if (!c || typeof window[c.del] !== 'function') return; await window[c.del](id); if (!c.data().some(x => x.id === id)) fechar(); }

  // ---------- linha clicável: descobre o id pelo botão "Editar" da própria linha ----------
  function idDaLinha(cfg, tr) {
    const b = [...tr.querySelectorAll('button[onclick]')].find(x => x.getAttribute('onclick').startsWith(cfg.edit + '('));
    const m = b && b.getAttribute('onclick').match(/\((\d+)\)/);
    return m ? Number(m[1]) : null;
  }
  function entDoAlvo(el) {
    for (const [k, c] of Object.entries(ENT)) { const w = $(c.wrap); if (w && w.contains(el)) return k; }
    return null;
  }
  document.addEventListener('click', e => {
    const tr = e.target.closest('tbody tr'); if (!tr) return;
    if (e.target.closest('button, a, select, input, textarea, label')) return;
    const k = entDoAlvo(tr); if (!k) return;
    const id = idDaLinha(ENT[k], tr); if (id === null) return;
    abrir(k, id);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && P.ent && !document.querySelector('.modal-overlay.open')) fechar(); });
  function destacarLinha() {
    document.querySelectorAll('tr.pn-sel').forEach(t => t.classList.remove('pn-sel'));
    if (!P.ent) return;
    const w = $(ENT[P.ent].wrap); if (!w) return;
    w.querySelectorAll('tbody tr').forEach(tr => { if (idDaLinha(ENT[P.ent], tr) === P.id) tr.classList.add('pn-sel'); });
  }

  // ---------- cartões do topo que filtram a tabela ----------
  const KF = {}; // filtro ativo por aba: índice do cartão
  function aplicarFiltroCartao(k) {
    const cfg = ENT[k]; const w = $(cfg.wrap); if (!w) return;
    const i = KF[k]; const regra = i != null ? cfg.cards[i] : null;
    let vis = 0, tot = 0;
    w.querySelectorAll('tbody tr').forEach(tr => {
      const id = idDaLinha(cfg, tr); if (id === null) return;
      tot++;
      const d = cfg.data().find(x => x.id === id);
      const mostra = !regra || (d && regra.f(d));
      tr.style.display = mostra ? '' : 'none';
      if (mostra) vis++;
    });
    const chip = $('kf-' + k);
    if (chip) chip.innerHTML = regra ? `<span class="kf-chip">${esc(regra.l)} · ${vis} de ${tot}<button onclick="Painel.filtrar('${k}',null)" aria-label="Limpar filtro">✕</button></span>` : '';
    const ks = $(cfg.kpis);
    if (ks) [...ks.children].forEach((c, j) => c.classList.toggle('kpi-on', j === i));
  }
  function filtrar(k, i) {
    KF[k] = (i == null || KF[k] === i || !ENT[k].cards[i]) ? null : i;
    aplicarFiltroCartao(k);
    const w = $(ENT[k].wrap); if (KF[k] != null && w) (w.closest('.card') || w).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function prepararCartoes(k) {
    const cfg = ENT[k]; const ks = $(cfg.kpis); if (!ks) return;
    [...ks.children].forEach((c, j) => {
      const r = cfg.cards[j];
      c.classList.toggle('clickable', true);
      c.title = r ? `Mostrar só: ${r.l}` : 'Mostrar todos';
      c.onclick = () => filtrar(k, r ? j : null);
    });
  }

  // ---------- barra de ferramentas: busca, filtros, contagem e "+ Novo" na mesma linha ----------
  function montarBarra(k) {
    const cfg = ENT[k];
    if ($('tb-' + k)) return;
    const f = cfg.filters && $(cfg.filters);
    const sec = $('sec-' + cfg.sec); if (!sec) return;
    const bar = document.createElement('div'); bar.className = 'tb'; bar.id = 'tb-' + k;
    const chip = document.createElement('div'); chip.className = 'kf'; chip.id = 'kf-' + k;
    if (f) {
      f.before(bar); bar.appendChild(f);
      // botões soltos da aba (+ Novo, Exportar) vão para a barra
      const novo = [...sec.querySelectorAll('.btn-accent')].find(b => /^\+/.test(b.textContent.trim()) && !b.closest('.modal-overlay') && !b.closest('.tb') && !b.closest('.card-header'));
      const exp = [...sec.querySelectorAll('button')].find(b => /Exportar Excel/i.test(b.textContent) && !b.closest('.tb') && !b.closest('#' + cfg.filters));
      const acoes = document.createElement('div'); acoes.className = 'tb-acoes';
      if (exp) acoes.appendChild(exp);
      if (novo) { const pai = novo.parentElement; acoes.appendChild(novo); if (pai && !pai.children.length && pai.parentElement === sec) pai.remove(); else if (pai && pai.children.length === 1 && !pai.children[0].children.length && pai.children[0].tagName === 'DIV' && pai.parentElement === sec) pai.remove(); }
      bar.appendChild(acoes);
      bar.after(chip);
    } else {
      // Seguros / Checklist: filtros já ficam no cabeçalho da tabela; só adiciona o indicador de filtro
      const t = $(cfg.toolbarIn); const card = t && t.closest('.card');
      if (card) card.before(chip); else if (t) t.before(chip); else sec.prepend(chip);
    }
  }

  // ---------- liga tudo às funções de cada aba ----------
  function envolver(nomeFn, k) {
    const orig = window[nomeFn]; if (typeof orig !== 'function') return;
    window[nomeFn] = function () {
      const r = orig.apply(this, arguments);
      try { montarBarra(k); prepararCartoes(k); aplicarFiltroCartao(k); if (P.ent === k) { desenhar(); destacarLinha(); } } catch (e) { console.error('[painel ' + k + ']', e); }
      return r;
    };
  }
  envolver('renderTorres', 'torres'); envolver('renderTorresTable', 'torres');
  envolver('renderIA', 'ia');
  envolver('renderArmarios', 'arm'); envolver('renderArmDetail', 'arm');
  envolver('renderChecklist', 'chk');
  envolver('renderSeguros', 'seg');
  envolver('renderFornecedores', 'forn'); envolver('renderFornTable', 'forn');
  // ao trocar de aba, o painel fecha
  const _show = window.showSection;
  if (typeof _show === 'function') window.showSection = function () { if (P.ent) fechar(); return _show.apply(this, arguments); };

  window.Painel = { abrir, fechar, editar, excluir, filtrar };
})();
