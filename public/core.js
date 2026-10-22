// ===== SUPABASE CONFIG =====
const DEFAULT_SB_URL = 'https://fxmdsumcqukxuzooiiju.supabase.co';
const DEFAULT_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4bWRzdW1jcXVreHV6b29paWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTcyNjAsImV4cCI6MjA4ODk5MzI2MH0.qEKKHqvJAt_5Bsk9V5uBI1eN27eWu1wiFhHoFbpI2lo';
let sb = null;
let lastLoadAt = 0;
let DATA = { fornecedores: [], torres: [], iaFilial: [], iaProvedor: [], armResumo: [], armDetail: [], boletos: [], iaDetail: [], fornHistorico: [], demandas: [], condominios: [], checklists: [], seguros: [], cidadesFilial: [] };

function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('backoffice_sb_config') || 'null');
    if (saved && saved.url && saved.key) return saved;
  } catch(e) {}
  return { url: DEFAULT_SB_URL, key: DEFAULT_SB_KEY };
}

function saveConfig() {
  const url = document.getElementById('cfg-url').value.trim();
  const key = document.getElementById('cfg-key').value.trim();
  if (!url || !key) { showToast('Preencha URL e Key', true); return; }
  localStorage.setItem('backoffice_sb_config', JSON.stringify({ url, key }));
  initSupabase();
}

async function testConnection() {
  const s = document.getElementById('cfg-status');
  s.textContent = 'Testando...';
  s.style.color = 'var(--text-muted)';
  try {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();
    const client = window.supabase.createClient(url, key);
    const { data, error } = await client.from('torres').select('id', { count: 'exact', head: true });
    if (error) throw error;
    s.innerHTML = '<span style="color:var(--accent)">Conexão OK! Tabela torres encontrada.</span>';
  } catch(e) {
    s.innerHTML = '<span style="color:var(--danger)">Erro: ' + e.message + '</span>';
  }
}

async function initSupabase() {
  const cfg = getConfig();
  document.getElementById('cfg-url').value = cfg.url;
  document.getElementById('cfg-key').value = cfg.key;
  try {
    sb = window.supabase.createClient(cfg.url, cfg.key);
    await refreshAuth();
    sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && boAdmin) setTimeout(() => applyAuth(false), 0); });
    // abre direto na aba do link (#torres etc.) e carrega só o que ela precisa
    await showSection(sectionFromHash(), true);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('sync-dot').classList.remove('offline');
    setSyncLabel();
    startRealtime();
  } catch(e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('sync-dot').classList.add('offline');
    document.getElementById('sync-label').textContent = 'Erro de conexão';
    showToast('Erro ao conectar: ' + e.message, true);
    showSection('config');
  }
}

// ===== CARREGAMENTO POR ABA =====
// tabela do Supabase -> chave em DATA
const TABLE_KEYS = {
  fornecedores:'fornecedores', torres:'torres', clientes_ia_filial:'iaFilial', clientes_ia_provedor:'iaProvedor',
  armarios_resumo:'armResumo', armarios_detail:'armDetail', boletos:'boletos', clientes_ia_detail:'iaDetail',
  fornecedores_historico:'fornHistorico', demandas_equipe:'demandas', dem_tasks:'demTasks', condominios_portaria:'condominios',
  checklist_portaria:'checklists', solicitacoes_seguro:'seguros', cidades_filial:'cidadesFilial',
};
// o que cada aba precisa para montar a tela
const SECTION_TABLES = {
  dashboard:    ['fornecedores','torres','clientes_ia_filial','armarios_resumo','dem_tasks','checklist_portaria','condominios_portaria','solicitacoes_seguro'],
  fornecedores: ['fornecedores','boletos','fornecedores_historico'],
  torres:       ['torres','cidades_filial','clientes_ia_filial','armarios_resumo'],
  clientes:     ['clientes_ia_detail','clientes_ia_filial','clientes_ia_provedor'],
  armarios:     ['armarios_resumo','armarios_detail'],
  demandas:     ['demandas_equipe'],
  checklist:    ['checklist_portaria','condominios_portaria'],
  seguros:      ['solicitacoes_seguro'],
  config:       [],
};
const SECTION_RENDER = {
  dashboard: () => renderDashboard(), fornecedores: () => renderFornSection(), torres: () => renderTorres(),
  clientes: () => renderIA(), armarios: () => renderArmarios(), demandas: () => renderDemandas(),
  checklist: () => renderChecklist(), seguros: () => renderSeguros(), config: () => {},
};
const loadedTables = new Set();   // tabelas já em memória
const dirtySections = new Set(Object.keys(SECTION_TABLES)); // abas que precisam ser redesenhadas
let currentSection = 'dashboard';

