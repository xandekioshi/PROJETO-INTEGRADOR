# EstudaFlow: integração com PHP e PostgreSQL

Este pacote mantém o HTML e o CSS do projeto original e conecta as telas ao SQL fornecido. O navegador chama uma API PHP com `fetch`; o PHP valida os dados, identifica o usuário pela sessão e executa consultas no PostgreSQL com PDO.

## 1. O que foi integrado

| Tela ou função | O que é persistido | Tabelas principais |
| --- | --- | --- |
| Cadastro e login | Nome, curso, e-mail e hash da senha | `usuario`, `curso` |
| Metas | Disciplina, prioridade, prazo e conclusão | `meta`, `disciplina`, `prioridade` |
| Cronograma | Título, data, hora e tipo | `evento`, `tipo_evento` |
| Arquivos | Nome, tipo, pasta, tamanho e datas | `arquivo`, `pasta`, `tipo_arquivo` |
| Documento | Texto completo | `documento` |
| Planilha | Quantidade de linhas/colunas e valores das células | `planilha`, `planilha_celula` |
| Apresentação | Slides na ordem de edição | `apresentacao`, `slide` |
| Mapa mental | Nós, posição, cor e relação com o nó pai | `mapa_mental`, `mapa_no` |
| Biblioteca | Catálogo compartilhado, áreas, tags e lista pessoal | `livro`, `area_conhecimento`, `tag`, `livro_tag`, `lista_leitura` |
| Dashboard | Resumo, progresso e histórico | As três views do SQL e `atividade` |

As metas, os eventos, os arquivos e a lista de leitura pertencem à conta conectada. O catálogo de livros e os cursos são compartilhados, conforme o modelo do SQL. Qualquer usuário conectado pode cadastrar um livro no catálogo nesta versão didática.

A biblioteca começa vazia. Você pode cadastrar livros pela própria interface. São registros de título, autor, área e tags; não há upload de PDF nem conteúdo digital de livros neste banco.

## 2. Requisitos

- PHP 8.1 ou superior com o driver `pdo_pgsql` ativado.
- PostgreSQL 15 ou superior, iniciado no seu computador.
- Um navegador. DBeaver ou pgAdmin são opcionais para importar e conferir o banco.

Não é necessário Node.js, Composer ou MySQL. O servidor embutido do PHP basta para testar localmente.

## 3. Estrutura do projeto

```text
estudaflow-php/
    app/
        config.example.php
        bootstrap.php
        save_file.php
    database/
        estudaflow_schema.sql
    public/
        index.html
        api.php
        css/style.css
        js/...
    TUTORIAL.md
    README.md
```

`app/config.php` será criado por você a partir do exemplo. O servidor deve expor somente a pasta `public`, mantendo configuração e SQL fora da área pública.

## 4. Ativar a extensão do PostgreSQL no PHP (Windows)

Abra o terminal e descubra qual PHP está sendo usado:

```powershell
where.exe php
php -v
php --ini
```

O comando `php --ini` mostra a linha **Loaded Configuration File**. Edite exatamente esse arquivo, pois pode haver instalações distintas de PHP no computador.

Se aparecer `(none)`, vá à pasta da instalação do PHP, copie `php.ini-development` e renomeie a cópia para `php.ini`. Execute `php --ini` novamente.

No `php.ini`, ative a extensão removendo o ponto e vírgula inicial:

```ini
extension=pdo_pgsql
```

Confira também o caminho de extensões. Em uma instalação Windows, por exemplo:

```ini
extension_dir = "C:\caminho\da\instalacao\php\ext"
```

A pasta informada precisa conter `php_pdo_pgsql.dll`, da mesma distribuição/versão de PHP. Não baixe DLLs avulsas de versões diferentes. Esta aplicação utiliza PDO, portanto `pgsql` sozinho não substitui `pdo_pgsql`.

Feche e abra novamente o servidor PHP depois da alteração. Confira:

```powershell
php -m
php -r "print_r(PDO::getAvailableDrivers());"
```

Deve aparecer `pdo_pgsql` na lista de módulos e `pgsql` na lista de drivers PDO.

Se `php` não for reconhecido, use o caminho completo do executável com o operador `&` do PowerShell:

```powershell
& "C:\caminho\da\instalacao\php\php.exe" --ini
```

Use o mesmo executável para iniciar o projeto. Se você usa XAMPP/Apache, confira também o PHP carregado pelo Apache e reinicie o serviço depois de editar sua configuração.

## 5. Criar o banco e importar seu SQL

