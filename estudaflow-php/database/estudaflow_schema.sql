-- ============================================================
-- EstudaFlow — Script de criação do banco (PostgreSQL 15+)
-- 24 tabelas · 3 views · 3 triggers · dados iniciais de domínio
--
-- Uso:
--   createdb estudaflow
--   psql -d estudaflow -f estudaflow_schema.sql
--
-- O script é re-executável: ele apaga e recria o schema "estudaflow".
-- ATENÇÃO: isso remove todos os dados existentes nesse schema.
-- ============================================================

BEGIN;

DROP SCHEMA IF EXISTS estudaflow CASCADE;
CREATE SCHEMA estudaflow;
SET search_path TO estudaflow;


-- ============================================================
-- 1. TABELAS DE DOMÍNIO (valores fixos, antes "hardcoded" no JS)
-- ============================================================

CREATE TABLE prioridade (
    id    smallint    PRIMARY KEY,
    nome  varchar(20) NOT NULL UNIQUE
);

CREATE TABLE tipo_evento (
    id    smallint    PRIMARY KEY,
    nome  varchar(30) NOT NULL UNIQUE,
    cor   varchar(20) NOT NULL          -- classe de cor usada no front (chip-blue etc.)
);

CREATE TABLE tipo_arquivo (
    id        smallint    PRIMARY KEY,
    codigo    varchar(20) NOT NULL UNIQUE,   -- mapa, planilha, documento, apresentacao
    nome      varchar(40) NOT NULL,
    extensao  varchar(10) NOT NULL,
    icone     varchar(10) NOT NULL
);

CREATE TABLE area_conhecimento (
    id    smallint    PRIMARY KEY,
    nome  varchar(60) NOT NULL UNIQUE        -- matematica, computacao, fisica, linguagens
);

CREATE TABLE tipo_atividade (
    id      smallint    PRIMARY KEY,
    codigo  varchar(40) NOT NULL UNIQUE,
    cor     varchar(20) NOT NULL
);


-- ============================================================
-- 2. USUÁRIOS E ACADÊMICO
-- ============================================================

CREATE TABLE curso (
    id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome  varchar(120) NOT NULL UNIQUE
);