async function loadTables(names, force) {
  const need = [...new Set(names)].filter(n => (boAdmin || !FORN_TABLES.includes(n)) && (force || !loadedTables.has(n)));
  if (!need.length) return [];
  const results = await Promise.all(need.map(t => sb.from(t).select('*')));
  const errors = [];
  need.forEach((t, i) => {
    const r = results[i];
    if (r.error) { errors.push(t + ': ' + r.error.message); return; }
    DATA[TABLE_KEYS[t]] = r.data || [];
    loadedTables.add(t);
  });
  // marca para redesenho toda aba que usa alguma tabela que mudou
  Object.entries(SECTION_TABLES).forEach(([sec, tbs]) => { if (tbs.some(t => need.includes(t))) dirtySections.add(sec); });
  updateNavBadges();
  lastLoadAt = Date.now();
  if (errors.length) {
    if (errors.length === need.length && /fetch|network/i.test(errors[0])) throw new Error('Sem conexão com o Supabase');
    showToast('Erro ao carregar ' + errors[0], true);
  }
  return need;
}

// desenha uma aba isolando erros: se ela falhar, o resto do painel continua funcionando
function safeRender(sec) {
  const el = document.getElementById('sec-' + sec);
  const old = el && el.querySelector(':scope > .section-error'); if (old) old.remove();
  try { SECTION_RENDER[sec] && SECTION_RENDER[sec](); dirtySections.delete(sec); }
  catch (e) {
    console.error('[' + sec + ']', e);
    if (el) el.insertAdjacentHTML('afterbegin', `<div class="section-error"><b>Esta aba não pôde ser exibida.</b> As outras abas continuam funcionando.<br><small>${String(e.message || e).replace(/</g,'&lt;')}</small><button class="btn btn-outline btn-sm" onclick="refreshData()">Tentar novamente</button></div>`);
  }
}

async function ensureSection(sec) {
  const el = document.getElementById('sec-' + sec);
  const tbs = SECTION_TABLES[sec] || [];
  const firstLoad = tbs.some(t => !loadedTables.has(t));
  if (firstLoad && el) el.classList.add('is-loading');
  try { await loadTables(tbs); }
  finally { if (el) el.classList.remove('is-loading'); }
  if (sec === currentSection && dirtySections.has(sec)) safeRender(sec);
  // tabela que falhou: avisa na própria aba para os zeros não parecerem dados reais
  const faltando = tbs.filter(t => !loadedTables.has(t) && (boAdmin || !FORN_TABLES.includes(t)));
  if (el && faltando.length && !el.querySelector(':scope > .section-error')) {
    el.insertAdjacentHTML('afterbegin', `<div class="section-error"><b>Parte dos dados não carregou (${faltando.join(', ')}).</b> Os números desta aba podem estar incompletos.<button class="btn btn-outline btn-sm" onclick="refreshData()">Tentar novamente</button></div>`);
  }
}

