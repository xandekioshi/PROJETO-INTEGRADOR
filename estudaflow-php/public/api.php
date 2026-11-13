<?php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';
$action = $_GET['action'] ?? 'session';
$readActions = ['session', 'state', 'file_get', 'profile_stats', 'export', 'admin_overview', 'admin_users', 'admin_access', 'admin_contents', 'admin_audit'];
$writeActions = ['register','login','logout','meta_add','meta_toggle','meta_delete','event_add','event_delete','file_save','file_delete','book_add','reading_toggle','card_review','profile_update','avatar_set','password_change','account_delete','admin_user_update','admin_user_password','admin_user_delete','admin_file_delete'];
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
        if ($user && !$user['ativo']) $user = null;
        if (!$user) unset($_SESSION['uid']);
        // Quem volta ao site com a sessão aberta conta como um acesso por dia.
        elseif (($_SESSION['acesso_dia'] ?? '') !== date('Y-m-d')) logAccess((int)$user['id'], $user['email'], 'retorno');
        reply(['user'=>$user ?: null, 'csrf'=>$_SESSION['csrf']]);
    }
    if ($action === 'login' || $action === 'register') {
        $email = strtolower(textField($data, 'email', 150));
        $pass = $data['senha'] ?? '';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($pass) || strlen($pass)>72) fail('E-mail ou senha inválidos (senha: até 72 bytes).');
        if ($action === 'login') {
            if (($_SESSION['login_block_until'] ?? 0) > time()) fail('Muitas tentativas. Aguarde um minuto.', 429);
            $user = one('SELECT id,senha_hash,ativo FROM usuario WHERE lower(email)=?', [$email]);
            if (!$user || !password_verify($pass,$user['senha_hash'])) {
                logAccess($user ? (int)$user['id'] : null, $email, 'falha');
                $_SESSION['login_attempts']=($_SESSION['login_attempts'] ?? 0)+1;
                if ($_SESSION['login_attempts']>=5) { $_SESSION['login_block_until']=time()+60; $_SESSION['login_attempts']=0; }
                fail('E-mail ou senha incorretos.',401);
            }
            if (!boolValue($user['ativo'])) {
                logAccess((int)$user['id'], $email, 'bloqueada');
                fail('Esta conta foi desativada por um administrador.',403);
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
        logAccess($uid, $email, $action === 'login' ? 'login' : 'cadastro');
        reply(state($uid));
    }
    $uid=ownerId();
    // Todas as ações admin_* exigem o papel de administrador.
    if (str_starts_with($action, 'admin_')) requireAdmin($uid);
    if ($action === 'logout') {
        logAccess($uid, null, 'logout');
        $_SESSION=[];
        session_regenerate_id(true);
        $_SESSION['csrf']=bin2hex(random_bytes(32));
        reply(['csrf'=>$_SESSION['csrf']]);
    }
    if ($action === 'state') reply(state($uid));
    // ---------- Administração (somente leitura) ----------
    if ($action === 'admin_overview') {
        $u=one("SELECT count(*) AS total,
            count(*) FILTER (WHERE ativo) AS ativos,
            count(*) FILTER (WHERE NOT ativo) AS desativados,
            count(*) FILTER (WHERE papel='admin') AS admins,
            count(*) FILTER (WHERE criado_em>=now()-interval '7 days') AS novos_7d,
            count(*) FILTER (WHERE ultimo_acesso>=now()-interval '1 day') AS ativos_24h,
            count(*) FILTER (WHERE ultimo_acesso>=now()-interval '7 days') AS ativos_7d
            FROM usuario");
        $outros=one("SELECT (SELECT count(*) FROM meta) AS metas,(SELECT count(*) FROM evento) AS eventos,(SELECT count(*) FROM flashcard) AS cartoes,(SELECT count(*) FROM acesso WHERE tipo IN ('falha','bloqueada') AND criado_em>=now()-interval '1 day') AS falhas_24h");
        reply([
            'usuarios'=>array_map('intval',$u),
            'outros'=>array_map('intval',$outros),
            'conteudos'=>array_map(fn($r)=>['codigo'=>$r['codigo'],'nome'=>$r['nome'],'qtd'=>(int)$r['qtd'],'bytes'=>(int)$r['bytes']], rows("SELECT t.codigo,t.nome,count(a.id) AS qtd,COALESCE(sum(a.tamanho_bytes),0) AS bytes FROM tipo_arquivo t LEFT JOIN arquivo a ON a.tipo_arquivo_id=t.id WHERE t.codigo IN ('mapa','documento','planilha','flashcards') GROUP BY t.id ORDER BY qtd DESC,t.id")),
            'acessos'=>array_map(fn($r)=>['dia'=>$r['dia'],'entradas'=>(int)$r['entradas'],'usuarios'=>(int)$r['usuarios'],'falhas'=>(int)$r['falhas']], rows("SELECT to_char(d,'YYYY-MM-DD') AS dia,
                count(a.id) FILTER (WHERE a.tipo IN ('login','retorno','cadastro')) AS entradas,
                count(DISTINCT a.usuario_id) FILTER (WHERE a.tipo IN ('login','retorno','cadastro')) AS usuarios,
                count(a.id) FILTER (WHERE a.tipo IN ('falha','bloqueada')) AS falhas
                FROM generate_series(current_date-13,current_date,interval '1 day') d
                LEFT JOIN acesso a ON a.criado_em::date=d::date GROUP BY d ORDER BY d")),
            'top'=>rows("SELECT u.id,u.nome,u.email,count(a.id) AS arquivos FROM usuario u JOIN arquivo a ON a.usuario_id=u.id GROUP BY u.id ORDER BY arquivos DESC,u.nome LIMIT 5"),
            'recentes'=>rows("SELECT id,nome,email,criado_em FROM usuario ORDER BY criado_em DESC,id DESC LIMIT 5"),
        ]);
    }
    if ($action === 'admin_users') {
        $list=rows("SELECT u.id,u.nome,u.email,COALESCE(c.nome,'') AS curso,u.papel,u.ativo,u.criado_em,u.ultimo_acesso,
            (SELECT count(*) FROM arquivo a WHERE a.usuario_id=u.id) AS arquivos,
            (SELECT count(*) FROM meta m WHERE m.usuario_id=u.id) AS metas
            FROM usuario u LEFT JOIN curso c ON c.id=u.curso_id ORDER BY u.criado_em DESC,u.id DESC LIMIT 1000");
        foreach ($list as &$r) { $r['id']=(int)$r['id']; $r['ativo']=boolValue($r['ativo']); $r['arquivos']=(int)$r['arquivos']; $r['metas']=(int)$r['metas']; } unset($r);
        reply(['usuarios'=>$list,'eu'=>$uid]);
    }
    if ($action === 'admin_access') {
        reply(['acessos'=>rows("SELECT a.id,a.tipo,COALESCE(u.email,a.email) AS email,u.nome,a.ip,a.navegador,a.criado_em FROM acesso a LEFT JOIN usuario u ON u.id=a.usuario_id ORDER BY a.criado_em DESC,a.id DESC LIMIT 300")]);
    }
    if ($action === 'admin_contents') {
        reply(['arquivos'=>rows("SELECT a.id,a.nome,t.codigo,a.tamanho_bytes,a.criado_em,a.atualizado_em,u.nome AS dono,u.email FROM arquivo a JOIN tipo_arquivo t ON t.id=a.tipo_arquivo_id JOIN usuario u ON u.id=a.usuario_id ORDER BY a.atualizado_em DESC,a.id DESC LIMIT 500")]);
    }
    if ($action === 'admin_audit') {
        reply(['registros'=>rows('SELECT id,admin_nome,acao,alvo,detalhes,criado_em FROM admin_log ORDER BY criado_em DESC,id DESC LIMIT 200')]);
    }
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
            if (one("SELECT 1 FROM usuario WHERE id=? AND papel='admin'",[$uid]) && !one("SELECT 1 FROM usuario WHERE papel='admin' AND ativo AND id<>?",[$uid]))
                fail('Você é o único administrador. Promova outra conta antes de excluir a sua.');
            // Metas, eventos, arquivos, pastas e atividades são apagados em cascata pelo banco.
            query('DELETE FROM usuario WHERE id=?',[$uid]);
            db()->commit();
            $_SESSION=[];
            session_regenerate_id(true);
            $_SESSION['csrf']=bin2hex(random_bytes(32));
            reply(['ok'=>true,'csrf'=>$_SESSION['csrf']]);
        // ---------- Administração (escrita; cada ação fica registrada em admin_log) ----------
        case 'admin_user_update':
            $id=integer($data['id'] ?? null);
            if ($id===$uid) fail('Você não pode alterar o seu próprio acesso. Peça a outro administrador.');
            $alvo=one('SELECT nome,email FROM usuario WHERE id=? FOR UPDATE',[$id]);
            if (!$alvo) fail('Usuário não encontrado.',404);
            $quem=$alvo['nome'].' <'.$alvo['email'].'>';
            if (array_key_exists('papel',$data)) {
                if (!in_array($data['papel'],['estudante','admin'],true)) fail('Papel inválido.');
                query('UPDATE usuario SET papel=? WHERE id=?',[$data['papel'],$id]);
                adminLog($uid,$data['papel']==='admin'?'promoveu_admin':'removeu_admin',$quem);
            }
            if (array_key_exists('ativo',$data)) {
                if (!is_bool($data['ativo'])) fail('Valor inválido.');
                query('UPDATE usuario SET ativo=? WHERE id=?',[$data['ativo'],$id]);
                adminLog($uid,$data['ativo']?'reativou_conta':'desativou_conta',$quem);
            }
            db()->commit();
            reply(['ok'=>true]);
        case 'admin_user_password':
            $id=integer($data['id'] ?? null);
            if ($id===$uid) fail('Para trocar a sua senha, use o seu perfil.');
            $alvo=one('SELECT nome,email FROM usuario WHERE id=?',[$id]);
            if (!$alvo) fail('Usuário não encontrado.',404);
            // Senha temporária legível (sem 0/O, 1/l/I), mostrada uma única vez ao administrador.
            $chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $senha='';
            for ($i=0;$i<10;$i++) $senha.=$chars[random_int(0,strlen($chars)-1)];
            query('UPDATE usuario SET senha_hash=?,atualizado_em=now() WHERE id=?',[password_hash($senha,PASSWORD_DEFAULT),$id]);
            adminLog($uid,'redefiniu_senha',$alvo['nome'].' <'.$alvo['email'].'>');
            db()->commit();
            reply(['senha'=>$senha,'nome'=>$alvo['nome'],'email'=>$alvo['email']]);
        case 'admin_user_delete':
            $id=integer($data['id'] ?? null);
            if ($id===$uid) fail('Para excluir a sua conta, use o seu perfil.');
            $alvo=one('SELECT nome,email FROM usuario WHERE id=?',[$id]);
            if (!$alvo) fail('Usuário não encontrado.',404);
            if (strtolower(trim((string)($data['confirmacao'] ?? '')))!==strtolower($alvo['email'])) fail('Digite o e-mail do usuário para confirmar.');
            $n=one('SELECT count(*) AS n FROM arquivo WHERE usuario_id=?',[$id])['n'];
            adminLog($uid,'excluiu_conta',$alvo['nome'].' <'.$alvo['email'].'>',$n.' arquivo(s) removido(s)');
            query('DELETE FROM usuario WHERE id=?',[$id]);
            db()->commit();
            reply(['ok'=>true]);
        case 'admin_file_delete':
            $id=integer($data['id'] ?? null);
            $f=one('SELECT a.nome,u.nome AS dono,u.email FROM arquivo a JOIN usuario u ON u.id=a.usuario_id WHERE a.id=?',[$id]);
            if (!$f) fail('Arquivo não encontrado.',404);
            query('DELETE FROM arquivo WHERE id=?',[$id]);
            adminLog($uid,'excluiu_arquivo',$f['nome'],'Dono: '.$f['dono'].' <'.$f['email'].'>');
            db()->commit();
            reply(['ok'=>true]);
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
