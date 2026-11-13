<?php
// Aplica as migrações de database/migrations/ em ordem, sem precisar do psql.
// Uso (dentro da pasta estudaflow-php):  php scripts/migrar.php
// Todas as migrações podem ser reexecutadas sem perder dados.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$c = require __DIR__ . '/../app/config.php';
$pdo = new PDO("pgsql:host={$c['host']};port={$c['port']};dbname={$c['database']}", $c['user'], $c['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$files = glob(__DIR__ . '/../database/migrations/*.sql');
sort($files);
foreach ($files as $file) {
    echo 'Aplicando ' . basename($file) . '... ';
    try {
        $pdo->exec(file_get_contents($file));
        echo "ok\n";
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo "ERRO\n  " . $e->getMessage() . "\n";
        exit(1);
    }
}
echo "Migrações concluídas.\n";
