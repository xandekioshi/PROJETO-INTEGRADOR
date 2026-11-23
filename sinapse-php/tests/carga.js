// Teste de carga do Sinapse (k6). Rodar SOMENTE contra o branch de testes do Neon.
// Uso: k6 run -e BASE=http://localhost:8001 tests/carga.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:8001';
const SENHA = 'senha123';
const JSON_HDR = { 'Content-Type': 'application/json' };

export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    // Critério do plano: erro < 1%. Acima de 10% o teste é suspenso para poupar a cota do Neon.
    http_req_failed: ['rate<0.01', { threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '10s' }],
  },
};

function csrf() {
  return http.get(`${BASE}/api.php?action=session`).json('csrf');
}

function post(action, body, token) {
  return http.post(`${BASE}/api.php?action=${action}`, JSON.stringify(body),
    { headers: Object.assign({ 'X-CSRF-Token': token }, JSON_HDR), tags: { name: action } });
}

// Cria uma conta temporária usada por todos os usuários virtuais.
export function setup() {
  const email = `teste.carga.${Date.now()}@exemplo.com`;
  const r = post('register', { nome: 'Carga', email, senha: SENHA, curso: 'ADS' }, csrf());
  if (r.status !== 200) throw new Error(`cadastro falhou: ${r.status} ${r.body}`);
  return { email };
}

export default function (data) {
  const token = http.get(`${BASE}/api.php?action=session`, { tags: { name: 'session' } }).json('csrf');
  const login = post('login', { email: data.email, senha: SENHA }, token);
  check(login, { 'login 200': (r) => r.status === 200 });
  const st = http.get(`${BASE}/api.php?action=state`, { tags: { name: 'state' } });
  check(st, { 'state 200': (r) => r.status === 200 });
  http.cookieJar().clear(BASE); // próxima iteração começa como um visitante novo
  sleep(1);
}

// Exclui a conta temporária (os registros dela saem em cascata).
export function teardown(data) {
  const login = post('login', { email: data.email, senha: SENHA }, csrf());
  const r = post('account_delete', { confirmacao: 'EXCLUIR', senha: SENHA }, login.json('csrf') || csrf());
  if (r.status !== 200) console.error(`exclusão falhou: ${r.status} ${r.body}`);
}
