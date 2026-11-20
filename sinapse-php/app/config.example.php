<?php
// Modelo de configuração do banco de dados.
// Copie este arquivo para app/config.php e preencha com os seus dados.
// O config.php fica fora do Git (.gitignore) porque contém a senha.

return [
    'host'     => '127.0.0.1',        // endereço do PostgreSQL (local ou na nuvem)
    'port'     => 5432,               // porta padrão do PostgreSQL
    'database' => 'sinapse',          // nome do banco
    'user'     => 'postgres',         // usuário do PostgreSQL
    'password' => '',                 // senha do usuário do PostgreSQL (não a do site)
    'sslmode'  => 'prefer',           // use 'require' em bancos na nuvem (Neon, Supabase)
    'timezone' => 'America/Cuiaba',   // fuso horário usado nas datas
];
