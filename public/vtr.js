// ===== DESLOCAMENTO DE VTR: o Dashboard VTR dentro da Gestão de Monitoramento =====
(function () {
  'use strict';
  const URL_VTR = 'https://dashboard-vtr-q5hx.vercel.app/';
  const $ = id => document.getElementById(id);
  const ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="7" width="15" height="10" rx="2"/><path d="M16 10h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg>';
  let tentativas = 0;

  function montar() {
    if ($('sec-vtr')) return;
    const itens = document.querySelector('.nav-group[data-group="monitoramento"] .nav-group-items');
    if (!itens) { if (tentativas++ < 20) setTimeout(montar, 300); return; } // espera a Gestão do Alarme criar o grupo
    if (typeof titles === 'object') titles.vtr = ['Deslocamento de VTR', 'Dashboard VTR — deslocamentos, rotas, Base Ativa e saúde dos clientes'];
    itens.insertAdjacentHTML('beforeend', `<div class="nav-item" data-section="vtr" onclick="showSection('vtr')">${ico}<span>Deslocamento VTR</span></div>`);
    const sec = `<div class="section" id="sec-vtr">
      <div class="card" style="overflow:hidden">
        <div class="card-header" style="flex-wrap:wrap;gap:8px">
          <div><div class="card-title">Dashboard de deslocamento das VTRs</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">Mesmo painel de sempre, agora dentro da Gestão de Monitoramento. Na primeira vez, entre com o seu e-mail e senha do Dashboard VTR.</div></div>
          <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="Vtr.recarregar()">↻ Recarregar</button><a class="btn btn-outline btn-sm" href="${URL_VTR}" target="_blank" rel="noopener">Abrir em nova aba ↗</a></div>
        </div>
        <div id="vtr-wrap" style="position:relative;height:calc(100vh - 190px);min-height:560px;background:var(--bg-soft)">
          <div id="vtr-load" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px">Carregando o Dashboard VTR...</div>
        </div>
      </div>
    </div>`;
    const cfg = $('sec-config');
    if (cfg) cfg.insertAdjacentHTML('beforebegin', sec); else document.querySelector('.content').insertAdjacentHTML('beforeend', sec);
    if (typeof window.showSection === 'function' && !window.showSection.__vtr) {
      const orig = window.showSection;
      window.showSection = function (id) { const r = orig.apply(this, arguments); if (id === 'vtr') carregar(); return r; };
      window.showSection.__vtr = true;
    }
    if (location.hash === '#vtr' && typeof showSection === 'function') setTimeout(() => showSection('vtr', true), 300);
  }

  // só carrega o painel quando a aba é aberta (não pesa o resto do Backoffice)
  function carregar() {
    const wrap = $('vtr-wrap');
    if (!wrap || $('vtr-frame')) return;
    const f = document.createElement('iframe');
    f.id = 'vtr-frame'; f.src = URL_VTR; f.title = 'Dashboard VTR';
    f.setAttribute('allow', 'clipboard-write; fullscreen');
    f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent';
    f.onload = () => { const l = $('vtr-load'); if (l) l.remove(); };
    wrap.appendChild(f);
  }
  function recarregar() { const f = $('vtr-frame'); if (f) f.src = URL_VTR; else carregar(); }

  window.Vtr = { carregar, recarregar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
