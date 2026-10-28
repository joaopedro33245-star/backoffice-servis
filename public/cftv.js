// ===== CFTV PENDENTE: clientes com problema de câmera/DVR + cobrança de todos num e-mail só =====
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PROBLEMAS = ['Câmera offline', 'DVR/NVR offline', 'DVR sem gravar', 'HD com defeito', 'Imagem ruim / sem visão noturna', 'Câmera desalinhada', 'Câmera sem acesso remoto', 'Outro'];
  const STATUS = { 'Pendente': '#eda100', 'Cobrado': '#2a78d6', 'Em atendimento': '#8b5cf6', 'Resolvido': '#1abf8f' };
  const FILIAIS = ['Servis Ceará', 'Servis Amazonas', 'Servis Maranhão', 'Secopi Piauí', 'Sideraltech'];
  const ST = { lista: [], busca: '', status: 'abertas', filial: '', sel: new Set(), carregado: false };
  const hoje = () => new Date().toLocaleDateString('en-CA');
  const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const dias = iso => iso ? Math.max(0, Math.round((new Date(hoje()) - new Date(String(iso).slice(0, 10))) / 86400000)) : 0;
  const aberta = p => p.status !== 'Resolvido';
  const nz = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // ---------- monta a aba (menu, seção e formulário) ----------
  function montar() {
    if ($('sec-cftv')) return;
    if (typeof titles === 'object') titles.cftv = ['CFTV Pendente', 'Clientes com câmera ou DVR pendente · cobrança em lote'];
    const chk = document.querySelector('.nav-item[data-section="checklist"]');
    const ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
    if (chk) chk.insertAdjacentHTML('afterend', `<div class="nav-item" data-section="cftv" onclick="showSection('cftv')">${ico}<span>CFTV Pendente</span><span class="nav-badge" id="badge-cftv"></span></div>`);
    const cfg = $('sec-config');
    const sec = `<div class="section" id="sec-cftv">
      <div class="kpi-grid-dash kpi-grid-4" id="cftv-kpis"></div>
      <div class="card">
        <div class="card-header" style="flex-wrap:wrap;gap:10px">
          <div class="card-title">Clientes com CFTV pendente</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input class="form-input" id="cftv-busca" placeholder="Buscar cliente ou conta..." style="width:200px;font-size:12px" oninput="Cftv.filtro('busca', this.value)">
            <select class="form-input" id="cftv-f-status" style="width:auto;font-size:12px" onchange="Cftv.filtro('status', this.value)">
              <option value="abertas">Em aberto</option><option value="">Todas</option>${Object.keys(STATUS).map(s => `<option>${s}</option>`).join('')}
            </select>
            <select class="form-input" id="cftv-f-filial" style="width:auto;font-size:12px" onchange="Cftv.filtro('filial', this.value)">
              <option value="">Todas as filiais</option>${FILIAIS.map(f => `<option>${f}</option>`).join('')}
            </select>
            <button class="btn btn-outline" onclick="Cftv.cobrar()" title="Monta um único e-mail com as pendências selecionadas (ou todas as em aberto)">✉ Cobrar por e-mail</button>
            <button class="btn btn-accent" onclick="Cftv.abrir()">+ Nova pendência</button>
          </div>
        </div>
        <div class="table-wrap table-scroll"><table class="table"><thead><tr>
          <th style="width:30px"><input type="checkbox" id="cftv-all" onchange="Cftv.marcarTodos(this.checked)" title="Selecionar todas"></th>
          <th>Cliente</th><th>Filial</th><th>Problema</th><th>Câmeras</th><th>Desde</th><th>Status</th><th>Cobranças</th><th>Ações</th>
        </tr></thead><tbody id="cftv-tbody"><tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px">Carregando...</td></tr></tbody></table></div>
      </div>
    </div>`;
    if (cfg) cfg.insertAdjacentHTML('beforebegin', sec); else document.querySelector('.main').insertAdjacentHTML('beforeend', sec);
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="cftv-modal"><div class="modal">
      <div class="modal-header"><h3 id="cftv-modal-t">Nova pendência de CFTV</h3><button class="modal-close" onclick="Cftv.fechar()">&times;</button></div>
      <div class="modal-body"><input type="hidden" id="cftv-id">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <div class="form-group"><label class="form-label">Cliente *</label><input class="form-input" id="cftv-cliente" placeholder="Ex.: COND. JARDINS ORQUIDEA"></div>
          <div class="form-group"><label class="form-label">Conta</label><input class="form-input" id="cftv-conta" placeholder="Ex.: 2200"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group"><label class="form-label">Filial</label><select class="form-input" id="cftv-filial"><option value="">—</option>${FILIAIS.map(f => `<option>${f}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Problema *</label><select class="form-input" id="cftv-problema">${PROBLEMAS.map(p => `<option>${p}</option>`).join('')}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group"><label class="form-label">Câmeras afetadas</label><input class="form-input" id="cftv-cameras" placeholder="Ex.: CAM 03, CAM 05 (portão)"></div>
          <div class="form-group"><label class="form-label">Detectado em</label><input class="form-input" id="cftv-data" type="date"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="cftv-status">${Object.keys(STATUS).map(s => `<option>${s}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Responsável</label><input class="form-input" id="cftv-resp" placeholder="Quem acompanha"></div>
        </div>
        <div class="form-group"><label class="form-label">Detalhes</label><textarea class="form-input" id="cftv-detalhe" rows="3" style="resize:vertical" placeholder="O que foi visto, testes feitos, contato no local..."></textarea></div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)"><button class="btn btn-outline" onclick="Cftv.fechar()">Cancelar</button><button class="btn btn-accent" id="cftv-salvar" onclick="Cftv.salvar()">Salvar</button></div>
    </div></div>
    <div class="modal-overlay" id="cftv-mail"><div class="modal" style="max-width:760px">
      <div class="modal-header"><h3>Cobrança de pendências por e-mail</h3><button class="modal-close" onclick="Cftv.fecharMail()">&times;</button></div>
      <div class="modal-body" style="max-height:70vh;overflow:auto">
        <div id="cftv-mail-aviso" style="font-size:12px;color:var(--text-muted);margin-bottom:12px"></div>
        <div id="cftv-mail-grupos"></div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)"><button class="btn btn-outline" onclick="Cftv.fecharMail()">Fechar</button></div>
    </div></div>`);
    // abre/atualiza a aba junto com a navegação do Backoffice
    if (typeof window.showSection === 'function' && !window.showSection.__cftv) {
      const orig = window.showSection;
      window.showSection = function (id) { const r = orig.apply(this, arguments); if (id === 'cftv' || (typeof currentSection !== 'undefined' && currentSection === 'cftv')) carregar(); return r; };
      window.showSection.__cftv = true;
    }
  }

  // ---------- dados ----------
  async function carregar() {
    if (typeof sb === 'undefined' || !sb) return;
    const { data, error } = await sb.from('cftv_pendencias').select('*').order('detectado_em', { ascending: true });
    if (error) { const tb = $('cftv-tbody'); if (tb) tb.innerHTML = `<tr><td colspan="9" style="color:var(--danger);padding:16px">Erro ao carregar: ${esc(error.message)}</td></tr>`; return; }
    ST.lista = data || []; ST.carregado = true;
    const ids = new Set(ST.lista.map(p => p.id)); ST.sel.forEach(id => { if (!ids.has(id)) ST.sel.delete(id); });
    render();
  }
  function filtrados() {
    return ST.lista.filter(p => {
      if (ST.status === 'abertas' && !aberta(p)) return false;
      if (ST.status && ST.status !== 'abertas' && p.status !== ST.status) return false;
      if (ST.filial && p.filial !== ST.filial) return false;
      if (ST.busca && !nz(`${p.cliente} ${p.conta} ${p.cameras}`).includes(nz(ST.busca))) return false;
      return true;
    });
  }
  function render() {
    const L = ST.lista, ab = L.filter(aberta);
    const badge = $('badge-cftv'); if (badge) badge.textContent = ab.length || '';
    if (!$('cftv-kpis')) return;
    const nPend = L.filter(p => p.status === 'Pendente').length, nCob = L.filter(p => p.status === 'Cobrado' || p.status === 'Em atendimento').length;
    const mes = hoje().slice(0, 7), resMes = L.filter(p => p.status === 'Resolvido' && String(p.resolvido_em || '').slice(0, 7) === mes).length;
    const velha = ab.reduce((m, p) => Math.max(m, dias(p.detectado_em)), 0);
    const kc = typeof kpiCard === 'function' ? kpiCard : (o => `<div class="kpi-card"><div class="kpi-label">${o.label}</div><div class="kpi-value">${o.value}</div></div>`);
    $('cftv-kpis').innerHTML =
      kc({ label: 'Em aberto', value: ab.length, color: ab.length ? 'danger' : 'neutral', icon: 'alert', sub: 'clientes com CFTV pendente' }) +
      kc({ label: 'Ainda não cobradas', value: nPend, color: nPend ? 'warning' : 'neutral', icon: 'clock', tag: nPend ? 'cobrar' : 'em dia', tagCls: nPend ? 'kpi-tag-down' : 'kpi-tag-up' }) +
      kc({ label: 'Cobradas / em atendimento', value: nCob, color: 'blue', icon: 'search' }) +
      kc({ label: 'Resolvidas no mês', value: resMes, color: 'accent', icon: 'check', sub: velha ? `mais antiga em aberto: ${velha} dia(s)` : '' });
    const F = filtrados();
    $('cftv-tbody').innerHTML = F.length ? F.map(p => {
      const d = dias(p.detectado_em), cor = STATUS[p.status] || '#6b7280';
      const idade = aberta(p) ? `<div style="font-size:11px;color:${d > 7 ? 'var(--danger)' : 'var(--text-muted)'}">há ${d} dia(s)</div>` : '';
      return `<tr>
        <td><input type="checkbox" ${ST.sel.has(p.id) ? 'checked' : ''} onchange="Cftv.marcar(${p.id}, this.checked)"></td>
        <td><b>${esc(p.cliente)}</b>${p.conta ? `<div style="font-size:11px;color:var(--text-muted)">Conta ${esc(p.conta)}</div>` : ''}</td>
        <td>${esc(p.filial || '—')}</td>
        <td>${esc(p.problema)}${p.detalhe ? ` <span title="${esc(p.detalhe)}" style="cursor:help">📝</span>` : ''}</td>
        <td style="font-size:12px">${esc(p.cameras || '—')}</td>
        <td>${fmtD(p.detectado_em)}${idade}</td>
        <td><span class="badge" style="color:${cor};background:${cor}1f">${esc(p.status)}</span></td>
        <td style="font-size:12px">${p.qtd_cobrancas ? `${p.qtd_cobrancas}x<div style="font-size:11px;color:var(--text-muted)">última ${fmtD(p.ultima_cobranca)}</div>` : '—'}</td>
        <td style="white-space:nowrap">${aberta(p) ? `<button class="btn btn-outline btn-sm" onclick="Cftv.resolver(${p.id})" title="Marcar como resolvida" style="margin-right:4px">✓</button>` : ''}<button class="btn btn-outline btn-sm" onclick="Cftv.abrir(${p.id})" style="margin-right:4px">Editar</button><button class="btn btn-outline btn-sm" onclick="Cftv.excluir(${p.id})" style="color:var(--danger)">Excluir</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">${ST.lista.length ? 'Nenhuma pendência com esses filtros.' : 'Nenhuma pendência cadastrada. Use "+ Nova pendência".'}</td></tr>`;
    const all = $('cftv-all'); if (all) all.checked = F.length > 0 && F.every(p => ST.sel.has(p.id));
  }
  function filtro(k, v) { ST[k] = v; render(); if (k === 'busca') { const el = $('cftv-busca'); if (el && document.activeElement !== el) el.focus(); } }
  function marcar(id, on) { if (on) ST.sel.add(id); else ST.sel.delete(id); render(); }
  function marcarTodos(on) { filtrados().forEach(p => on ? ST.sel.add(p.id) : ST.sel.delete(p.id)); render(); }

  // ---------- cadastro ----------
  function abrir(id) {
    montar();
    const p = id ? ST.lista.find(x => x.id === id) : null;
    $('cftv-modal-t').textContent = p ? 'Editar pendência de CFTV' : 'Nova pendência de CFTV';
    $('cftv-id').value = p ? p.id : '';
    $('cftv-cliente').value = p ? p.cliente : ''; $('cftv-conta').value = p ? (p.conta || '') : '';
    $('cftv-filial').value = p ? (p.filial || '') : ''; $('cftv-problema').value = p ? p.problema : PROBLEMAS[0];
    $('cftv-cameras').value = p ? (p.cameras || '') : ''; $('cftv-data').value = p ? (p.detectado_em || hoje()) : hoje();
    $('cftv-status').value = p ? p.status : 'Pendente'; $('cftv-resp').value = p ? (p.responsavel || '') : '';
    $('cftv-detalhe').value = p ? (p.detalhe || '') : '';
    $('cftv-modal').classList.add('open'); setTimeout(() => $('cftv-cliente').focus(), 50);
  }
  function fechar() { $('cftv-modal').classList.remove('open'); }
  async function salvar() {
    const cliente = $('cftv-cliente').value.trim();
    if (!cliente) { toast('Preencha o cliente.', true); return; }
    const id = $('cftv-id').value, status = $('cftv-status').value;
    const antes = id ? ST.lista.find(x => x.id === Number(id)) : null;
    const obj = { cliente: cliente.toUpperCase(), conta: $('cftv-conta').value.trim() || null, filial: $('cftv-filial').value || null, problema: $('cftv-problema').value,
      cameras: $('cftv-cameras').value.trim() || null, detectado_em: $('cftv-data').value || hoje(), status, responsavel: $('cftv-resp').value.trim() || null,
      detalhe: $('cftv-detalhe').value.trim() || null, updated_at: new Date().toISOString(),
      resolvido_em: status === 'Resolvido' ? ((antes && antes.resolvido_em) || hoje()) : null };
    const b = $('cftv-salvar'); b.disabled = true;
    const r = id ? await sb.from('cftv_pendencias').update(obj).eq('id', Number(id)) : await sb.from('cftv_pendencias').insert(obj);
    b.disabled = false;
    if (r.error) { toast('Erro: ' + r.error.message, true); return; }
    toast(id ? 'Pendência atualizada!' : 'Pendência registrada!'); fechar(); carregar();
  }
  async function resolver(id) {
    const r = await sb.from('cftv_pendencias').update({ status: 'Resolvido', resolvido_em: hoje(), updated_at: new Date().toISOString() }).eq('id', id);
    if (r.error) { toast('Erro: ' + r.error.message, true); return; }
    toast('Marcada como resolvida.'); ST.sel.delete(id); carregar();
  }
  async function excluir(id) {
    const p = ST.lista.find(x => x.id === id);
    if (!confirm(`Excluir a pendência de ${p ? p.cliente : 'este cliente'}?`)) return;
    const r = await sb.from('cftv_pendencias').delete().eq('id', id);
    if (r.error) { toast('Erro: ' + r.error.message, true); return; }
    toast('Pendência excluída.'); ST.sel.delete(id); carregar();
  }
  function toast(m, bad) { if (typeof showToast === 'function') showToast(m, bad); else alert(m); }

  // ---------- cobrança em lote (Zimbra, igual aos Fornecedores) ----------
  const DESTINOS = {
    'Servis Ceará': ['luizmagalhaes@serviseletronica.com.br', 'pedro.netto@serviseletronica.com.br', 'auriceliocosta@serviseletronica.com.br', 'danyelmendes@serviseletronica.com.br', 'rennanmendes@serviseletronica.com.br'],
    'Secopi Piauí': ['tecnicasecopi@serviseletronica.com.br', 'luizmagalhaes@serviseletronica.com.br', 'artefiosecopi@serviseletronica.com.br', 'franciscojesus@serviseletronica.com.br'],
    'Servis Maranhão': ['luizmagalhaes@serviseletronica.com.br', 'kleytonsilva@serviseletronica.com.br']
  };
  const ZIMBRA = 'https://webmail.servisgr.com.br/';
  const paraDe = f => lsGet('cftv_para_' + f, '') || (DESTINOS[f] || []).join(';');
  let grupos = [];
  function textoGrupo(f, itens) {
    const linhas = itens.map((p, i) => {
      const d = dias(p.detectado_em);
      return `${i + 1}. ${p.conta ? p.conta + ' - ' : ''}${p.cliente}\n   Problema: ${p.problema}${p.cameras ? ' (' + p.cameras + ')' : ''}\n   Pendente desde ${fmtD(p.detectado_em)} (${d} dia${d === 1 ? '' : 's'})${p.qtd_cobrancas ? ` · já cobrado ${p.qtd_cobrancas}x` : ''}${p.detalhe ? `\n   Obs.: ${p.detalhe.replace(/\s+/g, ' ')}` : ''}`;
    }).join('\n\n');
    return {
      assunto: `[Backoffice] Pendências de CFTV ${f} — ${fmtD(hoje())} (${itens.length} cliente${itens.length > 1 ? 's' : ''})`,
      corpo: `Prezados, bom dia.\n\nSegue a relação de clientes da ${f} com pendência de CFTV (${itens.length} no total). Pedimos verificação e retorno com a previsão de atendimento de cada um:\n\n${linhas}\n\nFavor responder este e-mail informando o andamento.\n\n---\nEnviado via Backoffice Servis`
    };
  }
  function cobrar() {
    const lote = ST.sel.size ? ST.lista.filter(p => ST.sel.has(p.id) && aberta(p)) : filtrados().filter(aberta);
    if (!lote.length) { toast('Não há pendências em aberto para cobrar.', true); return; }
    const por = {};
    lote.forEach(p => { const f = p.filial || 'Sem filial'; (por[f] = por[f] || []).push(p); });
    grupos = Object.keys(por).sort().map(f => Object.assign({ filial: f, itens: por[f], enviado: false }, textoGrupo(f, por[f])));
    $('cftv-mail-aviso').innerHTML = `${lote.length} pendência(s) ${ST.sel.size ? 'selecionada(s)' : 'em aberto (com os filtros atuais)'}, em <b>${grupos.length} e-mail(s)</b> — um por filial, já com os responsáveis de cada uma. "Abrir no Zimbra" abre o e-mail pronto; é só clicar em Enviar lá.`;
    renderGrupos();
    $('cftv-mail').classList.add('open');
  }
  function renderGrupos() {
    $('cftv-mail-grupos').innerHTML = grupos.map((g, i) => `<div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px${g.enviado ? ';opacity:.6' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px"><b>${esc(g.filial)} · ${g.itens.length} cliente(s)</b>${g.enviado ? '<span class="badge" style="color:#1abf8f;background:#1abf8f1f">Cobrado</span>' : ''}</div>
      <div class="form-group"><label class="form-label">Para</label><input class="form-input" id="cftv-g-para-${i}" value="${esc(paraDe(g.filial))}" placeholder="${DESTINOS[g.filial] ? '' : 'Sem lista cadastrada para esta filial — digite os e-mails (separados por ;)'}"></div>
      <div class="form-group"><label class="form-label">Assunto</label><input class="form-input" id="cftv-g-assunto-${i}" value="${esc(g.assunto)}"></div>
      <details><summary style="cursor:pointer;font-size:12px;color:var(--text-muted)">Ver / editar mensagem</summary><textarea class="form-input" id="cftv-g-corpo-${i}" rows="10" style="margin-top:8px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px">${esc(g.corpo)}</textarea></details>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn btn-outline btn-sm" onclick="Cftv.copiar(${i})">Copiar texto</button><button class="btn btn-accent btn-sm" onclick="Cftv.enviar(${i})">Abrir no Zimbra</button></div>
    </div>`).join('');
  }
  function fecharMail() { $('cftv-mail').classList.remove('open'); }
  function dadosGrupo(i) { return { para: $('cftv-g-para-' + i).value.trim().replace(/\s*[,;]\s*/g, ';'), assunto: $('cftv-g-assunto-' + i).value, corpo: $('cftv-g-corpo-' + i).value }; }
  async function copiar(i) {
    const d = dadosGrupo(i), t = `Para: ${d.para}\nAssunto: ${d.assunto}\n\n${d.corpo}`;
    try { await navigator.clipboard.writeText(t); toast('Texto copiado. Cole no seu e-mail.'); } catch (e) { toast('Não foi possível copiar.', true); }
  }
  function enviar(i) {
    const g = grupos[i], d = dadosGrupo(i);
    if (!d.para) { toast('Preencha o campo Para.', true); return; }
    if (d.para !== (DESTINOS[g.filial] || []).join(';')) lsSet('cftv_para_' + g.filial, d.para);
    window.open(`${ZIMBRA}?view=compose&to=${encodeURIComponent(d.para)}&subject=${encodeURIComponent(d.assunto)}&body=${encodeURIComponent(d.corpo)}`, '_blank');
    toast('Zimbra aberto! Verifique e envie o e-mail.');
    setTimeout(() => registrar(i), 1000);
  }
  async function registrar(i) {
    const g = grupos[i];
    if (!g || g.enviado || !confirm(`Enviou o e-mail da ${g.filial}? Marcar as ${g.itens.length} pendência(s) como "Cobrado" (hoje)?`)) return;
    const agora = new Date().toISOString();
    const res = await Promise.all(g.itens.map(p => sb.from('cftv_pendencias').update({ status: p.status === 'Pendente' ? 'Cobrado' : p.status, qtd_cobrancas: (p.qtd_cobrancas || 0) + 1, ultima_cobranca: agora, updated_at: agora }).eq('id', p.id)));
    const err = res.find(r => r.error);
    if (err) { toast('Erro ao registrar cobrança: ' + err.error.message, true); return; }
    toast(`${g.itens.length} pendência(s) da ${g.filial} marcadas como cobradas.`);
    g.enviado = true; g.itens.forEach(p => ST.sel.delete(p.id)); renderGrupos(); carregar();
    if (grupos.every(x => x.enviado)) fecharMail();
  }

  window.Cftv = { abrir, fechar, salvar, resolver, excluir, cobrar, fecharMail, copiar, enviar, filtro, marcar, marcarTodos, carregar };
  function iniciar() { montar(); const espera = () => { if (typeof sb !== 'undefined' && sb) carregar(); else setTimeout(espera, 800); }; espera(); if (location.hash === '#cftv' && typeof showSection === 'function') setTimeout(() => showSection('cftv', true), 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
