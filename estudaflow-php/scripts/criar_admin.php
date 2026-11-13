<?php
// Cria uma conta de administrador ou promove uma conta existente.
// Uso (dentro da pasta estudaflow-php):
//   php scripts/criar_admin.php email@exemplo.com                 -> promove uma conta que já existe
//   php scripts/criar_admin.php email@exemplo.com "Nome" senha     -> cria a conta já como admin
// Depois disso, os administradores podem promover outros pela página "Administração".
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

[$email, $nome, $senha] = array_pad(array_slice($argv, 1), 3, null);
$email = strtolower(trim((string)$email));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Uso: php scripts/criar_admin.php email [\"Nome\" senha]\n");
    exit(1);
}

$c = require __DIR__ . '/../app/config.php';
$pdo = new PDO("pgsql:host={$c['host']};port={$c['port']};dbname={$c['database']}", $c['user'], $c['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec('SET search_path TO estudaflow, public');

try {
    $pdo->query('SELECT papel FROM usuario LIMIT 0');
} catch (PDOException) {
    fwrite(STDERR, "A coluna 'papel' não existe. Rode antes: php scripts/migrar.php\n");
    exit(1);
}

$find = $pdo->prepare('SELECT id, nome FROM usuario WHERE lower(email) = ?');
$find->execute([$email]);
$user = $find->fetch();

if ($user) {
    $pdo->prepare("UPDATE usuario SET papel = 'admin', ativo = true WHERE id = ?")->execute([$user['id']]);
    echo "Conta de {$user['nome']} <{$email}> agora é administradora.\n";
    exit(0);
}

if ($nome === null || $senha === null) {
    fwrite(STDERR, "Nenhuma conta com o e-mail {$email}. Para criar, informe nome e senha:\n  php scripts/criar_admin.php {$email} \"Nome\" senha\n");
    exit(1);
}
if (strlen($senha) < 6 || strlen($senha) > 72) {
    fwrite(STDERR, "A senha precisa ter entre 6 e 72 caracteres.\n");
    exit(1);
}
$pdo->prepare("INSERT INTO usuario (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'admin')")
    ->execute([trim($nome), $email, password_hash($senha, PASSWORD_DEFAULT)]);
echo "Administrador {$nome} <{$email}> criado.\n";
