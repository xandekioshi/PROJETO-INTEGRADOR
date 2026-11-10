// ============================================================
// mindmap.js — Ferramenta "Mapa Mental" (desenho em canvas)
// ============================================================

function mmMode(m) {
  mmMode_state = m;
  document.querySelectorAll('.mm-btn').forEach(b => b.classList.remove('active'));
  const map = { add: 'btn-add-node', move: 'btn-move-node', del: 'btn-del-node' };
  if (map[m]) document.getElementById(map[m]).classList.add('active');
}

function initMindmap() {
  mindmapNodes = [];
  selectedNode = null;
  setTimeout(() => {
    const canvas = document.getElementById('mindmap-canvas');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight || 420;
    canvas.onclick = mmClick;
    drawMM();
  }, 100);
}

function mmClick(e) {
  const canvas = document.getElementById('mindmap-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const hit = mindmapNodes.find(n => Math.hypot(n.x - x, n.y - y) < 36);
  if (mmMode_state === 'del' && hit) { mindmapNodes = mindmapNodes.filter(n => n !== hit); selectedNode = null; drawMM(); return; }
  if (mmMode_state === 'add') {
    const label = prompt('Nome do nó:', ''); if (!label) return;
    const colors = ['#6c8cff', '#a78bfa', '#34d399', '#f59e0b', '#f87171'];
    const newNode = { x, y, label, id: Math.max(0, ...mindmapNodes.map(n => n.id)) + 1, color: colors[mindmapNodes.length % colors.length], parent: selectedNode ? selectedNode.id : null };
    mindmapNodes.push(newNode);
    selectedNode = newNode; drawMM(); return;
  }
  if (mmMode_state === 'move' && hit) { selectedNode = hit; drawMM(); return; }
  if (!hit) selectedNode = null;
  drawMM();
}

function drawMM() {
  const canvas = document.getElementById('mindmap-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // edges
  mindmapNodes.forEach(n => {
    if (n.parent) {
      const p = mindmapNodes.find(m => m.id === n.parent); if (!p) return;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = '#252a38'; ctx.lineWidth = 2; ctx.stroke();
    }
  });
  // nodes
  mindmapNodes.forEach(n => {
    ctx.beginPath(); ctx.arc(n.x, n.y, 32, 0, Math.PI * 2);
    ctx.fillStyle = n === selectedNode ? n.color + '44' : '#13161e';
    ctx.fill();
    ctx.strokeStyle = n.color; ctx.lineWidth = n === selectedNode ? 3 : 2; ctx.stroke();
    ctx.fillStyle = n.color; ctx.font = 'bold 11px DM Sans,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const words = n.label.split(' ');
    if (words.length <= 2) ctx.fillText(n.label.length > 10 ? n.label.substring(0, 9) + '…' : n.label, n.x, n.y);
    else { ctx.fillText(words[0], n.x, n.y - 7); ctx.fillText(words.slice(1).join(' '), n.x, n.y + 7); }
  });
}

function mmClear() { if (confirm('Limpar o mapa?')) { mindmapNodes = []; selectedNode = null; drawMM(); } }
