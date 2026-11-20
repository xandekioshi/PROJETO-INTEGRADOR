// ============================================================
// cronograma.js — Página "Cronograma": visão de semana ou de mês,
// navegação (anterior / hoje / próximo) e criação rápida de eventos
// clicando em um dia. Exclusão de eventos: integration.js (delEvento).
// ============================================================

let cronView = 'semana';      // 'semana' | 'mes'
let currentMonthOffset = 0;   // meses a partir do atual (a semana usa currentWeekOffset, de state.js)
const EV_TIPO = { blue: 'Aula', purple: 'Prova', green: 'Entrega', yellow: 'Estudo' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const eventosDoDia = iso => eventos.filter(ev => ev.data === iso).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

function eventChip(ev, compact) {
  const label = `${EV_TIPO[ev.tipo] || 'Evento'}: ${ev.titulo}${ev.hora ? ' às ' + ev.hora : ''}. Clique para excluir.`;
  return `<button type="button" class="event-chip chip-${ev.tipo}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}" onclick="event.stopPropagation();delEvento(${ev.id})">${!compact && ev.hora ? `<time>${ev.hora}</time>` : ''}<span>${escapeHTML(ev.titulo)}</span></button>`;
}

function renderCronograma() {
  const grid = document.getElementById('week-grid'); if (!grid) return;
  const today = new Date();
  const label = document.getElementById('semana-label');

  if (cronView === 'semana') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + currentWeekOffset * 7);
    const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
    const a = dates[0], b = dates[6];
    label.textContent = a.getMonth() === b.getMonth()
      ? `Semana de ${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()]}`
      : `Semana de ${a.getDate()} de ${MESES[a.getMonth()]} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
    grid.className = 'week-grid';
    grid.innerHTML = dates.map((d, i) => {
      const iso = toISODate(d), isToday = d.toDateString() === today.toDateString();
      const evs = eventosDoDia(iso);
      return `<div class="day-col${isToday ? ' is-today' : ''}${i > 4 ? ' is-weekend' : ''}">
        <div class="day-head"><span class="day-header">${DIAS[i]}</span><span class="day-number">${d.getDate()}</span></div>
        <div class="day-events">${evs.map(ev => eventChip(ev)).join('')}</div>
        <button type="button" class="day-add" onclick="openEventOn('${iso}')" aria-label="Adicionar evento em ${formatDate2(d)}"><svg class="icon"><use href="#i-plus"/></svg></button>
      </div>`;
    }).join('');
  } else {
    const first = new Date(today.getFullYear(), today.getMonth() + currentMonthOffset, 1);
    const month = first.getMonth();
    label.textContent = `${MESES[month].charAt(0).toUpperCase() + MESES[month].slice(1)} de ${first.getFullYear()}`;
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7)); // segunda-feira da 1ª semana
    const last = new Date(first.getFullYear(), month + 1, 0);
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7);
    grid.className = 'month-grid';
    let html = DIAS.map(d => `<div class="month-dow">${d}</div>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = toISODate(d), out = d.getMonth() !== month, isToday = d.toDateString() === today.toDateString();
      const evs = eventosDoDia(iso);
      html += `<div class="month-cell${out ? ' out' : ''}${isToday ? ' is-today' : ''}" onclick="openEventOn('${iso}')">
        <button type="button" class="mc-day" onclick="event.stopPropagation();openEventOn('${iso}')" aria-label="Adicionar evento em ${formatDate2(d)}">${d.getDate()}</button>
        ${evs.slice(0, 3).map(ev => eventChip(ev, true)).join('')}
        ${evs.length > 3 ? `<span class="mc-more">+${evs.length - 3}</span>` : ''}
      </div>`;
    }
    grid.innerHTML = html;
  }
  document.getElementById('cron-empty').style.display = eventos.length ? 'none' : 'block';
  renderDashboard();
}

function formatDate2(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }

// Anterior (-1) / hoje (0) / próximo (1), na unidade da visão atual.
function semanaNav(d) {
  if (cronView === 'semana') currentWeekOffset = d === 0 ? 0 : currentWeekOffset + d;
  else currentMonthOffset = d === 0 ? 0 : currentMonthOffset + d;
  renderCronograma();
}

function setCronView(v) {
  cronView = v;
  document.querySelectorAll('.cron-view .mm-btn').forEach(b => {
    const on = b.dataset.view === v;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
  // Ao trocar de visão, mostra o período que contém a semana/mês que já estava na tela.
  if (v === 'mes') {
    const ref = new Date(); ref.setDate(ref.getDate() + currentWeekOffset * 7);
    const now = new Date();
    currentMonthOffset = (ref.getFullYear() - now.getFullYear()) * 12 + ref.getMonth() - now.getMonth();
  } else if (currentMonthOffset === 0) {
    currentWeekOffset = 0;
  } else {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + currentMonthOffset, 1);
    const monday = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    currentWeekOffset = Math.round((monday(first) - monday(now)) / (7 * 86400000));
  }
  renderCronograma();
}

// Abre o formulário de evento já com a data escolhida (ou hoje).
function openEventOn(iso) {
  document.getElementById('ev-data').value = iso || toISODate(new Date());
  openModal('modal-evento');
  setTimeout(() => document.getElementById('ev-titulo').focus(), 60);
}
