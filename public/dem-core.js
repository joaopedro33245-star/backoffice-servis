/* Servis — Demandas: núcleo (dados, estado, utilitários, navegação) */
'use strict';

// ===== Conexão (mesmo Supabase do Backoffice) =====
const DEM_SB_URL = 'https://fxmdsumcqukxuzooiiju.supabase.co';
const DEM_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4bWRzdW1jcXVreHV6b29paWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTcyNjAsImV4cCI6MjA4ODk5MzI2MH0.qEKKHqvJAt_5Bsk9V5uBI1eN27eWu1wiFhHoFbpI2lo';
function demConfigConexao() {
  try {
    const s = JSON.parse(localStorage.getItem('backoffice_sb_config') || 'null');
    if (s && s.url && s.key) return s;
  } catch (e) {}
  return { url: window.DEM_TEST_URL || DEM_SB_URL, key: window.DEM_TEST_KEY || DEM_SB_KEY };
}
const sb = (() => { const c = demConfigConexao(); return window.supabase.createClient(c.url, c.key); })();

// ===== Constantes =====
const STATUS = [
  { k: 'nao_iniciada',         l: 'Não iniciada',         c: '#64748b' },
  { k: 'em_andamento',         l: 'Em andamento',         c: '#2563eb' },
  { k: 'aguardando_terceiros', l: 'Aguardando terceiros', c: '#d97706' },
  { k: 'bloqueada',            l: 'Bloqueada',            c: '#dc2626' },
  { k: 'em_revisao',           l: 'Em revisão',           c: '#7c3aed' },
  { k: 'concluida',            l: 'Concluída',            c: '#16a34a' },
  { k: 'cancelada',            l: 'Cancelada',            c: '#94a3b8' },
];
const KANBAN = STATUS.filter(s => s.k !== 'cancelada');
const ST = Object.fromEntries(STATUS.map(s => [s.k, s]));
const PRIO = {
  critica: { l: 'Crítica', c: '#b91c1c', w: 4 },
  alta:    { l: 'Alta',    c: '#ea580c', w: 3 },
  media:   { l: 'Média',   c: '#2563eb', w: 2 },
  baixa:   { l: 'Baixa',   c: '#64748b', w: 1 },
};
const COMPLEX = { 1: 'Muito baixa', 2: 'Baixa', 3: 'Média', 4: 'Alta', 5: 'Muito alta' };
const PAPEL = { gestor: 'Gestor', colaborador: 'Colaborador', administrador: 'Administrador' };
const CORES = ['#1d4ed8', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#059669', '#ca8a04', '#4f46e5', '#0f766e', '#be123c'];

// ===== Estado =====
const S = {
  tasks: [], profiles: [], deps: [], cats: [], templates: [],
  cfg: { dias_sem_atualizacao: 3, dias_prazo_proximo: 2, limite_abertas_por_pessoa: 8 },
  me: null, online: true, loadedAt: 0,
  showDemo: (() => { try { return localStorage.getItem('dem_show_demo') !== '0'; } catch (e) { return true; } })(),
  f: null, // filtros do quadro
};
function filtrosPadrao() {
  return { q: '', resp: '', prio: '', cat: '', dep: '', status: '', flag: '', fechadas: true, sort: 'prazo', view: 'kanban', page: 1 };
}
S.f = filtrosPadrao();

// ===== Utilitários =====
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const $ = id => document.getElementById(id);
function hojeISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dataLocal(iso) { if (!iso) return null; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
function diasAte(iso) { if (!iso) return null; const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((dataLocal(iso) - h) / 86400000); }
function diasDesde(ts) { if (!ts) return null; return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000); }
function fmtData(iso) { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; }
function fmtDataHora(ts) { if (!ts) return '—'; const d = new Date(ts); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function fmtRel(ts) {
  if (!ts) return 'nunca';
  const min = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return 'agora'; if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60); if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24); return d === 1 ? 'ontem' : `há ${d} dias`;
}
function fmtNum(n, dec = 0) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function iniciais(nome) { const p = String(nome || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }

function perfil(id) { return S.profiles.find(p => p.id === id) || null; }
function nomeDe(id) { const p = perfil(id); return p ? p.nome : '—'; }
function corDe(p) { if (!p) return '#94a3b8'; if (p.cor) return p.cor; let h = 0; for (const c of p.nome) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; }
function avatar(id, size = 26) {
  const p = typeof id === 'object' ? id : perfil(id);
  return `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px;background:${corDe(p)}" title="${esc(p ? p.nome : '')}">${esc(iniciais(p ? p.nome : '?'))}</span>`;
}
function tagStatus(s) { const x = ST[s] || { l: s, c: '#64748b' }; return `<span class="tag tag-dot" style="color:${x.c};background:${x.c}14">${esc(x.l)}</span>`; }
function tagPrio(p) { const x = PRIO[p] || PRIO.media; return `<span class="tag" style="color:${x.c};background:${x.c}14">${esc(x.l)}</span>`; }
function nomeDep(id) { const d = S.deps.find(x => x.id === id); return d ? d.nome : '—'; }

// ===== Regras de prazo / atualização =====
const aberta = t => t.status !== 'concluida' && t.status !== 'cancelada';
const atrasada = t => aberta(t) && t.prazo && diasAte(t.prazo) < 0;
const proxima = t => aberta(t) && t.prazo && diasAte(t.prazo) >= 0 && diasAte(t.prazo) <= S.cfg.dias_prazo_proximo;
const ultimaMov = t => t.ultima_atualizacao_em || t.created_at;
const semAtualizacao = t => aberta(t) && diasDesde(ultimaMov(t)) >= S.cfg.dias_sem_atualizacao;
const envolve = (t, pid) => t.responsavel_id === pid || (t.participantes || []).includes(pid);
const pontos = t => Number(t.complexidade || 3);

function tagsAlerta(t) {
  const out = [];
  if (t.is_demo) out.push('<span class="tag tag-demo">DEMONSTRAÇÃO</span>');
  if (atrasada(t)) out.push(`<span class="tag tag-late">Atrasada ${-diasAte(t.prazo)}d</span>`);
  else if (proxima(t)) { const n = diasAte(t.prazo); out.push(`<span class="tag tag-near">${n === 0 ? 'Vence hoje' : 'Vence em ' + n + 'd'}</span>`); }
  if (t.ajuda_solicitada && aberta(t)) out.push('<span class="tag tag-late">Pediu ajuda</span>');
  return out.join(' ');
}

// tarefas visíveis (respeita "mostrar demonstração" e arquivadas)
function tarefasVisiveis(incluirArquivadas = false) {
  return S.tasks.filter(t => (incluirArquivadas || !t.arquivada) && (S.showDemo || !t.is_demo));
}

// ===== Avisos e confirmações =====
function toast(msg, tipo) {
  const el = document.createElement('div');
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), tipo === 'bad' ? 6000 : 3200);
}
function msgErro(e) {
  const m = (e && (e.message || e.error_description || e.details)) || String(e);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com o banco. Verifique a internet e tente novamente.';
  if (/dem_tasks_bloqueio_motivo/.test(m)) return 'Para bloquear, informe o motivo do bloqueio (mínimo 5 caracteres).';
  if (/dem_task_updates_texto_check/.test(m)) return 'A atualização precisa ter pelo menos 10 caracteres.';
  if (/dem_tasks_prazo_ok/.test(m)) return 'O prazo final não pode ser antes da data de início.';
  if (/dem_profiles_nome_uq|duplicate key.*nome/.test(m)) return 'Já existe um cadastro com esse nome.';
  if (/relation .* does not exist|Could not find the table/i.test(m)) return 'As tabelas de Demandas ainda não foram criadas no Supabase (rode os arquivos SQL).';
  return m;
}
async function q(promise) {
  const r = await promise;
  if (r.error) throw r.error;
  return r.data;
}