function setSyncLabel(txt) {
  document.getElementById('sync-label').textContent = txt || ('Atualizado ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
}

// botão "Atualizar" e após salvar: recarrega só as tabelas já abertas nesta sessão
async function refreshData() {
  if (!sb) { showSection('config'); return; }
  setSyncLabel('Atualizando...');
  try {
    await loadTables([...loadedTables, ...(SECTION_TABLES[currentSection] || [])], true);
    document.getElementById('sync-dot').classList.remove('offline');
    setSyncLabel();
    safeRender(currentSection);
    showToast('Dados atualizados!');
  } catch(e) {
    setSyncLabel('Erro');
    document.getElementById('sync-dot').classList.add('offline');
    showToast('Erro: ' + e.message, true);
  }
}

// ===== ACESSO RESTRITO: FORNECEDORES (login do gestor) =====
// A proteção real está no banco (RLS): sem login de gestor o Supabase não devolve essas tabelas.
const FORN_TABLES = ['fornecedores','boletos','fornecedores_historico'];
let boAdmin = false, boEmail = null;
async function refreshAuth() {
  boAdmin = false; boEmail = null;
  try {
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    if (s) {
      boEmail = s.user && s.user.email;
      const r = await sb.rpc('bo_is_admin');
      boAdmin = r.data === true;
    }
  } catch (e) { boAdmin = false; }
  paintAuth();
  return boAdmin;
}
function paintAuth() {
  const nav = document.querySelector('[data-section="fornecedores"]');
  if (nav) {
    let lk = nav.querySelector('.nav-lock');
    if (!boAdmin && !lk) nav.insertAdjacentHTML('beforeend', '<svg class="nav-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Restrito"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>');
    if (boAdmin && lk) lk.remove();
  }
  const foot = document.querySelector('.sidebar-footer');
  let out = document.getElementById('auth-out');
  if (boAdmin && foot && !out) foot.insertAdjacentHTML('afterbegin', '<button id="auth-out" class="auth-out" onclick="sairGestor()" title="Sair do acesso de gestor"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Sair do acesso de gestor</span></button>');
  if (!boAdmin && out) out.remove();
}
async function applyAuth(admin) {
  boAdmin = admin; paintAuth();
  if (!admin) {
    boEmail = null;
    FORN_TABLES.forEach(t => { loadedTables.delete(t); DATA[TABLE_KEYS[t]] = []; });
    Object.keys(SECTION_TABLES).forEach(k => dirtySections.add(k));
  } else {
    await loadTables(FORN_TABLES, true);
  }
  safeRender(currentSection);
}
function renderFornSection() {
  const sec = document.getElementById('sec-fornecedores');
  sec.classList.toggle('locked', !boAdmin);
  let lock = document.getElementById('forn-lock');
  if (boAdmin) { if (lock) lock.remove(); renderFornecedores(); return; }
  if (lock) return;
  sec.insertAdjacentHTML('afterbegin', `<div class="lock-panel" id="forn-lock">
    <div class="lock-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div>
    <h3>Área restrita ao gestor</h3>
    <p>Fornecedores, pagamentos, boletos e notas só aparecem para quem entra com o acesso de gestor.</p>
    <form onsubmit="event.preventDefault();entrarGestor()" autocomplete="on">
      <label class="form-label" for="lk-email">E-mail</label>
      <input class="form-input" id="lk-email" type="email" autocomplete="username" required>
      <label class="form-label" for="lk-senha" style="margin-top:10px">Senha</label>
      <input class="form-input" id="lk-senha" type="password" autocomplete="current-password" required>
      <div class="lock-err" id="lk-err" role="alert"></div>
      <button class="btn btn-accent" id="lk-btn" type="submit" style="width:100%;margin-top:12px">Entrar</button>
    </form></div>`);
}
async function entrarGestor() {
  const err = document.getElementById('lk-err'), btn = document.getElementById('lk-btn');
  const email = document.getElementById('lk-email').value.trim(), senha = document.getElementById('lk-senha').value;
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    if (!(await refreshAuth())) { await sb.auth.signOut(); throw new Error('Este usuário não tem acesso à área de fornecedores.'); }
    document.getElementById('lk-senha').value = '';
    await applyAuth(true);
    showToast('Acesso de gestor liberado');
  } catch (e) {
    err.textContent = /invalid login/i.test(e.message || '') ? 'E-mail ou senha incorretos.' : (e.message || 'Não foi possível entrar.');
  } finally { if (document.getElementById('lk-btn')) { btn.disabled = false; btn.textContent = 'Entrar'; } }
}
async function sairGestor() {
  try { await sb.auth.signOut(); } catch (e) {}
  await applyAuth(false);
  showToast('Você saiu do acesso de gestor');
}

