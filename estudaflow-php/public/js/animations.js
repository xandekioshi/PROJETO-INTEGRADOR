/* animations.js
 * Carregar POR ÚLTIMO (depois de main.js).
 * Não substitui nenhuma função sua: apenas "embrulha" as existentes
 * (goPage, semanaNav, filterMetas, filterBib, buscarLivros) e observa listas.
 * Se uma função não existir, ela é ignorada sem erro.
 */
(function () {
  'use strict';

  const EASE = 'cubic-bezier(.2,.7,.2,1)';
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byId = (id) => document.getElementById(id);

  /* Itens que entram em cascata quando uma página é aberta */
  const PAGE_ITEMS =
    '.stat-card, .tool-card, .meta-item, .book-card, .file-card, .folder-row, .day-col, .page > .card, .grid-2 > .card';

  /* Listas preenchidas via JS que devem animar quando recebem itens */
  const LISTS = ['metas-list', 'books-list', 'files-grid', 'week-grid', 'dash-activity', 'dash-progress'];

  /* Entrada em cascata (fade + subida leve) */
  function staggerIn(els, opts) {
    if (reduced()) return;
    const o = Object.assign({ step: 40, max: 12, y: 10 }, opts);
    const now = performance.now();
    Array.from(els).slice(0, o.max).forEach((el, i) => {
      if (el._t && now - el._t < 600) return; // já animado há pouco: evita animar duas vezes
      el._t = now;
      el.animate(
        [{ opacity: 0, transform: `translateY(${o.y}px)` }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 340, delay: i * o.step, easing: EASE, fill: 'backwards' }
      );
    });
  }

  /* Troca de conteúdo de um container (filtros, semana anterior/próxima) */
  function swap(el, dir) {
    if (!el || reduced()) return;
    el.animate(
      [{ opacity: 0, transform: `translate(${(dir || 0) * 24}px, 6px)` }, { opacity: 1, transform: 'translate(0, 0)' }],
      { duration: 280, easing: EASE }
    );
  }

  /* Envolve uma função global existente, executando "after" depois dela */
  function wrap(name, after) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig._animWrapped) return;
    const wrapped = function () {
      const result = orig.apply(this, arguments);
      try { after.apply(null, arguments); } catch (e) { /* animação nunca deve quebrar o app */ }
      return result;
    };
    wrapped._animWrapped = true;
    window[name] = wrapped;
  }

  /* Contagem animada nos números do dashboard ("5" ou "3/8") */
  const countObserver = new MutationObserver((records) => {
    const seen = new Set();
    records.forEach((r) => {
      const node = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      const el = node && node.closest('.stat-value');
      if (el && !seen.has(el)) { seen.add(el); runCount(el); }
    });
  });

  function runCount(el) {
    const finalText = el.textContent.trim();
    if (el._final === finalText) return;
    el._final = finalText;
    cancelAnimationFrame(el._raf);
    if (reduced() || !/\d/.test(finalText)) return;

    const t0 = performance.now();
    const dur = 700;
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = p < 1 ? finalText.replace(/\d+/g, (m) => Math.round(Number(m) * e)) : finalText;
      countObserver.takeRecords(); // descarta as mudanças feitas por nós mesmos
      if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  function init() {
    /* 1. Cascata ao abrir uma página */
    wrap('goPage', (name) => {
      const page = byId('page-' + name);
      if (page) staggerIn(page.querySelectorAll(PAGE_ITEMS));
    });

    /* 2. Semana anterior / próxima desliza para o lado certo */
    wrap('semanaNav', (dir) => swap(byId('week-grid'), Number(dir) || 0));

    /* 3. Filtros e busca fazem a lista "respirar" */
    wrap('filterMetas', () => swap(byId('metas-list')));
    wrap('filterBib', () => swap(byId('books-list')));
    wrap('buscarLivros', () => swap(byId('books-list')));

    /* 4. Listas: anima itens novos (primeira carga ou item adicionado).
          Re-renderizações completas (ex.: marcar meta como concluída) não animam. */
    LISTS.forEach((id) => {
      const box = byId(id);
      if (!box) return;
      const countItems = () => Array.from(box.children).filter((c) => !c.classList.contains('empty-state')).length;
      let prevItems = countItems();

      new MutationObserver((records) => {
        const nowItems = countItems();
        let added = [];
        let removed = 0;
        records.forEach((r) => {
          removed += r.removedNodes.length;
          r.addedNodes.forEach((n) => { if (n.nodeType === 1) added.push(n); });
        });

        const visible = box.offsetParent !== null;
        if (visible) {
          if (removed === 0 && added.length) staggerIn(added);
          else if (prevItems === 0 && nowItems > 0) staggerIn(box.children);
        }
        prevItems = nowItems;
      }).observe(box, { childList: true });
    });

    /* 5. Números do dashboard contam até o valor final */
    document.querySelectorAll('.stat-card .stat-value').forEach((el) => {
      countObserver.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();