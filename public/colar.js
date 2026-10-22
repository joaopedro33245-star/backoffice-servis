// ===== COLAR E-MAIL: preenche o formulário de Seguros a partir do texto do e-mail =====
// Funciona no navegador, sem custo e sem enviar o texto para fora. A pessoa sempre confere e clica em Salvar.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const limpa = s => String(s || '').replace(/\s+/g, ' ').trim();
  const titulo = s => limpa(s).toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, w => w.toLowerCase());
  const NAO_COPIAR = /^(cpf|cnpj|rg|senha|password|token)\b/i;

  function campo(txt, ...nomes) {
    for (const n of nomes) {
      const m = txt.match(new RegExp('^\\s*' + n + '\\s*[:\\-–]\\s*(.+)$', 'im'));
      if (m && limpa(m[1])) return limpa(m[1]);
    }
    return '';
  }

  function analisarSeguro(txt) {
    const r = { omitidos: [] };
    // data (primeira dd/mm/aaaa do texto)
    const d = txt.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (d) r.data = `${d[3]}-${d[2]}-${d[1]}`;
    // conta e cliente: "2200 - COND. NOME (AM)"
    const c = txt.match(/\b(\d{3,6})\s*[-–]\s*((?:COND|CONDOM|RESID|EDIF|ED\.|CLIENTE|LOJA|EMPRESA)[^\n,;]*?)(?=\s*,|\s+em\s+raz|\s+devido|\s+por\s|\n|$)/i)
      || txt.match(/\b(\d{3,6})\s*[-–]\s*([A-ZÀ-Ú][^\n,;]{3,80}?)(?=\s*,|\s+em\s+raz|\n|$)/);
    if (c) { r.conta = c[1]; r.cliente = limpa(c[2]); }
    if (!r.cliente) { const cl = campo(txt, 'Cliente', 'Condom[ií]nio'); if (cl) r.cliente = cl; }
    if (!r.conta) { const ct = campo(txt, 'Conta', 'C[oó]digo'); if (ct) r.conta = ct.replace(/\D/g, ''); }
    // seguradora e protocolo
    const seg = campo(txt, 'Empresa', 'Seguradora', 'Cia', 'Companhia');
    if (seg) r.seguradora = /zurich/i.test(seg) ? 'Zurich Seguros' : /porto/i.test(seg) ? 'Porto Seguro' : /tokio/i.test(seg) ? 'Tokio Marine' : /allianz/i.test(seg) ? 'Allianz' : /mapfre/i.test(seg) ? 'Mapfre' : /hdi/i.test(seg) ? 'HDI Seguros' : titulo(seg);
    r.sinistro = campo(txt, 'Protocolo', 'N[ºo°]?\\.?\\s*(?:do\\s+)?sinistro', 'Sinistro', 'Chamado');
    // tipo + motivo
    const motivo = (txt.match(/em\s+raz[ãa]o\s+de\s+(?:o\s+condom[ií]nio\s+)?(?:est[aá]\s+com\s+)?([\s\S]+?)(?:\.\s|\.\n|\n\s*\n|$)/i) || [])[1];
    const mot = motivo ? limpa(motivo).replace(/\s*\.$/, '').replace(/^\w/, ch => ch.toLowerCase()) : '';
    let tipo = '';
    if (/vigilante|vigil[aâ]ncia/i.test(txt)) tipo = 'Vigilante de apoio';
    else if (/roubo/i.test(txt)) tipo = 'Roubo';
    else if (/furto/i.test(txt)) tipo = 'Furto';
    else if (/inc[eê]ndio/i.test(txt)) tipo = 'Incêndio';
    else if (/dano\s+el[eé]trico|descarga|raio/i.test(txt)) tipo = 'Dano elétrico';
    else if (/vidro/i.test(txt)) tipo = 'Quebra de vidros';
    r.tipo = tipo ? tipo + (mot ? ` (${mot})` : '') : mot;
    // status
    r.status = /negad/i.test(txt) ? 'Negado' : /aprovad|autorizad/i.test(txt) ? 'Aprovado' : /conclu[ií]d|finalizad|encerrad/i.test(txt) ? 'Concluído' : /em\s+an[aá]lise/i.test(txt) ? 'Em análise' : 'Pendente';
    // valor
    const v = txt.match(/R\$\s*([\d.]+,\d{2}|\d+(?:[.,]\d{2})?)/);
    if (v) r.valor = Number(v[1].replace(/\./g, '').replace(',', '.'));
    // e-mail
    const em = txt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (em) r.email = em[0];
    // observações: motivo + frases úteis + linhas "Rótulo: valor" (sem documentos e senhas)
    const obs = [];
    if (r.tipo) obs.push(`Chamado aberto${d ? ' em ' + d[0] : ''}: ${r.tipo.replace(' (', ' — ').replace(/\)$/, '')}.`);
    const pend = txt.match(/^(pendente[^\n]+)$/im); if (pend) obs.push(limpa(pend[1]).replace(/\.?$/, '.'));
    txt.split('\n').forEach(l => {
      const m = l.match(/^\s*([A-Za-zÀ-ú .ºª]{2,30}?)\s*[:\-–]\s*(.+)$/);
      if (!m) return;
      const rot = limpa(m[1]), val = limpa(m[2]);
      if (!val) return;
      if (NAO_COPIAR.test(rot)) { r.omitidos.push(rot); return; }
      if (/^(protocolo|empresa|seguradora|cliente|conta|sinistro|status|valor|att|atenciosamente)$/i.test(rot)) return;
      obs.push(`${titulo(rot)}: ${/prestador|atendente|respons|t[eé]cnico|nome/i.test(rot) ? titulo(val) : val}.`);
    });
    r.obs = obs.join(' ');
    return r;
  }

  function preencher() {
    const txt = $('seg-colar-txt').value;
    const msg = $('seg-colar-msg');
    if (limpa(txt).length < 20) { msg.textContent = 'Cole o texto do e-mail primeiro.'; msg.className = 'cl-msg bad'; return; }
    const r = analisarSeguro(txt);
    const set = (id, v) => { const el = $(id); if (el && v !== undefined && v !== null && v !== '') { el.value = v; el.classList.add('cl-auto'); } };
    ['seg-cliente', 'seg-conta', 'seg-tipo', 'seg-data', 'seg-valor', 'seg-seguradora', 'seg-sinistro', 'seg-obs', 'seg-email'].forEach(id => $(id) && $(id).classList.remove('cl-auto'));
    set('seg-cliente', r.cliente); set('seg-conta', r.conta); set('seg-tipo', r.tipo); set('seg-data', r.data);
    set('seg-status', r.status); set('seg-valor', r.valor); set('seg-seguradora', r.seguradora); set('seg-sinistro', r.sinistro);
    set('seg-obs', r.obs); set('seg-email', r.email);
    const faltam = [!r.cliente && 'cliente', !r.conta && 'conta', !r.data && 'data', !r.seguradora && 'seguradora'].filter(Boolean);
    const dup = r.sinistro && (DATA.seguros || []).find(s => String(s.numero_sinistro || '') === r.sinistro && String(s.id) !== String($('seg-edit-id').value || ''));
    const partes = ['Campos preenchidos em azul — confira antes de salvar.'];
    if (faltam.length) partes.push('Não encontrei: ' + faltam.join(', ') + '.');
    if (r.omitidos.length) partes.push('Não copiei ' + [...new Set(r.omitidos)].join(' e ') + ' (dados sensíveis).');
    if (dup) partes.push(`Atenção: já existe uma solicitação com o protocolo ${r.sinistro} (${dup.cliente}).`);
    msg.textContent = partes.join(' ');
    msg.className = 'cl-msg ' + (dup ? 'bad' : faltam.length ? 'warn' : 'ok');
    $('seg-colar').open = false;
  }

  function montar() {
    const body = document.querySelector('#seg-modal .modal-body');
    if (!body || $('seg-colar')) return;
    body.insertAdjacentHTML('afterbegin', `<details class="cl-box" id="seg-colar" open>
      <summary>Colar e-mail da seguradora <small>preenche o formulário sozinho</small></summary>
      <textarea class="form-input" id="seg-colar-txt" placeholder="Cole aqui o texto do e-mail (protocolo, empresa, condomínio, data...)"></textarea>
      <div class="cl-acoes"><button type="button" class="btn btn-accent btn-sm" onclick="Colar.seguro()">Preencher formulário</button></div>
    </details><div class="cl-msg" id="seg-colar-msg"></div>`);
    const st = document.createElement('style');
    st.textContent = `.cl-box{border:1px dashed var(--primary);background:var(--primary-50);border-radius:10px;padding:10px 12px;margin-bottom:12px}
      .cl-box summary{cursor:pointer;font-weight:700;font-size:13px;color:var(--primary)} .cl-box summary small{font-weight:500;color:var(--text-muted);margin-left:6px}
      .cl-box textarea{margin-top:10px;min-height:120px;font-size:12.5px} .cl-acoes{display:flex;justify-content:flex-end;margin-top:8px}
      .cl-msg:empty{display:none} .cl-msg{font-size:12.5px;border-radius:8px;padding:8px 10px;margin-bottom:12px}
      .cl-msg.ok{background:var(--accent-dim);color:var(--accent)} .cl-msg.warn{background:var(--warning-dim);color:#b45309} .cl-msg.bad{background:var(--danger-dim);color:var(--danger)}
      .form-input.cl-auto{border-color:var(--primary);background:var(--primary-50)}`;
    document.head.appendChild(st);
  }
  // a cada abertura do formulário, limpa a área de colar
  const _abrir = window.openSeguroModal;
  if (typeof _abrir === 'function') window.openSeguroModal = function () {
    montar();
    const r = _abrir.apply(this, arguments);
    if ($('seg-colar-txt')) { $('seg-colar-txt').value = ''; $('seg-colar-msg').textContent = ''; $('seg-colar-msg').className = 'cl-msg'; $('seg-colar').open = !$('seg-edit-id').value; }
    document.querySelectorAll('#seg-modal .cl-auto').forEach(el => el.classList.remove('cl-auto'));
    return r;
  };
  window.Colar = { seguro: preencher, analisarSeguro };
})();