### Opção A: pgAdmin ou DBeaver

1. Conecte-se ao PostgreSQL local, normalmente `localhost`, porta `5432`, usuário `postgres`, com a senha definida na instalação.
2. Crie um banco chamado `estudaflow`.
3. Abra uma conexão ou editor SQL apontando para **esse banco**.
4. Abra `database/estudaflow_schema.sql` e execute o script completo.
5. Confira o schema `estudaflow`, suas tabelas e views. No DBeaver, atualize a árvore de objetos se necessário.

O banco e o schema têm o mesmo nome, mas são objetos diferentes: o banco contém o schema, e o schema organiza suas tabelas.

### Opção B: terminal

Dentro da pasta `estudaflow-php`, execute:

```powershell
createdb -h localhost -p 5432 -U postgres estudaflow
psql -h localhost -p 5432 -U postgres -d estudaflow -v ON_ERROR_STOP=1 -f database/estudaflow_schema.sql
```

Se esses comandos não forem reconhecidos, use os executáveis na pasta `bin` da sua instalação do PostgreSQL ou a opção gráfica.

**Atenção ao script fornecido:** ele começa com `DROP SCHEMA IF EXISTS estudaflow CASCADE`. Reexecutá-lo apaga os dados do schema e recria as tabelas. Importe uma vez na instalação; não execute novamente a cada uso do site.

O SQL original está incluído sem alteração. A sintaxe de algumas chaves estrangeiras exige PostgreSQL 15 ou superior.

## 6. Configurar a conexão PHP

Copie o exemplo dentro da pasta do projeto:

```powershell
Copy-Item app/config.example.php app/config.php
```

Edite `app/config.php`:

```php
<?php
return [
    'host' => '127.0.0.1',
    'port' => 5432,
    'database' => 'estudaflow',
    'user' => 'postgres',
    'password' => 'sua_senha_do_postgresql',
    'timezone' => 'America/Cuiaba',
];
```

Use a senha do usuário do PostgreSQL, não a senha que você pretende cadastrar no site. O PHP configura o `search_path` para encontrar as tabelas em `estudaflow` e o fuso horário usado nas datas e no dashboard.

Se outra aplicação ou container publica o banco em uma porta diferente, ajuste `port`. Nesta forma de instalação, o PHP roda no computador e acessa a porta do PostgreSQL disponível nele.

## 7. Iniciar o site

Abra o terminal na pasta `estudaflow-php` e execute:

```powershell
php -S localhost:8000 -t public
```

Se necessário, use o caminho completo:

```powershell
& "C:\caminho\da\instalacao\php\php.exe" -S localhost:8000 -t public
```

Acesse no navegador:

```text
http://localhost:8000
```

Mantenha o terminal aberto. Para parar, pressione `Ctrl+C`.

Abra o site por essa URL. Dar dois cliques em `index.html` ou usar apenas o Live Server do VS Code não executa `api.php`.

Na aba **Cadastrar**, crie sua primeira conta. Use senha de pelo menos seis caracteres; o servidor limita senhas a 72 bytes para compatibilidade com o algoritmo padrão de hash. O login de demonstração foi removido: a conta precisa existir no banco.

## 8. Testar a persistência na interface

1. Cadastre uma conta e crie uma meta com disciplina e prazo.
2. Clique na caixa da meta para concluir; o trigger do SQL preenche `concluida_em`.
3. Adicione um evento no cronograma. Clique em um evento para excluí-lo após confirmar.
4. Crie um documento e escreva um texto. Salve, abra **Arquivos** e clique em **Abrir** para editar o mesmo registro.
5. Teste também a planilha, a apresentação e o mapa mental. Ao adicionar linhas/colunas, os valores da planilha são preservados. No modo **Mover** do mapa, selecione um nó e clique em uma posição vazia.
6. Cadastre um livro e clique em **+ Lista**. Confira **Minha lista de leitura**.
7. Atualize a página: a sessão recupera os dados. Saia, entre novamente e confira a persistência.
8. Crie uma segunda conta para conferir que metas, eventos, arquivos e lista pessoal estão separados. O catálogo de livros permanece compartilhado.

As pastas padrão são criadas automaticamente pelo trigger de cadastro. Os novos arquivos são associados à pasta de seu tipo, e as contagens vêm da view `vw_pasta_contagem`.

## 9. Como fazer a integração: exemplo de uma meta

### Passo 1: ler o formulário no JavaScript

Em `public/js/integration.js`, `addMeta()` monta o objeto:

