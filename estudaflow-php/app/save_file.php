<?php
// Executado pela API dentro de uma transação; $uid e $data vêm de api.php.
$type=one('SELECT id,codigo,extensao FROM tipo_arquivo WHERE codigo=?',[textField($data,'tipo',20)]);
if (!$type) fail('Tipo de arquivo inválido.');
$title=textField($data,'titulo',180);
$content=$data['content'] ?? null;
if (!is_array($content)) fail('Conteúdo inválido.');
$name=$title.$type['extensao'];
$size=strlen(json_encode($content,JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
$id=empty($data['id']) ? null : integer($data['id']);
if ($id) {
    $file=one('SELECT tipo_arquivo_id FROM arquivo WHERE id=? AND usuario_id=? FOR UPDATE',[$id,$uid]);
    if (!$file || (int)$file['tipo_arquivo_id']!==(int)$type['id']) fail('Arquivo não encontrado ou tipo incompatível.',404);
    query('UPDATE arquivo SET nome=?,tamanho_bytes=? WHERE id=? AND usuario_id=?',[$name,$size,$id,$uid]);
} else {
    $folders=['mapa'=>'Mapas Mentais','documento'=>'Documentos','planilha'=>'Planilhas','apresentacao'=>'Apresentações'];
    $folder=one('SELECT id FROM pasta WHERE usuario_id=? AND nome=? AND pasta_pai_id IS NULL',[$uid,$folders[$type['codigo']]]);
    $id=(int)one('INSERT INTO arquivo (usuario_id,pasta_id,tipo_arquivo_id,nome,tamanho_bytes) VALUES (?,?,?,?,?) RETURNING id',[$uid,$folder ? (int)$folder['id'] : null,(int)$type['id'],$name,$size])['id'];
    $tables=['mapa'=>'mapa_mental','documento'=>'documento','planilha'=>'planilha','apresentacao'=>'apresentacao'];
    // Nome da tabela vem exclusivamente desta lista fixa.
    query('INSERT INTO '.$tables[$type['codigo']].' (arquivo_id) VALUES (?)',[$id]);
}
switch ($type['codigo']) {
    case 'documento':
        $body=$content['conteudo'] ?? '';
        if (!is_string($body) || strlen($body)>1800000) fail('Documento inválido ou muito grande.');
        query('UPDATE documento SET conteudo=? WHERE arquivo_id=?',[$body,$id]); break;
    case 'planilha':
        $r=integer($content['rows'] ?? null,1,500); $c=integer($content['cols'] ?? null,1,8);
        $cells=$content['cells'] ?? [];
        if (!is_array($cells) || count($cells)>4000) fail('Células inválidas.');
        query('UPDATE planilha SET qtd_linhas=?,qtd_colunas=? WHERE arquivo_id=?',[$r,$c,$id]);
        query('DELETE FROM planilha_celula WHERE planilha_id=?',[$id]);
        foreach ($cells as $cell) {
            if (!is_array($cell)) fail('Célula inválida.');
            $value=$cell['valor'] ?? '';
            if (!is_string($value) || strlen($value)>10000) fail('Valor de célula muito grande.');
            if ($value!=='') query('INSERT INTO planilha_celula (planilha_id,linha,coluna,valor) VALUES (?,?,?,?)',[$id,integer($cell['linha'] ?? null,1,$r),integer($cell['coluna'] ?? null,1,$c),$value]);
        } break;
    case 'apresentacao':
        $items=$content['slides'] ?? [];
        if (!is_array($items) || count($items)>200) fail('Use no máximo 200 slides.');
        query('DELETE FROM slide WHERE apresentacao_id=?',[$id]);
        foreach (array_values($items) as $i=>$s) {
            if (!is_array($s)) fail('Slide inválido.');
            query('INSERT INTO slide (apresentacao_id,ordem,titulo,corpo) VALUES (?,?,?,?)',[$id,$i+1,textField($s,'titulo',200,false),textField($s,'corpo',20000,false)]);
        } break;
    case 'mapa':
        $nodes=$content['nodes'] ?? [];
        if (!is_array($nodes) || count($nodes)>500) fail('Use no máximo 500 nós.');
        $pending=[];
        foreach ($nodes as $node) {
            if (!is_array($node)) fail('Nó inválido.');
            $key=(string)($node['id'] ?? '');
            if (!preg_match('/^[0-9]{1,16}$/',$key) || isset($pending[$key])) fail('Identificador de nó inválido ou duplicado.');
            $node['label']=textField($node,'label',100);
            if (!is_numeric($node['x'] ?? null) || !is_numeric($node['y'] ?? null) || !is_finite((float)$node['x']) || !is_finite((float)$node['y']) || abs((float)$node['x'])>100000 || abs((float)$node['y'])>100000) fail('Posição inválida.');
            if (!is_string($node['color'] ?? null) || !preg_match('/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/',$node['color'])) fail('Cor inválida.');
            $pending[$key]=$node;
        }
        query('DELETE FROM mapa_no WHERE mapa_id=?',[$id]);
        $map=[];
        while ($pending) {
            $progress=false;
            foreach ($pending as $key=>$node) {
                $parent=$node['parent'] ?? null;
                if ($parent !== null && !isset($map[(string)$parent])) continue;
                $map[$key]=(int)one('INSERT INTO mapa_no (mapa_id,no_pai_id,rotulo,pos_x,pos_y,cor) VALUES (?,?,?,?,?,?) RETURNING id',[$id,$parent===null ? null : $map[(string)$parent],$node['label'],(string)$node['x'],(string)$node['y'],$node['color']])['id'];
                unset($pending[$key]); $progress=true;
            }
            if (!$progress) fail('Mapa com conexão circular ou pai inexistente.');
        } break;
}
activity($uid,4,'Salvou arquivo: '.$name);
