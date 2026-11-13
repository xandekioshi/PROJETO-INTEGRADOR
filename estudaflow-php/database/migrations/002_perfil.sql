-- ============================================================
-- Migração 002 — Foto de perfil do usuário
-- A imagem é reduzida no navegador (256x256) e guardada como
-- data URL (base64). Limite de ~300 KB por foto.
-- Execute depois da 001. É seguro reexecutar.
-- ============================================================
BEGIN;
SET search_path TO estudaflow, public;

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS foto text;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuario_foto_formato') THEN
        ALTER TABLE usuario ADD CONSTRAINT usuario_foto_formato CHECK (
            foto IS NULL OR (length(foto) <= 400000 AND foto ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
        );
    END IF;
END $$;

COMMIT;
