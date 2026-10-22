// ===== ASSISTENTE (IA): cole um e-mail/mensagem, confira o cadastro proposto e grave =====
// Usado no Backoffice (index.html) e nas Demandas (demandas.html). A IA roda na função "assistente" do Supabase.
(function () {
  'use strict';
  if (window.Assistente) return;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NA_DEMANDAS = /demandas\.html/.test(location.pathname);
  const st = { aberto: false, prop: null, ctx: null, busy: false };

  // ---------- campos de cada tipo ----------
  const SIMNAO = [['', '—'], ['true', 'Sim'], ['false', 'Não']];
  const TIPOS = {
    seguro: { nome: 'Pedido de seguro', tabela: 'solicitacoes_seguro', campos: [
      ['cliente', 'Cliente', 'text', true], ['conta', 'Conta'], ['tipo_seguro', 'Tipo de seguro'], ['data_solicitacao', 'Data da solicitação', 'date'],
      ['status', 'Status', ['Pendente', 'Em análise', 'Aprovado', 'Negado', 'Concluído']], ['valor', 'Valor (R$)', 'number'], ['seguradora', 'Seguradora'],
      ['numero_sinistro', 'Nº sinistro / protocolo'], ['observacoes', 'Observações', 'area'], ['email_origem', 'E-mail de origem']] },
    torre: { nome: 'Nova torre', tabela: 'torres', campos: [
      ['cliente', 'Cliente', 'text', true], ['cidade', 'Cidade'], ['status', 'Status', ['EM AUTORIZAÇÃO', 'AUTORIZADA', 'INSTALADA', 'NÃO AUTORIZADA', 'SEGUNDO PLANO', 'AVALIAR/AGUARDAR']],
      ['modelo', 'Modelo'], ['cameras', 'Câmeras', 'number'], ['pago_forn', 'Pago ao fornecedor', 'number'], ['cobrado', 'Cobrado do cliente', 'number'],
      ['responsavel', 'Responsável'], ['data_fim_gratificacao', 'Fim da gratificação', 'date'], ['observacao', 'Observação', 'area']] },
    demanda: { nome: 'Nova demanda', tabela: 'dem_tasks', campos: [
      ['titulo', 'Título', 'text', true], ['responsavel', 'Responsável', 'pessoa', true], ['prioridade', 'Prioridade', [['critica', 'Crítica'], ['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']]],
      ['categoria', 'Categoria', 'categoria'], ['complexidade', 'Complexidade (1–5)', 'number'], ['data_inicio', 'Início', 'date'], ['prazo', 'Prazo', 'date'],
      ['descricao', 'Descrição', 'area'], ['resultado_esperado', 'Resultado esperado', 'area'], ['criado_por', 'Quem está cadastrando', 'pessoa', true]] },
    checklist: { nome: 'Checklist de portaria', tabela: 'checklist_portaria', campos: [
      ['condominio', 'Condomínio', 'condominio', true], ['data_checklist', 'Data', 'date'], ['qtd_cameras', 'Câmeras', 'number'],
      ['todas_gravando_dvr', 'DVR gravando todas', SIMNAO], ['cameras_portao_gravando', 'Câmeras do portão gravando', SIMNAO], ['cameras_botoes_acoes', 'Câmeras com botões de ação', SIMNAO],
      ['central_alarme_comunicando', 'Alarme comunicando', SIMNAO], ['tem_ia', 'Tem IA', SIMNAO], ['ia_funcionando', 'IA funcionando', SIMNAO], ['qual_ia', 'Qual IA'],
      ['tem_torre', 'Tem torre', SIMNAO], ['cameras_portao_lista', 'Câmeras do portão (lista)'], ['observacoes', 'Observações', 'area']] },
  };

  // ---------- contexto (pessoas, categorias, condomínios) ----------
  async function contexto() {
    if (st.ctx) return st.ctx;
    const [p, c, k] = await Promise.all([
      sb.from('dem_profiles').select('id,nome,ativo').eq('ativo', true),
      sb.from('dem_categories').select('nome').eq('ativo', true),
      sb.from('condominios_portaria').select('id,nome,ativo'),
    ]);
    st.ctx = { pessoas: p.data || [], categorias: (c.data || []).map(x => x.nome), condominios: (k.data || []).filter(x => x.ativo !== false) };
    return st.ctx;
  }
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function acharCondominio(nome, lista) {
    const n = norm(nome); if (!n) return null;
    let best = null, score = 0;
    lista.forEach(c => { const m = norm(c.nome); const pal = n.split(' ').filter(w => w.length > 2); const s = m === n ? 100 : pal.filter(w => m.includes(w)).length / Math.max(pal.length, 1) * 90; if (s > score) { score = s; best = c; } });
    return score >= 60 ? best : null;
  }
  function usuarioAtual() { try { return localStorage.getItem('dem_usuario') || ''; } catch (e) { return ''; } }

  // ---------- interface ----------
  function montar() {
    if ($('as-fab')) return;
    const css = document.createElement('style');
    css.textContent = `
    #as-fab{position:fixed;right:18px;bottom:18px;z-index:120;display:flex;align-items:center;gap:8px;height:46px;padding:0 18px 0 14px;border:0;border-radius:999px;background:var(--navy,#0f1e3d);color:#fff;font:600 14px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(15,30,61,.3);cursor:pointer}
    #as-fab:hover{filter:brightness(1.15)} #as-fab svg{width:20px;height:20px}
    #as-win{position:fixed;right:18px;bottom:76px;z-index:121;width:440px;max-width:calc(100vw - 24px);max-height:calc(100vh - 100px);display:none;flex-direction:column;background:var(--bg-card,#fff);color:var(--text-primary,var(--tx,#0f172a));border:1px solid var(--border,var(--line,#e3e8ef));border-radius:16px;box-shadow:0 20px 50px rgba(15,30,61,.28);font:14px/1.45 Inter,system-ui,sans-serif;overflow:hidden}
    #as-win.on{display:flex}
    .as-h{display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--navy,#0f1e3d);color:#fff}
    .as-h b{font-size:15px} .as-h small{display:block;font-size:11.5px;color:#a9b8d6} .as-h button{margin-left:auto;background:none;border:0;color:#fff;font-size:18px;cursor:pointer;width:30px;height:30px;border-radius:8px}
    .as-h button:hover{background:rgba(255,255,255,.12)}
    .as-b{padding:14px 16px;overflow-y:auto;flex:1}
    .as-b textarea{width:100%;min-height:150px;border:1px solid var(--border,var(--line,#e3e8ef));border-radius:10px;padding:10px 12px;font:13px/1.45 Inter,system-ui,sans-serif;background:var(--bg-input,#fff);color:inherit;resize:vertical;box-sizing:border-box}
    .as-b textarea:focus,.as-f input:focus,.as-f select:focus{outline:none;border-color:var(--primary,var(--blue,#2563eb));box-shadow:0 0 0 3px rgba(37,99,235,.15)}
    .as-dica{font-size:12px;color:var(--text-muted,var(--tx-3,#7b8799));margin:8px 0 0}
    .as-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    .as-btn{height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--border,var(--line,#e3e8ef));background:var(--bg-card,#fff);color:inherit;font:600 13px Inter,system-ui,sans-serif;cursor:pointer}
    .as-btn.pri{background:var(--primary,var(--blue,#2563eb));border-color:var(--primary,var(--blue,#2563eb));color:#fff}
    .as-btn:disabled{opacity:.55;cursor:wait}
    .as-msg{border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px}
    .as-msg.info{background:var(--primary-50,var(--blue-50,#eff4ff));color:var(--primary,var(--blue,#2563eb))}
    .as-msg.ok{background:var(--accent-dim,var(--ok-50,#e9f8ee));color:var(--accent,var(--ok,#16a34a))}
    .as-msg.warn{background:var(--warning-dim,var(--warn-50,#fff5e6));color:#b45309}
    .as-msg.bad{background:var(--danger-dim,var(--bad-50,#fdecec));color:var(--danger,var(--bad,#dc2626))}
    .as-tipo{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 8px;border-radius:999px;background:var(--navy,#0f1e3d);color:#fff;margin-bottom:6px}
    .as-f{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-top:10px}
    .as-f label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;font-weight:600;color:var(--text-secondary,var(--tx-2,#475569))}
    .as-f label.full{grid-column:1/-1}
    .as-f input,.as-f select,.as-f textarea{height:34px;border:1px solid var(--border,var(--line,#e3e8ef));border-radius:8px;padding:0 9px;font:13px Inter,system-ui,sans-serif;background:var(--bg-input,#fff);color:var(--text-primary,var(--tx,#0f172a))}
    .as-f textarea{height:auto;min-height:60px;padding:7px 9px}
    .as-f .vazio{border-color:#fbbf24;background:#fffbeb}
    .as-f .req::after{content:' *';color:var(--danger,#dc2626)}
    @media(max-width:520px){#as-win{right:12px;left:12px;bottom:72px;width:auto}.as-f{grid-template-columns:1fr}#as-fab span{display:none}#as-fab{padding:0 13px}}`;
    document.head.appendChild(css);
    document.body.insertAdjacentHTML('beforeend', `
      <button id="as-fab" onclick="Assistente.alternar()" title="Assistente de cadastro (IA)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg><span>Assistente</span></button>
      <div id="as-win" role="dialog" aria-label="Assistente de cadastro">
        <div class="as-h"><div><b>Assistente de cadastro</b><small>Cole o e-mail ou escreva o que precisa</small></div><button onclick="Assistente.alternar(false)" aria-label="Fechar">✕</button></div>
        <div class="as-b" id="as-b"></div>
      </div>`);
    telaInicial();
  }
  function telaInicial(msg) {
    st.prop = null;
    $('as-b').innerHTML = `${msg || ''}<textarea id="as-txt" placeholder="Ex.: cole o e-mail da seguradora, ou escreva &quot;abre uma demanda pra Renata conferir o boleto da Zurich até sexta&quot;"></textarea>
      <p class="as-dica">Funciona para pedido de seguro, nova torre, demanda e checklist de portaria. Você confere tudo antes de gravar. CPF e senhas são descartados.</p>
      <div class="as-row"><button class="as-btn pri" id="as-go" onclick="Assistente.interpretar()">Interpretar</button></div>`;
  }
  function alternar(v) {
    montar(); st.aberto = v === undefined ? !st.aberto : v;
    $('as-win').classList.toggle('on', st.aberto);
    if (st.aberto && $('as-txt')) setTimeout(() => $('as-txt').focus(), 50);
  }

  // ---------- 1. interpretar ----------
  async function interpretar() {
    const txt = ($('as-txt') || {}).value || '';
    if (txt.trim().length < 5) return;
    const btn = $('as-go'); btn.disabled = true; btn.textContent = 'Lendo o texto...';
    try {
      const ctx = await contexto();
      const { data, error } = await sb.functions.invoke('assistente', { body: { texto: txt, contexto: { pessoas: ctx.pessoas.map(p => p.nome), categorias: ctx.categorias } } });
      let r = data;
      if (error) { try { r = await error.context.json(); } catch (e) { r = { erro: error.message }; } }
      if (!r || r.erro) throw new Error((r && r.erro) || 'Não foi possível interpretar agora.');
      if (!TIPOS[r.tipo]) {
        telaInicial(`<div class="as-msg ${r.tipo === 'pergunta' ? 'info' : 'warn'}">${esc(r.resposta || r.resumo || 'Não entendi que cadastro fazer. Diga se é seguro, torre, demanda ou checklist.')}</div>`);
        $('as-txt').value = txt; return;
      }
      st.prop = { tipo: r.tipo, dados: r.dados || {}, resumo: r.resumo, faltando: r.faltando || [], original: txt };
      await formulario();
    } catch (e) {
      telaInicial(`<div class="as-msg bad">${esc(e.message)}</div>`); $('as-txt').value = txt;
    }
  }

  // ---------- 2. conferir ----------
  async function formulario() {
    const ctx = await contexto(); const P = st.prop; const T = TIPOS[P.tipo]; const d = P.dados;
    if (P.tipo === 'demanda') {
      const pid = nome => (ctx.pessoas.find(p => norm(p.nome) === norm(nome)) || ctx.pessoas.find(p => norm(p.nome).includes(norm(nome)) && norm(nome)) || {}).id || '';
      d.responsavel = pid(d.responsavel); d.criado_por = usuarioAtual() && ctx.pessoas.some(p => p.id === usuarioAtual()) ? usuarioAtual() : '';
      if (!ctx.categorias.includes(d.categoria)) d.categoria = '';
      d.complexidade = d.complexidade || 3; d.prioridade = d.prioridade || 'media';
    }
    if (P.tipo === 'checklist') { const c = acharCondominio(d.condominio, ctx.condominios); d.condominio_texto = d.condominio; d.condominio = c ? String(c.id) : ''; }
    const dup = await duplicado(P.tipo, d);
    const campo = ([k, rot, tipo, req]) => {
      const v = d[k] === null || d[k] === undefined ? '' : String(d[k]);
      const cls = req ? 'req' : ''; const vz = v === '' ? ' class="vazio"' : '';
      const full = tipo === 'area' || k === 'tipo_seguro' || k === 'titulo' ? ' full' : '';
      let input;
      if (Array.isArray(tipo)) input = `<select id="as-f-${k}"${vz}>${tipo.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === v ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
      else if (tipo === 'pessoa') input = `<select id="as-f-${k}"${vz}><option value="">Selecione...</option>${ctx.pessoas.map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>`;
      else if (tipo === 'categoria') input = `<select id="as-f-${k}"${vz}><option value="">—</option>${ctx.categorias.map(c => `<option ${c === v ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`;
      else if (tipo === 'condominio') input = `<select id="as-f-${k}"${vz}><option value="">Selecione...${d.condominio_texto ? ' (texto: ' + esc(d.condominio_texto) + ')' : ''}</option>${ctx.condominios.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(c => `<option value="${c.id}" ${String(c.id) === v ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>`;
      else if (tipo === 'area') input = `<textarea id="as-f-${k}"${vz}>${esc(v)}</textarea>`;
      else input = `<input id="as-f-${k}" type="${tipo || 'text'}" value="${esc(v)}"${tipo === 'number' ? ' step="any"' : ''}${vz}>`;
      return `<label class="${full}"><span class="${cls}">${esc(rot)}</span>${input}</label>`;
    };
    $('as-b').innerHTML = `<span class="as-tipo">${esc(T.nome)}</span>
      <div class="as-msg info">${esc(P.resumo || 'Confira os campos abaixo.')}${P.faltando.length ? '<br><b>Não veio no texto:</b> ' + esc(P.faltando.join(', ')) : ''}<br><small>Campos em amarelo estão vazios. Corrija o que precisar antes de gravar.</small></div>
      ${dup ? `<div class="as-msg bad">⚠ Possível duplicado: ${esc(dup)}</div>` : ''}
      <div class="as-f">${T.campos.map(campo).join('')}</div>
      <div class="as-row"><button class="as-btn" onclick="Assistente.voltar()">Voltar</button><button class="as-btn pri" id="as-save" onclick="Assistente.gravar()">Gravar</button></div>`;
  }
  async function duplicado(tipo, d) {
    try {
      if (tipo === 'seguro' && d.numero_sinistro) { const r = (await sb.from('solicitacoes_seguro').select('id,cliente').eq('numero_sinistro', String(d.numero_sinistro))).data || []; if (r.length) return `já existe o protocolo ${d.numero_sinistro} (${r[0].cliente}).`; }
      if (tipo === 'torre' && d.cliente) { const r = (await sb.from('torres').select('id,cliente,status').ilike('cliente', `%${String(d.cliente).slice(0, 40)}%`)).data || []; if (r.length) return `já existe a torre "${r[0].cliente}" (${r[0].status}).`; }
      if (tipo === 'demanda' && d.titulo) { const r = (await sb.from('dem_tasks').select('codigo,titulo').ilike('titulo', `%${String(d.titulo).slice(0, 40)}%`).neq('status', 'cancelada')).data || []; if (r.length) return `já existe ${r[0].codigo} — ${r[0].titulo}.`; }
      if (tipo === 'checklist' && d.condominio && d.data_checklist) { const r = (await sb.from('checklist_portaria').select('id').eq('condominio_id', Number(d.condominio)).eq('data_checklist', d.data_checklist)).data || []; if (r.length) return 'já existe checklist deste condomínio nesta data.'; }
    } catch (e) {}
    return '';
  }

  // ---------- 3. gravar ----------
  async function gravar() {
    const P = st.prop; const T = TIPOS[P.tipo]; const v = {};
    T.campos.forEach(([k, , tipo]) => { const el = $('as-f-' + k); if (!el) return; let x = el.value.trim(); if (x === '') { v[k] = null; return; }
      if (tipo === 'number') x = Number(String(x).replace(',', '.')); if (Array.isArray(tipo) && tipo === SIMNAO) x = x === 'true'; v[k] = x; });
    const falta = T.campos.filter(c => c[3] && (v[c[0]] === null || v[c[0]] === '')).map(c => c[1]);
    if (falta.length) { alert('Preencha: ' + falta.join(', ')); return; }
    let obj = v;
    if (P.tipo === 'demanda') obj = { titulo: v.titulo, descricao: v.descricao, responsavel_id: v.responsavel, prioridade: v.prioridade || 'media', categoria: v.categoria, complexidade: Math.min(5, Math.max(1, Math.round(v.complexidade || 3))), data_inicio: v.data_inicio, prazo: v.prazo, resultado_esperado: v.resultado_esperado, criado_por: v.criado_por, atualizado_por: v.criado_por };
    if (P.tipo === 'checklist') { obj = { ...v, condominio_id: Number(v.condominio) }; delete obj.condominio; ['todas_gravando_dvr', 'cameras_portao_gravando', 'cameras_botoes_acoes', 'central_alarme_comunicando', 'tem_ia', 'ia_funcionando', 'tem_torre'].forEach(k => { if (obj[k] === null) obj[k] = false; }); }
    if (P.tipo === 'torre') { if (obj.cidade) obj.cidade = String(obj.cidade).toUpperCase(); obj.cameras = obj.cameras || 0; obj.pago_forn = obj.pago_forn || 0; obj.cobrado = obj.cobrado || 0; obj.status = obj.status || 'EM AUTORIZAÇÃO'; }
    if (P.tipo === 'seguro') obj.status = obj.status || 'Pendente';
    const btn = $('as-save'); btn.disabled = true; btn.textContent = 'Gravando...';
    const r = await sb.from(T.tabela).insert(obj).select();
    if (r.error) { btn.disabled = false; btn.textContent = 'Gravar'; alert('Não foi possível gravar: ' + r.error.message); return; }
    const novo = r.data && r.data[0];
    if (P.tipo === 'demanda' && usuarioAtual() === '' && obj.criado_por) { try { localStorage.setItem('dem_usuario', obj.criado_por); } catch (e) {} }
    const abrir = abrirLink(P.tipo, novo);
    telaInicial(`<div class="as-msg ok">✓ ${esc(T.nome)} gravado${novo && novo.codigo ? ' como <b>' + esc(novo.codigo) + '</b>' : ''}. ${abrir ? `<a href="javascript:void(0)" onclick="${abrir}">Abrir</a>` : ''}</div>`);
    try { if (!NA_DEMANDAS && typeof refreshData === 'function') refreshData(); if (NA_DEMANDAS && typeof App !== 'undefined' && App.reload) App.reload(); } catch (e) {}
  }
  function abrirLink(tipo, novo) {
    if (!novo) return '';
    if (tipo === 'demanda') return NA_DEMANDAS ? `location.hash='#/tarefa/${novo.id}'` : `location.href='demandas.html#/tarefa/${novo.id}'`;
    const sec = { seguro: ['seguros', 'seg'], torre: ['torres', 'torres'], checklist: ['checklist', 'chk'] }[tipo];
    if (!sec) return '';
    return NA_DEMANDAS ? `location.href='index.html#${sec[0]}'` : `Assistente.ir('${sec[0]}','${sec[1]}',${novo.id})`;
  }
  async function ir(sec, ent, id) { alternar(false); await showSection(sec); setTimeout(() => { if (window.Painel) Painel.abrir(ent, id); }, 600); }
  function voltar() { const t = st.prop ? st.prop.original : ''; telaInicial(); $('as-txt').value = t; }

  window.Assistente = { alternar, interpretar, gravar, voltar, ir };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