```javascript
await mutate('meta_add', {
  nome: field('meta-nome'),
  disciplina: field('meta-disciplina'),
  prazo: field('meta-prazo'),
  prioridade: field('meta-prioridade')
});
```

`field()` lê o valor pelo ID do input. `mutate()` chama a API e substitui o estado das telas pela resposta salva no banco.

### Passo 2: enviar JSON para o PHP

Em `public/js/api.js`, `api()` usa `fetch`:

```javascript
const response = await fetch('api.php?action=meta_add', {
  method: 'POST',
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(dados)
});
```

Este trecho é explicativo: `dados` representa o objeto do passo anterior. A função real do projeto recebe esse objeto como `payload` e monta a URL para qualquer ação.

O cookie da sessão é enviado automaticamente ao mesmo servidor. O token CSRF é obtido de `api.php?action=session` ao abrir a página e renovado no login/cadastro. Ele protege as ações de escrita.

### Passo 3: conectar ao PostgreSQL com PDO

Em `app/bootstrap.php`, `db()` lê a configuração e abre a conexão:

```php
$pdo = new PDO(
    "pgsql:host={$c['host']};port={$c['port']};dbname={$c['database']}",
    $c['user'],
    $c['password'],
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);
$pdo->exec('SET search_path TO estudaflow, public');
```

`$c` é o array retornado por `app/config.php`. Essa conexão é reutilizada durante a mesma requisição.

### Passo 4: validar e inserir

Em `public/api.php`, a ação `meta_add` valida os textos, a data e a prioridade. A função `discipline()` procura/cria a disciplina da própria conta. Depois executa:

```php
query(
    'INSERT INTO meta (usuario_id,disciplina_id,prioridade_id,nome,prazo) VALUES (?,?,?,?,?)',
    [$uid, $disc, (int)$pri['id'], $nome, dateField($data, 'prazo')]
);
activity($uid, 1, 'Adicionou meta: ' . $nome);
```

`$uid` vem da sessão PHP. O navegador não escolhe o dono da meta. `query()` prepara a consulta, vincula os valores aos `?` e executa. Os valores não são concatenados no SQL.

A meta e o registro de atividade são salvos dentro de uma transação. Se a gravação falhar, as alterações são revertidas juntas.

### Passo 5: ler do banco e atualizar a tela

Após salvar, o PHP chama `state($uid)` e devolve JSON com metas, eventos, arquivos, catálogo, pastas, resumo e progresso. No JavaScript, `applyState()` atualiza os arrays e `renderAll()` redesenha as telas.

Os arrays continuam sendo usados para renderização e filtros, mas agora são cópias dos dados do servidor. Atualizar a página carrega novamente os registros do PostgreSQL.

### Passo 6: aplicar o mesmo padrão às outras ações

| Ação da API | Método | Função |
| --- | --- | --- |
| `session` | GET | Recuperar usuário e token CSRF |
| `state` | GET | Carregar dados da conta e catálogo |
| `register`, `login`, `logout` | POST | Autenticação |
| `meta_add`, `meta_toggle`, `meta_delete` | POST | Criar, concluir/reabrir e excluir meta |
| `event_add`, `event_delete` | POST | Criar e excluir evento |
| `file_get` | GET | Abrir conteúdo de um arquivo pelo parâmetro `id` |
| `file_save`, `file_delete` | POST | Criar/atualizar e excluir material |
| `book_add`, `reading_toggle` | POST | Cadastrar livro e alternar lista pessoal |

Para acrescentar um campo, altere o formulário, o objeto enviado pelo JS, a validação e o SQL do PHP, e a leitura em `state()` se ele precisar aparecer na tela. Para acrescentar uma ação, inclua-a na lista de ações permitidas e implemente seu tratamento.

## 10. Consultas para conferir os dados

No editor SQL conectado ao banco `estudaflow`:

```sql
SELECT id, nome, email, curso_id FROM estudaflow.usuario;
SELECT id, usuario_id, nome, concluida, concluida_em FROM estudaflow.meta;
SELECT id, usuario_id, titulo, data, hora FROM estudaflow.evento;
SELECT id, usuario_id, nome, tamanho_bytes FROM estudaflow.arquivo;
SELECT arquivo_id, conteudo FROM estudaflow.documento;
SELECT * FROM estudaflow.planilha_celula;
SELECT * FROM estudaflow.slide ORDER BY apresentacao_id, ordem;
SELECT * FROM estudaflow.mapa_no;
SELECT * FROM estudaflow.lista_leitura;
SELECT * FROM estudaflow.vw_dashboard_resumo;
SELECT * FROM estudaflow.vw_progresso_metas;
SELECT * FROM estudaflow.vw_pasta_contagem;
```

