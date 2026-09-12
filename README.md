# Biblioteca Virtual

CRUD de livros representado como uma estante 3D, feito com HTML, CSS e
JavaScript puro (sem frameworks, sem back-end), usando **A-Frame** para a
cena 3D/VR e **AR.js** para uma variante em Realidade Aumentada. Os dados são
persistidos no `localStorage` do navegador.

## Como executar

Este projeto **precisa ser servido por HTTP** — nunca aberto diretamente como
arquivo (`file:///...`). Isso vale para os dois arquivos (`index.html` e
`ar.html`), pelos seguintes motivos:

- o carregamento de capas de livro por `Image()`/textura do three.js pode se
  comportar de forma inconsistente em `file://`;
- o modo AR (`ar.html`) usa `getUserMedia()` para acessar a câmera, e
  navegadores só liberam isso em um **contexto seguro** (HTTPS ou
  `localhost`) — nunca em `file://`.

Para rodar localmente, na pasta do projeto:

```bash
python3 -m http.server 8000
```

E acesse, no navegador:

- `http://localhost:8000/index.html` — modo 3D/VR (câmera livre, sem AR).
- `http://localhost:8000/ar.html` — modo AR com marcador (ver seção abaixo).

## Arquitetura

```
biblioteca-virtual/
├── index.html      # cena 3D/VR + formulário CRUD + painel de detalhes
├── ar.html          # variante em AR (marcador Hiro), reaproveita app.js/style.css
├── style.css        # tema visual (madeira/bege), formulário, painel, responsivo
├── app.js           # todo o estado, CRUD, localStorage e renderização 3D
└── assets/capas/     # onde ficam as imagens de capa locais (recomendado)
```

A ideia central do projeto é que **o array `livros`, dentro de `app.js`, é a
única fonte da verdade**. A cena 3D nunca guarda estado próprio: toda vez que
os dados mudam (criar, editar, excluir), o fluxo é sempre:

```
dados mudam → localStorage é atualizado → renderizarBiblioteca() → cena reflete os novos dados
```

Por isso a posição de cada livro (`x`, `y`, `z`) **não é salva** junto com o
livro — ela é sempre recalculada a partir do índice do livro dentro do array,
usando `calcularPosicaoLivro()`. Isso é o que garante que:

- um livro novo apareça automaticamente no final da fileira (ele só precisa
  ser adicionado ao final do array, com `push`);
- excluir um livro do meio reorganize os seguintes sozinho (basta remover do
  array com `filter` e renderizar tudo de novo — os índices dos livros
  restantes mudam automaticamente).

### `index.html` vs `ar.html`

A-Frame "puro" usa uma câmera livre controlada pelo usuário
(`look-controls`/`wasd-controls`). O AR.js baseado em marcador troca isso por
rastreamento da câmera real do dispositivo + um `<a-marker>` que serve de
âncora para o conteúdo 3D. Misturar os dois modos numa única cena, alternando
em tempo real, é frágil (troca de componentes de câmera, de raycaster e do
vídeo de fundo). Por isso o projeto usa **duas páginas**, que compartilham o
mesmo `app.js`/`style.css` e o mesmo "contrato" de elementos:

```html
<a-entity id="biblioteca-root">      <!-- cada HTML posiciona/escala este nó do seu jeito -->
  <a-entity id="estrutura-estante">  <!-- laterais, base, topo e tábuas da estante -->
  <a-entity id="livros-container">   <!-- um <a-entity> por livro -->
</a-entity>
```

`app.js` só manipula `#estrutura-estante` e `#livros-container` — ele nunca
sabe (nem precisa saber) se está rodando dentro da cena livre de
`index.html` ou dentro do marcador de `ar.html`. Isso cumpre o princípio de
que o AR.js deve **apenas mudar a forma como a cena é exibida**, sem duplicar
a lógica de dados/CRUD.

### Versões fixadas de A-Frame e AR.js

| Biblioteca | Versão | Origem |
|---|---|---|
| A-Frame | `1.6.0` | CDN oficial (`https://aframe.io/releases/1.6.0/aframe.min.js`) |
| AR.js (build de marcador) | `3.4.8` | RawGitHack, apontando para a **tag** `3.4.8` do repositório `AR-js-org/AR.js` (não para `master`) |

Essas versões são fixadas de propósito (URLs sem `latest`/`master`) para que
o projeto continue funcionando do mesmo jeito no futuro. **Não atualize a
versão do A-Frame** (por exemplo para `1.8.0`) sem antes testar manualmente
se o build do AR.js `3.4.8` continua funcionando junto — versões mais novas
do A-Frame podem alterar APIs internas das quais o AR.js depende.

## CRUD e verbos HTTP conceituais

Mesmo sem um back-end real, o código deixa explícita a relação entre cada
operação do CRUD e o verbo HTTP que ela representaria numa API real (ver
comentários em `app.js`):

| Operação | Verbo conceitual | Função em `app.js` |
|---|---|---|
| Create | `POST /livros` | `adicionarLivro(dados)` |
| Read | `GET /livros` | `carregarLivros()` + `inicializarAplicacao()` |
| Update | `PUT`/`PATCH /livros/:id` | `atualizarLivro(id, dados)` |
| Delete | `DELETE /livros/:id` | `excluirLivro(id)` |

### Sobre o `localStorage` e os livros de exemplo (mocks)

`carregarLivros()` distingue três situações, e isso é importante:

