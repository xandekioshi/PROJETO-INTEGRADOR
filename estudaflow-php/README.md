# EstudaFlow — PHP + PostgreSQL

Leia **TUTORIAL.md** para instalação, explicação da integração e solução de problemas.

Início rápido:

1. Crie o banco PostgreSQL `estudaflow` (PostgreSQL 15+).
2. Importe `database/estudaflow_schema.sql` uma vez. O script apaga/recria o schema.
3. Copie `app/config.example.php` para `app/config.php` e informe sua conexão.
4. Ative `pdo_pgsql` no PHP 8.1+.
5. Execute `php -S localhost:8000 -t public` nesta pasta.
6. Abra http://localhost:8000 e cadastre uma conta.

As credenciais e o SQL ficam fora de `public`. O pacote não contém senha de banco real.
