<?php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
$action = $_GET['action'] ?? 'session';
$readActions = ['session', 'state', 'file_get', 'profile_stats', 'export'];
$writeActions = ['register','login','logout','meta_add','meta_toggle','meta_delete','event_add','event_delete','file_save','file_delete','book_add','reading_toggle','card_review','profile_update','avatar_set','password_change','account_delete'];
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
        reply(['file'=>$file,'content'=>fileContent($id,$file['codigo'])]);
    }
    if ($action === 'profile_stats') {
        $n=one("SELECT
            (SELECT count(*) FROM arquivo WHERE usuario_id=?) AS arquivos,
            (SELECT count(*) FROM meta WHERE usuario_id=? AND concluida) AS metas_concluidas,
            (SELECT count(*) FROM meta WHERE usuario_id=?) AS metas,
            (SELECT COALESCE(sum(f.acertos+f.erros),0) FROM flashcard f JOIN arquivo a ON a.id=f.baralho_id WHERE a.usuario_id=?) AS revisoes,
            (SELECT count(*) FROM flashcard f JOIN arquivo a ON a.id=f.baralho_id WHERE a.usuario_id=? AND f.caixa>=4) AS dominados",[$uid,$uid,$uid,$uid,$uid]);
        // Dias com alguma atividade (atividades registradas ou revisões de flashcards).
        $dias=array_column(rows("SELECT DISTINCT d FROM (
            SELECT criado_em::date AS d FROM atividade WHERE usuario_id=?
            UNION SELECT f.revisado_em::date FROM flashcard f JOIN arquivo a ON a.id=f.baralho_id WHERE a.usuario_id=? AND f.revisado_em IS NOT NULL
        ) x ORDER BY d DESC",[$uid,$uid]),'d');
        $set=array_flip($dias); $streak=0; $day=new DateTimeImmutable('today');
        if (!isset($set[$day->format('Y-m-d')])) $day=$day->modify('-1 day'); // a sequência continua até o fim de hoje
        while (isset($set[$day->format('Y-m-d')])) { $streak++; $day=$day->modify('-1 day'); }
        $stats=array_map('intval',$n);
        $stats['sequencia']=$streak; $stats['dias_ativos']=count($dias);
        reply(['stats'=>$stats]);
    }
    if ($action === 'export') {
        // Portabilidade dos dados (LGPD): tudo o que pertence à conta, sem o hash da senha.
        $files=rows('SELECT a.id,a.nome,t.codigo AS tipo,p.nome AS pasta,a.tamanho_bytes,a.criado_em,a.atualizado_em FROM arquivo a JOIN tipo_arquivo t ON t.id=a.tipo_arquivo_id LEFT JOIN pasta p ON p.id=a.pasta_id WHERE a.usuario_id=? ORDER BY a.id',[$uid]);
        foreach ($files as &$f) $f['conteudo']=fileContent((int)$f['id'],$f['tipo']); unset($f);
        reply([
            'gerado_em'=>date(DATE_ATOM),
            'usuario'=>userData($uid),
            'metas'=>rows("SELECT m.nome,COALESCE(d.nome,'Geral') AS disciplina,p.nome AS prioridade,m.prazo,m.concluida,m.concluida_em,m.criado_em FROM meta m LEFT JOIN disciplina d ON d.id=m.disciplina_id JOIN prioridade p ON p.id=m.prioridade_id WHERE m.usuario_id=? ORDER BY m.id",[$uid]),
            'eventos'=>rows('SELECT e.titulo,e.data,e.hora,t.nome AS tipo FROM evento e JOIN tipo_evento t ON t.id=e.tipo_evento_id WHERE e.usuario_id=? ORDER BY e.data,e.hora',[$uid]),
            'arquivos'=>$files,
            'lista_de_leitura'=>rows('SELECT l.titulo,l.autor FROM lista_leitura r JOIN livro l ON l.id=r.livro_id WHERE r.usuario_id=? ORDER BY l.titulo',[$uid]),
            'atividades'=>rows('SELECT a.descricao,t.codigo AS tipo,a.criado_em FROM atividade a JOIN tipo_atividade t ON t.id=a.tipo_atividade_id WHERE a.usuario_id=? ORDER BY a.criado_em',[$uid]),
        ]);
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
        case 'card_review':
            // Repetição espaçada (caixas de Leitner): errei volta para a caixa 1; acertei sobe uma caixa.
            $card=one('SELECT f.id,f.caixa,a.nome FROM flashcard f JOIN arquivo a ON a.id=f.baralho_id WHERE f.id=? AND a.usuario_id=? FOR UPDATE OF f',[integer($data['id'] ?? null),$uid]);
            if (!$card) fail('Cartão não encontrado.',404);
            $resp=textField($data,'resposta',10);
            $intervalos=[1=>1,2=>3,3=>7,4=>14,5=>30];
            $caixa=(int)$card['caixa'];
            if ($resp==='errei') { $caixa=1; $dias=0; }
            elseif ($resp==='dificil') { $dias=1; }
            elseif ($resp==='acertei') { $caixa=min(5,$caixa+1); $dias=$intervalos[$caixa]; }
            else fail('Resposta inválida.');
            $row=one('UPDATE flashcard SET caixa=?,proxima_revisao=current_date+?::int,acertos=acertos+?,erros=erros+?,revisado_em=now() WHERE id=? RETURNING caixa,proxima_revisao AS proxima',[$caixa,$dias,$resp==='errei'?0:1,$resp==='errei'?1:0,(int)$card['id']]);
            db()->commit();
            reply(['card'=>['id'=>(int)$card['id'],'caixa'=>(int)$row['caixa'],'proxima'=>$row['proxima'],'dias'=>$dias]]);
        case 'profile_update':
            $nome=textField($data,'nome',120);
            $curso=textField($data,'curso',120,false);
            $cursoId=$curso === '' ? null : (int)one('INSERT INTO curso (nome) VALUES (?) ON CONFLICT (nome) DO UPDATE SET nome=EXCLUDED.nome RETURNING id',[$curso])['id'];
            query('UPDATE usuario SET nome=?,curso_id=?,atualizado_em=now() WHERE id=?',[$nome,$cursoId,$uid]);
            break;
        case 'avatar_set':
            $foto=$data['foto'] ?? null;
            if ($foto !== null) {
                if (!is_string($foto) || strlen($foto)>400000 || !preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#',$foto,$m)) fail('Imagem inválida ou muito grande.');
                $bin=base64_decode($m[2],true);
                $info=$bin===false ? false : @getimagesizefromstring($bin);
                if (!$info || $info[0]<16 || $info[1]<16 || $info[0]>1024 || $info[1]>1024) fail('Não foi possível ler a imagem enviada.');
            }
            query('UPDATE usuario SET foto=?,atualizado_em=now() WHERE id=?',[$foto,$uid]);
            break;
        case 'password_change':
            verifyPassword($uid,$data['atual'] ?? null);
            $nova=$data['nova'] ?? '';
            if (!is_string($nova) || strlen($nova)<6 || strlen($nova)>72) fail('A nova senha precisa ter entre 6 e 72 caracteres.');
            if (password_verify($nova,one('SELECT senha_hash FROM usuario WHERE id=?',[$uid])['senha_hash'])) fail('A nova senha precisa ser diferente da atual.');
            query('UPDATE usuario SET senha_hash=?,atualizado_em=now() WHERE id=?',[password_hash($nova,PASSWORD_DEFAULT),$uid]);
            db()->commit();
            session_regenerate_id(true);
            reply(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
        case 'account_delete':
            if (($data['confirmacao'] ?? '') !== 'EXCLUIR') fail('Digite EXCLUIR para confirmar.');
            verifyPassword($uid,$data['senha'] ?? null);
            // Metas, eventos, arquivos, pastas e atividades são apagados em cascata pelo banco.
            query('DELETE FROM usuario WHERE id=?',[$uid]);
            db()->commit();
            $_SESSION=[];
            session_regenerate_id(true);
            $_SESSION['csrf']=bin2hex(random_bytes(32));
            reply(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
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