- a chave `bibliotecaVirtualLivros` **não existe** → primeira visita, os
  mocks são criados e já salvos de imediato;
- a chave existe mas o conteúdo está corrompido (JSON inválido, ou não é uma
  lista) → tratado como se não existisse: os mocks são recriados e **o
  `localStorage` é sobrescrito na hora** com esse conteúdo válido;
- a chave existe e é uma lista válida, **mesmo vazia (`[]`)** → é respeitada
  como está, sem cair para os mocks.

Essa última distinção evita um bug comum: se o critério fosse simplesmente
"lista vazia → usar mocks", excluir todos os livros faria os mocks
reaparecerem sozinhos no próximo carregamento da página, o que não é o
comportamento esperado de um CRUD de verdade.

## Capas de livro e CORS

O campo "Capa" aceita uma URL ou um caminho de arquivo. Internamente,
`criarLivro3D()` tenta carregar essa imagem com `new Image()` antes de
aplicá-la como textura, e trata qualquer falha (rede, URL inválida, ausência
de capa) caindo no visual padrão: a cor cadastrada do livro (`livro.cor`) +
o título/autor em texto. Nenhuma falha de capa interrompe a renderização dos
demais livros.

Um ponto importante: URLs de capas **externas** (de outro domínio) estão
sujeitas a CORS. Se o servidor de origem da imagem não enviar o cabeçalho
`Access-Control-Allow-Origin`, o navegador impede que essa imagem seja usada
como textura (o canvas fica "tainted"), mesmo que a imagem em si carregue
normalmente numa aba comum. Por isso a recomendação é **priorizar capas
locais**, salvas em `assets/capas/` e referenciadas por caminho relativo
(ex.: `assets/capas/duna.jpg`) — mesma origem, sem esse problema. URLs
externas continuam funcionando quando o servidor permite, mas são tratadas
como "melhor esforço".

## Modo AR — marcador Hiro

O modo AR (`ar.html`) usa reconhecimento de **marcador**: a cena só aparece
quando a câmera do dispositivo enxerga um marcador impresso específico. Este
projeto usa o marcador padrão `hiro` (o mesmo usado em praticamente todos os
exemplos oficiais do AR.js), reconhecido automaticamente com
`<a-marker preset="hiro">`, sem precisar treinar um marcador customizado.

**Onde conseguir o marcador**: ele é a imagem de referência oficial do
AR.js/ARToolKit, um quadrado preto com bordas grossas e o desenho
estilizado da palavra "HIRO" no centro. Está disponível no próprio
repositório do AR.js (pasta `data/images/hiro.png` do projeto
`AR-js-org/AR.js` no GitHub). Basta abrir essa imagem e:

- imprimi-la em papel (mantendo a borda preta grossa visível e sem
  distorcer as proporções), ou
- exibi-la em outra tela (um segundo monitor, tablet ou celular) para
  apontar a câmera do dispositivo de teste na direção dela.

**Como testar no computador**: acesse `http://localhost:8000/ar.html`,
permita o acesso à câmera quando solicitado, e aponte a webcam para o
marcador — a estante com os livros deve aparecer ancorada sobre ele. Clicar
num livro (usando o cursor no centro da tela, que segue o mouse) abre o
painel de detalhes, igual ao modo VR de `index.html`.

**Como testar em um celular real (obrigatório)**: `http://IP-da-rede-local:porta`
**não é confiável** para esse teste. `getUserMedia()` (usado pelo AR.js para
acessar a câmera) exige um **contexto seguro**, e a maioria dos navegadores
móveis não trata um IP de rede local sobre HTTP puro como seguro — a
permissão de câmera pode simplesmente não ser oferecida, mesmo com o resto
da aplicação correto. Em vez disso, acesse `ar.html` por uma **URL HTTPS
real**, por exemplo:

- a porta encaminhada automaticamente pelo GitHub Codespaces durante o
  desenvolvimento (já expõe HTTPS por padrão), ou
- os arquivos publicados no GitHub Pages, para um link HTTPS estável.

A partir dessa URL, no celular: aponte a câmera para o marcador Hiro
impresso ou exibido em outra tela e confirme que **tocar** num livro (não só
clicar com mouse) seleciona o livro e abre o painel de detalhes
corretamente — isso valida que o `cursor`/`raycaster` configurado em
`ar.html` responde também a eventos de toque, que é o uso real esperado em
AR num celular.

## Testes manuais recomendados

1. Abrir `index.html` pela primeira vez → a estante e os 5 livros de exemplo
   aparecem.
2. Criar um livro → ele aparece no final da fileira atual.
3. Recarregar a página → o livro criado continua lá.
4. Adicionar livros suficientes para encher uma fileira (mais de 6) → o
   próximo livro aparece na prateleira de baixo.
5. Selecionar um livro → o painel mostra título, autor, gênero, ano e
   sinopse.
6. Editar título, autor ou capa → a mudança aparece imediatamente na cena.
7. Excluir um livro do meio → ele desaparece e os livros seguintes ocupam os
   espaços anteriores, sem buracos.
8. Excluir o último livro → nenhum erro ocorre.
9. Adicionar um livro sem capa → ele aparece normalmente, usando a cor
   cadastrada.
10. Excluir todos os livros, recarregar a página → a estante fica vazia (os
    mocks **não** reaparecem); fechar e abrir o navegador de novo confirma
    que o estado persiste.
11. (Modo AR) Testar a seleção por toque em um celular real, acessando
    `ar.html` por HTTPS, conforme descrito acima.