// ===== HELPERS =====
function fmtVal(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
function fmtK(v) { return v >= 1000 ? (v/1000).toFixed(1) + 'k' : Number(v).toFixed(2); }
function showToast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('bad', !!err);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== NAVIGATION =====
const titles = {
  dashboard: ['Dashboard','Visao geral'],
  fornecedores: ['Fornecedores','Softwares, links e servicos de TI'],
  torres: ['Torres','Acompanhamento de torres Servis'],
  clientes: ['Clientes IA','Bonificação e inteligência artificial'],
  armarios: ['Armários','Controle de armários por filial'],
  demandas: ['Demandas','Acompanhamento de demandas da equipe'],
  checklist: ['Checklist Portaria','Verificacao semanal dos condominios'],
  seguros: ['Seguros','Solicitacoes de seguro'],
  config: ['Configuracoes','Supabase e preferencias'],
};

function toggleNavGroup(btn) { btn.parentElement.classList.toggle('open'); }
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  sb.classList.toggle('collapsed');
}
function updateNavBadges() {
  const set = (id, txt, alert) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = txt;
    el.classList.toggle('alert', !!alert);
    el.style.display = txt === '' || txt === '0' ? 'none' : '';
  };
  // só mostra o número quando a tabela já foi carregada (evita "0" enganoso)
  set('badge-torres', loadedTables.has('torres') ? String((DATA.torres || []).length) : '');
  set('badge-armarios', loadedTables.has('armarios_resumo') ? String((DATA.armResumo || []).reduce((s, d) => s + Number(d.cadastrados || 0), 0)) : '');
  const pend = (DATA.seguros || []).filter(s => s.status === 'Pendente').length;
  set('badge-seguros', pend ? String(pend) : '', pend > 0);
}
function showSection(id, fromHash) {
  if (id === 'demandas') { location.href = 'demandas.html'; return Promise.resolve(); }
  if (!titles[id] || !document.getElementById('sec-' + id)) id = 'dashboard';
  if (!fromHash && location.hash !== '#' + id) { try { history.pushState(null, '', '#' + id); } catch(e) { location.hash = id; } }
  document.querySelector('.main') && document.querySelector('.main').scrollTo(0, 0);
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  const nav = document.querySelector('[data-section="'+id+'"]');
  if (nav) nav.classList.add('active');
  const grp = nav ? nav.closest('.nav-group') : null;
  if (grp) grp.classList.add('open');
  document.getElementById('page-title').textContent = titles[id][0];
  document.getElementById('page-subtitle').textContent = titles[id][1];
  currentSection = id;
  if (!sb) return Promise.resolve();
  return ensureSection(id).catch(e => { showToast('Erro ao carregar: ' + e.message, true); setSyncLabel('Erro'); document.getElementById('sync-dot').classList.add('offline'); });
}

// ===== SVG CHARTS =====
function hBar(container, data, colors) {
  if (!data.length) return;
  const maxVal = Math.max(...data.map(d => d.v));
  const barH = 28, gap = 8, labelW = 120, chartW = 380;
  const h = data.length * (barH + gap) + 10;
  let svg = `<svg width="100%" viewBox="0 0 ${labelW + chartW + 80} ${h}" style="display:block;max-width:100%">`;
  data.forEach((d, i) => {
    const y = i * (barH + gap) + 4;
    const w = maxVal > 0 ? (d.v / maxVal) * chartW : 0;
    const c = colors[i % colors.length];
    svg += `<g class="chart-bar-group">`;
    svg += `<text x="${labelW - 8}" y="${y + barH/2 + 4}" text-anchor="end" fill="var(--text-secondary)" font-size="11" font-family="Inter,sans-serif">${d.l}</text>`;
    svg += `<rect x="${labelW}" y="${y}" width="${Math.max(w, 2)}" height="${barH}" rx="4" fill="${c}"/>`;
    svg += `<text x="${labelW + w + 8}" y="${y + barH/2 + 4}" fill="var(--text-primary)" font-size="11" font-weight="600" font-family="Inter,sans-serif">${d.t}</text>`;
    svg += `</g>`;
  });
  svg += `</svg>`;
  const el = document.getElementById(container);
  if (el) el.innerHTML = svg;
}