const Modal = {
  _onClose: null,
  open(html, opts = {}) {
    const m = $('modal');
    m.className = 'modal' + (opts.small ? ' sm' : '');
    m.innerHTML = html;
    $('modal-scrim').classList.add('on');
    this._onClose = opts.onClose || null;
    setTimeout(() => { const f = m.querySelector('[autofocus], input:not([type=hidden]), textarea, select'); if (f) f.focus(); }, 30);
  },
  close() { $('modal-scrim').classList.remove('on'); $('modal').innerHTML = ''; if (this._onClose) { const f = this._onClose; this._onClose = null; f(); } },
  isOpen() { return $('modal-scrim').classList.contains('on'); },
  head(t) { return `<div class="modal-h"><h3 id="modal-title">${esc(t)}</h3><button class="icon-btn" onclick="Modal.close()" aria-label="Fechar">✕</button></div>`; },
};
function confirmar(texto, { ok = 'Confirmar', perigo = false } = {}) {
  return new Promise(res => {
    Modal.open(`${Modal.head('Confirmar')}<div class="modal-b"><p>${esc(texto)}</p></div>
      <div class="modal-f"><button class="btn" id="cf-n">Cancelar</button><button class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" id="cf-s">${esc(ok)}</button></div>`,
      { small: true, onClose: () => res(false) });
    $('cf-n').onclick = () => Modal.close();
    $('cf-s').onclick = () => { Modal._onClose = null; Modal.close(); res(true); };
  });
}
// botão com estado de carregamento
async function comCarregando(btn, fn) {
  if (btn) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.textContent = 'Salvando...'; }
  try { return await fn(); }
  catch (e) { toast(msgErro(e), 'bad'); throw e; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = btn.dataset.txt; } }
}

