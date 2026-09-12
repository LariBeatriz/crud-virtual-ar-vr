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
- Visualizar a biblioteca em AR usando o marcador Hiro.

## Como executar

O projeto **deve ser servido por HTTP**. Evite abrir os arquivos diretamente com `file://`.

Isso é importante porque:

- texturas e capas podem se comportar de forma inconsistente em `file://`;
- o modo AR usa `getUserMedia()` para acessar a câmera, o que exige um **contexto seguro** (`HTTPS` ou `localhost`).

Na pasta do projeto, execute:

```bash
python3 -m http.server 8000
```

Depois acesse:

- `http://localhost:8000/index.html` — modo 3D/VR;
- `http://localhost:8000/ar.html` — modo AR com marcador Hiro.

> O Python é usado apenas para subir um servidor HTTP local simples. A aplicação continua sendo feita somente com HTML, CSS e JavaScript.

## Estrutura do projeto

```text
biblioteca-virtual/
├── index.html          # cena 3D/VR + formulário CRUD + painel de detalhes
├── ar.html             # variante AR com marcador Hiro
├── style.css           # tema visual, formulário, painel e responsividade
├── app.js              # estado, CRUD, localStorage e renderização 3D
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

Para usar a câmera em um celular, prefira uma **URL HTTPS real**.

Não dependa de:

```text
http://IP-da-rede-local:porta
```

porque navegadores móveis podem não considerar esse endereço um contexto seguro para `getUserMedia()`.

As opções recomendadas são:

- URL HTTPS da porta encaminhada pelo **GitHub Codespaces**;
- publicação do projeto no **GitHub Pages**.

No celular:

1. abra `ar.html` pela URL HTTPS;
2. autorize o acesso à câmera;
3. aponte para o marcador Hiro;
4. confirme que a estante aparece;
5. toque em um livro e verifique se o painel de detalhes é aberto.

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