// ===== KPI CARD PADRÃO =====
const KPI_ICONS = {
  list: '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  play: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
  check: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  alert: '<path d="M12 2l10 18H2z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="16" r="0.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  history: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>',
};
const KPI_COLORS = {
  accent: ['var(--accent)', 'var(--accent-dim)'], blue: ['var(--blue)', 'var(--blue-dim)'],
  warning: ['var(--warning)', 'var(--warning-dim)'], danger: ['var(--danger)', 'var(--danger-dim)'],
  neutral: ['var(--text-secondary)', 'rgba(138,155,181,0.12)'],
};
function kpiCard({ label, value, sub = '', tag = '', tagCls = 'kpi-tag-neutral', color = 'neutral', icon = 'list', go = '', small = false }) {
  const [c, cd] = KPI_COLORS[color] || KPI_COLORS.neutral;
  return `<div class="kpi-card${go ? ' clickable' : ''}"${go ? ` onclick="showSection('${go}')"` : ''}>
    <div class="kpi-card-stripe" style="background:${c}"></div>
    <div class="kpi-card-icon" style="background:${cd}"><svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2">${KPI_ICONS[icon] || ''}</svg></div>
    <div class="kpi-label">${label}</div><div class="kpi-value" style="color:${color === 'neutral' ? 'var(--text-primary)' : c}${small ? ';font-size:22px' : ''}">${value}</div>
    <div class="kpi-sub">${tag ? `<span class="kpi-tag ${tagCls}">${tag}</span>` : ''} ${sub}</div></div>`;
}

function statusBadge(st) {
  const v = (st || '').toLowerCase();
  if (/^conclu|^aprovad/.test(v)) return 'badge-success';
  if (/^pendente/.test(v)) return 'badge-warning';
  if (/^em (andamento|an[aá]lise)/.test(v)) return 'badge-blue';
  if (/^negad|^cancel/.test(v)) return 'badge-danger';
  return 'badge-neutral';
}

// ===== OPERAÇÕES (Demandas / Checklist / Seguros) =====
function opsStats() {
  const D = (DATA.demTasks || []).filter(x => !x.arquivada && !x.is_demo), S = DATA.seguros || [], C = DATA.checklists || [];
  const demAberta = x => x.status !== 'concluida' && x.status !== 'cancelada';
  const demPend = D.filter(x => x.status === 'nao_iniciada').length;
  const demAnd = D.filter(x => demAberta(x) && x.status !== 'nao_iniciada').length;
  const demConc = D.filter(x => x.status === 'concluida').length;
  const demAtras = D.filter(x => demAberta(x) && x.prazo && (diasAte(String(x.prazo).slice(0,10)) ?? 0) < 0).length;
  const segPend = S.filter(x => x.status === 'Pendente').length;
  const segAnal = S.filter(x => /^em an[aá]lise$/i.test(x.status || '')).length;
  const segAprov = S.filter(x => x.status === 'Aprovado').length;
  const segAbertoValor = S.filter(x => x.status === 'Pendente' || /^em an[aá]lise$/i.test(x.status || '')).reduce((s, x) => s + Number(x.valor || 0), 0);
  const dates = [...new Set(C.map(c => c.data_checklist).filter(Boolean))].sort().reverse();
  const last = dates[0] || null;
  const lastChecks = last ? C.filter(c => c.data_checklist === last) : [];
  const chkOk = lastChecks.filter(c => c.todas_gravando_dvr && c.central_alarme_comunicando).length;
  const chkProb = lastChecks.length - chkOk;
  const diasChk = last ? -diasAte(last) : null;
  const condAtivos = (DATA.condominios || []).filter(c => c.ativo !== false).length;
  return { D, S, demPend, demAnd, demConc, demAtras, segPend, segAnal, segAprov, segAbertoValor, dates, last, lastChecks, chkOk, chkProb, diasChk, condAtivos };
}
function opsAlerts() {
  const o = opsStats(); const a = [];
  if (o.segPend) a.push({cls:'red', go:'seguros', txt:`${o.segPend} seguro${o.segPend>1?'s':''} pendente${o.segPend>1?'s':''}`});
  if (o.chkProb) a.push({cls:'orange', go:'checklist', txt:`${o.chkProb} condomínio${o.chkProb>1?'s':''} com falha no último checklist`});
  if (o.diasChk !== null && o.diasChk > 7) a.push({cls:'amber', go:'checklist', txt:`Checklist de portaria atrasado (${o.diasChk} dias)`});
  if (o.demAtras) a.push({cls:'red', go:'demandas', txt:`${o.demAtras} demanda${o.demAtras>1?'s':''} atrasada${o.demAtras>1?'s':''}`});
  if (o.demPend) a.push({cls:'amber', go:'demandas', txt:`${o.demPend} demanda${o.demPend>1?'s':''} não iniciada${o.demPend>1?'s':''}`});
  return a;
}
function renderDashOps() {
  const el = document.getElementById('dash-kpis-ops'); if (!el) return;
  const o = opsStats();
  const abertas = o.demPend + o.demAnd;
  const lastBR = o.last ? fmtDataBR(o.last) : '—';
  el.innerHTML =
    kpiCard({ label:'Demandas em aberto', value:abertas, color: abertas ? 'warning' : 'accent', icon:'list', go:'demandas',
      tag: o.demAtras ? `${o.demAtras} atrasada${o.demAtras===1?'':'s'}` : `${o.demPend} não iniciada${o.demPend===1?'':'s'}`, tagCls: o.demAtras ? 'kpi-tag-down' : 'kpi-tag-up', sub:`${o.demAnd} em andamento · ${o.demConc} concluída${o.demConc===1?'':'s'}` }) +
    kpiCard({ label:'Checklist Portaria', value: o.last ? `${o.chkOk}/${o.lastChecks.length}` : '—', color: o.chkProb ? 'danger' : 'accent', icon:'check', go:'checklist',
      tag: o.last ? (o.diasChk === 0 ? 'hoje' : `há ${o.diasChk}d`) : 'sem registro', tagCls: (o.diasChk ?? 99) > 7 ? 'kpi-tag-down' : 'kpi-tag-up', sub:`OK no último (${lastBR})` }) +
    kpiCard({ label:'Seguros em aberto', value: o.segPend + o.segAnal, color: o.segPend ? 'danger' : 'blue', icon:'shield', go:'seguros',
      tag:`${o.segPend} pendente${o.segPend===1?'':'s'}`, tagCls: o.segPend ? 'kpi-tag-down' : 'kpi-tag-up', sub:`${o.segAnal} em análise · ${fmtVal(o.segAbertoValor)}` });
}

