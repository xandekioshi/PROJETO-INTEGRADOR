-- ============================================================
-- Migração 003 — Conta de administrador
--   * usuario.papel         'estudante' ou 'admin'
--   * usuario.ativo         contas desativadas não conseguem entrar
--   * usuario.ultimo_acesso data do último login/retorno ao site
--   * acesso                registro de entradas, saídas e falhas de login
--   * admin_log             auditoria das ações feitas por administradores
-- Execute depois da 002. É seguro reexecutar.
-- Para criar o primeiro administrador: php scripts/criar_admin.php
-- ============================================================
BEGIN;
SET search_path TO estudaflow, public;

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS papel varchar(20) NOT NULL DEFAULT 'estudante';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuario_papel_valido') THEN
        ALTER TABLE usuario ADD CONSTRAINT usuario_papel_valido CHECK (papel IN ('estudante', 'admin'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS acesso (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- NULL quando alguém tenta entrar com um e-mail que não existe
    usuario_id  integer      REFERENCES usuario(id) ON DELETE CASCADE,
    email       varchar(150),
    tipo        varchar(12)  NOT NULL CHECK (tipo IN ('cadastro', 'login', 'retorno', 'logout', 'falha', 'bloqueada')),
    ip          varchar(45),
    navegador   varchar(255),
    criado_em   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acesso_criado_idx  ON acesso (criado_em DESC);
CREATE INDEX IF NOT EXISTS acesso_usuario_idx ON acesso (usuario_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS admin_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id    integer      REFERENCES usuario(id) ON DELETE SET NULL,
    admin_nome  varchar(120) NOT NULL,
    acao        varchar(40)  NOT NULL,
    alvo        varchar(250),
    detalhes    text,
    criado_em   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_log_criado_idx ON admin_log (criado_em DESC);

COMMIT;
