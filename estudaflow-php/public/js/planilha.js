// ============================================================
// planilha.js — Ferramenta "Planilha" (tabela editável simples)
// ============================================================

function initPlanilha() { setTimeout(() => renderPlanilha(), 50); }

function renderPlanilha() {
  const t = document.getElementById('pl-table'); if (!t) return;
  const alpha = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  let h = '<tr><th style="padding:4px 8px;background:var(--surface2);border:1px solid var(--border);font-size:.75rem;color:var(--text3)"></th>';
  for (let c = 0; c < plCols; c++) h += `<th style="padding:6px 12px;background:var(--surface2);border:1px solid var(--border);font-size:.75rem;color:var(--text2);min-width:80px">${alpha[c]}</th>`;
  h += '</tr>'; t.innerHTML = h;
  for (let r = 0; r < plRows; r++) {
    let row = `<tr><td style="padding:4px 8px;background:var(--surface2);border:1px solid var(--border);font-size:.75rem;color:var(--text3);text-align:center">${r + 1}</td>`;
    for (let c = 0; c < plCols; c++) row += `<td style="border:1px solid var(--border)"><input type="text" style="width:100%;background:transparent;border:none;padding:6px 8px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:.82rem;outline:none" /></td>`;
    row += '</tr>'; t.innerHTML += row;
  }
}

function plAddRow() { plRows++; renderPlanilha(); }
function plAddCol() { if (plCols < 8) { plCols++; renderPlanilha(); } }
