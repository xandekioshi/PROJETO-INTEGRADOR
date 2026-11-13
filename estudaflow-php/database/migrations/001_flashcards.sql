-- ============================================================
-- Migração 001 — Substitui "Apresentação" por "Flashcards"
-- (repetição espaçada, sistema de caixas de Leitner).
--
-- Execute UMA vez, depois de estudaflow_schema.sql:
--   psql -h localhost -U postgres -d estudaflow -v ON_ERROR_STOP=1 -f database/migrations/001_flashcards.sql
-- É seguro reexecutar: os passos verificam o que já existe.
-- Apresentações existentes são convertidas em baralhos
-- (título do slide -> frente, conteúdo -> verso).
-- ============================================================
BEGIN;
SET search_path TO estudaflow, public;

-- 1. Novo tipo de arquivo
INSERT INTO tipo_arquivo (id, codigo, nome, extensao, icone)
VALUES (5, 'flashcards', 'Flashcards', '.cards', '🗂️')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabelas
CREATE TABLE IF NOT EXISTS baralho (
    arquivo_id       integer  PRIMARY KEY,
    tipo_arquivo_id  smallint NOT NULL DEFAULT 5 CHECK (tipo_arquivo_id = 5),
    FOREIGN KEY (arquivo_id, tipo_arquivo_id)
        REFERENCES arquivo (id, tipo_arquivo_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcard (
    id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    baralho_id       integer      NOT NULL REFERENCES baralho(arquivo_id) ON DELETE CASCADE,
    ordem            smallint     NOT NULL CHECK (ordem >= 1),
    frente           varchar(500) NOT NULL CHECK (length(btrim(frente)) > 0),
    verso            text         NOT NULL DEFAULT '',
    -- caixa de Leitner: 1 = revisar sempre ... 5 = bem memorizado
    caixa            smallint     NOT NULL DEFAULT 1 CHECK (caixa BETWEEN 1 AND 5),
    proxima_revisao  date         NOT NULL DEFAULT current_date,
    acertos          integer      NOT NULL DEFAULT 0 CHECK (acertos >= 0),
    erros            integer      NOT NULL DEFAULT 0 CHECK (erros >= 0),
    revisado_em      timestamptz,
    CONSTRAINT flashcard_ordem_uk UNIQUE (baralho_id, ordem) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS flashcard_revisao_idx ON flashcard (baralho_id, proxima_revisao);

-- 3. Converte apresentações existentes em baralhos
CREATE TEMP TABLE tmp_ap ON COMMIT DROP AS SELECT arquivo_id FROM apresentacao;
CREATE TEMP TABLE tmp_slide ON COMMIT DROP AS
    SELECT s.apresentacao_id, s.ordem, s.titulo, s.corpo FROM slide s;
DELETE FROM apresentacao WHERE arquivo_id IN (SELECT arquivo_id FROM tmp_ap);
UPDATE arquivo
   SET tipo_arquivo_id = 5, nome = regexp_replace(nome, '\.pptx$', '') || '.cards'
 WHERE id IN (SELECT arquivo_id FROM tmp_ap);
INSERT INTO baralho (arquivo_id) SELECT arquivo_id FROM tmp_ap;
INSERT INTO flashcard (baralho_id, ordem, frente, verso)
SELECT apresentacao_id, ordem,
       left(COALESCE(NULLIF(btrim(titulo), ''), 'Cartão ' || ordem), 500), corpo
  FROM tmp_slide;

-- 4. Pasta padrão: "Apresentações" passa a ser "Flashcards"
UPDATE pasta p SET nome = 'Flashcards'
 WHERE p.nome = 'Apresentações' AND p.pasta_pai_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM pasta q WHERE q.usuario_id = p.usuario_id AND q.pasta_pai_id IS NULL AND lower(q.nome) = 'flashcards');
INSERT INTO pasta (usuario_id, nome)
SELECT u.id, 'Flashcards' FROM usuario u
 WHERE NOT EXISTS (SELECT 1 FROM pasta q WHERE q.usuario_id = u.id AND q.pasta_pai_id IS NULL AND lower(q.nome) = 'flashcards');

CREATE OR REPLACE FUNCTION trg_usuario_pastas_padrao() RETURNS trigger AS $$
BEGIN
    INSERT INTO pasta (usuario_id, nome) VALUES
        (NEW.id, 'Mapas Mentais'),
        (NEW.id, 'Documentos'),
        (NEW.id, 'Planilhas'),
        (NEW.id, 'Flashcards');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