// ===== Dados =====
const Data = {
  async loadAll() {
    const [tasks, profiles, deps, cats, cfg, templates] = await Promise.all([
      q(sb.from('dem_v_tasks').select('*').order('id', { ascending: true })),
      q(sb.from('dem_profiles').select('*').order('nome')),
      q(sb.from('dem_departments').select('*').order('nome')),
      q(sb.from('dem_categories').select('*').order('nome')),
      q(sb.from('dem_config').select('*')),
      q(sb.from('dem_templates').select('*').order('titulo')),
    ]);
    S.tasks = tasks; S.profiles = profiles; S.deps = deps; S.cats = cats; S.templates = templates;
    cfg.forEach(c => { S.cfg[c.chave] = Number(c.valor); });
    S.loadedAt = Date.now();
  },
  async reloadTasks() {
    S.tasks = await q(sb.from('dem_v_tasks').select('*').order('id', { ascending: true }));
    S.loadedAt = Date.now();
  },
  async gerarRecorrentes() {
    try { const n = await q(sb.rpc('dem_gerar_recorrentes')); return Number(n) || 0; }
    catch (e) { console.warn('recorrentes', e); return 0; }
  },
};

// ===== Navegação =====
const ICON = {
  dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14c2.8 0 5 1.8 5 4.5"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  late: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rep: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  cfg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const PAGES = [
  { id: 'dashboard',  l: 'Dashboard Geral',      i: 'dash',  sec: 'Visão geral', roles: ['gestor', 'administrador'] },
  { id: 'quadro',     l: 'Quadro de Tarefas',    i: 'board', sec: 'Visão geral' },
  { id: 'minhas',     l: 'Minhas Demandas',      i: 'me',    sec: 'Visão geral' },
  { id: 'equipe',     l: 'Equipe',               i: 'team',  sec: 'Acompanhamento', roles: ['gestor', 'administrador'] },
  { id: 'calendario', l: 'Calendário e Prazos',  i: 'cal',   sec: 'Acompanhamento' },
  { id: 'atrasadas',  l: 'Demandas Atrasadas',   i: 'late',  sec: 'Acompanhamento' },
  { id: 'relatorios', l: 'Relatórios Gerenciais', i: 'rep',  sec: 'Gestão', roles: ['gestor', 'administrador'] },
  { id: 'historico',  l: 'Histórico de Atividades', i: 'hist', sec: 'Gestão', roles: ['gestor', 'administrador'] },
  { id: 'config',     l: 'Configurações',        i: 'cfg',   sec: 'Gestão', roles: ['gestor', 'administrador'] },
];
function podeVer(pg) { const papel = S.me ? S.me.papel : 'colaborador'; return !pg.roles || pg.roles.includes(papel); }
const ehGestor = () => !!S.me && (S.me.papel === 'gestor' || S.me.papel === 'administrador');

