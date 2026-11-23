<?php
declare(strict_types=1);

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../app/leitner.php';

// Casos TU01–TU06 do Apêndice B do plano de teste.
final class LeitnerTest extends TestCase
{
    public static function casos(): array
    {
        return [
            'TU01 errei volta para a caixa 1'     => [3, 'errei',   [1, 0]],
            'TU02 acertei na caixa 1 sobe para 2' => [1, 'acertei', [2, 3]],
            'TU03 acertei na caixa 4 sobe para 5' => [4, 'acertei', [5, 30]],
            'TU04 acertei na caixa 5 fica na 5'   => [5, 'acertei', [5, 30]],
            'TU05 dificil mantém a caixa'         => [2, 'dificil', [2, 1]],
        ];
    }

    #[DataProvider('casos')]
    public function testRegraDeLeitner(int $caixa, string $resposta, array $esperado): void
    {
        $this->assertSame($esperado, leitner($caixa, $resposta));
    }

    public function testTU06RespostaInvalidaERecusada(): void
    {
        $this->assertNull(leitner(2, 'talvez'));
    }
}