CREATE TABLE usuario (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    curso_id    integer      REFERENCES curso(id) ON DELETE SET NULL,
    nome        varchar(120) NOT NULL,
    email       varchar(150) NOT NULL,
    senha_hash  varchar(255) NOT NULL,       -- NUNCA guardar senha em texto puro
    criado_em   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT usuario_email_formato CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
-- e-mail único sem diferenciar maiúsculas/minúsculas
CREATE UNIQUE INDEX usuario_email_uk ON usuario (lower(email));
CREATE INDEX usuario_curso_idx ON usuario (curso_id);

CREATE TABLE disciplina (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  integer      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nome        varchar(100) NOT NULL,
    CONSTRAINT disciplina_usuario_nome_uk UNIQUE (usuario_id, nome),
    -- permite FK composta: garante que meta/evento só usem disciplina do próprio dono
    CONSTRAINT disciplina_id_usuario_uk UNIQUE (id, usuario_id)
);


-- ============================================================
-- 3. METAS
-- ============================================================

CREATE TABLE meta (
    id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id     integer      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    disciplina_id  integer,
    prioridade_id  smallint     NOT NULL DEFAULT 1 REFERENCES prioridade(id),
    nome           varchar(200) NOT NULL,
    prazo          date,
    concluida      boolean      NOT NULL DEFAULT false,
    concluida_em   timestamptz,
    criado_em      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT meta_nome_nao_vazio CHECK (length(btrim(nome)) > 0),
    CONSTRAINT meta_conclusao_coerente CHECK (concluida OR concluida_em IS NULL),
    -- disciplina deve pertencer ao mesmo usuário; ao apagá-la, a meta vira "Geral"
    CONSTRAINT meta_disciplina_fk FOREIGN KEY (disciplina_id, usuario_id)
        REFERENCES disciplina (id, usuario_id) ON DELETE SET NULL (disciplina_id)
);
CREATE INDEX meta_usuario_idx      ON meta (usuario_id, concluida);
CREATE INDEX meta_disciplina_idx   ON meta (disciplina_id);
CREATE INDEX meta_usuario_prazo_idx ON meta (usuario_id, prazo);


-- ============================================================
-- 4. CRONOGRAMA
-- ============================================================

CREATE TABLE evento (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      integer      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    disciplina_id   integer,
    tipo_evento_id  smallint     NOT NULL REFERENCES tipo_evento(id),
    titulo          varchar(200) NOT NULL,
    data            date         NOT NULL,
    hora            time         NOT NULL DEFAULT '00:00',
    criado_em       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT evento_titulo_nao_vazio CHECK (length(btrim(titulo)) > 0),
    CONSTRAINT evento_disciplina_fk FOREIGN KEY (disciplina_id, usuario_id)
        REFERENCES disciplina (id, usuario_id) ON DELETE SET NULL (disciplina_id)
);
CREATE INDEX evento_usuario_data_idx ON evento (usuario_id, data);
CREATE INDEX evento_disciplina_idx   ON evento (disciplina_id);


-- ============================================================
-- 5. ARQUIVOS E PASTAS
-- ============================================================

CREATE TABLE pasta (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id    integer      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    pasta_pai_id  integer,
    nome          varchar(100) NOT NULL,
    criado_em     timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pasta_id_usuario_uk UNIQUE (id, usuario_id),
    CONSTRAINT pasta_nao_e_pai_de_si CHECK (pasta_pai_id IS NULL OR pasta_pai_id <> id),
    CONSTRAINT pasta_pai_fk FOREIGN KEY (pasta_pai_id, usuario_id)
        REFERENCES pasta (id, usuario_id) ON DELETE SET NULL (pasta_pai_id)
);
-- sem duas pastas com o mesmo nome dentro da mesma pasta (raiz incluída)
CREATE UNIQUE INDEX pasta_nome_uk ON pasta (usuario_id, COALESCE(pasta_pai_id, 0), lower(nome));
CREATE INDEX pasta_pai_idx ON pasta (pasta_pai_id);

CREATE TABLE arquivo (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      integer      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    pasta_id        integer,
    tipo_arquivo_id smallint     NOT NULL REFERENCES tipo_arquivo(id),
    nome            varchar(200) NOT NULL,
    tamanho_bytes   integer      NOT NULL DEFAULT 0 CHECK (tamanho_bytes >= 0),
    criado_em       timestamptz  NOT NULL DEFAULT now(),
    atualizado_em   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT arquivo_nome_nao_vazio CHECK (length(btrim(nome)) > 0),
    -- permite que as tabelas filhas confirmem o tipo do arquivo
    CONSTRAINT arquivo_id_tipo_uk UNIQUE (id, tipo_arquivo_id),
    -- ao apagar a pasta, o arquivo volta para a raiz (não é apagado)
    CONSTRAINT arquivo_pasta_fk FOREIGN KEY (pasta_id, usuario_id)
        REFERENCES pasta (id, usuario_id) ON DELETE SET NULL (pasta_id)
);
CREATE INDEX arquivo_usuario_recente_idx ON arquivo (usuario_id, criado_em DESC);
CREATE INDEX arquivo_pasta_idx           ON arquivo (pasta_id);
CREATE INDEX arquivo_tipo_idx            ON arquivo (tipo_arquivo_id);

-- ---------- Especializações de arquivo (1:1) ----------
-- Cada filha guarda tipo_arquivo_id fixo (1=mapa, 2=planilha, 3=documento,
-- 4=apresentacao) e usa FK composta, impedindo, por exemplo, ligar um
-- "documento" a um arquivo que seja uma planilha.

CREATE TABLE mapa_mental (
    arquivo_id       integer  PRIMARY KEY,
    tipo_arquivo_id  smallint NOT NULL DEFAULT 1 CHECK (tipo_arquivo_id = 1),
    FOREIGN KEY (arquivo_id, tipo_arquivo_id)
        REFERENCES arquivo (id, tipo_arquivo_id) ON DELETE CASCADE
);

CREATE TABLE mapa_no (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mapa_id    integer      NOT NULL REFERENCES mapa_mental(arquivo_id) ON DELETE CASCADE,
    no_pai_id  integer,
    rotulo     varchar(100) NOT NULL,
    pos_x      real         NOT NULL,
    pos_y      real         NOT NULL,
    cor        varchar(9)   NOT NULL DEFAULT '#6c8cff'
               CHECK (cor ~ '^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$'),
    CONSTRAINT mapa_no_id_mapa_uk UNIQUE (id, mapa_id),
    CONSTRAINT mapa_no_nao_e_pai_de_si CHECK (no_pai_id IS NULL OR no_pai_id <> id),
    -- o pai precisa estar no mesmo mapa; apagar um nó remove seus descendentes
    CONSTRAINT mapa_no_pai_fk FOREIGN KEY (no_pai_id, mapa_id)
        REFERENCES mapa_no (id, mapa_id) ON DELETE CASCADE
);
CREATE INDEX mapa_no_mapa_idx ON mapa_no (mapa_id);
CREATE INDEX mapa_no_pai_idx  ON mapa_no (no_pai_id);

CREATE TABLE planilha (
    arquivo_id       integer  PRIMARY KEY,
    tipo_arquivo_id  smallint NOT NULL DEFAULT 2 CHECK (tipo_arquivo_id = 2),
    qtd_linhas       smallint NOT NULL DEFAULT 5 CHECK (qtd_linhas >= 1),
    qtd_colunas      smallint NOT NULL DEFAULT 5 CHECK (qtd_colunas BETWEEN 1 AND 8),
    FOREIGN KEY (arquivo_id, tipo_arquivo_id)
        REFERENCES arquivo (id, tipo_arquivo_id) ON DELETE CASCADE
);

-- Guarda apenas células preenchidas (linha/coluna começam em 1; coluna 1 = A)
CREATE TABLE planilha_celula (
    planilha_id  integer  NOT NULL REFERENCES planilha(arquivo_id) ON DELETE CASCADE,
    linha        smallint NOT NULL CHECK (linha >= 1),
    coluna       smallint NOT NULL CHECK (coluna BETWEEN 1 AND 8),
    valor        text     NOT NULL DEFAULT '',
    PRIMARY KEY (planilha_id, linha, coluna)
);

CREATE TABLE documento (
    arquivo_id       integer  PRIMARY KEY,
    tipo_arquivo_id  smallint NOT NULL DEFAULT 3 CHECK (tipo_arquivo_id = 3),
    conteudo         text     NOT NULL DEFAULT '',
    FOREIGN KEY (arquivo_id, tipo_arquivo_id)
        REFERENCES arquivo (id, tipo_arquivo_id) ON DELETE CASCADE
);

CREATE TABLE apresentacao (
    arquivo_id       integer  PRIMARY KEY,
    tipo_arquivo_id  smallint NOT NULL DEFAULT 4 CHECK (tipo_arquivo_id = 4),
    FOREIGN KEY (arquivo_id, tipo_arquivo_id)
        REFERENCES arquivo (id, tipo_arquivo_id) ON DELETE CASCADE
);

CREATE TABLE slide (
    id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apresentacao_id  integer      NOT NULL REFERENCES apresentacao(arquivo_id) ON DELETE CASCADE,
    ordem            smallint     NOT NULL CHECK (ordem >= 1),
    titulo           varchar(200) NOT NULL DEFAULT '',
    corpo            text         NOT NULL DEFAULT '',
    -- DEFERRABLE permite reordenar slides numa mesma transação
    CONSTRAINT slide_ordem_uk UNIQUE (apresentacao_id, ordem) DEFERRABLE INITIALLY DEFERRED
);


-- ============================================================
-- 6. BIBLIOTECA
-- ============================================================

CREATE TABLE livro (
    id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    area_id   smallint     NOT NULL REFERENCES area_conhecimento(id),
    titulo    varchar(200) NOT NULL,
    autor     varchar(200) NOT NULL,
    icone     varchar(10)  NOT NULL DEFAULT '📘',
    CONSTRAINT livro_titulo_autor_uk UNIQUE (titulo, autor)
);
CREATE INDEX livro_area_idx ON livro (area_id);
-- busca por título/autor (usada na barra de pesquisa)
CREATE INDEX livro_busca_idx ON livro
    USING gin (to_tsvector('portuguese', titulo || ' ' || autor));

CREATE TABLE tag (
    id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome  varchar(60) NOT NULL
);
CREATE UNIQUE INDEX tag_nome_uk ON tag (lower(nome));

CREATE TABLE livro_tag (
    livro_id  integer NOT NULL REFERENCES livro(id) ON DELETE CASCADE,
    tag_id    integer NOT NULL REFERENCES tag(id)   ON DELETE CASCADE,
    PRIMARY KEY (livro_id, tag_id)
);
CREATE INDEX livro_tag_tag_idx ON livro_tag (tag_id);

CREATE TABLE lista_leitura (
    usuario_id     integer     NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    livro_id       integer     NOT NULL REFERENCES livro(id)   ON DELETE CASCADE,
    adicionado_em  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, livro_id)
);
CREATE INDEX lista_leitura_livro_idx ON lista_leitura (livro_id);


