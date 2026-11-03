// ===== GESTÃO DO ALARME: painel do monitoramento, passagem de turno, auditoria, reclamações, operadores e importação do Sigma =====
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nz = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const hoje = () => new Date().toLocaleDateString('en-CA');
  const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
  const segunda = iso => { const d = new Date(iso + 'T12:00:00'); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d.toLocaleDateString('en-CA'); };
  const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const fmtDH = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const fmtS = s => { if (s == null || isNaN(s)) return '—'; s = Math.round(s); if (s < 60) return s + 's'; const m = Math.floor(s / 60), r = s % 60; if (m < 60) return m + 'min' + (r ? ' ' + r + 's' : ''); return Math.floor(m / 60) + 'h ' + (m % 60) + 'min'; };
  const pct = (a, b) => b ? Math.round(a * 100 / b) : null;
  const toast = (m, bad) => { if (typeof showToast === 'function') showToast(m, bad); else alert(m); };
  const kc = o => typeof kpiCard === 'function' ? kpiCard(o) : `<div class="kpi-card"><div class="kpi-label">${o.label}</div><div class="kpi-value">${o.value}</div><div class="kpi-sub">${o.sub || ''}</div></div>`;
  const badge = (txt, cor) => `<span class="badge" style="color:${cor};background:${cor}1f">${esc(txt)}</span>`;
  const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const FILIAIS = ['Servis Ceará', 'Servis Amazonas', 'Servis Maranhão', 'Secopi Piauí', 'Sideraltech'];
  const FUNCOES = ['Operador', 'Líder', 'Supervisor'];
  const TURNOS = ['Dia', 'Noite'];
  const CHECK = [
    { k: 'tempo', t: 'Iniciou o atendimento dentro do tempo padrão', w: 2 },
    { k: 'imagens', t: 'Verificou imagens / zonas antes de agir', w: 1 },
    { k: 'contatos', t: 'Ligou para os contatos na ordem da lista', w: 2, crit: true },
    { k: 'senha', t: 'Confirmou senha / contrassenha', w: 2, crit: true },
    { k: 'vtr', t: 'Acionou a viatura quando necessário (ou justificou)', w: 2, crit: true },
    { k: 'registro', t: 'Registrou comentário claro e completo no evento', w: 2, crit: true },
    { k: 'encerramento', t: 'Encerrou com o motivo / código correto', w: 1 },
    { k: 'postura', t: 'Postura e cordialidade na ligação (escuta da gravação)', w: 1 }
  ];
  const TIPOS_RECL = ['Demora no atendimento', 'Não ligou para os contatos', 'Não acionou a viatura', 'Postura / forma de atendimento', 'Erro de procedimento', 'Informação errada ao cliente', 'Evento não tratado', 'Disparo falso recorrente', 'Outro'];
  const ORIGENS = ['Cliente', 'Comercial', 'Técnica', 'Pesquisa / SAC', 'Diretoria', 'Interna (auditoria)'];
  const GRAV = { 'Baixa': '#6b7280', 'Média': '#d97706', 'Alta': '#e8590c', 'Crítica': '#dc2626' };
  const ST_RECL = { 'Aberta': '#dc2626', 'Em tratativa': '#2563eb', 'Resolvida': '#16a34a' };
  const PROC = { 'Em análise': '#6b7280', 'Procedente': '#dc2626', 'Improcedente': '#16a34a' };
  const FB = { 'Elogio': '#16a34a', 'Orientação': '#2563eb', 'Advertência verbal': '#d97706', 'Advertência escrita': '#e8590c', 'Suspensão': '#dc2626' };
  const CATS = ['Crítico', 'Alarme', 'Técnico', 'Outros'];
  const CAT_COR = { 'Crítico': '#dc2626', 'Alarme': '#e8590c', 'Técnico': '#2563eb', 'Outros': '#6b7280' };
  const METAS_PADRAO = { sla_critico: 30, sla_alarme: 90, sla_tecnico: 600, sla_outros: 300, amostras_semana: 3, nota_minima: 8, tma_meta: 60 };
  const PERIODOS = { hoje: 'Hoje', semana: 'Esta semana', d7: 'Últimos 7 dias', mes: 'Este mês', d30: 'Últimos 30 dias' };

  const ST = {
    aba: lsGet('alm_aba', 'painel'), periodo: lsGet('alm_periodo', 'semana'),
    ops: [], pass: [], aud: [], rec: [], fb: [], imps: [], contas: [], metas: Object.assign({}, METAS_PADRAO), painel: null,
    audSemana: segunda(hoje()), recFiltro: 'abertas', recBusca: '', carregado: false, importacao: null
  };

  function categoria(ev) {
    const s = nz(ev);
    if (/panico|coacao|emergencia|medic|sos|incendio|fogo|assalto|refem/.test(s)) return 'Crítico';
    if (/falha|bateria|energia|rede eletrica|\bac\b|comunicacao|teste|autoteste|tamper|sabotagem|problema|corte|keep ?alive|sem sinal/.test(s)) return 'Técnico';
    if (/alarme|disparo|invasao|violacao|sensor|zona|magnetic|intrus|infravermelho|ivp|porta|janela/.test(s)) return 'Alarme';
    return 'Outros';
  }
  function slaDe(cat) { const m = ST.metas; return ({ 'Crítico': m.sla_critico, 'Alarme': m.sla_alarme, 'Técnico': m.sla_tecnico })[cat] ?? m.sla_outros; }
  function periodo() {
    const h = hoje();
    switch (ST.periodo) {
      case 'hoje': return [h, h];
      case 'd7': return [addD(h, -6), h];
      case 'mes': return [h.slice(0, 8) + '01', h];
      case 'd30': return [addD(h, -29), h];
      default: return [segunda(h), h];
    }
  }
  // nome do operador como cadastrado (resolve apelidos usados no Sigma)
  function opNome(raw) {
    if (!raw) return '';
    const n = nz(raw);
    const o = ST.ops.find(o => nz(o.nome) === n || String(o.apelidos || '').split(/[;,]/).some(a => a.trim() && nz(a) === n));
    return o ? o.nome : String(raw).trim();
  }
  const opsAtivos = (f) => ST.ops.filter(o => o.ativo && (!f || o.funcao === f));
  const lideres = () => ST.ops.filter(o => o.ativo && o.funcao !== 'Operador');
  const optsOps = (sel, lista, vazio = '—') => `<option value="">${vazio}</option>` + (lista || opsAtivos()).map(o => `<option ${o.nome === sel ? 'selected' : ''}>${esc(o.nome)}</option>`).join('') + (sel && !(lista || opsAtivos()).some(o => o.nome === sel) ? `<option selected>${esc(sel)}</option>` : '');

  // ---------------------------------------------------------------- montagem
  function montar() {
    if ($('sec-alarme')) return;
    if (typeof titles === 'object') titles.alarme = ['Gestão do Alarme', 'Indicadores do monitoramento, passagem de turno, auditoria e reclamações'];
    const ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>';
    const grupoOp = document.querySelector('.nav-group[data-group="operacoes"]');
    const grupo = `<div class="nav-group open" data-group="monitoramento">
      <button class="nav-group-head" onclick="toggleNavGroup(this)">${ico}<span>Monitoramento</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>
      <div class="nav-group-items"><div class="nav-item" data-section="alarme" onclick="showSection('alarme')">${ico}<span>Gestão do Alarme</span><span class="nav-badge" id="badge-alarme"></span></div></div></div>`;
    if (grupoOp) grupoOp.insertAdjacentHTML('beforebegin', grupo); else { const nav = document.querySelector('.sidebar-nav'); if (nav) nav.insertAdjacentHTML('beforeend', grupo); }
    const abas = [['painel', 'Painel'], ['turno', 'Passagem de turno'], ['auditoria', 'Auditoria'], ['reclamacoes', 'Reclamações'], ['equipe', 'Equipe e feedbacks'], ['importar', 'Importar Sigma'], ['metas', 'Metas']];
    const sec = `<div class="section" id="sec-alarme">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="tab-pills" id="alm-abas">${abas.map(([k, l]) => `<button class="tab-pill" data-aba="${k}" onclick="Alarme.aba('${k}')">${l}</button>`).join('')}</div>
        <div class="tab-pills" id="alm-periodos">${Object.entries(PERIODOS).map(([k, l]) => `<button class="tab-pill" data-p="${k}" onclick="Alarme.periodo('${k}')">${l}</button>`).join('')}</div>
      </div>
      <div id="alm-body"><div class="card"><div class="card-body" style="padding:24px;color:var(--text-muted)">Carregando...</div></div></div>
    </div>`;
    const cfg = $('sec-config');
    if (cfg) cfg.insertAdjacentHTML('beforebegin', sec); else document.querySelector('.content').insertAdjacentHTML('beforeend', sec);
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="alm-modal"><div class="modal" id="alm-modal-box" style="max-width:720px">
      <div class="modal-header"><h3 id="alm-modal-t"></h3><button class="modal-close" onclick="Alarme.fechar()">&times;</button></div>
      <div class="modal-body" id="alm-modal-b" style="max-height:72vh;overflow:auto"></div>
      <div class="modal-footer" id="alm-modal-f" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)"></div>
    </div></div>`);
    if (typeof window.showSection === 'function' && !window.showSection.__alarme) {
      const orig = window.showSection;
      window.showSection = function (id) { const r = orig.apply(this, arguments); if (id === 'alarme') carregar(); return r; };
      window.showSection.__alarme = true;
    }
  }
  function modal(titulo, corpo, botoes, largura) {
    $('alm-modal-t').textContent = titulo; $('alm-modal-b').innerHTML = corpo;
    $('alm-modal-f').innerHTML = `<button class="btn btn-outline" onclick="Alarme.fechar()">Cancelar</button>` + (botoes || '');
    $('alm-modal-box').style.maxWidth = (largura || 720) + 'px';
    $('alm-modal').classList.add('open');
  }
  function fechar() { $('alm-modal').classList.remove('open'); }

  // ---------------------------------------------------------------- dados
  async function q(p) { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; }
  async function carregar() {
    if (typeof sb === 'undefined' || !sb) return;
    try {
      const desde = addD(hoje(), -180);
      const [ops, pass, aud, rec, fb, imps, cfg] = await Promise.all([
        q(sb.from('alm_operadores').select('*').order('nome')),
        q(sb.from('alm_passagem_turno').select('*').gte('data', addD(hoje(), -60)).order('data', { ascending: false }).order('turno')),
        q(sb.from('alm_auditorias').select('*').gte('semana', addD(hoje(), -120)).order('created_at')),
        q(sb.from('alm_reclamacoes').select('*').or(`data.gte.${desde},status.neq.Resolvida`).order('data', { ascending: false })),
        q(sb.from('alm_feedbacks').select('*').gte('data', desde).order('data', { ascending: false })),
        q(sb.from('alm_importacoes').select('*').order('created_at', { ascending: false }).limit(50)),
        q(sb.from('alm_config').select('*'))
      ]);
      Object.assign(ST, { ops, pass, aud, rec, fb, imps });
      const m = cfg.find(c => c.chave === 'metas'); ST.metas = Object.assign({}, METAS_PADRAO, m ? m.valor : {});
      const ultContas = imps.find(i => i.tipo === 'contas');
      ST.contas = ultContas ? await q(sb.from('alm_contas_eventos').select('*').eq('lote_id', ultContas.id).order('qtd', { ascending: false }).limit(25)) : [];
      const [ini, fim] = periodo();
      ST.painel = await q(sb.rpc('alm_painel', { p_ini: ini, p_fim: fim }));
      ST.carregado = true;
    } catch (e) {
      const b = $('alm-body'); if (b) b.innerHTML = `<div class="card"><div class="card-body" style="padding:20px;color:var(--danger)">Erro ao carregar a Gestão do Alarme: ${esc(e.message)}</div></div>`;
      return;
    }
    render();
  }
  function render() {
    const abertas = ST.rec.filter(r => r.status !== 'Resolvida').length;
    const bdg = $('badge-alarme'); if (bdg) { bdg.textContent = abertas || ''; bdg.style.display = abertas ? '' : 'none'; bdg.classList.toggle('alert', ST.rec.some(r => r.status !== 'Resolvida' && (r.gravidade === 'Crítica' || r.gravidade === 'Alta'))); }
    if (!$('alm-body')) return;
    document.querySelectorAll('#alm-abas .tab-pill').forEach(b => b.classList.toggle('active', b.dataset.aba === ST.aba));
    document.querySelectorAll('#alm-periodos .tab-pill').forEach(b => b.classList.toggle('active', b.dataset.p === ST.periodo));
    $('alm-periodos').style.display = ST.aba === 'painel' ? '' : 'none';
    const R = { painel: rPainel, turno: rTurno, auditoria: rAuditoria, reclamacoes: rReclamacoes, equipe: rEquipe, importar: rImportar, metas: rMetas };
    $('alm-body').innerHTML = (R[ST.aba] || rPainel)();
  }
  function aba(k) { ST.aba = k; lsSet('alm_aba', k); render(); }
  async function setPeriodo(k) { ST.periodo = k; lsSet('alm_periodo', k); const [ini, fim] = periodo(); try { ST.painel = await q(sb.rpc('alm_painel', { p_ini: ini, p_fim: fim })); } catch (e) { toast('Erro: ' + e.message, true); } render(); }

  // ---------------------------------------------------------------- PAINEL
  function emPeriodo(iso) { const [ini, fim] = periodo(); const d = String(iso || '').slice(0, 10); return d >= ini && d <= fim; }
  function resumoOperadores() {
    const [ini, fim] = periodo(), P = ST.painel || {}, map = {};
    const linha = n => map[n] = map[n] || { nome: n, eventos: 0, tmrSoma: 0, tmrN: 0, noSla: 0, comResp: 0, semCom: 0, aud: 0, notaSoma: 0, falhas: 0, recl: 0, elogios: 0, adv: 0 };
    opsAtivos().forEach(o => linha(o.nome));
    (P.por_operador || []).forEach(x => { const l = linha(opNome(x.operador)); l.eventos += x.total; if (x.tmr != null) { l.tmrSoma += x.tmr * x.com_resposta; l.tmrN += x.com_resposta; } l.noSla += x.no_sla; l.comResp += x.com_resposta; l.semCom += x.sem_comentario; });
    ST.aud.filter(a => a.status === 'Avaliada' && String(a.avaliada_em || a.created_at).slice(0, 10) >= ini && String(a.avaliada_em || a.created_at).slice(0, 10) <= fim).forEach(a => { const l = linha(a.operador); l.aud++; l.notaSoma += Number(a.nota || 0); if (a.falha_critica) l.falhas++; });
    ST.rec.filter(r => r.operador && r.procedente === 'Procedente' && emPeriodo(r.data)).forEach(r => linha(r.operador).recl++);
    ST.fb.filter(f => emPeriodo(f.data)).forEach(f => { const l = linha(f.operador); if (f.tipo === 'Elogio') l.elogios++; else if (/Advert|Suspens/.test(f.tipo)) l.adv++; });
    return Object.values(map).map(l => {
      const tmr = l.tmrN ? l.tmrSoma / l.tmrN : null, sla = pct(l.noSla, l.comResp), nota = l.aud ? l.notaSoma / l.aud : null;
      let s = 'ok', motivos = [];
      if (nota != null && nota < ST.metas.nota_minima) { s = 'mau'; motivos.push('nota abaixo da mínima'); }
      if (l.falhas) { s = 'mau'; motivos.push(l.falhas + ' falha(s) crítica(s)'); }
      if (l.recl) { s = 'mau'; motivos.push(l.recl + ' reclamação(ões) procedente(s)'); }
      if (sla != null && sla < 80) { if (s === 'ok') s = 'atencao'; motivos.push('SLA ' + sla + '%'); }
      if (l.comResp && l.semCom / Math.max(l.eventos, 1) > 0.1) { if (s === 'ok') s = 'atencao'; motivos.push('eventos sem comentário'); }
      if (!l.aud && !l.eventos) s = 'sem';
      return Object.assign(l, { tmr, sla, nota, s, motivos });
    }).sort((a, b) => ({ mau: 0, atencao: 1, ok: 2, sem: 3 }[a.s] - { mau: 0, atencao: 1, ok: 2, sem: 3 }[b.s]) || b.eventos - a.eventos || a.nome.localeCompare(b.nome));
  }
  function alertas() {
    const out = [], h = hoje(), m = ST.metas;
    const turnosHoje = ST.pass.filter(p => p.data === h).map(p => p.turno);
    const ontem = ST.pass.filter(p => p.data === addD(h, -1)).map(p => p.turno);
    const hora = new Date().getHours();
    if (!ontem.includes('Noite')) out.push(['danger', 'Passagem do turno da <b>noite de ontem</b> não foi registrada.', 'turno']);
    if (hora >= 19 && !turnosHoje.includes('Dia')) out.push(['danger', 'Passagem do turno do <b>dia de hoje</b> ainda não foi registrada.', 'turno']);
    const naoLidas = ST.pass.filter(p => !p.lida).length; if (naoLidas) out.push(['warning', `${naoLidas} passagem(ns) de turno ainda não lida(s) por você.`, 'turno']);
    const crit = ST.rec.filter(r => r.status !== 'Resolvida' && (r.gravidade === 'Crítica' || r.gravidade === 'Alta'));
    if (crit.length) out.push(['danger', `${crit.length} reclamação(ões) <b>alta/crítica</b> em aberto.`, 'reclamacoes']);
    const velhas = ST.rec.filter(r => r.status !== 'Resolvida' && (new Date(h) - new Date(r.data)) / 864e5 > 3);
    if (velhas.length) out.push(['warning', `${velhas.length} reclamação(ões) aberta(s) há mais de 3 dias.`, 'reclamacoes']);
    const semFb = ST.rec.filter(r => r.procedente === 'Procedente' && r.operador && !r.feedback_dado);
    if (semFb.length) out.push(['warning', `${semFb.length} reclamação(ões) procedente(s) sem feedback ao operador.`, 'reclamacoes']);
    const sem = ST.audSemana === segunda(h) ? segunda(h) : segunda(h);
    const audSem = ST.aud.filter(a => a.semana === sem), meta = opsAtivos('Operador').length * m.amostras_semana;
    const feitas = audSem.filter(a => a.status === 'Avaliada').length;
    if (meta && feitas < meta) out.push([((new Date().getDay() + 6) % 7) >= 3 ? 'warning' : 'info', `Auditoria da semana: ${feitas} de ${meta} avaliadas.`, 'auditoria']);
    const audRuins = ST.aud.filter(a => a.status === 'Avaliada' && (a.falha_critica || Number(a.nota) < m.nota_minima) && !a.feedback_dado);
    if (audRuins.length) out.push(['warning', `${audRuins.length} auditoria(s) com nota baixa ou falha crítica sem feedback dado.`, 'auditoria']);
    if (!ST.ops.length) out.push(['info', 'Cadastre a equipe do monitoramento (operadores e líderes) para liberar a auditoria e o desempenho por operador.', 'equipe']);
    const ultImp = ST.imps.find(i => i.tipo === 'eventos' || i.tipo === 'deslocamentos');
    if (!ultImp) out.push(['info', 'Nenhum relatório do Sigma importado ainda: os indicadores de tempo de atendimento aparecem depois da primeira importação.', 'importar']);
    else if ((new Date(h) - new Date(String(ultImp.periodo_fim || ultImp.created_at).slice(0, 10))) / 864e5 > 7) out.push(['info', `Último relatório de eventos do Sigma cobre até ${fmtD(ultImp.periodo_fim)}. Importe o mais recente.`, 'importar']);
    return out;
  }
  function rPainel() {
    const P = ST.painel || {}, m = ST.metas, [ini, fim] = periodo(), h = hoje();
    const dias = Math.round((new Date(fim) - new Date(ini)) / 864e5) + 1;
    const passP = ST.pass.filter(p => p.data >= ini && p.data <= fim).length;
    const recAb = ST.rec.filter(r => r.status !== 'Resolvida'), recCrit = recAb.filter(r => r.gravidade === 'Crítica' || r.gravidade === 'Alta').length;
    const semAtual = segunda(h), audSem = ST.aud.filter(a => a.semana === semAtual), metaAud = opsAtivos('Operador').length * m.amostras_semana;
    const audAval = ST.aud.filter(a => a.status === 'Avaliada' && emPeriodo(a.avaliada_em || a.created_at));
    const notaMed = audAval.length ? audAval.reduce((s, a) => s + Number(a.nota || 0), 0) / audAval.length : null;
    const sla = pct(P.no_sla || 0, P.com_resposta || 0);
    const al = alertas();
    const corAl = { danger: 'var(--danger)', warning: 'var(--warning)', info: 'var(--blue)' };
    const turnosHoje = ['Dia', 'Noite'].map(t => ST.pass.some(p => p.data === h && p.turno === t) ? `${t} ✓` : `${t} —`).join(' · ');
    let html = `<div class="kpi-grid-dash kpi-grid-4">
      ${kc({ label: 'Passagens de turno', value: `${passP}/${dias * 2}`, color: passP >= dias * 2 - 1 ? 'accent' : 'warning', icon: 'history', sub: 'hoje: ' + turnosHoje })}
      ${kc({ label: 'Reclamações em aberto', value: recAb.length, color: recCrit ? 'danger' : recAb.length ? 'warning' : 'accent', icon: 'alert', tag: recCrit ? recCrit + ' alta/crítica' : 'ok', tagCls: recCrit ? 'kpi-tag-down' : 'kpi-tag-up' })}
      ${kc({ label: 'Auditoria da semana', value: `${audSem.filter(a => a.status === 'Avaliada').length}/${metaAud || '—'}`, color: 'blue', icon: 'search', sub: `${m.amostras_semana} por operador` })}
      ${kc({ label: 'Nota média de qualidade', value: notaMed == null ? '—' : notaMed.toFixed(1), color: notaMed == null ? 'neutral' : notaMed >= m.nota_minima ? 'accent' : 'danger', icon: 'check', sub: `${audAval.length} avaliação(ões) · mínima ${m.nota_minima}` })}
    </div>
    <div class="kpi-grid-dash kpi-grid-4" style="margin-top:12px">
      ${kc({ label: 'Eventos no período (Sigma)', value: (P.total || 0).toLocaleString('pt-BR'), color: 'neutral', icon: 'list', sub: P.total ? `${fmtD(ini)} a ${fmtD(fim)}` : 'importe o relatório do Sigma' })}
      ${kc({ label: 'Tempo médio até o atendimento', value: fmtS(P.tmr), color: P.tmr == null ? 'neutral' : P.tmr <= m.tma_meta ? 'accent' : 'warning', icon: 'clock', sub: P.mediana != null ? 'mediana ' + fmtS(P.mediana) + ' · meta ' + fmtS(m.tma_meta) : '' })}
      ${kc({ label: 'Atendidos dentro do SLA', value: sla == null ? '—' : sla + '%', color: sla == null ? 'neutral' : sla >= 90 ? 'accent' : sla >= 75 ? 'warning' : 'danger', icon: 'shield', sub: `${(P.no_sla || 0).toLocaleString('pt-BR')} de ${(P.com_resposta || 0).toLocaleString('pt-BR')}` })}
      ${kc({ label: 'Sem início / sem comentário', value: `${(P.sem_inicio || 0).toLocaleString('pt-BR')} / ${P.com_coluna_comentario ? (P.sem_comentario || 0).toLocaleString('pt-BR') : '—'}`, color: (P.sem_comentario || 0) > 0 ? 'warning' : 'neutral', icon: 'alert', sub: 'eventos sem registro do operador' })}
    </div>`;
    html += `<div class="card" style="margin-top:16px"><div class="card-header"><div class="card-title">Pontos de atenção</div><span style="font-size:12px;color:var(--text-muted)">o que precisa de você agora</span></div><div class="card-body" style="padding:6px 16px 12px">
      ${al.length ? al.map(([t, txt, go]) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)"><span style="width:8px;height:8px;border-radius:50%;background:${corAl[t]};flex:none"></span><span style="flex:1;font-size:13px">${txt}</span><button class="btn btn-outline btn-sm" onclick="Alarme.aba('${go}')">Abrir</button></div>`).join('') : '<div style="padding:12px 0;color:var(--accent);font-size:13px">Tudo em dia. Nenhum ponto de atenção.</div>'}
    </div></div>`;
    // desempenho por operador
    const ops = resumoOperadores();
    const sem = { mau: ['#dc2626', 'Crítico'], atencao: ['#d97706', 'Atenção'], ok: ['#16a34a', 'Bom'], sem: ['#6b7280', 'Sem dados'] };
    html += `<div class="card" style="margin-top:16px"><div class="card-header" style="flex-wrap:wrap;gap:8px"><div class="card-title">Desempenho por operador · ${PERIODOS[ST.periodo].toLowerCase()}</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="Alarme.exportarOps()">Exportar CSV (bonificação)</button></div></div>
      <div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Operador</th><th>Situação</th><th style="text-align:right">Eventos</th><th style="text-align:right">Tempo médio</th><th style="text-align:right">SLA</th><th style="text-align:right">Sem coment.</th><th style="text-align:right">Auditorias</th><th style="text-align:right">Nota</th><th style="text-align:right">Recl. proced.</th><th style="text-align:right">Elogios</th><th style="text-align:right">Advert.</th><th></th></tr></thead><tbody>
      ${ops.length ? ops.map(o => `<tr><td><b>${esc(o.nome)}</b><div style="font-size:11px;color:var(--text-muted)">${esc((ST.ops.find(x => x.nome === o.nome) || {}).funcao || 'não cadastrado')}</div></td>
        <td>${badge(sem[o.s][1], sem[o.s][0])}${o.motivos.length ? `<div style="font-size:11px;color:var(--text-muted);max-width:220px">${esc(o.motivos.join(' · '))}</div>` : ''}</td>
        <td style="text-align:right">${o.eventos.toLocaleString('pt-BR')}</td><td style="text-align:right">${fmtS(o.tmr)}</td>
        <td style="text-align:right;color:${o.sla == null ? 'inherit' : o.sla >= 90 ? 'var(--accent)' : o.sla >= 75 ? 'var(--warning)' : 'var(--danger)'}">${o.sla == null ? '—' : o.sla + '%'}</td>
        <td style="text-align:right">${o.semCom || '—'}</td><td style="text-align:right">${o.aud || '—'}</td>
        <td style="text-align:right;font-weight:600;color:${o.nota == null ? 'inherit' : o.nota >= m.nota_minima ? 'var(--accent)' : 'var(--danger)'}">${o.nota == null ? '—' : o.nota.toFixed(1)}</td>
        <td style="text-align:right">${o.recl || '—'}</td><td style="text-align:right">${o.elogios || '—'}</td><td style="text-align:right">${o.adv || '—'}</td>
        <td><button class="btn btn-outline btn-sm" data-n="${esc(o.nome)}" onclick="Alarme.ficha(this.dataset.n)">Ficha</button></td></tr>`).join('')
        : '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--text-muted)">Cadastre a equipe em "Equipe e feedbacks" ou importe um relatório do Sigma com a coluna de operador.</td></tr>'}
      </tbody></table></div></div>`;
    // por hora + categorias
    const horas = Array.from({ length: 24 }, (_, i) => ((P.por_hora || []).find(x => x.h === i) || {}).n || 0), maxH = Math.max(1, ...horas);
    const cats = CATS.map(c => (P.por_categoria || []).find(x => x.categoria === c) || { categoria: c, total: 0 });
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-top:16px">
      <div class="card"><div class="card-header"><div class="card-title">Eventos por hora do dia</div><span style="font-size:12px;color:var(--text-muted)">para dimensionar a escala</span></div><div class="card-body" style="padding:16px">
        ${P.total ? `<div style="display:flex;align-items:flex-end;gap:3px;height:150px">${horas.map((n, i) => `<div title="${String(i).padStart(2, '0')}h: ${n.toLocaleString('pt-BR')} eventos" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%"><div style="height:${Math.max(2, n / maxH * 100)}%;background:${n === maxH ? 'var(--danger)' : 'var(--primary)'};border-radius:3px 3px 0 0;opacity:${n ? 1 : .25}"></div></div>`).join('')}</div>
        <div style="display:flex;gap:3px;margin-top:4px">${horas.map((_, i) => `<div style="flex:1;text-align:center;font-size:9px;color:var(--text-muted)">${i % 3 === 0 ? i : ''}</div>`).join('')}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Pico: <b>${horas.indexOf(maxH)}h</b> com ${maxH.toLocaleString('pt-BR')} eventos.</div>` : '<div style="color:var(--text-muted);font-size:13px">Sem eventos importados para o período.</div>'}
      </div></div>
      <div class="card"><div class="card-header"><div class="card-title">Por tipo de evento</div><span style="font-size:12px;color:var(--text-muted)">SLA configurado em Metas</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Tipo</th><th style="text-align:right">Eventos</th><th style="text-align:right">Tempo médio</th><th style="text-align:right">No SLA</th><th style="text-align:right">Meta</th></tr></thead><tbody>
        ${cats.map(c => { const s = pct(c.no_sla || 0, c.com_resposta || 0); return `<tr><td>${badge(c.categoria, CAT_COR[c.categoria])}</td><td style="text-align:right">${(c.total || 0).toLocaleString('pt-BR')}</td><td style="text-align:right">${fmtS(c.tmr)}</td><td style="text-align:right;color:${s == null ? 'inherit' : s >= 90 ? 'var(--accent)' : s >= 75 ? 'var(--warning)' : 'var(--danger)'}">${s == null ? '—' : s + '%'}</td><td style="text-align:right;color:var(--text-muted)">${fmtS(slaDe(c.categoria))}</td></tr>`; }).join('')}
        </tbody></table></div></div>
    </div>`;
    // reincidentes
    const reinc = (P.reincidentes && P.reincidentes.length) ? P.reincidentes.map(r => ({ conta: r.conta, cliente: r.cliente, empresa: r.empresa, n: r.n, extra: r.alarmes + ' alarme(s)/crítico(s)' }))
      : ST.contas.map(c => ({ conta: c.conta, cliente: c.cliente, empresa: c.empresa, n: c.qtd, extra: `${fmtD(c.periodo_ini)} a ${fmtD(c.periodo_fim)}` }));
    html += `<div class="card" style="margin-top:16px"><div class="card-header" style="flex-wrap:wrap;gap:8px"><div class="card-title">Contas reincidentes (mais eventos)</div>
      <div style="display:flex;gap:8px;align-items:center"><span style="font-size:12px;color:var(--text-muted)">candidatas a manutenção remota / visita técnica</span>${reinc.length ? '<button class="btn btn-outline btn-sm" onclick="Alarme.copiarReinc()">Copiar lista para o BackOffice</button>' : ''}</div></div>
      <div class="table-wrap table-scroll" style="max-height:360px"><table class="table"><thead><tr><th>Conta</th><th>Cliente</th><th>Empresa</th><th style="text-align:right">Eventos</th><th></th></tr></thead><tbody>
      ${reinc.length ? reinc.slice(0, 20).map(r => `<tr><td>${esc(r.conta)}</td><td><b>${esc(r.cliente || '—')}</b></td><td style="font-size:12px">${esc(r.empresa || '—')}</td><td style="text-align:right;font-weight:600">${Number(r.n || 0).toLocaleString('pt-BR')}</td><td style="font-size:11px;color:var(--text-muted)">${esc(r.extra)}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Importe o relatório "Contas com mais eventos" ou um relatório de eventos do Sigma.</td></tr>'}
      </tbody></table></div></div>`;
    ST._reinc = reinc;
    return html;
  }
  function exportarOps() {
    const [ini, fim] = periodo(), L = resumoOperadores();
    const cab = ['Operador', 'Função', 'Situação', 'Eventos', 'Tempo médio (s)', 'SLA %', 'Sem comentário', 'Auditorias', 'Nota média', 'Falhas críticas', 'Reclamações procedentes', 'Elogios', 'Advertências'];
    const linhas = L.map(o => [o.nome, (ST.ops.find(x => x.nome === o.nome) || {}).funcao || '', { mau: 'Crítico', atencao: 'Atenção', ok: 'Bom', sem: 'Sem dados' }[o.s], o.eventos, o.tmr == null ? '' : Math.round(o.tmr), o.sla ?? '', o.semCom, o.aud, o.nota == null ? '' : o.nota.toFixed(1).replace('.', ','), o.falhas, o.recl, o.elogios, o.adv]);
    const csv = '﻿' + [cab, ...linhas].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `desempenho_operadores_${ini}_a_${fim}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function copiarReinc() {
    const t = 'Contas com mais eventos (verificar manutenção remota):\n' + (ST._reinc || []).slice(0, 20).map((r, i) => `${i + 1}. ${r.conta} - ${r.cliente || ''} (${r.empresa || ''}): ${r.n} eventos`).join('\n');
    try { await navigator.clipboard.writeText(t); toast('Lista copiada.'); } catch (e) { toast('Não foi possível copiar.', true); }
  }

  // ---------------------------------------------------------------- PASSAGEM DE TURNO
  function rTurno() {
    const h = hoje();
    const status = d => ['Dia', 'Noite'].map(t => { const p = ST.pass.find(x => x.data === d && x.turno === t); return `<div style="flex:1;min-width:150px;border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:12px;color:var(--text-muted)">${d === h ? 'Hoje' : 'Ontem'} · ${t}</div><div style="font-weight:600;margin-top:4px;color:${p ? 'var(--accent)' : 'var(--text-muted)'}">${p ? '✓ ' + esc(p.lider) : 'Não registrada'}</div></div>`; }).join('');
    return `<div class="card"><div class="card-header" style="flex-wrap:wrap;gap:8px"><div class="card-title">Passagem de turno</div><div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="Alarme.copiarLinkTurno()">Copiar link para os líderes</button><button class="btn btn-accent" onclick="Alarme.novoTurno()">+ Registrar passagem</button></div></div>
      <div class="card-body" style="padding:16px"><div style="display:flex;gap:10px;flex-wrap:wrap">${status(addD(h, -1))}${status(h)}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:10px">O líder registra ao fim de cada turno (Dia 07h–19h · Noite 19h–07h). Você lê aqui e marca como lida — se precisar, deixa um comentário.</div></div></div>
      <div class="card" style="margin-top:16px"><div class="card-header"><div class="card-title">Últimos registros</div></div><div class="card-body" style="padding:8px 16px">
      ${ST.pass.length ? ST.pass.slice(0, 40).map(p => `<div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
          <div><b>${fmtD(p.data)} · ${esc(p.turno)}</b> <span style="color:var(--text-muted);font-size:12px">líder: ${esc(p.lider)}</span> ${p.fila_critica ? badge('Fila crítica', '#dc2626') : ''} ${p.faltas ? badge('Faltas', '#d97706') : ''}</div>
          <div style="display:flex;gap:6px">${p.lida ? badge('Lida', '#16a34a') : `<button class="btn btn-accent btn-sm" onclick="Alarme.lerTurno(${p.id})">Marcar como lida</button>`}<button class="btn btn-outline btn-sm" onclick="Alarme.novoTurno(${p.id})">Abrir</button></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 16px;margin-top:8px;font-size:12.5px">
          ${[['Faltas', p.faltas], ['Ocorrências relevantes', p.ocorrencias], ['Pendências p/ próximo turno', p.pendencias], ['Clientes com problema', p.clientes_problema], ['Falhas de sistema', p.falhas_sistema], ['Seu comentário', p.comentario_gestor]].filter(x => x[1]).map(([l, v]) => `<div><div style="color:var(--text-muted);font-size:11px">${l}</div><div style="white-space:pre-wrap">${esc(v)}</div></div>`).join('') || '<div style="color:var(--text-muted)">Sem observações.</div>'}
        </div></div>`).join('') : '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nenhuma passagem registrada ainda.</div>'}
      </div></div>`;
  }
  function novoTurno(id) {
    const p = id ? ST.pass.find(x => x.id === id) : null, h = new Date().getHours();
    const turnoPadrao = p ? p.turno : (h >= 7 && h < 19 ? 'Dia' : 'Noite');
    const dataPadrao = p ? p.data : (h < 7 ? addD(hoje(), -1) : hoje());
    const presentes = p && p.presentes ? p.presentes.split(';').map(s => s.trim()) : [];
    const ta = (idc, l, v, ph) => `<div class="form-group"><label class="form-label">${l}</label><textarea class="form-input" id="${idc}" rows="2" style="resize:vertical" placeholder="${ph}">${esc(v || '')}</textarea></div>`;
    modal(p ? 'Passagem de turno' : 'Registrar passagem de turno', `<input type="hidden" id="alm-t-id" value="${p ? p.id : ''}">
      <div style="display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:12px">
        <div class="form-group"><label class="form-label">Data do turno</label><input class="form-input" type="date" id="alm-t-data" value="${dataPadrao}"></div>
        <div class="form-group"><label class="form-label">Turno</label><select class="form-input" id="alm-t-turno">${TURNOS.map(t => `<option ${t === turnoPadrao ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Líder do turno *</label><select class="form-input" id="alm-t-lider">${optsOps(p ? p.lider : '', lideres().length ? lideres() : opsAtivos(), 'Selecione')}</select></div>
      </div>
      ${opsAtivos().length ? `<div class="form-group"><label class="form-label">Operadores presentes</label><div style="display:flex;flex-wrap:wrap;gap:6px 14px">${opsAtivos().map(o => `<label style="font-size:12.5px;display:flex;gap:5px;align-items:center"><input type="checkbox" class="alm-t-pres" value="${esc(o.nome)}" ${presentes.includes(o.nome) || (!p && o.turno === turnoPadrao) ? 'checked' : ''}>${esc(o.nome)}</label>`).join('')}</div></div>` : ''}
      ${ta('alm-t-faltas', 'Faltas / atrasos', p && p.faltas, 'Quem faltou ou chegou atrasado e o motivo')}
      ${ta('alm-t-ocor', 'Ocorrências relevantes', p && p.ocorrencias, 'Disparos reais, pânico, acionamentos de viatura, ocorrências policiais...')}
      ${ta('alm-t-pend', 'Pendências para o próximo turno', p && p.pendencias, 'O que o próximo turno precisa acompanhar')}
      ${ta('alm-t-cli', 'Clientes com problema', p && p.clientes_problema, 'Sem comunicação, disparo recorrente, sem contato válido...')}
      ${ta('alm-t-sis', 'Falhas de sistema / estrutura', p && p.falhas_sistema, 'Sigma lento, receptora, telefonia, internet, energia...')}
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0 10px"><input type="checkbox" id="alm-t-fila" ${p && p.fila_critica ? 'checked' : ''}> Houve acúmulo de eventos na fila (fila crítica)</label>
      ${p ? `<div class="form-group"><label class="form-label">Comentário do gestor</label><textarea class="form-input" id="alm-t-com" rows="2" style="resize:vertical">${esc(p.comentario_gestor || '')}</textarea></div>` : ''}`,
      `<button class="btn btn-accent" onclick="Alarme.salvarTurno()">Salvar</button>`);
  }
  async function salvarTurno() {
    const id = $('alm-t-id').value, lider = $('alm-t-lider').value;
    if (!lider) { toast('Selecione o líder do turno.', true); return; }
    const v = k => ($(k) ? $(k).value.trim() : '') || null;
    const obj = { data: $('alm-t-data').value || hoje(), turno: $('alm-t-turno').value, lider,
      presentes: [...document.querySelectorAll('.alm-t-pres:checked')].map(c => c.value).join('; ') || null,
      faltas: v('alm-t-faltas'), ocorrencias: v('alm-t-ocor'), pendencias: v('alm-t-pend'), clientes_problema: v('alm-t-cli'), falhas_sistema: v('alm-t-sis'), fila_critica: $('alm-t-fila').checked };
    if ($('alm-t-com')) obj.comentario_gestor = v('alm-t-com');
    try {
      if (id) await q(sb.from('alm_passagem_turno').update(obj).eq('id', Number(id)));
      else await q(sb.from('alm_passagem_turno').insert(obj));
      toast('Passagem de turno salva.'); fechar(); carregar();
    } catch (e) { toast(/duplicate|unique/i.test(e.message) ? 'Já existe passagem para esse dia e turno. Abra o registro existente para editar.' : 'Erro: ' + e.message, true); }
  }
  async function lerTurno(id) {
    try { await q(sb.from('alm_passagem_turno').update({ lida: true, lida_em: new Date().toISOString() }).eq('id', id)); const p = ST.pass.find(x => x.id === id); if (p) p.lida = true; render(); }
    catch (e) { toast('Erro: ' + e.message, true); }
  }
  async function copiarLinkTurno() {
    const url = location.origin + location.pathname + '#alarme';
    try { await navigator.clipboard.writeText(`Passagem de turno do monitoramento: ${url}\nAbra a aba "Passagem de turno" e registre ao final de cada turno.`); toast('Link copiado.'); } catch (e) { toast(url); }
  }

  // ---------------------------------------------------------------- AUDITORIA
  function notaDe(itens) {
    let ok = 0, tot = 0, crit = false;
    CHECK.forEach(c => { const v = itens[c.k]; if (v === 'sim') { ok += c.w; tot += c.w; } else if (v === 'nao') { tot += c.w; if (c.crit) crit = true; } });
    return { nota: tot ? Math.round(ok / tot * 100) / 10 : null, crit };
  }
  function rAuditoria() {
    const sem = ST.audSemana, L = ST.aud.filter(a => a.semana === sem), m = ST.metas;
    const ops = opsAtivos('Operador'), meta = ops.length * m.amostras_semana, aval = L.filter(a => a.status === 'Avaliada');
    const media = aval.length ? (aval.reduce((s, a) => s + Number(a.nota || 0), 0) / aval.length).toFixed(1) : '—';
    const porOp = ops.map(o => { const x = L.filter(a => a.operador === o.nome); return { o, total: x.length, feitas: x.filter(a => a.status === 'Avaliada').length }; });
    return `<div class="card"><div class="card-header" style="flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px"><button class="btn btn-outline btn-sm" onclick="Alarme.semana(-1)">‹</button><div class="card-title">Semana de ${fmtD(sem)} a ${fmtD(addD(sem, 6))}</div><button class="btn btn-outline btn-sm" onclick="Alarme.semana(1)">›</button></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline" onclick="Alarme.novaAuditoria()">+ Avaliação avulsa</button><button class="btn btn-accent" onclick="Alarme.sortear()" title="Cria ${m.amostras_semana} avaliações por operador, sorteando eventos importados do Sigma quando houver">🎲 Gerar amostra da semana</button></div></div>
      <div class="card-body" style="padding:14px 16px">
        <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px;margin-bottom:10px"><div>Avaliadas: <b>${aval.length}/${meta || '—'}</b></div><div>Nota média: <b>${media}</b></div><div>Falhas críticas: <b style="color:${aval.some(a => a.falha_critica) ? 'var(--danger)' : 'inherit'}">${aval.filter(a => a.falha_critica).length}</b></div><div style="color:var(--text-muted)">Nota mínima: ${m.nota_minima}</div></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${porOp.map(p => `<span class="badge" style="color:${p.feitas >= m.amostras_semana ? '#16a34a' : p.total ? '#d97706' : '#6b7280'};background:${p.feitas >= m.amostras_semana ? '#16a34a' : p.total ? '#d97706' : '#6b7280'}1f">${esc(p.o.nome)} ${p.feitas}/${m.amostras_semana}</span>`).join('') || '<span style="font-size:12px;color:var(--text-muted)">Cadastre os operadores em "Equipe e feedbacks".</span>'}</div>
      </div>
      <div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Operador</th><th>Evento auditado</th><th>Status</th><th style="text-align:right">Nota</th><th>Feedback</th><th>Ações</th></tr></thead><tbody>
      ${L.length ? L.sort((a, b) => a.operador.localeCompare(b.operador) || (a.status === 'Pendente' ? -1 : 1)).map(a => `<tr>
        <td><b>${esc(a.operador)}</b>${a.auditor ? `<div style="font-size:11px;color:var(--text-muted)">por ${esc(a.auditor)}</div>` : ''}</td>
        <td style="font-size:12.5px">${a.cliente || a.evento ? `${a.conta ? esc(a.conta) + ' · ' : ''}<b>${esc(a.cliente || '')}</b><div style="color:var(--text-muted)">${esc(a.evento || '')} ${a.data_evento ? '· ' + fmtDH(a.data_evento) : ''} ${a.categoria ? badge(a.categoria, CAT_COR[a.categoria] || '#6b7280') : ''}</div>` : '<span style="color:var(--text-muted)">escolher um evento do operador no Sigma</span>'}</td>
        <td>${a.status === 'Avaliada' ? badge('Avaliada', '#16a34a') : badge('Pendente', '#d97706')}${a.falha_critica ? ' ' + badge('Falha crítica', '#dc2626') : ''}</td>
        <td style="text-align:right;font-weight:600;color:${a.nota == null ? 'inherit' : Number(a.nota) >= m.nota_minima ? 'var(--accent)' : 'var(--danger)'}">${a.nota == null ? '—' : Number(a.nota).toFixed(1)}</td>
        <td>${a.status !== 'Avaliada' ? '—' : a.feedback_dado ? badge('Dado', '#16a34a') : (a.falha_critica || Number(a.nota) < m.nota_minima) ? `<button class="btn btn-outline btn-sm" onclick="Alarme.feedbackAud(${a.id})">Registrar</button>` : '<span style="font-size:12px;color:var(--text-muted)">não precisa</span>'}</td>
        <td style="white-space:nowrap"><button class="btn ${a.status === 'Avaliada' ? 'btn-outline' : 'btn-accent'} btn-sm" onclick="Alarme.avaliar(${a.id})" style="margin-right:4px">${a.status === 'Avaliada' ? 'Ver' : 'Avaliar'}</button><button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="Alarme.excluirAud(${a.id})">Excluir</button></td></tr>`).join('')
        : `<tr><td colspan="6" style="text-align:center;padding:22px;color:var(--text-muted)">Nenhuma avaliação nesta semana. Clique em "Gerar amostra da semana".</td></tr>`}
      </tbody></table></div></div>
      <div class="card" style="margin-top:16px"><div class="card-header"><div class="card-title">Como avaliar</div></div><div class="card-body" style="padding:14px 16px;font-size:12.5px;color:var(--text-secondary)">
        Abra o evento no Sigma (e a gravação da ligação, se houver) e marque cada item como Sim, Não ou Não se aplica. A nota vai de 0 a 10, ponderada.
        Itens marcados com <b style="color:var(--danger)">●</b> são críticos: um "Não" em qualquer um deles marca <b>falha crítica</b>, mesmo com nota alta.
        <ul style="margin:8px 0 0 18px">${CHECK.map(c => `<li>${c.crit ? '<b style="color:var(--danger)">●</b> ' : ''}${esc(c.t)} <span style="color:var(--text-muted)">(peso ${c.w})</span></li>`).join('')}</ul></div></div>`;
  }
  function mudarSemana(n) { ST.audSemana = addD(ST.audSemana, 7 * n); render(); }
  async function sortear() {
    const ops = opsAtivos('Operador'), sem = ST.audSemana, n = ST.metas.amostras_semana;
    if (!ops.length) { toast('Cadastre os operadores primeiro (aba Equipe e feedbacks).', true); return; }
    // eventos da semana anterior + semana atual para ter de onde sortear
    const ini = addD(sem, -7), fim = addD(sem, 7);
    const novos = [];
    for (const o of ops) {
      const ja = ST.aud.filter(a => a.semana === sem && a.operador === o.nome).length;
      const falta = n - ja; if (falta <= 0) continue;
      const nomes = [o.nome, ...String(o.apelidos || '').split(/[;,]/).map(s => s.trim()).filter(Boolean)];
      let evs = [];
      try { evs = await q(sb.from('alm_eventos').select('id,conta,cliente,evento,categoria,recebido_em').in('operador', nomes).gte('recebido_em', ini).lt('recebido_em', fim).limit(500)); } catch (e) { evs = []; }
      const usados = new Set(ST.aud.map(a => a.evento_id).filter(Boolean));
      evs = evs.filter(e => !usados.has(e.id));
      const prior = evs.filter(e => e.categoria === 'Crítico' || e.categoria === 'Alarme'), pool = prior.length >= falta ? prior : evs;
      for (let i = 0; i < falta; i++) {
        const e = pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0] : null;
        novos.push({ semana: sem, operador: o.nome, status: 'Pendente', evento_id: e ? e.id : null, conta: e ? e.conta : null, cliente: e ? e.cliente : null, evento: e ? e.evento : null, data_evento: e ? e.recebido_em : null, categoria: e ? e.categoria : null });
      }
    }
    if (!novos.length) { toast('A amostra desta semana já está completa.'); return; }
    try { await q(sb.from('alm_auditorias').insert(novos)); toast(`${novos.length} avaliação(ões) criada(s)${novos.some(x => x.evento_id) ? ' com eventos sorteados do Sigma' : ''}.`); carregar(); }
    catch (e) { toast('Erro: ' + e.message, true); }
  }
  function novaAuditoria() { avaliar(null); }
  function avaliar(id) {
    const a = id ? ST.aud.find(x => x.id === id) : null, it = (a && a.itens) || {};
    const radio = c => ['sim', 'nao', 'na'].map(v => `<label style="display:flex;gap:4px;align-items:center;font-size:12px"><input type="radio" name="alm-a-${c.k}" value="${v}" ${it[c.k] === v ? 'checked' : ''} onchange="Alarme.calcNota()">${{ sim: 'Sim', nao: 'Não', na: 'N/A' }[v]}</label>`).join('');
    modal(a ? `Avaliação · ${a.operador}` : 'Nova avaliação', `<input type="hidden" id="alm-a-id" value="${a ? a.id : ''}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Operador *</label><select class="form-input" id="alm-a-op" ${a ? 'disabled' : ''}>${optsOps(a ? a.operador : '', null, 'Selecione')}</select></div>
        <div class="form-group"><label class="form-label">Avaliado por</label><input class="form-input" id="alm-a-aud" value="${esc(a && a.auditor || lsGet('alm_auditor', 'Pedro'))}"></div>
      </div>
      <div style="display:grid;grid-template-columns:.8fr 1.6fr 1.6fr;gap:12px">
        <div class="form-group"><label class="form-label">Conta</label><input class="form-input" id="alm-a-conta" value="${esc(a && a.conta || '')}"></div>
        <div class="form-group"><label class="form-label">Cliente</label><input class="form-input" id="alm-a-cli" value="${esc(a && a.cliente || '')}"></div>
        <div class="form-group"><label class="form-label">Evento</label><input class="form-input" id="alm-a-ev" value="${esc(a && a.evento || '')}" placeholder="Ex.: Disparo zona 03"></div>
      </div>
      <div class="form-group"><label class="form-label">Data/hora do evento</label><input class="form-input" type="datetime-local" id="alm-a-dt" value="${a && a.data_evento ? new Date(new Date(a.data_evento).getTime() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''}" style="max-width:240px"></div>
      <div style="border:1px solid var(--border);border-radius:10px;padding:4px 12px;margin-bottom:12px">
        ${CHECK.map(c => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px">${c.crit ? '<b style="color:var(--danger)">●</b> ' : ''}${esc(c.t)}</span><span style="display:flex;gap:10px;flex:none">${radio(c)}</span></div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:14px"><span>Nota</span><b id="alm-a-nota">—</b></div>
      </div>
      <div class="form-group"><label class="form-label">Observação (o que o operador fez bem ou precisa corrigir)</label><textarea class="form-input" id="alm-a-obs" rows="3" style="resize:vertical">${esc(a && a.observacao || '')}</textarea></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="alm-a-fb" ${a && a.feedback_dado ? 'checked' : ''}> Feedback já foi dado ao operador</label>`,
      `<button class="btn btn-accent" onclick="Alarme.salvarAud()">Salvar avaliação</button>`, 760);
    calcNota();
  }
  function lerItens() { const it = {}; CHECK.forEach(c => { const r = document.querySelector(`input[name="alm-a-${c.k}"]:checked`); if (r) it[c.k] = r.value; }); return it; }
  function calcNota() { const { nota, crit } = notaDe(lerItens()); const el = $('alm-a-nota'); if (el) { el.textContent = nota == null ? '—' : nota.toFixed(1) + (crit ? ' · falha crítica' : ''); el.style.color = nota == null ? '' : (crit || nota < ST.metas.nota_minima) ? 'var(--danger)' : 'var(--accent)'; } }
  async function salvarAud() {
    const id = $('alm-a-id').value, op = $('alm-a-op').value, itens = lerItens();
    if (!op) { toast('Selecione o operador.', true); return; }
    const { nota, crit } = notaDe(itens), completo = CHECK.every(c => itens[c.k]);
    const dt = $('alm-a-dt').value;
    const obj = { operador: op, auditor: $('alm-a-aud').value.trim() || null, conta: $('alm-a-conta').value.trim() || null, cliente: $('alm-a-cli').value.trim() || null, evento: $('alm-a-ev').value.trim() || null,
      data_evento: dt ? new Date(dt).toISOString() : null, itens, nota, falha_critica: crit, observacao: $('alm-a-obs').value.trim() || null, feedback_dado: $('alm-a-fb').checked,
      status: completo ? 'Avaliada' : 'Pendente', avaliada_em: completo ? new Date().toISOString() : null };
    if (obj.evento && !obj.categoria) obj.categoria = categoria(obj.evento);
    if (obj.auditor) lsSet('alm_auditor', obj.auditor);
    try {
      let novoId = id ? Number(id) : null;
      if (id) await q(sb.from('alm_auditorias').update(obj).eq('id', novoId));
      else { obj.semana = ST.audSemana; const r = await q(sb.from('alm_auditorias').insert(obj).select('id').single()); novoId = r.id; }
      fechar(); await carregar();
      toast(completo ? `Avaliação salva: nota ${nota == null ? '—' : nota.toFixed(1)}.` : 'Salva como pendente (faltam itens).');
      if (completo && !obj.feedback_dado && (crit || (nota != null && nota < ST.metas.nota_minima))) setTimeout(() => feedbackAud(novoId), 300);
    } catch (e) { toast('Erro: ' + e.message, true); }
  }
  async function excluirAud(id) {
    if (!confirm('Excluir esta avaliação?')) return;
    try { await q(sb.from('alm_auditorias').delete().eq('id', id)); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }
  function feedbackAud(id) {
    const a = ST.aud.find(x => x.id === id); if (!a) return;
    const falhas = CHECK.filter(c => (a.itens || {})[c.k] === 'nao').map(c => c.t.toLowerCase());
    novoFeedback({ operador: a.operador, tipo: a.falha_critica ? 'Advertência verbal' : 'Orientação', origem: 'Auditoria', ref_id: a.id,
      motivo: `Auditoria (${a.cliente || 'evento'}${a.data_evento ? ' em ' + fmtDH(a.data_evento) : ''}) com nota ${Number(a.nota).toFixed(1)}. Pontos a corrigir: ${falhas.join('; ') || '—'}.${a.observacao ? ' ' + a.observacao : ''}` });
  }

  // ---------------------------------------------------------------- RECLAMAÇÕES
  function rReclamacoes() {
    const mes = hoje().slice(0, 7);
    const ab = ST.rec.filter(r => r.status !== 'Resolvida');
    let L = ST.rec.filter(r => ST.recFiltro === 'abertas' ? r.status !== 'Resolvida' : ST.recFiltro ? r.status === ST.recFiltro : true);
    if (ST.recBusca) L = L.filter(r => nz(`${r.cliente} ${r.conta} ${r.operador} ${r.tipo} ${r.descricao}`).includes(nz(ST.recBusca)));
    const porTipo = {}; ST.rec.filter(r => r.data.slice(0, 7) === mes).forEach(r => porTipo[r.tipo || 'Outro'] = (porTipo[r.tipo || 'Outro'] || 0) + 1);
    return `<div class="kpi-grid-dash kpi-grid-4">
      ${kc({ label: 'Em aberto', value: ab.length, color: ab.length ? 'warning' : 'accent', icon: 'alert' })}
      ${kc({ label: 'Alta / crítica em aberto', value: ab.filter(r => r.gravidade === 'Alta' || r.gravidade === 'Crítica').length, color: 'danger', icon: 'alert' })}
      ${kc({ label: 'Procedentes no mês', value: ST.rec.filter(r => r.procedente === 'Procedente' && r.data.slice(0, 7) === mes).length, color: 'blue', icon: 'check', sub: Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([t, n]) => `mais comum: ${t} (${n})`).join('') })}
      ${kc({ label: 'Procedentes sem feedback', value: ST.rec.filter(r => r.procedente === 'Procedente' && r.operador && !r.feedback_dado).length, color: 'warning', icon: 'history' })}
    </div>
    <div class="card" style="margin-top:16px"><div class="card-header" style="flex-wrap:wrap;gap:8px"><div class="card-title">Reclamações e ocorrências críticas</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input class="form-input" placeholder="Buscar cliente, operador..." style="width:200px;font-size:12px" value="${esc(ST.recBusca)}" oninput="Alarme.filtroRec('recBusca', this.value)" id="alm-r-busca">
        <select class="form-input" style="width:auto;font-size:12px" onchange="Alarme.filtroRec('recFiltro', this.value)"><option value="abertas" ${ST.recFiltro === 'abertas' ? 'selected' : ''}>Em aberto</option><option value="" ${ST.recFiltro === '' ? 'selected' : ''}>Todas</option>${Object.keys(ST_RECL).map(s => `<option ${ST.recFiltro === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <button class="btn btn-accent" onclick="Alarme.novaRec()">+ Nova reclamação</button></div></div>
      <div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Gravidade</th><th>Operador</th><th>Procedência</th><th>Status</th><th>Feedback</th><th></th></tr></thead><tbody>
      ${L.length ? L.map(r => { const d = Math.round((new Date(hoje()) - new Date(r.data)) / 864e5); return `<tr style="cursor:pointer" onclick="Alarme.novaRec(${r.id})">
        <td>${fmtD(r.data)}${r.status !== 'Resolvida' ? `<div style="font-size:11px;color:${d > 3 ? 'var(--danger)' : 'var(--text-muted)'}">há ${d} dia(s)</div>` : ''}</td>
        <td><b>${esc(r.cliente)}</b><div style="font-size:11px;color:var(--text-muted)">${esc([r.conta, r.filial, r.origem].filter(Boolean).join(' · '))}</div></td>
        <td style="font-size:12.5px">${esc(r.tipo || '—')}</td><td>${badge(r.gravidade, GRAV[r.gravidade] || '#6b7280')}</td><td>${esc(r.operador || '—')}</td>
        <td>${badge(r.procedente, PROC[r.procedente] || '#6b7280')}</td><td>${badge(r.status, ST_RECL[r.status] || '#6b7280')}</td>
        <td>${r.procedente !== 'Procedente' || !r.operador ? '—' : r.feedback_dado ? badge('Dado', '#16a34a') : badge('Pendente', '#d97706')}</td>
        <td>${r.status !== 'Resolvida' ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Alarme.resolverRec(${r.id})">✓ Resolver</button>` : ''}</td></tr>`; }).join('')
        : '<tr><td colspan="9" style="text-align:center;padding:22px;color:var(--text-muted)">Nenhuma reclamação com esse filtro.</td></tr>'}
      </tbody></table></div></div>`;
  }
  function filtroRec(k, v) { ST[k] = v; render(); if (k === 'recBusca') { const el = $('alm-r-busca'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } } }
  function novaRec(id) {
    const r = id ? ST.rec.find(x => x.id === id) : null;
    const sel = (idc, lista, v) => `<select class="form-input" id="${idc}">${lista.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    modal(r ? 'Reclamação' : 'Nova reclamação', `<input type="hidden" id="alm-r-id" value="${r ? r.id : ''}">
      <div style="display:grid;grid-template-columns:1fr 2fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Data</label><input class="form-input" type="date" id="alm-r-data" value="${r ? r.data : hoje()}"></div>
        <div class="form-group"><label class="form-label">Cliente *</label><input class="form-input" id="alm-r-cli" value="${esc(r && r.cliente || '')}"></div>
        <div class="form-group"><label class="form-label">Conta</label><input class="form-input" id="alm-r-conta" value="${esc(r && r.conta || '')}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Filial</label><select class="form-input" id="alm-r-filial"><option value="">—</option>${FILIAIS.map(f => `<option ${r && r.filial === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Origem</label>${sel('alm-r-origem', ORIGENS, r ? r.origem : 'Cliente')}</div>
        <div class="form-group"><label class="form-label">Gravidade</label>${sel('alm-r-grav', Object.keys(GRAV), r ? r.gravidade : 'Média')}</div>
      </div>
      <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Tipo</label>${sel('alm-r-tipo', TIPOS_RECL, r ? r.tipo : TIPOS_RECL[0])}</div>
        <div class="form-group"><label class="form-label">Operador envolvido</label><select class="form-input" id="alm-r-op">${optsOps(r ? r.operador : '', null, 'Não identificado')}</select></div>
      </div>
      <div class="form-group"><label class="form-label">O que aconteceu</label><textarea class="form-input" id="alm-r-desc" rows="3" style="resize:vertical">${esc(r && r.descricao || '')}</textarea></div>
      <div class="form-group"><label class="form-label">Causa identificada (após ouvir a gravação / ver o evento)</label><textarea class="form-input" id="alm-r-causa" rows="2" style="resize:vertical">${esc(r && r.causa || '')}</textarea></div>
      <div class="form-group"><label class="form-label">Tratativa com o cliente</label><textarea class="form-input" id="alm-r-trat" rows="2" style="resize:vertical">${esc(r && r.tratativa || '')}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Procedência</label>${sel('alm-r-proc', Object.keys(PROC), r ? r.procedente : 'Em análise')}</div>
        <div class="form-group"><label class="form-label">Status</label>${sel('alm-r-st', Object.keys(ST_RECL), r ? r.status : 'Aberta')}</div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="alm-r-fb" ${r && r.feedback_dado ? 'checked' : ''}> Feedback já foi dado ao operador</label>`,
      (r ? `<button class="btn btn-outline" style="color:var(--danger)" onclick="Alarme.excluirRec(${r.id})">Excluir</button>` : '') + `<button class="btn btn-accent" onclick="Alarme.salvarRec()">Salvar</button>`, 760);
  }
  async function salvarRec() {
    const id = $('alm-r-id').value, cli = $('alm-r-cli').value.trim();
    if (!cli) { toast('Preencha o cliente.', true); return; }
    const st = $('alm-r-st').value, antes = id ? ST.rec.find(x => x.id === Number(id)) : null;
    const obj = { data: $('alm-r-data').value || hoje(), cliente: cli.toUpperCase(), conta: $('alm-r-conta').value.trim() || null, filial: $('alm-r-filial').value || null, origem: $('alm-r-origem').value,
      gravidade: $('alm-r-grav').value, tipo: $('alm-r-tipo').value, operador: $('alm-r-op').value || null, descricao: $('alm-r-desc').value.trim() || null, causa: $('alm-r-causa').value.trim() || null,
      tratativa: $('alm-r-trat').value.trim() || null, procedente: $('alm-r-proc').value, status: st, feedback_dado: $('alm-r-fb').checked, updated_at: new Date().toISOString(),
      resolvido_em: st === 'Resolvida' ? ((antes && antes.resolvido_em) || hoje()) : null };
    try {
      let rid = id ? Number(id) : null;
      if (id) await q(sb.from('alm_reclamacoes').update(obj).eq('id', rid));
      else { const r = await q(sb.from('alm_reclamacoes').insert(obj).select('id').single()); rid = r.id; }
      fechar(); await carregar(); toast('Reclamação salva.');
      if (obj.procedente === 'Procedente' && obj.operador && !obj.feedback_dado && (!antes || antes.procedente !== 'Procedente'))
        setTimeout(() => novoFeedback({ operador: obj.operador, tipo: obj.gravidade === 'Crítica' || obj.gravidade === 'Alta' ? 'Advertência verbal' : 'Orientação', origem: 'Reclamação', ref_id: rid, motivo: `Reclamação procedente de ${obj.cliente} (${fmtD(obj.data)}): ${obj.tipo}.${obj.causa ? ' Causa: ' + obj.causa : ''}` }), 300);
    } catch (e) { toast('Erro: ' + e.message, true); }
  }
  async function resolverRec(id) {
    try { await q(sb.from('alm_reclamacoes').update({ status: 'Resolvida', resolvido_em: hoje(), updated_at: new Date().toISOString() }).eq('id', id)); toast('Reclamação resolvida.'); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }
  async function excluirRec(id) {
    if (!confirm('Excluir esta reclamação?')) return;
    try { await q(sb.from('alm_reclamacoes').delete().eq('id', id)); fechar(); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }

  // ---------------------------------------------------------------- EQUIPE E FEEDBACKS
  function rEquipe() {
    const L = ST.ops.slice().sort((a, b) => (b.ativo - a.ativo) || FUNCOES.indexOf(b.funcao) - FUNCOES.indexOf(a.funcao) || a.nome.localeCompare(b.nome));
    return `<div class="card"><div class="card-header" style="flex-wrap:wrap;gap:8px"><div class="card-title">Equipe do monitoramento</div><div style="display:flex;gap:8px"><button class="btn btn-outline" onclick="Alarme.colarEquipe()">Colar lista de nomes</button><button class="btn btn-accent" onclick="Alarme.editOp()">+ Adicionar</button></div></div>
      <div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Nome</th><th>Função</th><th>Turno</th><th>Equipe</th><th>Como aparece no Sigma</th><th>Situação</th><th></th></tr></thead><tbody>
      ${L.length ? L.map(o => `<tr style="${o.ativo ? '' : 'opacity:.5'}"><td><b>${esc(o.nome)}</b></td><td>${esc(o.funcao)}</td><td>${esc(o.turno || '—')}</td><td>${esc(o.equipe || '—')}</td><td style="font-size:12px">${esc(o.apelidos || '—')}</td><td>${o.ativo ? badge('Ativo', '#16a34a') : badge('Inativo', '#6b7280')}</td>
        <td style="white-space:nowrap"><button class="btn btn-outline btn-sm" data-n="${esc(o.nome)}" onclick="Alarme.ficha(this.dataset.n)" style="margin-right:4px">Ficha</button><button class="btn btn-outline btn-sm" onclick="Alarme.editOp(${o.id})">Editar</button></td></tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--text-muted)">Nenhum operador cadastrado. Use "+ Adicionar" ou "Colar lista de nomes".</td></tr>'}
      </tbody></table></div></div>
      <div class="card" style="margin-top:16px"><div class="card-header"><div class="card-title">Feedbacks registrados</div><button class="btn btn-accent" onclick="Alarme.novoFeedback()">+ Registrar feedback</button></div>
      <div class="table-wrap table-scroll" style="max-height:480px"><table class="table"><thead><tr><th>Data</th><th>Operador</th><th>Tipo</th><th>Motivo</th><th>Origem</th><th>Por</th><th></th></tr></thead><tbody>
      ${ST.fb.length ? ST.fb.map(f => `<tr><td>${fmtD(f.data)}</td><td><b>${esc(f.operador)}</b></td><td>${badge(f.tipo, FB[f.tipo] || '#6b7280')}</td><td style="font-size:12.5px;max-width:420px">${esc(f.motivo)}</td><td style="font-size:12px">${esc(f.origem || '—')}</td><td style="font-size:12px">${esc(f.registrado_por || '—')}</td><td><button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="Alarme.excluirFb(${f.id})">Excluir</button></td></tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:22px;color:var(--text-muted)">Nenhum feedback registrado.</td></tr>'}
      </tbody></table></div></div>`;
  }
  function editOp(id) {
    const o = id ? ST.ops.find(x => x.id === id) : null;
    modal(o ? 'Editar integrante' : 'Adicionar integrante', `<input type="hidden" id="alm-o-id" value="${o ? o.id : ''}">
      <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="alm-o-nome" value="${esc(o && o.nome || '')}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Função</label><select class="form-input" id="alm-o-func">${FUNCOES.map(f => `<option ${o && o.funcao === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Turno</label><select class="form-input" id="alm-o-turno"><option value="">—</option>${TURNOS.map(t => `<option ${o && o.turno === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Equipe / escala</label><input class="form-input" id="alm-o-eq" value="${esc(o && o.equipe || '')}" placeholder="Ex.: A, B, 12x36"></div>
      </div>
      <div class="form-group"><label class="form-label">Como o nome aparece no Sigma (usuário), se for diferente</label><input class="form-input" id="alm-o-ap" value="${esc(o && o.apelidos || '')}" placeholder="Ex.: matheus.silva; MATHEUS S"><div style="font-size:11px;color:var(--text-muted);margin-top:4px">Separe por ponto e vírgula. Serve para ligar os eventos importados ao operador.</div></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="alm-o-ativo" ${!o || o.ativo ? 'checked' : ''}> Ativo</label>`,
      (o ? `<button class="btn btn-outline" style="color:var(--danger)" onclick="Alarme.excluirOp(${o.id})">Excluir</button>` : '') + `<button class="btn btn-accent" onclick="Alarme.salvarOp()">Salvar</button>`, 560);
  }
  async function salvarOp() {
    const id = $('alm-o-id').value, nome = $('alm-o-nome').value.trim().replace(/\s+/g, ' ');
    if (!nome) { toast('Preencha o nome.', true); return; }
    const obj = { nome, funcao: $('alm-o-func').value, turno: $('alm-o-turno').value || null, equipe: $('alm-o-eq').value.trim() || null, apelidos: $('alm-o-ap').value.trim() || null, ativo: $('alm-o-ativo').checked };
    try { if (id) await q(sb.from('alm_operadores').update(obj).eq('id', Number(id))); else await q(sb.from('alm_operadores').insert(obj)); toast('Salvo.'); fechar(); carregar(); }
    catch (e) { toast(/duplicate|unique/i.test(e.message) ? 'Já existe alguém com esse nome.' : 'Erro: ' + e.message, true); }
  }
  async function excluirOp(id) {
    if (!confirm('Excluir este integrante? (Para manter o histórico, prefira marcar como inativo.)')) return;
    try { await q(sb.from('alm_operadores').delete().eq('id', id)); fechar(); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }
  function colarEquipe() {
    modal('Colar lista de nomes', `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Um nome por linha. Opcional: separe por tabulação ou ";" a função e o turno — ex.: <code>Matheus; Líder; Dia</code>. Dá para copiar direto de uma planilha.</div>
      <textarea class="form-input" id="alm-cola" rows="12" style="resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px"></textarea>`,
      `<button class="btn btn-accent" onclick="Alarme.salvarColagem()">Cadastrar</button>`, 560);
  }
  async function salvarColagem() {
    const ex = new Set(ST.ops.map(o => nz(o.nome)));
    const rows = $('alm-cola').value.split(/\r?\n/).map(l => l.split(/\t|;/).map(s => s.trim())).filter(c => c[0]).map(c => {
      const f = FUNCOES.find(x => nz(x) === nz(c[1] || '')) || (/lider/.test(nz(c[1] || '')) ? 'Líder' : /superv/.test(nz(c[1] || '')) ? 'Supervisor' : 'Operador');
      const t = TURNOS.find(x => nz(x) === nz(c[2] || '')) || (/noit/.test(nz(c[2] || '')) ? 'Noite' : /dia/.test(nz(c[2] || '')) ? 'Dia' : null);
      return { nome: c[0].replace(/\s+/g, ' '), funcao: f, turno: t, ativo: true };
    }).filter(r => !ex.has(nz(r.nome)) && (ex.add(nz(r.nome)), true));
    if (!rows.length) { toast('Nenhum nome novo para cadastrar.', true); return; }
    try { await q(sb.from('alm_operadores').insert(rows)); toast(`${rows.length} integrante(s) cadastrado(s).`); fechar(); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }
  function novoFeedback(pre) {
    pre = pre || {};
    modal('Registrar feedback', `<input type="hidden" id="alm-f-origem" value="${esc(pre.origem || 'Gestor')}"><input type="hidden" id="alm-f-ref" value="${pre.ref_id || ''}">
      ${pre.origem ? `<div style="font-size:12.5px;background:var(--warning-dim);color:var(--warning);padding:10px 12px;border-radius:8px;margin-bottom:12px">Esta ${pre.origem === 'Auditoria' ? 'avaliação' : 'reclamação'} pede um retorno ao operador. Registre o feedback assim que conversar com ele.</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Operador *</label><select class="form-input" id="alm-f-op">${optsOps(pre.operador || '', null, 'Selecione')}</select></div>
        <div class="form-group"><label class="form-label">Tipo</label><select class="form-input" id="alm-f-tipo">${Object.keys(FB).map(t => `<option ${t === (pre.tipo || 'Orientação') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Data</label><input class="form-input" type="date" id="alm-f-data" value="${hoje()}"></div>
      </div>
      <div class="form-group"><label class="form-label">Motivo / o que foi conversado *</label><textarea class="form-input" id="alm-f-mot" rows="4" style="resize:vertical">${esc(pre.motivo || '')}</textarea></div>
      <div class="form-group"><label class="form-label">Registrado por</label><input class="form-input" id="alm-f-por" value="${esc(lsGet('alm_auditor', 'Pedro'))}"></div>`,
      `<button class="btn btn-accent" onclick="Alarme.salvarFb()">Registrar</button>`, 640);
  }
  async function salvarFb() {
    const op = $('alm-f-op').value, mot = $('alm-f-mot').value.trim();
    if (!op || !mot) { toast('Preencha operador e motivo.', true); return; }
    const origem = $('alm-f-origem').value, ref = Number($('alm-f-ref').value) || null;
    try {
      await q(sb.from('alm_feedbacks').insert({ operador: op, tipo: $('alm-f-tipo').value, data: $('alm-f-data').value || hoje(), motivo: mot, origem, ref_id: ref, registrado_por: $('alm-f-por').value.trim() || null }));
      if (ref && origem === 'Auditoria') await q(sb.from('alm_auditorias').update({ feedback_dado: true }).eq('id', ref));
      if (ref && origem === 'Reclamação') await q(sb.from('alm_reclamacoes').update({ feedback_dado: true }).eq('id', ref));
      toast('Feedback registrado.'); fechar(); carregar();
    } catch (e) { toast('Erro: ' + e.message, true); }
  }
  async function excluirFb(id) {
    if (!confirm('Excluir este feedback?')) return;
    try { await q(sb.from('alm_feedbacks').delete().eq('id', id)); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }
  function ficha(nome) {
    const o = ST.ops.find(x => x.nome === nome) || { nome };
    const aud = ST.aud.filter(a => a.operador === nome && a.status === 'Avaliada').sort((a, b) => String(b.avaliada_em).localeCompare(String(a.avaliada_em)));
    const rec = ST.rec.filter(r => r.operador === nome), fb = ST.fb.filter(f => f.operador === nome);
    const media = aud.length ? (aud.reduce((s, a) => s + Number(a.nota || 0), 0) / aud.length).toFixed(1) : '—';
    const tl = [
      ...aud.map(a => ({ d: String(a.avaliada_em || a.created_at).slice(0, 10), cor: a.falha_critica || Number(a.nota) < ST.metas.nota_minima ? '#dc2626' : '#16a34a', t: `Auditoria · nota ${Number(a.nota).toFixed(1)}${a.falha_critica ? ' · falha crítica' : ''}`, s: [a.cliente, a.evento, a.observacao].filter(Boolean).join(' · ') })),
      ...rec.map(r => ({ d: r.data, cor: PROC[r.procedente] || '#6b7280', t: `Reclamação · ${r.tipo} (${r.procedente})`, s: [r.cliente, r.causa].filter(Boolean).join(' · ') })),
      ...fb.map(f => ({ d: f.data, cor: FB[f.tipo] || '#6b7280', t: `Feedback · ${f.tipo}`, s: f.motivo }))
    ].sort((a, b) => b.d.localeCompare(a.d));
    modal(`Ficha · ${nome}`, `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px">${esc([o.funcao, o.turno && 'Turno ' + o.turno, o.equipe && 'Equipe ' + o.equipe].filter(Boolean).join(' · ') || 'Não cadastrado na equipe')} · últimos 6 meses</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        ${[['Auditorias', aud.length], ['Nota média', media], ['Reclamações proc.', rec.filter(r => r.procedente === 'Procedente').length], ['Elogios / advert.', `${fb.filter(f => f.tipo === 'Elogio').length} / ${fb.filter(f => /Advert|Suspens/.test(f.tipo)).length}`]].map(([l, v]) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px"><div style="font-size:11px;color:var(--text-muted)">${l}</div><div style="font-size:20px;font-weight:700">${v}</div></div>`).join('')}
      </div>
      ${tl.length ? tl.map(x => `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="width:8px;height:8px;border-radius:50%;background:${x.cor};margin-top:6px;flex:none"></span><div style="flex:1"><div style="font-size:13px"><b>${fmtD(x.d)}</b> · ${esc(x.t)}</div>${x.s ? `<div style="font-size:12px;color:var(--text-muted)">${esc(x.s)}</div>` : ''}</div></div>`).join('') : '<div style="color:var(--text-muted);font-size:13px">Sem registros ainda.</div>'}`,
      `<button class="btn btn-accent" data-n="${esc(nome)}" onclick="Alarme.novoFeedback({operador:this.dataset.n})">+ Feedback</button>`, 720);
  }

  // ---------------------------------------------------------------- IMPORTAR SIGMA
  const CAMPOS = [
    ['recebido', 'Data/hora de recepção do evento *', /recep|recebi|data do evento|data evento|^data$|data\/hora|ocorr/],
    ['iniciado', 'Início do atendimento (operador assumiu)', /^iniciado|inicio|in[ií]cio do atend|atendido em|em atendimento|assumid/],
    ['encerrado', 'Encerramento / finalização', /encerr|finaliz|fechamento|conclus|fechado/],
    ['operador', 'Operador / usuário', /operador|usuario|atendente|responsavel/],
    ['evento', 'Evento / descrição', /^evento|descri|tipo de evento|ocorrencia$/],
    ['conta', 'Código da conta', /codigo da conta|cod.*conta|^conta$|codigo conta/],
    ['cliente', 'Cliente (fantasia)', /fantasia|cliente|razao/],
    ['empresa', 'Empresa / filial', /^empresa|filial/],
    ['viatura', 'Viatura', /viatura/],
    ['deslocamento', 'Viatura deslocada em', /^deslocamento$|deslocamento iniciado|despach/],
    ['nolocal', 'Viatura no local em', /no local|chegada/],
    ['comentario', 'Comentário / log do operador', /coment|observ|log|historico|nota/]
  ];
  function rImportar() {
    const I = ST.importacao;
    const tipoNome = { eventos: 'Eventos atendidos', deslocamentos: 'Deslocamento de viaturas', contas: 'Contas com mais eventos' };
    let html = `<div class="card"><div class="card-header"><div class="card-title">Importar relatório do Sigma</div></div><div class="card-body" style="padding:16px">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Exporte o relatório do Sigma em Excel (.xlsx) ou CSV e solte aqui. A aba reconhece sozinha as colunas e você confere antes de gravar. Importar de novo o mesmo período não duplica eventos.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px;font-size:12.5px">
        <div style="border:1px solid var(--border);border-radius:10px;padding:10px"><b>Eventos atendidos</b><div style="color:var(--text-muted)">Relatório de eventos com <b>operador</b>, data de recepção e início do atendimento. Alimenta tempo de atendimento, SLA, desempenho por operador e o sorteio da auditoria.</div></div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:10px"><b>Deslocamento de viaturas</b><div style="color:var(--text-muted)">O mesmo que você já usa para a análise de deslocamentos. Entra como eventos (sem operador), com tempos de viatura.</div></div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:10px"><b>Contas com mais eventos</b><div style="color:var(--text-muted)">Alimenta a lista de contas reincidentes para manutenção remota.</div></div>
      </div>
      <label id="alm-drop" style="display:block;border:2px dashed var(--border);border-radius:12px;padding:26px;text-align:center;cursor:pointer;color:var(--text-muted)" ondragover="event.preventDefault();this.style.borderColor='var(--primary)'" ondragleave="this.style.borderColor=''" ondrop="event.preventDefault();this.style.borderColor='';Alarme.arquivo(event.dataTransfer.files[0])">
        <input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="Alarme.arquivo(this.files[0])">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary)">Clique ou arraste o arquivo aqui</div><div style="font-size:12px;margin-top:4px">.xlsx, .xls ou .csv exportado do Sigma</div></label>
      </div></div>`;
    if (I) {
      if (I.tipo === 'contas') {
        html += `<div class="card" style="margin-top:16px"><div class="card-header" style="flex-wrap:wrap;gap:8px"><div class="card-title">${esc(I.arquivo)} · ${tipoNome.contas}</div><div style="display:flex;gap:8px;align-items:center">
          <label style="font-size:12px">Período <input type="date" class="form-input" id="alm-i-ini" value="${I.ini || ''}" style="width:auto;display:inline-block;font-size:12px"> a <input type="date" class="form-input" id="alm-i-fim" value="${I.fim || ''}" style="width:auto;display:inline-block;font-size:12px"></label>
          <button class="btn btn-accent" onclick="Alarme.gravarImport()">Importar ${I.linhas.length.toLocaleString('pt-BR')} contas</button></div></div>
          <div class="table-wrap table-scroll" style="max-height:300px"><table class="table"><thead><tr><th>Empresa</th><th>Conta</th><th>Cliente</th><th style="text-align:right">Eventos</th></tr></thead><tbody>
          ${I.linhas.slice().sort((a, b) => b.qtd - a.qtd).slice(0, 10).map(l => `<tr><td>${esc(l.empresa)}</td><td>${esc(l.conta)}</td><td>${esc(l.cliente)}</td><td style="text-align:right">${l.qtd.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></div></div>`;
      } else {
        const prev = montarEventos(I, 6), st = I.stats || {};
        html += `<div class="card" style="margin-top:16px"><div class="card-header" style="flex-wrap:wrap;gap:8px"><div class="card-title">${esc(I.arquivo)} · ${tipoNome[I.tipo]}</div>
          <div style="display:flex;gap:8px;align-items:center"><span style="font-size:12px;color:var(--text-muted)">${I.rows.length.toLocaleString('pt-BR')} linhas · ${st.validos ?? '…'} com data válida · ${st.comOp ?? 0} com operador · ${st.comIni ?? 0} com início</span>
          <button class="btn btn-accent" id="alm-i-btn" onclick="Alarme.gravarImport()">Importar eventos</button></div></div>
          <div class="card-body" style="padding:14px 16px"><div style="font-size:12.5px;color:var(--text-muted);margin-bottom:8px">Confira de qual coluna vem cada informação:</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px 14px">
          ${CAMPOS.map(([k, l]) => `<div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:11.5px;color:var(--text-muted)">${l}</span><select class="form-input" style="font-size:12px" onchange="Alarme.mapear('${k}', this.value)"><option value="">— não tem —</option>${I.cab.map((c, i) => `<option value="${i}" ${I.map[k] === i ? 'selected' : ''}>${esc(c || 'Coluna ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}
          </div></div>
          <div class="table-wrap table-scroll"><table class="table"><thead><tr><th>Recebido</th><th>Conta / cliente</th><th>Evento</th><th>Tipo</th><th>Operador</th><th style="text-align:right">Até o atendimento</th></tr></thead><tbody>
          ${prev.length ? prev.map(e => `<tr><td style="white-space:nowrap">${fmtDH(e.recebido_em)}</td><td>${esc(e.conta || '')} <b>${esc(e.cliente || '')}</b></td><td style="font-size:12px">${esc(e.evento || '')}</td><td>${badge(e.categoria, CAT_COR[e.categoria])}</td><td>${esc(e.operador || '—')}</td><td style="text-align:right">${fmtS(e.t_resposta_s)}</td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--danger)">Nenhuma linha com data de recepção válida. Ajuste a coluna "Data/hora de recepção".</td></tr>'}
          </tbody></table></div></div>`;
      }
    }
    html += `<div class="card" style="margin-top:16px"><div class="card-header"><div class="card-title">Importações feitas</div></div><div class="table-wrap table-scroll" style="max-height:360px"><table class="table"><thead><tr><th>Quando</th><th>Tipo</th><th>Arquivo</th><th>Período</th><th style="text-align:right">Linhas</th><th></th></tr></thead><tbody>
      ${ST.imps.length ? ST.imps.map(i => `<tr><td>${fmtDH(i.created_at)}</td><td>${esc(tipoNome[i.tipo] || i.tipo)}</td><td style="font-size:12px">${esc(i.arquivo || '')}</td><td>${fmtD(i.periodo_ini)} a ${fmtD(i.periodo_fim)}</td><td style="text-align:right">${(i.linhas || 0).toLocaleString('pt-BR')}</td><td><button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="Alarme.excluirImp(${i.id})">Desfazer</button></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--text-muted)">Nenhuma importação ainda.</td></tr>'}
      </tbody></table></div></div>`;
    return html;
  }
  function carregarXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((ok, err) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = ok; s.onerror = () => err(new Error('não foi possível carregar o leitor de Excel')); document.head.appendChild(s); });
  }
  function paraData(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return new Date(d.getTime() + d.getTimezoneOffset() * 6e4); }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d+))?)?/);
    if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return new Date(y, m[2] - 1, m[1], m[4] || 0, m[5] || 0, m[6] || 0); }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(m[1], m[2] - 1, m[3], m[4] || 0, m[5] || 0, m[6] || 0);
    return null;
  }
  const limpa = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  async function arquivo(f) {
    if (!f) return;
    try {
      toast('Lendo ' + f.name + '...');
      await carregarXLSX();
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: /\.(csv|txt)$/i.test(f.name), codepage: 65001 });
      let melhor = null;
      for (const nome of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: '' });
        // linha de cabeçalho = primeira das 20 primeiras com 3+ textos
        let hi = rows.slice(0, 20).findIndex(r => r.filter(c => typeof c === 'string' && c.trim() && isNaN(c)).length >= 3);
        if (hi < 0) continue;
        if (!melhor || rows.length > melhor.rows.length) melhor = { cab: rows[hi].map(c => limpa(c)), rows: rows.slice(hi + 1).filter(r => r.some(c => c !== '' && c != null)) };
      }
      if (!melhor) { toast('Não encontrei uma tabela nesse arquivo.', true); return; }
      const cabN = melhor.cab.map(nz);
      const iQtd = cabN.findIndex(c => /quantidade de eventos|qtd.*eventos|total de eventos/.test(c));
      const iPer = cabN.findIndex(c => /^\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}$/.test(c));
      if (iQtd >= 0 || iPer >= 0) {
        const col = iQtd >= 0 ? iQtd : iPer, fc = re => cabN.findIndex(c => re.test(c));
        const iEmp = fc(/^empresa/), iConta = fc(/codigo conta|codigo da conta|^conta$/), iCli = fc(/fantasia/) >= 0 ? fc(/fantasia/) : fc(/razao/);
        let ini = '', fim = '';
        const per = (iPer >= 0 ? melhor.cab[iPer] : f.name).match(/(\d{2})[_\/.-](\d{2})[_\/.-](\d{4}).*?(\d{2})[_\/.-](\d{2})[_\/.-](\d{4})/);
        if (per) { ini = `${per[3]}-${per[2]}-${per[1]}`; fim = `${per[6]}-${per[5]}-${per[4]}`; }
        const linhas = melhor.rows.map(r => ({ empresa: limpa(r[iEmp]), conta: limpa(r[iConta]), cliente: limpa(r[iCli]), qtd: Number(r[col]) || 0 })).filter(l => l.conta && l.qtd > 0);
        ST.importacao = { tipo: 'contas', arquivo: f.name, linhas, ini, fim };
      } else {
        const map = {};
        CAMPOS.forEach(([k, , re]) => { const i = cabN.findIndex((c, idx) => re.test(c) && !Object.values(map).includes(idx)); if (i >= 0) map[k] = i; });
        const tipo = cabN.some(c => /viatura/.test(c)) && map.operador == null ? 'deslocamentos' : 'eventos';
        ST.importacao = { tipo, arquivo: f.name, cab: melhor.cab, rows: melhor.rows, map };
        calcStats();
      }
      ST.aba = 'importar'; render();
    } catch (e) { toast('Erro ao ler o arquivo: ' + e.message, true); }
  }
  function mapear(k, v) { const I = ST.importacao; if (!I) return; if (v === '') delete I.map[k]; else I.map[k] = Number(v); calcStats(); render(); }
  function montarEventos(I, limite) {
    const M = I.map, out = [], g = (r, k) => M[k] == null ? null : r[M[k]];
    for (const r of I.rows) {
      const rec = paraData(g(r, 'recebido')); if (!rec) continue;
      const ini = paraData(g(r, 'iniciado')), enc = paraData(g(r, 'encerrado'));
      const evento = limpa(g(r, 'evento')), op = limpa(g(r, 'operador'));
      const conta = limpa(g(r, 'conta')).replace(/\s*\(.*$/, ''), cliente = limpa(g(r, 'cliente')).replace(/\s*\([^()]*\)\s*$/, ''), empresa = limpa(g(r, 'empresa')).replace(/\s*\(.*$/, '');
      const tr = ini ? Math.round((ini - rec) / 1000) : null;
      out.push({ chave: [conta, rec.toISOString(), nz(evento).slice(0, 60), nz(op)].join('|'), empresa: empresa || null, conta: conta || null, cliente: cliente || null, evento: evento || null, categoria: categoria(evento),
        operador: op ? opNome(op) : null, recebido_em: rec.toISOString(), iniciado_em: ini ? ini.toISOString() : null, encerrado_em: enc ? enc.toISOString() : null,
        viatura: limpa(g(r, 'viatura')) || null, deslocamento_em: (paraData(g(r, 'deslocamento')) || null) && paraData(g(r, 'deslocamento')).toISOString(), no_local_em: (paraData(g(r, 'nolocal')) || null) && paraData(g(r, 'nolocal')).toISOString(),
        t_resposta_s: tr != null && tr >= 0 ? tr : null, t_total_s: enc ? Math.max(0, Math.round((enc - rec) / 1000)) : null,
        comentario: M.comentario == null ? null : limpa(g(r, 'comentario')).slice(0, 2000) });
      if (limite && out.length >= limite) break;
    }
    return out;
  }
  function calcStats() { const I = ST.importacao, L = montarEventos(I); I.stats = { validos: L.length, comOp: L.filter(e => e.operador).length, comIni: L.filter(e => e.t_resposta_s != null).length }; }
  async function gravarImport() {
    const I = ST.importacao; if (!I) return;
    const btn = $('alm-i-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Importando...'; }
    try {
      if (I.tipo === 'contas') {
        const ini = $('alm-i-ini').value || null, fim = $('alm-i-fim').value || null;
        const lote = await q(sb.from('alm_importacoes').insert({ tipo: 'contas', arquivo: I.arquivo, periodo_ini: ini, periodo_fim: fim, linhas: I.linhas.length }).select('id').single());
        for (let i = 0; i < I.linhas.length; i += 500) await q(sb.from('alm_contas_eventos').insert(I.linhas.slice(i, i + 500).map(l => Object.assign({ lote_id: lote.id, periodo_ini: ini, periodo_fim: fim }, l))));
        toast(`${I.linhas.length.toLocaleString('pt-BR')} contas importadas.`);
      } else {
        const L = montarEventos(I); if (!L.length) { toast('Nada para importar: confira a coluna de data de recepção.', true); return; }
        const dedup = [...new Map(L.map(e => [e.chave, e])).values()];
        const datas = dedup.map(e => e.recebido_em).sort();
        const dia = iso => new Date(iso).toLocaleDateString('en-CA');
        const lote = await q(sb.from('alm_importacoes').insert({ tipo: I.tipo, arquivo: I.arquivo, periodo_ini: dia(datas[0]), periodo_fim: dia(datas[datas.length - 1]), linhas: dedup.length }).select('id').single());
        for (let i = 0; i < dedup.length; i += 500) {
          if (btn) btn.textContent = `Importando ${Math.min(i + 500, dedup.length).toLocaleString('pt-BR')}/${dedup.length.toLocaleString('pt-BR')}...`;
          await q(sb.from('alm_eventos').upsert(dedup.slice(i, i + 500).map(e => Object.assign({ lote_id: lote.id }, e)), { onConflict: 'chave', ignoreDuplicates: true }));
        }
        const semOp = [...new Set(dedup.map(e => e.operador).filter(n => n && !ST.ops.some(o => o.nome === n)))];
        toast(`${dedup.length.toLocaleString('pt-BR')} eventos importados.${semOp.length ? ` ${semOp.length} operador(es) do Sigma ainda não cadastrados.` : ''}`);
        if (semOp.length) ST._semOp = semOp;
      }
      ST.importacao = null; await carregar();
      if (ST._semOp && ST._semOp.length) { const n = ST._semOp; ST._semOp = null; sugerirCadastro(n); }
    } catch (e) { toast('Erro ao importar: ' + e.message, true); if (btn) { btn.disabled = false; btn.textContent = 'Importar eventos'; } }
  }
  function sugerirCadastro(nomes) {
    modal('Operadores encontrados no Sigma', `<div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Estes nomes apareceram no relatório e não estão na equipe. Marque os que devem ser cadastrados (se algum for o mesmo de um cadastrado com outro nome, adicione o nome do Sigma em "Como aparece no Sigma" no cadastro dele).</div>
      ${nomes.map(n => `<label style="display:flex;gap:8px;align-items:center;font-size:13px;padding:4px 0"><input type="checkbox" class="alm-sug" value="${esc(n)}" checked>${esc(n)}</label>`).join('')}`,
      `<button class="btn btn-accent" onclick="Alarme.cadastrarSug()">Cadastrar como operadores</button>`, 520);
  }
  async function cadastrarSug() {
    const rows = [...document.querySelectorAll('.alm-sug:checked')].map(c => ({ nome: c.value, funcao: 'Operador', ativo: true }));
    if (!rows.length) { fechar(); return; }
    try { await q(sb.from('alm_operadores').insert(rows)); toast(`${rows.length} operador(es) cadastrado(s).`); fechar(); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }
  async function excluirImp(id) {
    if (!confirm('Desfazer esta importação? Os eventos dela serão apagados (auditorias já feitas ficam).')) return;
    try { await q(sb.from('alm_importacoes').delete().eq('id', id)); toast('Importação desfeita.'); carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }

  // ---------------------------------------------------------------- METAS
  function rMetas() {
    const m = ST.metas, inp = (k, l, sub, suf) => `<div class="form-group"><label class="form-label">${l}</label><div style="display:flex;align-items:center;gap:6px"><input class="form-input" type="number" min="0" id="alm-m-${k}" value="${m[k]}" style="max-width:120px"><span style="font-size:12px;color:var(--text-muted)">${suf}</span></div><div style="font-size:11px;color:var(--text-muted);margin-top:3px">${sub}</div></div>`;
    return `<div class="card"><div class="card-header"><div class="card-title">Metas e padrões do monitoramento</div><button class="btn btn-accent" onclick="Alarme.salvarMetas()">Salvar metas</button></div><div class="card-body" style="padding:16px">
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">Tempo máximo entre a chegada do evento e o início do atendimento pelo operador (SLA), por tipo de evento. Esses números definem o "% no SLA" do painel e entram na avaliação de cada operador.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px">
        ${inp('sla_critico', 'SLA eventos críticos', 'pânico, coação, emergência, incêndio', 'segundos')}
        ${inp('sla_alarme', 'SLA alarmes / disparos', 'disparo de zona, invasão, violação', 'segundos')}
        ${inp('sla_tecnico', 'SLA eventos técnicos', 'falha de comunicação, bateria, energia, tamper', 'segundos')}
        ${inp('sla_outros', 'SLA demais eventos', 'rondas, chamados, outros', 'segundos')}
        ${inp('tma_meta', 'Meta de tempo médio geral', 'referência para o card do painel', 'segundos')}
        ${inp('amostras_semana', 'Auditorias por operador', 'quantos eventos auditar por semana', 'por semana')}
        ${inp('nota_minima', 'Nota mínima de qualidade', 'abaixo disso pede feedback', 'de 0 a 10')}
      </div></div></div>`;
  }
  async function salvarMetas() {
    const v = {}; Object.keys(METAS_PADRAO).forEach(k => { const el = $('alm-m-' + k); v[k] = el && el.value !== '' ? Number(el.value) : METAS_PADRAO[k]; });
    try { await q(sb.from('alm_config').upsert({ chave: 'metas', valor: v, updated_at: new Date().toISOString() })); toast('Metas salvas.'); await carregar(); } catch (e) { toast('Erro: ' + e.message, true); }
  }

  // ---------------------------------------------------------------- init
  window.Alarme = { aba, periodo: setPeriodo, carregar, fechar, exportarOps, copiarReinc, ficha,
    novoTurno, salvarTurno, lerTurno, copiarLinkTurno,
    semana: mudarSemana, sortear, novaAuditoria, avaliar, calcNota, salvarAud, excluirAud, feedbackAud,
    novaRec, salvarRec, resolverRec, excluirRec, filtroRec,
    editOp, salvarOp, excluirOp, colarEquipe, salvarColagem, novoFeedback, salvarFb, excluirFb,
    arquivo, mapear, gravarImport, excluirImp, cadastrarSug, salvarMetas };
  function iniciar() {
    montar();
    const espera = () => { if (typeof sb !== 'undefined' && sb) carregar(); else setTimeout(espera, 800); };
    espera();
    if (location.hash === '#alarme' && typeof showSection === 'function') setTimeout(() => showSection('alarme', true), 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