// ===== INLINE UPDATE =====
async function updateField(table, id, field, value) {
  if (!sb) return;
  const { error } = await sb.from(table).update({ [field]: value }).eq('id', id);
  if (error) { showToast('Erro ao salvar: ' + error.message, true); return; }
  showToast('Salvo!');
  // Update local data
  const arr = table === 'fornecedores' ? DATA.fornecedores : table === 'torres' ? DATA.torres : table === 'armarios_detail' ? DATA.armDetail : null;
  if (arr) { const item = arr.find(d => d.id === id); if (item) item[field] = value; }
}

// ===== RENDER ALL =====
function renderAll() {
  // compatibilidade: redesenha só a aba visível; as outras são redesenhadas quando abertas
  Object.keys(SECTION_TABLES).forEach(k => dirtySections.add(k));
  safeRender(currentSection);
}


// ===== LINK DIRETO POR ABA (#secao) =====
function sectionFromHash() { const h = (location.hash || '').replace('#', ''); return titles[h] ? h : 'dashboard'; }
window.addEventListener('hashchange', () => showSection(sectionFromHash(), true));

// ===== TEMA CLARO / ESCURO =====
const THEME_ICONS = {
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
};
function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
function paintThemeBtn() {
  const b = document.getElementById('theme-toggle'); if (!b) return;
  const t = currentTheme();
  b.innerHTML = THEME_ICONS[t];
  b.title = t === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('backoffice_theme', next === 'dark' ? 'dark' : ''); } catch(e) {}
  paintThemeBtn();
}
paintThemeBtn();

