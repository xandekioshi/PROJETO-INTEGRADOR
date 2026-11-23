<?php
declare(strict_types=1);
// Repetição espaçada (caixas de Leitner), sem banco nem sessão para poder ser testada isoladamente.
// Retorna [nova caixa, dias até a próxima revisão] ou null se a resposta for inválida.
function leitner(int $caixa, string $resposta): ?array {
    $intervalos = [1 => 1, 2 => 3, 3 => 7, 4 => 14, 5 => 30];
    return match ($resposta) {
        'errei' => [1, 0],
        'dificil' => [$caixa, 1],
        'acertei' => [$novo = min(5, $caixa + 1), $intervalos[$novo]],
        default => null,
    };
}
