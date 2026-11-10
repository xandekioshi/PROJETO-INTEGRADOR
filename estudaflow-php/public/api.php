<?php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
$action = $_GET['action'] ?? 'session';
$readActions = ['session', 'state', 'file_get'];
$writeActions = ['register','login','logout','meta_add','meta_toggle','meta_delete','event_add','event_delete','file_save','file_delete','book_add','reading_toggle'];
try {
    if (!in_array($action, array_merge($readActions, $writeActions), true)) fail('Ação desconhecida.', 404);
    $read = in_array($action, $readActions, true);
    if ($_SERVER['REQUEST_METHOD'] !== ($read ? 'GET' : 'POST')) fail('Método não permitido.', 405);
    $data = [];
    if (!$read) {
        if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail('Sessão inválida. Atualize a página.', 403);
        $raw = file_get_contents('php://input', false, null, 0, 2000001);
        if (strlen($raw) > 2000000) fail('Conteúdo acima do limite de 2 MB.', 413);
        $data = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($data)) fail('Envie um objeto JSON.');
    }
    if ($action === 'session') {
        $user = empty($_SESSION['uid']) ? null : userData((int)$_SESSION['uid']);
        if (!$user) unset($_SESSION['uid']);
        reply(['user'=>$user ?: null, 'csrf'=>$_SESSION['csrf']]);
    }
    if ($action === 'login' || $action === 'register') {
        $email = strtolower(textField($data, 'email', 150));
        $pass = $data['senha'] ?? '';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($pass) || strlen($pass)>72) fail('E-mail ou senha inválidos (senha: até 72 bytes).');
        if ($action === 'login') {
            if (($_SESSION['login_block_until'] ?? 0) > time()) fail('Muitas tentativas. Aguarde um minuto.', 429);
            $user = one('SELECT id,senha_hash FROM usuario WHERE lower(email)=?', [$email]);
            if (!$user || !password_verify($pass,$user['senha_hash'])) {
                $_SESSION['login_attempts']=($_SESSION['login_attempts'] ?? 0)+1;
                if ($_SESSION['login_attempts']>=5) { $_SESSION['login_block_until']=time()+60; $_SESSION['login_attempts']=0; }
                fail('E-mail ou senha incorretos.',401);
            }
            $uid=(int)$user['id'];
            unset($_SESSION['login_attempts'],$_SESSION['login_block_until']);
        } else {
            if (strlen($pass)<6) fail('A senha precisa ter pelo menos 6 caracteres.');
            $nome=textField($data,'nome',120);
            $curso=textField($data,'curso',120,false);
            db()->beginTransaction();
            $cursoId=$curso === '' ? null : (int)one('INSERT INTO curso (nome) VALUES (?) ON CONFLICT (nome) DO UPDATE SET nome=EXCLUDED.nome RETURNING id',[$curso])['id'];
            $uid=(int)one('INSERT INTO usuario (nome,email,curso_id,senha_hash) VALUES (?,?,?,?) RETURNING id',[$nome,$email,$cursoId,password_hash($pass,PASSWORD_DEFAULT)])['id'];
            db()->commit();
        }
        session_regenerate_id(true);
        $_SESSION['uid']=$uid;
        $_SESSION['csrf']=bin2hex(random_bytes(32));
        reply(state($uid));
    }
    $uid=ownerId();
    if ($action === 'logout') {
        $_SESSION=[];
        session_regenerate_id(true);
        $_SESSION['csrf']=bin2hex(random_bytes(32));
        reply(['csrf'=>$_SESSION['csrf']]);
    }
    if ($action === 'state') reply(state($uid));
    if ($action === 'file_get') {
        $id=integer($_GET['id'] ?? null);
        $file=one('SELECT a.id,a.nome,t.codigo FROM arquivo a JOIN tipo_arquivo t ON t.id=a.tipo_arquivo_id WHERE a.id=? AND a.usuario_id=?',[$id,$uid]);
        if (!$file) fail('Arquivo não encontrado.',404);
        $content=[];
        switch ($file['codigo']) {
            case 'documento': $content=['conteudo'=>one('SELECT conteudo FROM documento WHERE arquivo_id=?',[$id])['conteudo']]; break;
            case 'planilha':
                $content=one('SELECT qtd_linhas AS rows,qtd_colunas AS cols FROM planilha WHERE arquivo_id=?',[$id]);
                $content['cells']=rows('SELECT linha,coluna,valor FROM planilha_celula WHERE planilha_id=?',[$id]); break;
            case 'apresentacao': $content=['slides'=>rows('SELECT titulo,corpo FROM slide WHERE apresentacao_id=? ORDER BY ordem',[$id])]; break;
            case 'mapa': $content=['nodes'=>rows('SELECT id,no_pai_id AS parent,rotulo AS label,pos_x AS x,pos_y AS y,cor AS color FROM mapa_no WHERE mapa_id=? ORDER BY id',[$id])]; break;
        }
        reply(['file'=>$file,'content'=>$content]);
    }
    // Uma transação salva a operação e sua atividade juntas.
    db()->beginTransaction();
    switch ($action) {
        case 'meta_add':
            $nome=textField($data,'nome',200);
            $disc=discipline($uid,textField($data,'disciplina',100,false));
            $pri=one('SELECT id FROM prioridade WHERE nome=?',[textField($data,'prioridade',20)]);
            if (!$pri) fail('Prioridade inválida.');
            query('INSERT INTO meta (usuario_id,disciplina_id,prioridade_id,nome,prazo) VALUES (?,?,?,?,?)',[$uid,$disc,(int)$pri['id'],$nome,dateField($data,'prazo')]);
            activity($uid,1,'Adicionou meta: '.$nome); break;
        case 'meta_toggle':
            $m=one('UPDATE meta SET concluida=NOT concluida WHERE id=? AND usuario_id=? RETURNING nome,concluida',[integer($data['id'] ?? null),$uid]);
            if (!$m) fail('Meta não encontrada.',404);
            if (boolValue($m['concluida'])) activity($uid,2,'Concluiu meta: '.$m['nome']); break;
        case 'meta_delete':
            if (!query('DELETE FROM meta WHERE id=? AND usuario_id=?',[integer($data['id'] ?? null),$uid])->rowCount()) fail('Meta não encontrada.',404); break;
        case 'event_add':
            $titulo=textField($data,'titulo',200);
            $type=one('SELECT id FROM tipo_evento WHERE cor=?',[textField($data,'tipo',20)]);
            if (!$type) fail('Tipo de evento inválido.');
            $hora=textField($data,'hora',5,false) ?: '00:00';
            if (!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/',$hora)) fail('Horário inválido.');
            query('INSERT INTO evento (usuario_id,tipo_evento_id,titulo,data,hora) VALUES (?,?,?,?,?)',[$uid,(int)$type['id'],$titulo,dateField($data,'data',true),$hora]);
            activity($uid,3,'Adicionou evento: '.$titulo); break;
        case 'event_delete':
            if (!query('DELETE FROM evento WHERE id=? AND usuario_id=?',[integer($data['id'] ?? null),$uid])->rowCount()) fail('Evento não encontrado.',404); break;
        case 'file_delete':
            if (!query('DELETE FROM arquivo WHERE id=? AND usuario_id=?',[integer($data['id'] ?? null),$uid])->rowCount()) fail('Arquivo não encontrado.',404); break;
        case 'file_save':
            require __DIR__.'/../app/save_file.php'; break;
        case 'book_add':
            $titulo=textField($data,'titulo',200); $autor=textField($data,'autor',200);
            $area=one('SELECT id FROM area_conhecimento WHERE nome=?',[textField($data,'area',60)]);
            if (!$area) fail('Área inválida.');
            $book=(int)one('INSERT INTO livro (area_id,titulo,autor) VALUES (?,?,?) RETURNING id',[(int)$area['id'],$titulo,$autor])['id'];
            $tags=textField($data,'tags',600,false);
            foreach (array_unique(array_filter(array_map('trim',explode(',',$tags)))) as $tag) {
                $tag=textField(['tag'=>$tag],'tag',60);
                $tid=(int)one('INSERT INTO tag (nome) VALUES (?) ON CONFLICT (lower(nome)) DO UPDATE SET nome=tag.nome RETURNING id',[$tag])['id'];
                query('INSERT INTO livro_tag (livro_id,tag_id) VALUES (?,?)',[$book,$tid]);
            }
            activity($uid,5,'Adicionou livro: '.$titulo); break;
        case 'reading_toggle':
            $bid=integer($data['id'] ?? null);
            if (!one('SELECT id FROM livro WHERE id=?',[$bid])) fail('Livro não encontrado.',404);
            if (!query('DELETE FROM lista_leitura WHERE usuario_id=? AND livro_id=?',[$uid,$bid])->rowCount()) query('INSERT INTO lista_leitura (usuario_id,livro_id) VALUES (?,?)',[$uid,$bid]);
            break;
    }
    db()->commit();
    reply(state($uid));
} catch (JsonException $e) {
    fail('JSON inválido.',400);
} catch (PDOException $e) {
    rollbackIfOpen();
    // Conexões são liberadas e transações pendentes são revertidas ao encerrar a requisição.
    error_log('EstudaFlow DB: '.$e->getMessage());
    $code=(string)$e->getCode();
    if ($code==='23505') fail('Este e-mail ou registro já existe.',409);
    if (in_array($code,['23503','23514','22001','22007','22008'],true)) fail('Dados inválidos para o banco. Confira os campos.',422);
    fail('Não foi possível acessar o banco. Confira app/config.php, o serviço PostgreSQL e a importação do SQL. Veja também o terminal do PHP.',503);
} catch (Throwable $e) {
    error_log('EstudaFlow: '.$e->getMessage());
    fail('Falha no servidor. Consulte o terminal do PHP.',500);
}
