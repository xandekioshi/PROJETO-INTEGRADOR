<?php
declare(strict_types=1);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('session.use_strict_mode', '1');
session_name('estudaflow_session');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);
if (!session_start()) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Não foi possível iniciar a sessão. Confira session.save_path no php.ini.']);
    exit;
}
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function rollbackIfOpen(): void {
    $pdo = $GLOBALS['ef_pdo'] ?? null;
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
}
function fail(string $message, int $status = 422): never {
    rollbackIfOpen();
    reply(['error' => $message], $status);
}
function db(): PDO {
    static $pdo;
    if ($pdo) return $pdo;
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) fail('Copie app/config.example.php para app/config.php e configure o banco.', 503);
    $c = require $path;
    date_default_timezone_set($c['timezone'] ?? 'America/Cuiaba');
    $pdo = new PDO("pgsql:host={$c['host']};port={$c['port']};dbname={$c['database']}", $c['user'], $c['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $GLOBALS['ef_pdo'] = $pdo;
    $pdo->exec('SET search_path TO estudaflow, public');
    query("SELECT set_config('TimeZone', ?, false)", [$c['timezone'] ?? 'America/Cuiaba']);
    return $pdo;
}
function query(string $sql, array $params = []): PDOStatement {
    $stmt = db()->prepare($sql);
    foreach (array_values($params) as $i => $v) {
        $stmt->bindValue($i + 1, $v, is_bool($v) ? PDO::PARAM_BOOL : (is_int($v) ? PDO::PARAM_INT : ($v === null ? PDO::PARAM_NULL : PDO::PARAM_STR)));
    }
    $stmt->execute();
    return $stmt;
}
function rows(string $sql, array $params = []): array { return query($sql, $params)->fetchAll(); }
function one(string $sql, array $params = []): array|false { return query($sql, $params)->fetch(); }
function textField(array $data, string $key, int $max, bool $required = true): string {
    $value = $data[$key] ?? '';
    if (!is_string($value)) fail("Campo inválido: $key");
    $value = trim($value);
    $size = preg_match_all('/./us', $value);
    if ($size === false || $size > $max || ($required && $value === '')) fail("Verifique o campo $key (máximo $max caracteres).");
    return $value;
}
function integer(mixed $v, int $min = 1, int $max = 2147483647): int {
    $n = filter_var($v, FILTER_VALIDATE_INT);
    if ($n === false || $n < $min || $n > $max) fail('Identificador ou número inválido.');
    return $n;
}
function dateField(array $data, string $key, bool $required = false): ?string {
    $v = textField($data, $key, 10, $required);
    if ($v === '') return null;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $v);
    if (!$date || $date->format('Y-m-d') !== $v) fail('Data inválida.');
    return $v;
}
function ownerId(): int {
    if (empty($_SESSION['uid'])) fail('Entre na sua conta para continuar.', 401);
    return (int) $_SESSION['uid'];
}
function userData(int $id): array|false {
    return one("SELECT u.id, u.nome, u.email, COALESCE(c.nome, '') AS curso, u.foto, u.criado_em FROM usuario u LEFT JOIN curso c ON c.id=u.curso_id WHERE u.id=?", [$id]);
}
// Conteúdo completo de um arquivo do usuário (usado ao abrir e ao exportar).
function fileContent(int $id, string $codigo): array {
    switch ($codigo) {
        case 'documento': return ['conteudo'=>one('SELECT conteudo FROM documento WHERE arquivo_id=?',[$id])['conteudo'] ?? ''];
        case 'planilha':
            $c=one('SELECT qtd_linhas AS rows,qtd_colunas AS cols FROM planilha WHERE arquivo_id=?',[$id]) ?: ['rows'=>5,'cols'=>5];
            $c['cells']=rows('SELECT linha,coluna,valor FROM planilha_celula WHERE planilha_id=?',[$id]);
            return $c;
        case 'mapa': return ['nodes'=>rows('SELECT id,no_pai_id AS parent,rotulo AS label,pos_x AS x,pos_y AS y,cor AS color FROM mapa_no WHERE mapa_id=? ORDER BY id',[$id])];
        case 'flashcards': return ['cards'=>rows('SELECT id,frente,verso,caixa,proxima_revisao AS proxima,acertos,erros FROM flashcard WHERE baralho_id=? ORDER BY ordem',[$id])];
    }
    return [];
}
// Confere a senha atual; após 5 erros bloqueia por 1 minuto (mesma regra do login).
function verifyPassword(int $uid, mixed $pass): void {
    if (($_SESSION['pw_block_until'] ?? 0) > time()) fail('Muitas tentativas. Aguarde um minuto.', 429);
    $row=one('SELECT senha_hash FROM usuario WHERE id=?',[$uid]);
    if (!is_string($pass) || !$row || !password_verify($pass,$row['senha_hash'])) {
        $_SESSION['pw_attempts']=($_SESSION['pw_attempts'] ?? 0)+1;
        if ($_SESSION['pw_attempts']>=5) { $_SESSION['pw_block_until']=time()+60; $_SESSION['pw_attempts']=0; }
        fail('Senha atual incorreta.',403);
    }
    unset($_SESSION['pw_attempts'],$_SESSION['pw_block_until']);
}
function activity(int $uid, int $type, string $description): void {
    // Tipos são os IDs das tabelas de domínio do SQL fornecido.
    query('INSERT INTO atividade (usuario_id,tipo_atividade_id,descricao) VALUES (?,?,?)', [$uid, $type, $description]);
}
function discipline(int $uid, string $name): ?int {
    if ($name === '' || $name === 'Geral') return null;
    return (int) one('INSERT INTO disciplina (usuario_id,nome) VALUES (?,?) ON CONFLICT (usuario_id,nome) DO UPDATE SET nome=EXCLUDED.nome RETURNING id', [$uid,$name])['id'];
}
function boolValue(mixed $v): bool { return $v === true || $v === 't' || $v === '1' || $v === 1; }
function state(int $uid): array {
    $metas = rows("SELECT m.id,m.nome,COALESCE(d.nome,'Geral') AS disciplina,m.prazo,p.nome AS prioridade,m.concluida AS done FROM meta m LEFT JOIN disciplina d ON d.id=m.disciplina_id JOIN prioridade p ON p.id=m.prioridade_id WHERE m.usuario_id=? ORDER BY m.id DESC", [$uid]);
    foreach ($metas as &$m) { $m['id']=(int)$m['id']; $m['done']=boolValue($m['done']); } unset($m);
    $books = rows('SELECT l.id,l.titulo,l.autor,l.icone AS icon,a.nome AS area,EXISTS(SELECT 1 FROM lista_leitura r WHERE r.livro_id=l.id AND r.usuario_id=?) AS na_lista FROM livro l JOIN area_conhecimento a ON a.id=l.area_id ORDER BY l.id DESC', [$uid]);
    $tags = rows('SELECT lt.livro_id,t.nome FROM livro_tag lt JOIN tag t ON t.id=lt.tag_id');
    $byBook = [];
    foreach ($tags as $t) $byBook[$t['livro_id']][]=$t['nome'];
    foreach ($books as &$b) { $b['id']=(int)$b['id']; $b['na_lista']=boolValue($b['na_lista']); $b['tags']=$byBook[$b['id']] ?? []; } unset($b);
    return [
        'user' => userData($uid), 'csrf' => $_SESSION['csrf'], 'metas' => $metas,
        'eventos' => rows('SELECT e.id,e.titulo,e.data,to_char(e.hora,\'HH24:MI\') AS hora,t.cor AS tipo FROM evento e JOIN tipo_evento t ON t.id=e.tipo_evento_id WHERE e.usuario_id=? ORDER BY e.data,e.hora', [$uid]),
        'arquivos' => rows('SELECT a.id,a.nome,a.pasta_id,t.codigo,t.icone AS tipo,a.tamanho_bytes,a.atualizado_em FROM arquivo a JOIN tipo_arquivo t ON t.id=a.tipo_arquivo_id WHERE a.usuario_id=? ORDER BY a.atualizado_em DESC,a.id DESC', [$uid]),
        'pastas' => rows('SELECT * FROM vw_pasta_contagem WHERE usuario_id=? ORDER BY pasta_id', [$uid]),
        'books' => $books,
        'atividades' => rows('SELECT a.descricao AS texto,t.cor,EXTRACT(EPOCH FROM a.criado_em)*1000 AS ts FROM atividade a JOIN tipo_atividade t ON t.id=a.tipo_atividade_id WHERE a.usuario_id=? ORDER BY a.criado_em DESC,a.id DESC LIMIT 20', [$uid]),
        'resumo' => one('SELECT * FROM vw_dashboard_resumo WHERE usuario_id=?', [$uid]),
        'progresso' => rows('SELECT * FROM vw_progresso_metas WHERE usuario_id=? ORDER BY disciplina', [$uid]),
        'revisoes' => array_map(fn($r) => ['id'=>(int)$r['id'],'nome'=>$r['nome'],'total'=>(int)$r['total'],'pendentes'=>(int)$r['pendentes']], rows("SELECT a.id,regexp_replace(a.nome,'\.cards$','') AS nome,count(f.id) AS total,count(f.id) FILTER (WHERE f.proxima_revisao<=current_date) AS pendentes FROM arquivo a JOIN baralho b ON b.arquivo_id=a.id LEFT JOIN flashcard f ON f.baralho_id=a.id WHERE a.usuario_id=? GROUP BY a.id ORDER BY pendentes DESC,a.atualizado_em DESC", [$uid])),
    ];
}