const App = {
  page: 'dashboard', param: null, charts: [],

  async start() {
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (Modal.isOpen()) Modal.close(); else if (Tarefa.atual) Tarefa.fechar(); }
    });
    $('modal-scrim').addEventListener('mousedown', e => { if (e.target.id === 'modal-scrim') Modal.close(); });
    try {
      await Data.loadAll();
      const n = await Data.gerarRecorrentes();
      if (n > 0) { await Data.reloadTasks(); toast(`${n} tarefa(s) recorrente(s) gerada(s) hoje.`, 'ok'); }
      this.setOnline(true);
    } catch (e) {
      $('boot-msg').innerHTML = esc(msgErro(e)) + '<br><br><button class="btn btn-primary" onclick="location.reload()">Tentar novamente</button>';
      $('boot').querySelector('.spin').hidden = true;
      return;
    }
    this.carregarUsuario();
    $('boot').hidden = true;
    this._hashExplicito = /^#\/\w/.test(location.hash || '');
    if (!S.me) this.escolherUsuario(true);
    this.route();
    this.realtime();
    setInterval(() => this.renderNav(), 60000);
  },

  setOnline(on) { S.online = on; $('offline-bar').hidden = on; },

  carregarUsuario() {
    let id = null; try { id = localStorage.getItem('dem_usuario'); } catch (e) {}
    S.me = S.profiles.find(p => p.id === id && p.ativo) || null;
    this.renderMe();
  },
  renderMe() {
    const p = S.me;
    $('me-chip').innerHTML = p ? `${avatar(p, 28)}<span class="nm">${esc(p.nome)}<small>${esc(PAPEL[p.papel] || '')}</small></span>` : '<span class="nm">Quem é você?</span>';
  },
  escolherUsuario(obrigatorio) {
    const ativos = S.profiles.filter(p => p.ativo);
    Modal.open(`${Modal.head('Quem está usando?')}<div class="modal-b">
      <p class="small muted" style="margin-bottom:12px">Escolha seu nome. Ele é usado para registrar quem fez cada atualização e para montar "Minhas Demandas".
      Fica guardado só neste navegador. <b>Isto não é um login</b>: qualquer pessoa com o link pode escolher qualquer nome.</p>
      <div class="who-list">${ativos.map(p => `<button onclick="App.definirUsuario('${p.id}')">${avatar(p, 34)}<span><b>${esc(p.nome)}</b><br><small class="muted">${esc(PAPEL[p.papel])}${p.cargo ? ' · ' + esc(p.cargo) : ''}</small></span></button>`).join('') || '<div class="empty">Nenhum colaborador cadastrado. Rode o arquivo SQL de dados iniciais.</div>'}</div>
    </div>`, { small: true });
    if (obrigatorio) $('modal').querySelector('.modal-h .icon-btn').hidden = true;
  },
  definirUsuario(id) {
    try { localStorage.setItem('dem_usuario', id); } catch (e) {}
    S.me = perfil(id);
    Modal._onClose = null; Modal.close();
    this.renderMe();
    toast('Você está usando como ' + S.me.nome + '.', 'ok');
    const inicial = this.page === 'minhas' && !this._hashExplicito;
    if (inicial && ehGestor()) { if (location.hash === '#/dashboard') this.route(); else location.hash = '#/dashboard'; }
    else if (!podeVer(PAGES.find(p => p.id === this.page) || {})) location.hash = '#/minhas';
    else this.render();
  },

  toggleMenu(on) { $('side').classList.toggle('open', on); $('side-scrim').classList.toggle('on', on); },

  renderNav() {
    const vis = tarefasVisiveis();
    const atras = vis.filter(atrasada).length;
    const minhas = S.me ? vis.filter(t => aberta(t) && envolve(t, S.me.id)).length : 0;
    let html = '', sec = '';
    PAGES.filter(podeVer).forEach(p => {
      if (p.sec !== sec) { sec = p.sec; html += `<div class="nav-sec">${esc(sec)}</div>`; }
      const cnt = p.id === 'atrasadas' && atras ? `<span class="cnt bad">${atras}</span>` : p.id === 'minhas' && minhas ? `<span class="cnt">${minhas}</span>` : '';
      html += `<a class="nav-a${this.page === p.id ? ' on' : ''}" href="#/${p.id}" onclick="App.toggleMenu(false)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[p.i]}</svg>${esc(p.l)}${cnt}</a>`;
    });
    $('side-nav').innerHTML = html;
  },

  route() {
    const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
    if (parts[0] === 'tarefa' && parts[1]) { // link direto para uma demanda (ex.: vindo da busca do Backoffice)
      const id = Number(parts[1]);
      history.replaceState(null, '', '#/quadro');
      setTimeout(() => { if (S.tasks.some(t => t.id === id)) Tarefa.abrir(id); }, 0);
      parts[0] = 'quadro'; parts.length = 1;
    }
    let pg = PAGES.find(p => p.id === parts[0]);
    if (!pg) pg = PAGES.find(p => p.id === (ehGestor() ? 'dashboard' : 'minhas'));
    if (!podeVer(pg)) pg = PAGES.find(p => p.id === 'minhas');
    this.page = pg.id; this.param = parts[1] ? decodeURIComponent(parts[1]) : null;
    this.render();
    $('view').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  },

  render() {
    this.charts.forEach(c => { try { c.destroy(); } catch (e) {} });
    this.charts = [];
    this.renderNav();
    const pg = PAGES.find(p => p.id === this.page);
    $('page-title').textContent = pg.l;
    $('page-sub').textContent = Paginas.subtitulo(this.page);
    try { Paginas[this.page](this.param); }
    catch (e) {
      console.error(e);
      $('view').innerHTML = `<div class="alert alert-bad">Esta página não pôde ser exibida: ${esc(e.message)}. As demais continuam funcionando.</div>`;
    }
    if (Tarefa.atual) Tarefa.render();
  },

  async reload(manual) {
    try {
      await Data.loadAll();
      this.setOnline(true);
      if (Modal.isOpen()) return; // não redesenha por baixo de um formulário
      this.render();
      if (manual) toast('Dados atualizados.', 'ok');
    } catch (e) {
      this.setOnline(false);
      if (manual) toast(msgErro(e), 'bad');
    }
  },

  // atualiza só as tarefas (após salvar)
  async refresh() {
    try { await Data.reloadTasks(); this.setOnline(true); this.render(); }
    catch (e) { this.setOnline(false); toast(msgErro(e), 'bad'); }
  },

  realtime() {
    if (typeof sb.channel !== 'function') return;
    let timer = null;
    const agendar = () => { clearTimeout(timer); timer = setTimeout(() => { if (Modal.isOpen()) agendar(); else this.reload(false); }, 1200); };
    const ch = sb.channel('dem-live');
    ['dem_tasks', 'dem_task_updates', 'dem_task_comments', 'dem_task_checklists', 'dem_task_assignees', 'dem_task_attachments', 'dem_profiles']
      .forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, agendar));
    ch.subscribe();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - S.loadedAt > 60000) this.reload(false);
    });
  },

  // abre o quadro em modo lista já filtrado
  irLista(filtros) {
    S.f = Object.assign(filtrosPadrao(), { view: 'lista' }, filtros);
    if (location.hash === '#/quadro') this.render(); else location.hash = '#/quadro';
  },
  globalSearch(v) {
    const t = String(v || '').trim();
    const cod = t.match(/^dem-?(\d+)$/i);
    if (cod) {
      const task = S.tasks.find(x => x.id === Number(cod[1]));
      if (task) { Tarefa.abrir(task.id); return; }
    }
    this.irLista({ q: t, fechadas: true });
  },
  chart(el, cfg) {
    if (!window.Chart || !el) return null;
    const c = new Chart(el, cfg); this.charts.push(c); return c;
  },
};