// ===== BUSCA GLOBAL (Ctrl+K) =====
let searchHits = [], searchSel = 0;
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hl(text, q) {
  const t = String(text ?? ''); const i = norm(t).indexOf(q);
  if (!q || i < 0) return escHtml(t);
  return escHtml(t.slice(0, i)) + '<mark>' + escHtml(t.slice(i, i + q.length)) + '</mark>' + escHtml(t.slice(i + q.length));
}
function searchIndex() {
  const j = (...a) => a.filter(x => x !== null && x !== undefined && x !== '').join(' · ');
  const out = [];
  Object.entries(titles).forEach(([id, [t, sub]]) => out.push({ g:'Ir para', title:t, sub, keys:[t, sub], act:() => showSection(id) }));
  (DATA.torres || []).forEach(d => out.push({ g:'Torres', title:d.cliente, sub:j(d.cidade, d.status, d.responsavel), keys:[d.cliente, d.cidade, d.responsavel], act:() => { showSection('torres'); openTorreModal(d.id); } }));
  (DATA.iaDetail || []).forEach(d => out.push({ g:'Clientes IA', title:d.nome_cliente, sub:j(d.filial, d.provedor, d.status), keys:[d.nome_cliente, d.filial, d.provedor], act:() => { showSection('clientes'); editIADetail(d.id); } }));
  (DATA.armDetail || []).forEach(d => out.push({ g:'Armários', title:d.condominio, sub:j(d.filial, d.fornecedor, d.status), keys:[d.condominio, d.fornecedor, d.endereco], act:() => { showSection('armarios'); editArmDetail(d.id); } }));
  (DATA.fornecedores || []).forEach(d => out.push({ g:'Fornecedores', title:d.servico, sub:j(d.tipo, d.filial, d.valor != null ? fmtVal(d.valor) : ''), keys:[d.servico, d.tipo, d.uso, d.fornecedor_id], act:() => { showSection('fornecedores'); openFornModal(d.id); } }));
  (DATA.demTasks || []).filter(d => !d.arquivada).forEach(d => out.push({ g:'Demandas', title:d.titulo, sub:j(d.codigo, d.categoria, ({nao_iniciada:'Não iniciada',em_andamento:'Em andamento',aguardando_terceiros:'Aguardando terceiros',bloqueada:'Bloqueada',em_revisao:'Em revisão',concluida:'Concluída',cancelada:'Cancelada'})[d.status] || d.status), keys:[d.titulo, d.codigo, d.categoria], act:() => { location.href = 'demandas.html#/tarefa/' + d.id; } }));
  (DATA.seguros || []).forEach(d => out.push({ g:'Seguros', title:d.cliente, sub:j(d.conta, d.tipo_seguro, d.status), keys:[d.cliente, d.conta, d.numero_sinistro, d.seguradora], act:() => { showSection('seguros'); editSeguro(d.id); } }));
  (DATA.condominios || []).forEach(d => out.push({ g:'Condomínios (portaria)', title:d.nome, sub: d.ativo === false ? 'inativo' : 'ativo', keys:[d.nome], act:() => { showSection('checklist'); } }));
  return out;
}
const SEARCH_TABLES = ['torres','clientes_ia_detail','armarios_detail','fornecedores','dem_tasks','solicitacoes_seguro','condominios_portaria'];
function openSearch() {
  document.getElementById('search-overlay').classList.add('open');
  const inp = document.getElementById('search-input'); inp.value = ''; runSearch(''); setTimeout(() => inp.focus(), 20);
  // a busca precisa das tabelas de todas as abas: carrega só as que ainda faltam, uma única vez
  const falta = SEARCH_TABLES.filter(t => !loadedTables.has(t));
  if (sb && falta.length) {
    document.getElementById('search-results').innerHTML = '<div class="search-empty">Carregando dados para a busca...</div>';
    loadTables(falta).then(() => runSearch(inp.value)).catch(e => showToast('Erro na busca: ' + e.message, true));
  }
}
function closeSearch() { document.getElementById('search-overlay').classList.remove('open'); }
function runSearch(raw) {
  const q = norm(raw.trim());
  const box = document.getElementById('search-results');
  if (!q) { box.innerHTML = '<div class="search-empty">Digite pelo menos 2 letras para buscar em todas as abas</div>'; searchHits = []; return; }
  if (q.length < 2) { box.innerHTML = '<div class="search-empty">Continue digitando...</div>'; searchHits = []; return; }
  const all = searchIndex().filter(it => it.title && it.keys.some(k => norm(k).includes(q)));
  // título que começa com o termo vem primeiro; até 8 por grupo
  const groups = {};
  all.sort((a, b) => (norm(b.title).startsWith(q) - norm(a.title).startsWith(q))).forEach(it => { (groups[it.g] = groups[it.g] || []).push(it); });
  searchHits = []; let html = '';
  Object.entries(groups).forEach(([g, items]) => {
    html += `<div class="search-group">${escHtml(g)} <span style="font-weight:500">(${items.length})</span></div>`;
    items.slice(0, 8).forEach(it => { const i = searchHits.push(it) - 1;
      html += `<div class="search-item" data-i="${i}" onmousemove="searchHover(${i})" onclick="searchGo(${i})"><div class="search-item-main"><div class="search-item-title">${hl(it.title, q)}</div><div class="search-item-sub">${escHtml(it.sub || '')}</div></div></div>`; });
  });
  box.innerHTML = html || `<div class="search-empty">Nada encontrado para "${escHtml(raw)}"</div>`;
  searchSel = 0; paintSearchSel();
}
function paintSearchSel() {
  document.querySelectorAll('#search-results .search-item').forEach(el => el.classList.toggle('sel', Number(el.dataset.i) === searchSel));
  const el = document.querySelector('#search-results .search-item.sel'); if (el) el.scrollIntoView({ block: 'nearest' });
}
function searchHover(i) { if (searchSel !== i) { searchSel = i; paintSearchSel(); } }
function searchGo(i) { const it = searchHits[i]; if (!it) return; closeSearch(); it.act(); }
function searchKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (searchHits.length) { searchSel = (searchSel + 1) % searchHits.length; paintSearchSel(); } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (searchHits.length) { searchSel = (searchSel - 1 + searchHits.length) % searchHits.length; paintSearchSel(); } }
  else if (e.key === 'Enter') { e.preventDefault(); searchGo(searchSel); }
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
  if (e.key === 'Escape' && document.getElementById('search-overlay').classList.contains('open')) closeSearch();
  else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('.modal-overlay.open')) { e.preventDefault(); openSearch(); }
});

