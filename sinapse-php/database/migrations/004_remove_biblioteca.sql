-- ============================================================
-- 004 — Remove a Biblioteca (livros, tags, lista de leitura).
-- O site deixou de usar esse recurso em 20/11/2026.
-- Pode ser executada de novo sem erro (IF EXISTS).
-- ============================================================
BEGIN;
SET search_path TO sinapse, public;

-- 1. A view do painel tinha a coluna "livros_biblioteca" (que lê a tabela livro).
--    CREATE OR REPLACE não remove colunas, então a view é recriada sem ela.
DROP VIEW IF EXISTS vw_dashboard_resumo;
CREATE VIEW vw_dashboard_resumo AS
SELECT
    u.id AS usuario_id,
    (SELECT count(*) FROM arquivo a WHERE a.usuario_id = u.id)                    AS documentos_criados,
    (SELECT count(*) FROM meta m WHERE m.usuario_id = u.id AND m.concluida)       AS metas_concluidas,
    (SELECT count(*) FROM meta m WHERE m.usuario_id = u.id)                       AS metas_total,
    (SELECT count(*) FROM evento e
      WHERE e.usuario_id = u.id
        AND e.data >= date_trunc('week', current_date)::date
        AND e.data <  date_trunc('week', current_date)::date + 7)                 AS eventos_semana
FROM usuario u;

-- 2. Tabelas da Biblioteca (as de ligação primeiro).
DROP TABLE IF EXISTS lista_leitura;
DROP TABLE IF EXISTS livro_tag;
DROP TABLE IF EXISTS livro;
DROP TABLE IF EXISTS tag;
DROP TABLE IF EXISTS area_conhecimento;

-- 3. Tipo de atividade "livro adicionado" (e atividades antigas desse tipo, se houver).
DELETE FROM atividade WHERE tipo_atividade_id IN (SELECT id FROM tipo_atividade WHERE codigo = 'livro_adicionado');
DELETE FROM tipo_atividade WHERE codigo = 'livro_adicionado';

COMMIT;
