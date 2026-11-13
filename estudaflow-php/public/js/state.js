// ============================================================
// state.js — Estado da interface (preenchido pela API PHP)
// ============================================================

let currentUser = null;

function toISODate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getTodayPlus(d) {
  const dt = new Date(); dt.setDate(dt.getDate() + d);
  return toISODate(dt);
}

// Começa tudo vazio: o usuário ainda não tem metas, eventos, arquivos ou livros.
let metas = [];
let eventos = [];
let arquivos = [];
let books = [];
let atividades = []; // { texto, cor, ts }

let currentWeekOffset = 0;
let plRows = 5, plCols = 5;