-- ============================================================
-- 7. ATIVIDADE RECENTE (dashboard)
-- ============================================================

CREATE TABLE atividade (
    id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id        integer      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    tipo_atividade_id smallint     NOT NULL REFERENCES tipo_atividade(id),
    descricao         varchar(255) NOT NULL,
    criado_em         timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX atividade_usuario_recente_idx ON atividade (usuario_id, criado_em DESC);


-- ============================================================
-- 8. DADOS INICIAIS DAS TABELAS DE DOMÍNIO
--    (a biblioteca e os demais dados do usuário começam VAZIOS)
-- ============================================================

INSERT INTO prioridade (id, nome) VALUES
    (1, 'normal'),
    (2, 'urgente'),
    (3, 'baixa');

INSERT INTO tipo_evento (id, nome, cor) VALUES
    (1, 'aula',    'blue'),
    (2, 'prova',   'purple'),
    (3, 'entrega', 'green'),
    (4, 'estudo',  'yellow');

INSERT INTO tipo_arquivo (id, codigo, nome, extensao, icone) VALUES
    (1, 'mapa',         'Mapa Mental',  '.flow', '🗺️'),
    (2, 'planilha',     'Planilha',     '.xls',  '📊'),
    (3, 'documento',    'Documento',    '.doc',  '📝'),
    (4, 'apresentacao', 'Apresentação', '.pptx', '🖼️');

INSERT INTO area_conhecimento (id, nome) VALUES
    (1, 'matematica'),
    (2, 'computacao'),
    (3, 'fisica'),
    (4, 'linguagens');

INSERT INTO tipo_atividade (id, codigo, cor) VALUES
    (1, 'meta_criada',      'accent2'),
    (2, 'meta_concluida',   'accent3'),
    (3, 'evento_criado',    'accent4'),
    (4, 'arquivo_salvo',    'accent'),
    (5, 'livro_adicionado', 'text3');


-- ============================================================
-- 9. TRIGGERS
-- ============================================================

-- 9.1 meta: preenche/limpa concluida_em automaticamente
CREATE FUNCTION trg_meta_conclusao() RETURNS trigger AS $$
BEGIN
    IF NEW.concluida AND (TG_OP = 'INSERT' OR NOT OLD.concluida) THEN
        NEW.concluida_em := now();
    ELSIF NOT NEW.concluida THEN
        NEW.concluida_em := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meta_conclusao
    BEFORE INSERT OR UPDATE OF concluida ON meta
    FOR EACH ROW EXECUTE FUNCTION trg_meta_conclusao();

-- 9.2 arquivo: mantém atualizado_em
CREATE FUNCTION trg_arquivo_atualizado() RETURNS trigger AS $$
BEGIN
    NEW.atualizado_em := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER arquivo_atualizado
    BEFORE UPDATE ON arquivo
    FOR EACH ROW EXECUTE FUNCTION trg_arquivo_atualizado();

-- 9.3 usuario: cria as pastas padrão da página "Arquivos" no cadastro
CREATE FUNCTION trg_usuario_pastas_padrao() RETURNS trigger AS $$
BEGIN
    INSERT INTO pasta (usuario_id, nome) VALUES
        (NEW.id, 'Mapas Mentais'),
        (NEW.id, 'Documentos'),
        (NEW.id, 'Planilhas'),
        (NEW.id, 'Apresentações');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuario_pastas_padrao
    AFTER INSERT ON usuario
    FOR EACH ROW EXECUTE FUNCTION trg_usuario_pastas_padrao();


-- ============================================================
-- 10. VIEWS (alimentam o Dashboard e a página Arquivos)
-- ============================================================

-- Os 4 cards do dashboard (um registro por usuário)
CREATE VIEW vw_dashboard_resumo AS
SELECT
    u.id AS usuario_id,
    (SELECT count(*) FROM arquivo a WHERE a.usuario_id = u.id)                    AS documentos_criados,
    (SELECT count(*) FROM meta m WHERE m.usuario_id = u.id AND m.concluida)       AS metas_concluidas,
    (SELECT count(*) FROM meta m WHERE m.usuario_id = u.id)                       AS metas_total,
    (SELECT count(*) FROM evento e
      WHERE e.usuario_id = u.id
        AND e.data >= date_trunc('week', current_date)::date
        AND e.data <  date_trunc('week', current_date)::date + 7)                 AS eventos_semana,
    (SELECT count(*) FROM livro)                                                  AS livros_biblioteca
FROM usuario u;

-- Barras de "Progresso das Metas": % concluído por disciplina
CREATE VIEW vw_progresso_metas AS
SELECT
    m.usuario_id,
    COALESCE(d.nome, 'Geral')                                  AS disciplina,
    count(*)                                                   AS total,
    count(*) FILTER (WHERE m.concluida)                        AS concluidas,
    round(100.0 * count(*) FILTER (WHERE m.concluida) / count(*)) AS percentual
FROM meta m
LEFT JOIN disciplina d ON d.id = m.disciplina_id
GROUP BY m.usuario_id, COALESCE(d.nome, 'Geral');

-- Contagem de itens por pasta (página Arquivos > Pastas)
CREATE VIEW vw_pasta_contagem AS
SELECT
    p.id AS pasta_id,
    p.usuario_id,
    p.nome,
    count(a.id) AS qtd_itens
FROM pasta p
LEFT JOIN arquivo a ON a.pasta_id = p.id
GROUP BY p.id, p.usuario_id, p.nome;

COMMIT;