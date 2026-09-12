# Biblioteca Virtual

CRUD de livros representado como uma **estante 3D**, desenvolvido com HTML, CSS e JavaScript puro, sem frameworks e sem back-end.

O projeto utiliza:

- **A-Frame 1.6.0** para a cena 3D/VR;
- **AR.js 3.4.8** para a versão em Realidade Aumentada;
- **localStorage** para persistência dos livros no navegador.

Cada livro possui:

```js
{
  id,
  titulo,
  autor,
  genero,
  ano,
  sinopse,
  cor,
  capa
}
```

## Funcionalidades

- Criar livros;
- Listar os livros na estante 3D;
- Selecionar um livro e visualizar seus detalhes;
- Editar um livro existente;
- Excluir um livro;
- Persistir os dados no `localStorage`;
- Organizar automaticamente os livros nas prateleiras;
- Exibir capa personalizada ou usar cor + título/autor como fallback;
- Visualizar a biblioteca em modo 3D/VR;
- Visualizar a biblioteca em AR usando o marcador Hiro;
- Selecionar um livro por **clique** (mouse/toque) ou por **gaze** (manter a mira sobre o livro por ~1,2s, sem clicar) — ver [Interação](#interação).

## Como executar

O projeto **deve ser servido por HTTP**. Evite abrir os arquivos diretamente com `file://`.

Isso é importante porque:

- texturas e capas podem se comportar de forma inconsistente em `file://`;
- o modo AR usa `getUserMedia()` para acessar a câmera, o que exige um **contexto seguro** (`HTTPS` ou `localhost`).

Na pasta do projeto, execute:

```bash
npm start
```

Isso sobe um servidor estático (`server.js`, sem dependências externas — só usa módulos nativos do Node) que já imprime os links certos no terminal, por exemplo:

```text
📚 Biblioteca Virtual — servidor rodando
   Pasta servida: /caminho/para/crud-virtual-ar-vr

   🧊 Modo 3D/VR:              http://localhost:8000/index.html
   🕶️  Modo AR (marcador Hiro): http://localhost:8000/ar.html
```

Copie um dos dois links no navegador. Diferente de servidores genéricos, este script sempre serve a pasta onde `server.js` está, então não tem erro de "rodei o comando na pasta errada e apareceu uma listagem de arquivos estranha".

> O `npm start` só usa o Node (que já vem instalado) para servir arquivos estáticos — a aplicação em si continua sendo puro HTML/CSS/JavaScript, sem nenhuma dependência de terceiros (não há `node_modules`).

**Alternativa sem Node**, caso prefira (ou não tenha Node instalado): na pasta do projeto,

```bash
python3 -m http.server 8000
```

e acesse manualmente `http://localhost:8000/index.html` (modo 3D/VR) ou `http://localhost:8000/ar.html` (modo AR) — mas repare que, com essa opção, o terminal **não** avisa qual link é qual: você precisa entrar em cada um para ver.

### Rodando no GitHub Codespaces

O projeto já vem com `.devcontainer/devcontainer.json`, então basta abrir o repositório em um Codespace (botão **Code → Codespaces → Create codespace**) — o `npm start` roda automaticamente ao iniciar o container, e a porta `8000` é encaminhada e aberta em uma pré-visualização.

Para acessar de fora do Codespace (por exemplo, do celular, para testar o modo AR):

1. Na aba **Ports** do Codespaces, confirme que a porta `8000` está com visibilidade **Public** (o `devcontainer.json` já pede isso, mas vale conferir — clique direito na porta → *Port Visibility* → *Public*).
2. Copie a URL gerada pelo Codespaces para a porta `8000` (algo como `https://SEU-CODESPACE-8000.app.github.dev`) — ela já é **HTTPS**, então funciona para a câmera do AR sem nenhum dos ajustes de `chrome://flags` necessários no acesso local.
3. Acesse `.../index.html` (modo 3D/VR) ou `.../ar.html` (modo AR) a partir dessa URL, em qualquer dispositivo.

## Estrutura do projeto

```text
biblioteca-virtual/
├── index.html          # cena 3D/VR + formulário CRUD + painel de detalhes
├── ar.html             # variante AR com marcador Hiro
├── style.css           # tema visual, formulário, painel e responsividade
├── app.js              # estado, CRUD, localStorage e renderização 3D
├── server.js           # servidor estático sem dependências (usado por "npm start")
├── package.json        # só declara o script "npm start"; zero dependências
├── .devcontainer/
│   └── devcontainer.json  # sobe "npm start" e expõe a porta 8000 no GitHub Codespaces
└── assets/
    └── capas/          # imagens de capa locais
```

## Arquitetura

A fonte da verdade da aplicação é o array `livros`, mantido em `app.js`.

A cena 3D não armazena dados próprios. Sempre que algum registro é criado, editado ou excluído, o fluxo é:

```text
dados mudam
   ↓
localStorage é atualizado
   ↓
renderizarBiblioteca()
   ↓
a cena 3D é reconstruída
```

As posições `x`, `y` e `z` **não são salvas** no objeto livro. Elas são calculadas a partir do índice do livro no array usando `calcularPosicaoLivro()`.

Isso garante que:

- um novo livro apareça automaticamente no final da fileira;
- ao excluir um livro do meio, os livros seguintes ocupem os espaços anteriores;
- não seja necessário reposicionar manualmente cada entidade 3D.

### Estrutura compartilhada entre VR e AR

`index.html` e `ar.html` compartilham o mesmo `app.js`, o mesmo `style.css` e a mesma estrutura interna:

```html
<a-entity id="biblioteca-root">
  <a-entity id="estrutura-estante"></a-entity>
  <a-entity id="livros-container"></a-entity>
</a-entity>
```

O `app.js` manipula apenas `#estrutura-estante` e `#livros-container`.

Cada página controla apenas como `#biblioteca-root` é exibido:

- em `index.html`, ele fica em uma cena 3D com câmera livre;
- em `ar.html`, ele fica dentro de um `<a-marker preset="hiro">` e recebe escala/posição adequadas ao marcador.

Dessa forma, a lógica do CRUD não precisa ser duplicada.

## Versões utilizadas

| Biblioteca | Versão | Origem |
|---|---:|---|
| A-Frame | `1.6.0` | CDN oficial: `https://aframe.io/releases/1.6.0/aframe.min.js` |
| AR.js | `3.4.8` | Build marker-based da tag `3.4.8` do repositório `AR-js-org/AR.js` |

As versões são fixadas propositalmente para evitar mudanças inesperadas de compatibilidade.

Não atualize o A-Frame ou o AR.js sem testar novamente os dois modos da aplicação.

## CRUD e verbos HTTP conceituais

Embora o projeto não possua back-end real, cada operação segue o significado dos verbos HTTP exigidos na atividade:

| Operação | Verbo conceitual | Função |
|---|---|---|
| Create | `POST /livros` | `adicionarLivro(dados)` |
| Read | `GET /livros` | `carregarLivros()` + `inicializarAplicacao()` |
| Update | `PUT/PATCH /livros/:id` | `atualizarLivro(id, dados)` |
| Delete | `DELETE /livros/:id` | `excluirLivro(id)` |

## localStorage e mocks

Os livros são armazenados na chave:

```text
bibliotecaVirtualLivros
```

`carregarLivros()` diferencia três situações:

1. **A chave não existe**: primeira execução; os mocks são criados e salvos.
2. **A chave existe, mas contém dados inválidos**: os mocks são recriados e o valor inválido é substituído.
3. **A chave contém um array válido, inclusive `[]`**: o conteúdo é respeitado exatamente como está.

O terceiro caso é importante. Se o usuário excluir todos os livros, a biblioteca deve continuar vazia após recarregar a página. Os mocks não devem reaparecer.

## Capas e CORS

O campo `capa` aceita uma URL ou caminho relativo.

Exemplo recomendado:

```text
assets/capas/duna.jpg
```

A função `criarLivro3D()` tenta carregar a imagem antes de aplicá-la como textura.

Se a capa estiver ausente, inválida ou não puder ser utilizada, o livro continua funcionando e usa como fallback:

- `livro.cor` como cor principal;
- título e autor em texto.

### URLs externas

Capas hospedadas em outros domínios podem sofrer restrições de **CORS**.

Mesmo que a imagem abra normalmente em uma aba do navegador, o servidor pode impedir seu uso como textura WebGL se não enviar os cabeçalhos adequados.

Por isso, para a apresentação, prefira imagens locais em:

```text
assets/capas/
```

## Modo AR — marcador Hiro

O arquivo `ar.html` utiliza AR.js com o marcador padrão **Hiro**:

```html
<a-marker preset="hiro">
```

A biblioteca 3D aparece quando a câmera reconhece esse marcador.

### Como obter o marcador

O marcador Hiro pode ser obtido no repositório do AR.js, em `data/images/hiro.png`.

Você pode:

- imprimir o marcador em papel;
- exibi-lo em outro monitor, tablet ou celular.

Mantenha a borda preta visível e não distorça as proporções da imagem.

### Teste no computador

Abra:

```text
http://localhost:8000/ar.html
```

Permita o acesso à câmera e aponte a webcam para o marcador Hiro.

A estante deve aparecer ancorada sobre o marcador. A seleção de um livro deve abrir o mesmo painel de detalhes usado no modo 3D.

### Teste no celular

Primeiro, um erro comum: se você digitar `http://localhost:8000/ar.html` no navegador do **celular**, vai dar "conexão recusada" — `localhost` no celular aponta para o próprio celular, não para o computador que está rodando o servidor. É preciso usar o endereço do computador na rede local.

O problema seguinte é que `getUserMedia()` (a câmera, usada pelo AR.js) só é liberada pelo navegador em **contexto seguro** (HTTPS, ou `localhost` — mas `localhost` só conta como seguro *na própria máquina* que roda o servidor, não a partir de outro aparelho). Um IP de rede local por HTTP puro normalmente não conta como seguro.

**Opção A — Chrome no Android, sem instalar nada extra (mais rápida para testar na mesma rede Wi-Fi):**

1. Celular e computador precisam estar na **mesma rede Wi-Fi**.
2. Descubra o IP do computador na rede local:
   ```bash
   hostname -I
   ```
   (o primeiro endereço da lista, algo como `192.168.1.3`)
3. No Chrome do celular, acesse `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
4. No campo de texto, cole o endereço do seu servidor, por exemplo `http://192.168.1.3:8000` (troque pelo IP que você descobriu no passo 2 — ele pode mudar se o computador reconectar à rede).
5. Mude o dropdown ao lado para **Enabled** e toque em **Relaunch** para o Chrome reiniciar.
6. Acesse `http://192.168.1.3:8000/ar.html` (mesmo IP/porta do passo 4) no Chrome do celular.
7. Autorize o acesso à câmera quando solicitado, aponte para o marcador Hiro e confirme que a estante aparece; toque em um livro para abrir o painel de detalhes.

Essa opção só funciona no **Chrome para Android** (o flag não existe no Safari/iPhone). Se o servidor não responder mesmo com o IP certo, verifique se o firewall do computador não está bloqueando a porta (`8000` por padrão) para conexões vindas da rede local.

**Opção B — URL HTTPS real (funciona em qualquer celular/navegador):**

- URL HTTPS da porta encaminhada pelo **GitHub Codespaces**;
- publicação do projeto no **GitHub Pages**;
- um túnel HTTPS (ex.: `ngrok`, `cloudflared`) apontando para o seu servidor local.

No celular, pela URL HTTPS:

1. abra `ar.html`;
2. autorize o acesso à câmera;
3. aponte para o marcador Hiro;
4. confirme que a estante aparece;
5. toque em um livro e verifique se o painel de detalhes é aberto.

## Interação

A atividade pede pelo menos uma forma de interação com os objetos virtuais. Este projeto cobre as três formas citadas:

| Forma de interação | Onde | Como funciona |
|---|---|---|
| **Clique** | `index.html` e `ar.html` | Clique do mouse (ou toque na tela, no celular) sobre um livro dispara `selecionarLivro()` imediatamente. Em `index.html` a mira acompanha o ponteiro (`cursor="rayOrigin: mouse"`). |
| **Gaze (olhar fixo)** | `ar.html` | O cursor (`<a-cursor fuse="true" fuse-timeout="1200">`) seleciona o livro se a mira do centro da tela ficar parada sobre ele por 1,2s, sem precisar tocar — o anel encolhe enquanto o tempo passa. Fica só no modo AR porque lá a mira é apontada com o aparelho e não existe ponteiro de mouse. Em `index.html` o gaze é desligado de propósito: com a mira fixa no centro da tela ele dispararia sozinho ao carregar a página, selecionando um livro qualquer sem o usuário ter feito nada. |
| **Botões/interface HTML** | Painel lateral (`aside.painel-crud`) | Formulário de criação/edição e os botões **Editar** / **Excluir** / **Fechar** no painel de detalhes. |

## Checklist da atividade

Mapeamento direto dos requisitos da atividade para onde cada um é atendido no projeto:

- [x] **CRUD integrado a RV ou RA** — os dois: `index.html` (RV/3D com A-Frame) e `ar.html` (RA com AR.js), compartilhando o mesmo `app.js`.
- [x] **Dados representados visualmente em cena 3D** — cada livro é uma entidade 3D na estante (`criarLivro3D()`).
- [x] **Cada ação do CRUD reflete no ambiente virtual** — `renderizarBiblioteca()` reconstrói a cena a cada create/update/delete.
- [x] **Interação por clique, gaze ou botões/HTML** — as três, ver seção [Interação](#interação) acima.
- [x] **LocalStorage para os dados** — chave `bibliotecaVirtualLivros`, ver [localStorage e mocks](#localstorage-e-mocks).
- [x] **Mocks de dados para representar os registros** — 5 livros de exemplo em `criarMocks()`.
- [x] **Create insere e exibe; Read lista tudo; Update atualiza; Delete remove da cena e do armazenamento** — `adicionarLivro`, `carregarLivros`/`inicializarAplicacao`, `atualizarLivro`, `excluirLivro`.
- [x] **Lista atualizada dinamicamente a cada ação** — nenhuma das funções acima retorna sem chamar `renderizarBiblioteca()`.
- [x] **Verbos HTTP aplicados conceitualmente (POST/GET/PUT-PATCH/DELETE)** — comentado em `app.js` e detalhado em [CRUD e verbos HTTP conceituais](#crud-e-verbos-http-conceituais).
- [x] **Bibliotecas obrigatórias A-Frame.js e AR.js** — as duas em uso, versões fixadas (ver [Versões utilizadas](#versões-utilizadas)).
- [ ] *(opcional, não implementado)* JSON Server como API simulada — o projeto usa só `localStorage`, dentro do que a atividade permite.
- [ ] **Link do repositório no GitHub** — publique o repositório e cole o link aqui antes da apresentação.
- [x] **Projeto rodando no GitHub Codespaces** — `.devcontainer/devcontainer.json` já configurado, ver [Rodando no GitHub Codespaces](#rodando-no-github-codespaces).
- [ ] **Demonstração do CRUD em RA ou RV** — use os testes manuais logo abaixo como roteiro da demonstração.

## Testes manuais recomendados

- [ ] Abrir `index.html` pela primeira vez e verificar os 5 livros de exemplo.
- [ ] Criar um livro e confirmar que ele aparece no final da fileira.
- [ ] Recarregar a página e confirmar que o novo livro continua salvo.
- [ ] Adicionar mais de 6 livros e verificar a quebra para a próxima prateleira.
- [ ] Selecionar um livro e visualizar título, autor, gênero, ano e sinopse.
- [ ] Editar um livro e verificar a atualização imediata na cena.
- [ ] Excluir um livro do meio e verificar a reorganização automática.
- [ ] Excluir o último livro sem gerar erro.
- [ ] Criar um livro sem capa e verificar o fallback com cor + texto.
- [ ] Excluir todos os livros, recarregar a página e confirmar que os mocks não reaparecem.
- [ ] Testar `ar.html` em um celular real por HTTPS.

## Resumo do fluxo

```text
Create  → adicionar ao array → salvar → renderizar
Read    → carregar localStorage → renderizar
Update  → alterar no array → salvar → renderizar
Delete  → remover do array → salvar → renderizar
```

O objetivo principal é manter uma única fonte de dados e fazer a cena 3D refletir esse estado automaticamente.
