// ============================================================
// cronograma.js — Página "Cronograma Semanal": grade de dias,
// navegação entre semanas e criação de eventos
// ============================================================

function renderCronograma() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + currentWeekOffset * 7);
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const grid = document.getElementById('week-grid'); if (!grid) return;
  const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  document.getElementById('semana-label').textContent = `${formatDate2(dates[0])} – ${formatDate2(dates[6])}`;
  grid.innerHTML = dates.map((d, i) => {
    const isToday = d.toDateString() === today.toDateString();
    const dayEvs = eventos.filter(ev => ev.data === toISODate(d));
    return `<div class="day-col">
      <div class="day-header">${days[i]}</div>
      <div class="day-number ${isToday ? 'today' : ''}">${d.getDate()}</div>
      ${dayEvs.map(ev => `<div class="event-chip chip-${ev.tipo}" title="${ev.hora}">${escapeHTML(ev.titulo)}</div>`).join('')}
    </div>`;
  }).join('');
  document.getElementById('cron-empty').style.display = eventos.length ? 'none' : 'flex';
  renderDashboard();
}

function formatDate2(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }

function semanaNav(d) { if (d === 0) currentWeekOffset = 0; else currentWeekOffset += d; renderCronograma(); }

// Criação e exclusão persistidas estão em integration.js.
