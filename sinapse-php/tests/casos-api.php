<?php
declare(strict_types=1);
// Executa os casos CT01–CT19 do plano de teste (Apêndice B) direto na API.
// Uso: suba o site com o BANCO DE TESTES e rode
//   php tests/casos-api.php http://localhost:8001
// Cria duas contas temporárias (teste.*@exemplo.com) e apaga as duas no fim.

$base = rtrim($argv[1] ?? 'http://localhost:8001', '/') . '/api.php?action=';

final class Cliente {
    private string $jar;
    public string $csrf = '';
    public function __construct(private string $base) {
        $this->jar = tempnam(sys_get_temp_dir(), 'sinapse');
        $this->csrf = $this->get('session')['body']['csrf'];
    }
    public function get(string $acao, string $extra = ''): array { return $this->req($acao . $extra, null); }
    public function post(string $acao, array $dados): array {
        $r = $this->req($acao, $dados);
        if (isset($r['body']['csrf'])) $this->csrf = $r['body']['csrf'];
        return $r;
    }
    private function req(string $acao, ?array $dados): array {
        $h = curl_init($this->base . $acao);
        curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar]);
        if ($dados !== null) curl_setopt_array($h, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($dados),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $this->csrf]]);
        $txt = curl_exec($h);
        return ['status' => curl_getinfo($h, CURLINFO_RESPONSE_CODE), 'body' => json_decode((string)$txt, true) ?? []];
    }
}

$resultados = [];
function caso(string $id, string $obtido, bool $passou): void {
    global $resultados;
    $resultados[] = [$id, $passou, $obtido];
    printf("%s  %-6s %s\n", $passou ? 'PASSOU' : 'FALHOU', $id, $obtido);
}
$erro = fn(array $r) => $r['status'] . ' "' . ($r['body']['error'] ?? '') . '"';

$sufixo = date('YmdHis');
$emailA = "teste.a.$sufixo@exemplo.com"; $emailB = "teste.b.$sufixo@exemplo.com";
$senha = 'senha123';

// ---------- F01 Cadastro ----------
$a = new Cliente($base);
$r = $a->post('register', ['nome' => 'Teste A', 'email' => $emailA, 'senha' => $senha, 'curso' => '']);
$pastas = array_column($r['body']['pastas'] ?? [], 'nome');
caso('CT01', "{$r['status']}, pastas criadas: " . implode(', ', $pastas), $r['status'] === 200 && count($pastas) === 4);

$x = new Cliente($base);
$r = $x->post('register', ['nome' => 'Curta', 'email' => "teste.c.$sufixo@exemplo.com", 'senha' => '12345', 'curso' => '']);
caso('CT02', $erro($r), $r['status'] === 422 && $r['body']['error'] === 'A senha precisa ter pelo menos 6 caracteres.');

$x = new Cliente($base);
$r = $x->post('register', ['nome' => 'Duplicado', 'email' => $emailA, 'senha' => $senha, 'curso' => '']);
caso('CT03', $erro($r), $r['status'] === 409);

// ---------- F02 Login ----------
$a->post('logout', []);
$r = $a->post('login', ['email' => $emailA, 'senha' => $senha]);
caso('CT04', "{$r['status']}, usuário: " . ($r['body']['user']['email'] ?? '-'), $r['status'] === 200 && ($r['body']['user']['email'] ?? '') === $emailA);

$x = new Cliente($base);
$r = $x->post('login', ['email' => $emailA, 'senha' => 'errada99']);
caso('CT05', $erro($r), $r['status'] === 401 && $r['body']['error'] === 'E-mail ou senha incorretos.');

$a->post('logout', []);
$r = $a->get('session');
caso('CT06', 'após sair, sessão: ' . json_encode($r['body']['user'] ?? null), ($r['body']['user'] ?? null) === null);
$a->post('login', ['email' => $emailA, 'senha' => $senha]);

// ---------- F03 Metas ----------
$r = $a->post('meta_add', ['nome' => 'Estudar banco de dados', 'disciplina' => 'BD', 'prioridade' => 'urgente', 'prazo' => date('Y-m-d', strtotime('+7 days'))]);
$meta = $r['body']['metas'][0] ?? [];
caso('CT07', "{$r['status']}, meta: " . ($meta['nome'] ?? '-'), $r['status'] === 200 && ($meta['nome'] ?? '') === 'Estudar banco de dados');

$r = $a->post('meta_add', ['nome' => '', 'prioridade' => 'normal']);
caso('CT08', $erro($r), $r['status'] === 422);

$r = $a->post('meta_toggle', ['id' => $meta['id'] ?? 0]);
$atv = $r['body']['atividades'][0]['texto'] ?? '';
caso('CT09', "concluída: " . json_encode($r['body']['metas'][0]['done'] ?? null) . ", atividade: $atv", ($r['body']['metas'][0]['done'] ?? false) === true && str_starts_with($atv, 'Concluiu meta'));

// ---------- F04 Cronograma ----------
$data = date('Y-m-d', strtotime('+10 days'));
$r = $a->post('event_add', ['titulo' => 'Prova', 'tipo' => 'purple', 'data' => $data, 'hora' => '19:00']);
$ev = $r['body']['eventos'][0] ?? [];
caso('CT10', "{$r['status']}, evento em " . ($ev['data'] ?? '-') . ' ' . ($ev['hora'] ?? ''), ($ev['data'] ?? '') === $data && ($ev['hora'] ?? '') === '19:00');