// ===== TEMPO REAL (Supabase Realtime) =====
const RT_TABLES = ['dem_tasks','fornecedores','torres','clientes_ia_filial','clientes_ia_provedor','armarios_resumo','armarios_detail','boletos','clientes_ia_detail','fornecedores_historico','demandas_equipe','condominios_portaria','checklist_portaria','solicitacoes_seguro','cidades_filial'];
let rtChannel = null, rtTimer = null, rtBusy = false;
function startRealtime() {
  if (!sb || typeof sb.channel !== 'function') return;
  if (rtChannel) { try { sb.removeChannel(rtChannel); } catch(e) {} }
  rtChannel = sb.channel('backoffice-live');
  RT_TABLES.forEach(t => rtChannel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => scheduleLiveRefresh(t)));
  rtChannel.subscribe(status => {
    const pill = document.getElementById('live-pill');
    if (pill) pill.classList.toggle('on', status === 'SUBSCRIBED');
  });
}
const rtPending = new Set();
function scheduleLiveRefresh(table) {
  // só interessa o que já está aberto nesta sessão; o resto é buscado quando a aba for aberta
  if (table) { if (loadedTables.has(table)) rtPending.add(table); else return; }
  clearTimeout(rtTimer); rtTimer = setTimeout(liveRefresh, 1200);
}
async function liveRefresh(all) {
  // não atualiza por baixo de um formulário aberto ou campo em edição
  const editing = document.querySelector('.modal-overlay.open') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
  if (editing || rtBusy) { rtTimer = setTimeout(() => liveRefresh(all), 3000); return; }
  const tables = all ? [...loadedTables] : [...rtPending];
  rtPending.clear();
  if (!tables.length) return;
  rtBusy = true;
  try {
    await loadTables(tables, true);
    if (dirtySections.has(currentSection)) safeRender(currentSection);
    setSyncLabel();
    document.getElementById('sync-dot').classList.remove('offline');
  } catch(e) { /* silencioso: o botão de atualizar continua disponível */ }
  rtBusy = false;
}
// ao voltar para a aba depois de 2+ min, atualiza (cobre o caso do Realtime estar desligado)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sb && Date.now() - lastLoadAt > 120000) liveRefresh(true);
});