## 11. Problemas comuns

| Sintoma | Como verificar |
| --- | --- |
| `could not find driver` no terminal | Ative `pdo_pgsql` no `php.ini` do mesmo executável que inicia o servidor. |
| Falha de autenticação no PostgreSQL | Confira usuário e senha em `app/config.php`. |
| Conexão recusada | Confira se o PostgreSQL está iniciado e a porta está correta. |
| `database does not exist` | Crie o banco e confira seu nome na configuração. |
| `relation ... does not exist` | Importe o script no banco correto; o schema esperado é `estudaflow`. |
| Erro ao importar `ON DELETE SET NULL (...)` | Confira se o PostgreSQL é versão 15 ou superior. |
| PHP exibe erro ao carregar a extensão | Confira `extension_dir`, a distribuição de PHP e as DLLs incluídas nela. |
| Resposta inválida do servidor | Acesse pelo servidor PHP, não por `file://` ou Live Server; confira o terminal. |
| Não foi possível iniciar a sessão | Confira se `session.save_path` no `php.ini` aponta para uma pasta existente e gravável pelo PHP. |
| Sessão/token inválido | Atualize a página e entre novamente. Mantenha o mesmo endereço, sem alternar entre `localhost` e `127.0.0.1`. |
| E-mail já existe | Entre com a conta cadastrada ou use outro e-mail. |

A API envia mensagens gerais ao navegador e grava o erro técnico no terminal do PHP. Para detalhes de uma chamada, abra `F12`, guia **Rede/Network**, e veja a resposta de `api.php`.

## 12. Segurança e limites da versão

As senhas usam `password_hash()` e o login usa `password_verify()`. Não são armazenadas em `localStorage`. Sessões têm cookies `HttpOnly` e `SameSite=Lax`; em HTTPS, o cookie recebe também `Secure`. Consultas usam parâmetros preparados e operações pessoais restringem os registros por `usuario_id`. Os textos do banco são escapados ao montar HTML.

Esta é uma aplicação didática para execução local. A limitação de tentativas de login é por sessão; um sistema publicado exigiria controle persistente de tentativas e revisão de permissões, especialmente para administrar o catálogo compartilhado. Use HTTPS e um usuário de banco com permissões adequadas ao publicar. O servidor `php -S` é destinado a testes/desenvolvimento.

Os materiais são conteúdo estruturado no PostgreSQL. As extensões `.doc`, `.xls`, `.pptx` e `.flow` seguem os nomes do projeto original; não são exportações compatíveis com Word, Excel ou PowerPoint. Você reabre e edita o conteúdo dentro do EstudaFlow. A planilha guarda texto e não calcula fórmulas. O tamanho exibido mede o JSON do conteúdo salvo.

Limites adotados: requisição de até 2 MB, planilha de até 500 linhas e 8 colunas, apresentação com até 200 slides e mapa com até 500 nós. O front usa as tabelas de domínio para validar os tipos existentes, mas seus controles visuais continuam oferecendo as opções do SQL original. A estrutura de pastas aninhadas existe no banco; esta interface utiliza apenas as quatro pastas padrão.

Referências oficiais para estudo:

- [Driver PDO PostgreSQL](https://www.php.net/manual/pt_BR/ref.pdo-pgsql.php)
- [PDO e prepared statements](https://www.php.net/manual/pt_BR/pdo.prepared-statements.php)
- [password_hash](https://www.php.net/manual/pt_BR/function.password-hash.php)
- [Configuração de cookies de sessão](https://www.php.net/manual/pt_BR/function.session-set-cookie-params.php)

## 13. Verificação realizada

A API foi verificada em PHP 8.3 e PostgreSQL 16 com 46 verificações de autenticação, operações de metas/eventos, leitura e gravação dos quatro tipos de conteúdo, catálogo, lista pessoal, isolamento entre contas e rollback de operações inválidas. O SQL original foi importado com sucesso. Os arquivos PHP e JavaScript passaram na verificação de sintaxe.

Também foram exercitados os scripts da interface em um DOM de teste conectado à API: cadastro, renderização de textos, metas, edição dos quatro tipos de conteúdo, preservação de células e recuperação após logout/login. Isso verifica a integração JavaScript/PHP, sem substituir uma inspeção visual em navegador.