// ---------- F05 Materiais ----------
$cartoes = [['frente' => 'P1', 'verso' => 'R1'], ['frente' => 'P2', 'verso' => 'R2'], ['frente' => 'P3', 'verso' => 'R3']];
$r = $a->post('file_save', ['tipo' => 'flashcards', 'titulo' => 'Baralho teste', 'content' => ['cards' => $cartoes]]);
$baralho = array_values(array_filter($r['body']['arquivos'] ?? [], fn($f) => $f['codigo'] === 'flashcards'))[0] ?? [];
$g = $a->get('file_get', '&id=' . ($baralho['id'] ?? 0));
$cards = $g['body']['content']['cards'] ?? [];
caso('CT11', 'arquivo: ' . ($baralho['nome'] ?? '-') . ', cartões ao reabrir: ' . count($cards), count($cards) === 3);

$ok = [];
foreach ([
    'documento' => ['conteudo' => '<p>Resumo</p>'],
    'planilha'  => ['rows' => 3, 'cols' => 3, 'cells' => [['linha' => 1, 'coluna' => 1, 'valor' => '42']]],
    'mapa'      => ['nodes' => [['id' => '1', 'parent' => null, 'label' => 'Centro', 'x' => 0, 'y' => 0, 'color' => '#336699'], ['id' => '2', 'parent' => '1', 'label' => 'Filho', 'x' => 100, 'y' => 50, 'color' => '#993366']]],
] as $tipo => $conteudo) {
    $r = $a->post('file_save', ['tipo' => $tipo, 'titulo' => "Teste $tipo", 'content' => $conteudo]);
    $f = array_values(array_filter($r['body']['arquivos'] ?? [], fn($f) => $f['codigo'] === $tipo))[0] ?? [];
    $c = $a->get('file_get', '&id=' . ($f['id'] ?? 0))['body']['content'] ?? [];
    $ok[$tipo] = match ($tipo) {
        'documento' => ($c['conteudo'] ?? '') === '<p>Resumo</p>',
        'planilha'  => ($c['cells'][0]['valor'] ?? '') === '42',
        'mapa'      => count($c['nodes'] ?? []) === 2,
    };
}
caso('CT12', implode(', ', array_map(fn($t, $v) => "$t " . ($v ? 'ok' : 'falhou'), array_keys($ok), $ok)), !in_array(false, $ok, true));

// ---------- F06 Revisão ----------
$r = $a->post('card_review', ['id' => $cards[0]['id'] ?? 0, 'resposta' => 'acertei']);
$c = $r['body']['card'] ?? [];
caso('CT13', 'caixa 1 → ' . ($c['caixa'] ?? '-') . ', próxima em ' . ($c['dias'] ?? '-') . ' dia(s)', ($c['caixa'] ?? 0) === 2 && ($c['dias'] ?? 0) === 3);

$r = $a->post('card_review', ['id' => $cards[0]['id'] ?? 0, 'resposta' => 'errei']);
$c = $r['body']['card'] ?? [];
caso('CT14', 'caixa 2 → ' . ($c['caixa'] ?? '-') . ', próxima: ' . ($c['proxima'] ?? '-'), ($c['caixa'] ?? 0) === 1 && ($c['dias'] ?? -1) === 0 && ($c['proxima'] ?? '') === date('Y-m-d'));

// ---------- F07 Perfil ----------
$r = $a->post('password_change', ['atual' => $senha, 'nova' => $senha]);
caso('CT15', $erro($r), $r['status'] === 422 && $r['body']['error'] === 'A nova senha precisa ser diferente da atual.');

// ---------- F08 Exportação ----------
$r = $a->get('export');
$txt = json_encode($r['body']);
caso('CT16', "{$r['status']}, metas: " . count($r['body']['metas'] ?? []) . ', eventos: ' . count($r['body']['eventos'] ?? []) . ', arquivos: ' . count($r['body']['arquivos'] ?? []) . ', contém senha_hash: ' . (str_contains($txt, 'senha_hash') ? 'sim' : 'não'),
    $r['status'] === 200 && count($r['body']['metas'] ?? []) === 1 && count($r['body']['arquivos'] ?? []) === 4 && !str_contains($txt, 'senha_hash'));

// ---------- F09 Isolamento e F10 Administração ----------
$b = new Cliente($base);
$b->post('register', ['nome' => 'Teste B', 'email' => $emailB, 'senha' => $senha, 'curso' => '']);
$r = $b->get('file_get', '&id=' . ($baralho['id'] ?? 0));
caso('CT18', 'usuário B abrindo arquivo de A: ' . $erro($r), $r['status'] === 404);

$r = $b->get('admin_users');
caso('CT19', $erro($r), $r['status'] === 403 && $r['body']['error'] === 'Acesso restrito a administradores.');

// ---------- F08 Exclusão (por último: apaga a conta A) ----------
$r = $a->post('account_delete', ['confirmacao' => 'EXCLUIR', 'senha' => $senha]);
$x = new Cliente($base);
$l = $x->post('login', ['email' => $emailA, 'senha' => $senha]);
caso('CT17', "exclusão: {$r['status']}; login depois: " . $erro($l), $r['status'] === 200 && $l['status'] === 401);

// Limpeza: a conta B também é apagada.
$b->post('account_delete', ['confirmacao' => 'EXCLUIR', 'senha' => $senha]);

usort($resultados, fn($p, $q) => strcmp($p[0], $q[0]));
$total = count($resultados); $passou = count(array_filter($resultados, fn($r) => $r[1]));
echo "\n$passou de $total casos passaram.\n";
file_put_contents(__DIR__ . '/resultado-casos-api.json', json_encode(['executado_em' => date('Y-m-d H:i:s'), 'casos' => $resultados], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
exit($passou === $total ? 0 : 1);
