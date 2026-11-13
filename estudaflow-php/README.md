# EstudaFlow — PHP + PostgreSQL

Leia **TUTORIAL.md** para instalação, explicação da integração e solução de problemas.

Início rápido:

1. Crie o banco PostgreSQL `estudaflow` (PostgreSQL 15+).
2. Importe `database/estudaflow_schema.sql` uma vez. O script apaga/recria o schema.
3. Copie `app/config.example.php` para `app/config.php` e informe sua conexão.
4. Ative `pdo_pgsql` no PHP 8.1+.
5. Aplique as migrações de `database/migrations/` com `php scripts/migrar.php` (`001_flashcards.sql` cria os Flashcards; `002_perfil.sql` adiciona a foto de perfil; `003_admin.sql` cria a conta de administrador e o registro de acessos). Elas podem ser reexecutadas sem perda de dados.
6. Execute `php -S localhost:8000 -t public` nesta pasta.
7. Abra http://localhost:8000 e cadastre uma conta.

Administrador: depois de cadastrar sua conta, rode `php scripts/criar_admin.php seu@email.com` para torná-la administradora
(ou `php scripts/criar_admin.php email "Nome" senha` para criar uma conta nova já como admin). Entre de novo e o menu
**Administração** aparece com a visão geral, os usuários (papel, desativar, redefinir senha, excluir), os acessos, os conteúdos e a auditoria.

As credenciais e o SQL ficam fora de `public`. O pacote não contém senha de banco real.
