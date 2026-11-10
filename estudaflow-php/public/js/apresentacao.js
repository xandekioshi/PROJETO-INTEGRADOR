// ============================================================
// apresentacao.js — Ferramenta "Apresentação" (lista de slides)
// ============================================================

function apAddSlide() {
  slides.push({ titulo: 'Slide ' + (slides.length + 1), corpo: '' });
  renderSlides();
}

function renderSlides() {
  const list = document.getElementById('slides-list'); if (!list) return;
  list.innerHTML = slides.map((s, i) => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;gap:10px;align-items:flex-start">
      <div style="background:var(--surface2);color:var(--text3);font-size:.75rem;padding:4px 8px;border-radius:5px;flex-shrink:0">${i + 1}</div>
      <div style="flex:1">
        <input type="text" value="${escapeHTML(s.titulo)}" onchange="slides[${i}].titulo=this.value" style="background:transparent;border:none;color:var(--text);font-weight:500;font-size:.9rem;outline:none;width:100%;margin-bottom:6px" />
        <textarea rows="2" style="font-size:.8rem" placeholder="Conteúdo do slide..." onchange="slides[${i}].corpo=this.value">${escapeHTML(s.corpo)}</textarea>
      </div>
      <button class="btn-sm" onclick="slides.splice(${i},1);renderSlides()">🗑</button>
    </div>`).join('');
}
