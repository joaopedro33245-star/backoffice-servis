// ===== DESLOCAMENTO DE VTR: abre o Dashboard VTR em outra página (igual às Demandas) =====
(function () {
  'use strict';
  const URL_VTR = 'https://dashboard-vtr-q5hx.vercel.app/';
  const tema = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const abrir = () => { location.href = URL_VTR + '?origem=backoffice&tema=' + tema(); };
  const $ = id => document.getElementById(id);
  const ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="7" width="15" height="10" rx="2"/><path d="M16 10h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg>';
  let tentativas = 0;

  function montar() {
    if (document.querySelector('.nav-item[data-section="vtr"]')) return;
    const itens = document.querySelector('.nav-group[data-group="monitoramento"] .nav-group-items');
    if (!itens) { if (tentativas++ < 20) setTimeout(montar, 300); return; } // espera a Gestão do Alarme criar o grupo
    itens.insertAdjacentHTML('beforeend', `<div class="nav-item" data-section="vtr" onclick="Vtr.abrir()" title="Abre o Dashboard VTR">${ico}<span>Deslocamento VTR</span></div>`);
    if (typeof window.showSection === 'function' && !window.showSection.__vtr) {
      const orig = window.showSection;
      window.showSection = function (id) { if (id === 'vtr') { abrir(); return Promise.resolve(); } return orig.apply(this, arguments); };
      window.showSection.__vtr = true;
    }
    if (location.hash === '#vtr') abrir();
  }

  window.Vtr = { abrir };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
