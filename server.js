/**
 * Servidor HTTP estático mínimo, sem dependências externas — usado só para
 * servir os arquivos do projeto (a aplicação continua sendo puro
 * HTML/CSS/JS). Existe porque abrir os arquivos com file:// quebra o modo AR
 * (a câmera exige um contexto seguro: HTTPS ou localhost) e pode deixar o
 * carregamento de capas inconsistente.
 *
 * Diferente de "python3 -m http.server", este servidor sempre serve a pasta
 * onde este arquivo está (__dirname), não a pasta em que o comando foi
 * executado — evita o erro comum de rodar o servidor no diretório errado e
 * ver uma listagem de arquivos que não é a aplicação.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = Number(process.env.PORT) || 8000;
const RAIZ = __dirname;

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const servidor = http.createServer((requisicao, resposta) => {
  const urlSemQuery = decodeURIComponent(requisicao.url.split('?')[0]);
  const caminhoRelativo = urlSemQuery === '/' ? '/index.html' : urlSemQuery;

  // Impede sair da pasta do projeto com "../../etc/passwd" etc.
  const caminhoAbsoluto = path.normalize(path.join(RAIZ, caminhoRelativo));
  if (!caminhoAbsoluto.startsWith(RAIZ)) {
    resposta.writeHead(403);
    resposta.end('Acesso negado.');
    return;
  }

  fs.readFile(caminhoAbsoluto, (erro, conteudo) => {
    if (erro) {
      resposta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      resposta.end(`Arquivo não encontrado: ${caminhoRelativo}`);
      return;
    }
    const extensao = path.extname(caminhoAbsoluto).toLowerCase();
    resposta.writeHead(200, { 'Content-Type': TIPOS_MIME[extensao] || 'application/octet-stream' });
    resposta.end(conteudo);
  });
});

servidor.listen(PORTA, () => {
  const base = `http://localhost:${PORTA}`;
  console.log('');
  console.log('📚 Biblioteca Virtual — servidor rodando');
  console.log(`   Pasta servida: ${RAIZ}`);
  console.log('');
  console.log(`   🧊 Modo 3D/VR:              ${base}/index.html`);
  console.log(`   🕶️  Modo AR (marcador Hiro): ${base}/ar.html`);
  console.log('');
  console.log('   Pressione Ctrl+C para parar o servidor.');
  console.log('');
});
