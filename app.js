/**
 * Biblioteca Virtual — lógica do CRUD e da renderização 3D.
 *
 * Este arquivo é compartilhado por index.html (modo VR/3D livre) e ar.html
 * (modo AR com marcador Hiro). Os dois HTMLs expõem os mesmos elementos com
 * id="estrutura-estante" e id="livros-container" dentro de um id="biblioteca-root";
 * este script nunca decide onde a biblioteca aparece no espaço (isso é
 * responsabilidade de cada HTML), só o que existe dentro dela.
 *
 * Mapeamento conceitual do CRUD para verbos HTTP (mesmo sem back-end real):
 *   Create -> POST   /livros
 *   Read   -> GET    /livros
 *   Update -> PUT/PATCH /livros/:id
 *   Delete -> DELETE /livros/:id
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CHAVE_LIVROS = 'bibliotecaVirtualLivros';

// Quantos livros cabem em uma fileira antes de "quebrar" para a prateleira de baixo.
const LIVROS_POR_PRATELEIRA = 6;

// Dimensões físicas de um livro (todas as capas usam o mesmo tamanho).
const LARGURA_LIVRO = 0.35;
const ALTURA_LIVRO = 0.8;
const PROFUNDIDADE_LIVRO = 0.12;

// Espaço entre o centro de um livro e o centro do próximo, na horizontal e entre fileiras.
const ESPACAMENTO_X = 0.42;
const ESPACAMENTO_Y = 1.05;

// Posição do centro do primeiro livro da primeira fileira (índice 0).
const X_INICIAL = -((LIVROS_POR_PRATELEIRA - 1) * ESPACAMENTO_X) / 2;
const Y_TOPO = 1.55;
const Z_LIVROS = 0.15;

// Medidas da "mobília" da estante (laterais, tábuas, base e topo).
const ESPESSURA_PAINEL = 0.05;
const PROFUNDIDADE_ESTANTE = 0.45;
const MARGEM_LATERAL = 0.25;
const LARGURA_ESTANTE =
  (LIVROS_POR_PRATELEIRA - 1) * ESPACAMENTO_X + LARGURA_LIVRO + MARGEM_LATERAL * 2;
const GAP_TOPO = 0.15;

const COR_MADEIRA = '#6B4226';
const COR_MADEIRA_ESCURA = '#4A2E1A';
// O fundo da estante é mais claro que as laterais de propósito: com um tom
// escuro demais as prateleiras vazias viravam um "buraco preto" na cena.
const COR_FUNDO_ESTANTE = '#6A472C';

// ---------------------------------------------------------------------------
// Estado da aplicação
// ---------------------------------------------------------------------------

// livros é a ÚNICA fonte da verdade da aplicação. A cena 3D é sempre uma
// representação derivada deste array — nunca o contrário.
let livros = [];

// Livro atualmente clicado, cujo painel de detalhes está aberto. Controla
// apenas leitura/visualização e o destaque visual na cena.
let livroSelecionadoId = null;

// Diferente de livroSelecionadoId: só é != null quando o formulário está em
// modo "edição". Ele existe para o formulário saber se um "salvar" deve criar
// um livro novo (POST) ou atualizar um existente (PUT/PATCH). Um livro pode
// estar selecionado (painel aberto) sem estar em edição.
let livroEmEdicaoId = null;

// Guarda quantas prateleiras foram desenhadas da última vez, para só
// reconstruir a mobília da estante quando esse número realmente mudar.
let numeroDePrateleirasAtual = -1;

// ---------------------------------------------------------------------------
// LocalStorage (persistência) — GET / gravação bruta dos dados
// ---------------------------------------------------------------------------

/**
 * Lê os livros do localStorage. Distingue três situações porque isso importa
 * para decidir quando semear os mocks:
 *   - chave ausente (primeira visita)      -> existiaChave: false
 *   - JSON corrompido/não é array          -> existiaChave: false (mocks recriam e sobrescrevem)
 *   - array válido, mesmo vazio ([])       -> existiaChave: true (respeita o estado do usuário)
 * Sem essa distinção, excluir todos os livros faria os mocks reaparecerem no
 * próximo carregamento — o que não é o comportamento esperado de um CRUD real.
 */
function carregarLivros() {
  const bruto = localStorage.getItem(CHAVE_LIVROS);

  if (bruto === null) {
    return { existiaChave: false, livros: [] };
  }

  try {
    const dados = JSON.parse(bruto);
    if (!Array.isArray(dados)) {
      throw new Error('O conteúdo salvo não é uma lista de livros.');
    }
    return { existiaChave: true, livros: dados };
  } catch (erro) {
    console.warn('Dados de livros corrompidos no localStorage; recriando mocks.', erro);
    return { existiaChave: false, livros: [] };
  }
}

// Grava o array atual inteiro (JSON.stringify) — inclusive quando está vazio,
// para que a chave exista e o critério acima funcione corretamente.
function salvarLivros() {
  localStorage.setItem(CHAVE_LIVROS, JSON.stringify(livros));
}

// Alguns livros de exemplo usados apenas na primeira execução (ou após dados
// corrompidos). Duas capas ficam vazias de propósito e três apontam para
// arquivos que não existem em assets/capas/ — isso demonstra, já na carga
// inicial, que a ausência/falha de capa nunca quebra a aplicação (ver
// criarLivro3D): o livro aparece normalmente usando a cor cadastrada.
function criarMocks() {
  return [
    {
      id: 1,
      titulo: '1984',
      autor: 'George Orwell',
      genero: 'Distopia',
      ano: 1949,
      sinopse: 'Uma sociedade submetida à vigilância extrema, onde o Grande Irmão observa tudo.',
      cor: '#7A1F1F',
      capa: 'assets/capas/1984.jpg'
    },
    {
      id: 2,
      titulo: 'Duna',
      autor: 'Frank Herbert',
      genero: 'Ficção Científica',
      ano: 1965,
      sinopse: 'Intrigas políticas e religiosas disputam o controle do planeta desértico Arrakis.',
      cor: '#A5672A',
      capa: 'assets/capas/duna.jpg'
    },
    {
      id: 3,
      titulo: 'O Hobbit',
      autor: 'J. R. R. Tolkien',
      genero: 'Fantasia',
      ano: 1937,
      sinopse: 'Bilbo Bolseiro é convocado para uma inesperada aventura rumo à Montanha Solitária.',
      cor: '#315B37',
      capa: 'assets/capas/hobbit.jpg'
    },
    {
      id: 4,
      titulo: 'Fahrenheit 451',
      autor: 'Ray Bradbury',
      genero: 'Distopia',
      ano: 1953,
      sinopse: 'Em um futuro onde livros são proibidos, um bombeiro incendiário passa a questionar seu papel.',
      cor: '#B23A24',
      capa: ''
    },
    {
      id: 5,
      titulo: 'A Revolução dos Bichos',
      autor: 'George Orwell',
      genero: 'Sátira Política',
      ano: 1945,
      sinopse: 'Animais de uma fazenda se rebelam contra os humanos, mas o poder logo corrompe seus próprios líderes.',
      cor: '#4A4A2E',
      capa: ''
    }
  ];
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

// Validação usada tanto para criação quanto para edição.
function validarFormulario(dados) {
  const erros = [];

  if (!dados.titulo || !dados.titulo.trim()) {
    erros.push('O título é obrigatório.');
  }
  if (!dados.autor || !dados.autor.trim()) {
    erros.push('O autor é obrigatório.');
  }
  if (!dados.genero || !dados.genero.trim()) {
    erros.push('O gênero é obrigatório.');
  }

  const anoNumero = Number(dados.ano);
  const anoAtual = new Date().getFullYear();
  if (!dados.ano || Number.isNaN(anoNumero) || anoNumero <= 0 || anoNumero > anoAtual + 1) {
    erros.push('Informe um ano de publicação válido.');
  }

  if (!dados.sinopse || !dados.sinopse.trim()) {
    erros.push('A sinopse é obrigatória.');
  }
  if (!dados.cor) {
    erros.push('Escolha uma cor para o livro.');
  }

  return erros;
}

// Converte os dados brutos do formulário no formato final salvo no array.
function normalizarDadosLivro(dados) {
  return {
    titulo: dados.titulo.trim(),
    autor: dados.autor.trim(),
    genero: dados.genero.trim(),
    ano: Number(dados.ano),
    sinopse: dados.sinopse.trim(),
    cor: dados.cor,
    capa: dados.capa ? dados.capa.trim() : ''
  };
}

// CREATE — equivalente conceitualmente a POST /livros
function adicionarLivro(dados) {
  const erros = validarFormulario(dados);
  if (erros.length > 0) {
    exibirErrosFormulario(erros);
    return;
  }

  const novoLivro = { id: Date.now(), ...normalizarDadosLivro(dados) };

  // O novo livro só precisa ir para o final do array: como a posição de cada
  // livro é calculada a partir do seu índice (ver calcularPosicaoLivro), ele
  // aparece automaticamente no final da fileira atual, sem lógica especial.
  livros.push(novoLivro);

  salvarLivros();
  renderizarBiblioteca();
  entrarModoCriacao();
}

// UPDATE — equivalente conceitualmente a PUT/PATCH /livros/:id
function atualizarLivro(id, dados) {
  const erros = validarFormulario(dados);
  if (erros.length > 0) {
    exibirErrosFormulario(erros);
    return;
  }

  livros = livros.map((livro) =>
    livro.id === id ? { ...livro, ...normalizarDadosLivro(dados) } : livro
  );

  salvarLivros();
  renderizarBiblioteca();
  limparSelecao();
}

// DELETE — equivalente conceitualmente a DELETE /livros/:id
function excluirLivro(id) {
  const confirmou = window.confirm('Tem certeza que deseja excluir este livro?');
  if (!confirmou) return;

  // Basta remover do array com filter: como a cena inteira é reconstruída a
  // partir dos índices atuais, os livros seguintes "sobem" automaticamente
  // para preencher o espaço, sem precisar mover objetos 3D manualmente.
  livros = livros.filter((livro) => livro.id !== id);

  salvarLivros();
  limparSelecao();
  renderizarBiblioteca();
}

// ---------------------------------------------------------------------------
// Cálculo de posição (nunca persistido — sempre derivado do índice)
// ---------------------------------------------------------------------------

function calcularPosicaoLivro(indice, livro) {
  // Math.floor(indice / N) avança de prateleira a cada N livros completos.
  const numeroPrateleira = Math.floor(indice / LIVROS_POR_PRATELEIRA);
  // indice % N reinicia de 0 a cada nova prateleira: posição dentro da fileira.
  const posicaoNaPrateleira = indice % LIVROS_POR_PRATELEIRA;

  const x = X_INICIAL + posicaoNaPrateleira * ESPACAMENTO_X;

  // Livros têm alturas ligeiramente diferentes (ver calcularAlturaLivro), e a
  // posição do A-Frame é o CENTRO do objeto. Subimos metade da diferença para
  // que a base continue apoiada na tábua, em vez de ficar flutuando ou
  // afundando conforme a altura.
  const ajusteDeAltura = livro ? (calcularAlturaLivro(livro) - ALTURA_LIVRO) / 2 : 0;
  const y = Y_TOPO - numeroPrateleira * ESPACAMENTO_Y + ajusteDeAltura;

  return { x, y, z: Z_LIVROS, numeroPrateleira };
}

// Altura e profundidade variam um pouco de livro para livro, só para a
// estante não parecer um conjunto de caixas idênticas. A variação vem do id,
// então é determinística: o mesmo livro tem sempre as mesmas medidas, mesmo
// depois de recarregar a página ou reconstruir a cena.
function calcularAlturaLivro(livro) {
  const variacao = ((Number(livro.id) % 5) - 2) * 0.04;
  return ALTURA_LIVRO + variacao;
}

function calcularProfundidadeLivro(livro) {
  const variacao = ((Number(livro.id) % 3) - 1) * 0.02;
  return PROFUNDIDADE_LIVRO + variacao;
}

// Escolhe texto claro ou escuro conforme a luminância da cor do livro, para
// o título continuar legível tanto numa lombada vinho quanto numa bege.
function corDeContraste(corDoLivro) {
  const hex = String(corDoLivro || '').replace('#', '');
  const normalizado =
    hex.length === 3
      ? hex
          .split('')
          .map((caractere) => caractere + caractere)
          .join('')
      : hex;

  const r = parseInt(normalizado.slice(0, 2), 16);
  const g = parseInt(normalizado.slice(2, 4), 16);
  const b = parseInt(normalizado.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#FFF8EC';

  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? '#2C2117' : '#FFF8EC';
}

// ---------------------------------------------------------------------------
// Renderização 3D — a cena é sempre reconstruída a partir de `livros`
// ---------------------------------------------------------------------------

function renderizarBiblioteca() {
  renderizarEstruturaEstante();
  renderizarLivros();
}

// Desenha as tábuas/laterais da estante. Só recria o DOM quando o número de
// prateleiras necessárias muda, para não ficar destruindo/recriando a mobília
// toda vez que um único livro é criado/editado/excluído.
function renderizarEstruturaEstante() {
  const numeroDePrateleiras = Math.max(3, Math.ceil(livros.length / LIVROS_POR_PRATELEIRA));
  if (numeroDePrateleiras === numeroDePrateleirasAtual) return;
  numeroDePrateleirasAtual = numeroDePrateleiras;

  const container = document.getElementById('estrutura-estante');
  if (!container) return;
  container.innerHTML = '';

  const yTopoLid = Y_TOPO + ALTURA_LIVRO / 2 + GAP_TOPO + ESPESSURA_PAINEL / 2;
  const alturasDasTabuas = [yTopoLid];
  for (let i = 0; i < numeroDePrateleiras; i += 1) {
    const yTabua = Y_TOPO - i * ESPACAMENTO_Y - ALTURA_LIVRO / 2 - ESPESSURA_PAINEL / 2;
    alturasDasTabuas.push(yTabua);
  }

  alturasDasTabuas.forEach((y) => {
    container.appendChild(
      criarCaixa({
        largura: LARGURA_ESTANTE,
        altura: ESPESSURA_PAINEL,
        profundidade: PROFUNDIDADE_ESTANTE,
        cor: COR_MADEIRA,
        x: 0,
        y,
        z: 0
      })
    );
  });

  const yTopoPainelLateral = yTopoLid;
  const yBasePainelLateral = alturasDasTabuas[alturasDasTabuas.length - 1];
  const alturaLateral = yTopoPainelLateral - yBasePainelLateral + ESPESSURA_PAINEL;
  const yCentroLateral = (yTopoPainelLateral + yBasePainelLateral) / 2;

  [-1, 1].forEach((lado) => {
    container.appendChild(
      criarCaixa({
        largura: ESPESSURA_PAINEL,
        altura: alturaLateral,
        profundidade: PROFUNDIDADE_ESTANTE,
        cor: COR_MADEIRA_ESCURA,
        x: lado * (LARGURA_ESTANTE / 2),
        y: yCentroLateral,
        z: 0
      })
    );
  });

  // Fundo da estante, só para dar profundidade visual.
  container.appendChild(
    criarCaixa({
      largura: LARGURA_ESTANTE,
      altura: alturaLateral,
      profundidade: ESPESSURA_PAINEL,
      cor: COR_FUNDO_ESTANTE,
      x: 0,
      y: yCentroLateral,
      z: -PROFUNDIDADE_ESTANTE / 2
    })
  );
}

function criarCaixa({ largura, altura, profundidade, cor, x, y, z }) {
  const caixa = document.createElement('a-box');
  caixa.setAttribute('width', largura);
  caixa.setAttribute('height', altura);
  caixa.setAttribute('depth', profundidade);
  // roughness alto + metalness zero deixam a madeira fosca, em vez do
  // aspecto plástico e brilhante do material padrão.
  caixa.setAttribute('material', `color: ${cor}; roughness: 0.92; metalness: 0`);
  caixa.setAttribute('position', `${x} ${y} ${z}`);
  return caixa;
}

// Limpa e recria todas as entidades de livro a partir do array `livros`.
function renderizarLivros() {
  const container = document.getElementById('livros-container');
  if (!container) return;

  container.innerHTML = '';
  livros.forEach((livro, indice) => {
    container.appendChild(criarLivro3D(livro, indice));
  });

  // Se o livro selecionado ainda existir, reaplica o destaque na entidade
  // recém-criada (o destaque anterior foi perdido junto com o innerHTML = '').
  if (livroSelecionadoId !== null) {
    aplicarDestaque(livroSelecionadoId);
  }
}

// Cria a entidade 3D de um único livro, incluindo o carregamento best-effort
// da capa.
function criarLivro3D(livro, indice) {
  const posicao = calcularPosicaoLivro(indice, livro);
  const altura = calcularAlturaLivro(livro);
  const profundidade = calcularProfundidadeLivro(livro);

  const entidade = document.createElement('a-entity');
  entidade.setAttribute('data-id', String(livro.id));
  entidade.classList.add('clickable', 'livro-3d');
  entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z}`);
  entidade.setAttribute('scale', '1 1 1');

  // Lombada: sempre visível, usa a cor cadastrada. É o que garante que o
  // livro nunca "quebra" visualmente, com ou sem capa. O `emissive` já fica
  // declarado aqui com intensidade zero para que o destaque da seleção
  // precise mexer só na intensidade (ver aplicarDestaque).
  const lombada = document.createElement('a-box');
  lombada.setAttribute('width', LARGURA_LIVRO);
  lombada.setAttribute('height', altura);
  lombada.setAttribute('depth', profundidade);
  lombada.setAttribute(
    'material',
    `color: ${livro.cor || '#8B4513'}; roughness: 0.72; metalness: 0.04; emissive: #FFD9A0; emissiveIntensity: 0`
  );
  lombada.classList.add('clickable');
  entidade.appendChild(lombada);

  // Texto de apoio (título + autor), usado como identificação enquanto não
  // há uma capa carregada com sucesso. A largura precisa acompanhar a do
  // livro: com um valor maior que LARGURA_LIVRO o texto transborda por cima
  // dos livros vizinhos.
  const texto = document.createElement('a-text');
  texto.setAttribute('value', textoDaCapa(livro));
  texto.setAttribute('align', 'center');
  texto.setAttribute('baseline', 'center');
  texto.setAttribute('width', LARGURA_LIVRO * 0.94);
  texto.setAttribute('wrap-count', 14);
  texto.setAttribute('color', corDeContraste(livro.cor));
  texto.setAttribute('position', `0 0 ${profundidade / 2 + 0.001}`);
  entidade.appendChild(texto);

  entidade.addEventListener('click', () => selecionarLivro(livro.id));

  // Capa: tratada como "melhor esforço". URLs externas podem falhar por
  // problemas de rede ou de CORS (a imagem existe, mas o servidor de origem
  // não libera Access-Control-Allow-Origin, o que impede usá-la como
  // textura); por isso caminhos locais em assets/capas/ são a via
  // recomendada. Em qualquer falha, ou quando não há capa informada, a
  // lombada colorida + texto continuam sendo exibidos normalmente — nenhuma
  // falha de imagem interrompe a renderização dos demais livros.
  if (livro.capa) {
    const imagem = new Image();
    imagem.crossOrigin = 'anonymous';
    imagem.onload = () => {
      const capaPlano = document.createElement('a-plane');
      capaPlano.setAttribute('width', LARGURA_LIVRO * 0.95);
      capaPlano.setAttribute('height', altura * 0.95);
      capaPlano.setAttribute('src', livro.capa);
      capaPlano.setAttribute('position', `0 0 ${profundidade / 2 + 0.002}`);
      capaPlano.classList.add('clickable');
      capaPlano.addEventListener('click', () => selecionarLivro(livro.id));
      entidade.appendChild(capaPlano);
      texto.setAttribute('visible', 'false');
    };
    imagem.onerror = () => {
      console.warn(
        `Não foi possível carregar a capa de "${livro.titulo}" (${livro.capa}). Usando a cor cadastrada.`
      );
    };
    imagem.src = livro.capa;
  }

  return entidade;
}

// Títulos/autores muito longos viram um bloco de texto ilegível na capa 3D;
// aqui cortamos o excesso (o texto completo continua no painel lateral).
function textoDaCapa(livro) {
  const LIMITE = 34;
  const encurtar = (valor) =>
    String(valor).length > LIMITE ? `${String(valor).slice(0, LIMITE - 1)}…` : String(valor);

  return `${encurtar(livro.titulo)}\n\n${encurtar(livro.autor)}`;
}

// ---------------------------------------------------------------------------
// Seleção e destaque visual
// ---------------------------------------------------------------------------

// O clique numa entidade 3D só carrega o data-id; é esse id que liga o objeto
// 3D de volta ao registro correspondente no array `livros`. Clicar sempre
// reabre o preview da capa, mesmo se o livro já estava selecionado — só o
// destaque 3D (escala/avanço) é que não se reaplica à toa nesse caso.
function selecionarLivro(id) {
  const livro = livros.find((l) => l.id === id);
  if (!livro) return;

  if (livroSelecionadoId !== id) {
    removerDestaque(livroSelecionadoId);
    livroSelecionadoId = id;
    aplicarDestaque(id);
  }

  entrarModoVisualizacao(livro);
  mostrarCapaOverlay(livro);
}

function limparSelecao() {
  removerDestaque(livroSelecionadoId);
  esconderCapaOverlay();
  entrarModoCriacao();
}

// Destaque da seleção: o livro avança em direção à câmera, cresce um pouco e
// acende (emissive). Os três juntos deixam claro qual livro está selecionado
// mesmo quando a estante está cheia de cores parecidas.
function aplicarDestaque(id) {
  const indice = livros.findIndex((l) => l.id === id);
  const entidade = document.querySelector(`#livros-container [data-id="${id}"]`);
  if (indice === -1 || !entidade) return;

  const posicao = calcularPosicaoLivro(indice, livros[indice]);
  entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z + 0.18}`);
  entidade.setAttribute('scale', '1.12 1.12 1.12');

  // Brilho discreto: o suficiente para destacar sem lavar a cor cadastrada
  // do livro (com valores altos um verde escuro virava quase bege).
  const lombada = entidade.querySelector('a-box');
  if (lombada) lombada.setAttribute('material', 'emissiveIntensity', 0.18);
}

function removerDestaque(id) {
  if (id === null || id === undefined) return;

  const indice = livros.findIndex((l) => l.id === id);
  const entidade = document.querySelector(`#livros-container [data-id="${id}"]`);
  if (!entidade) return;

  entidade.setAttribute('scale', '1 1 1');
  if (indice !== -1) {
    const posicao = calcularPosicaoLivro(indice, livros[indice]);
    entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z}`);
  }

  const lombada = entidade.querySelector('a-box');
  if (lombada) lombada.setAttribute('material', 'emissiveIntensity', 0);
}

// ---------------------------------------------------------------------------
// Preview em tela cheia da capa (aberto ao clicar em qualquer livro)
// ---------------------------------------------------------------------------

// Mostra a capa do livro selecionado ocupando a tela toda. Se não houver
// capa, ou se ela falhar ao carregar, usa o mesmo fallback do livro 3D
// (cor cadastrada + título/autor) — nunca deixa o preview vazio.
function mostrarCapaOverlay(livro) {
  const overlay = document.getElementById('overlay-capa');
  const conteudo = document.getElementById('overlay-capa-conteudo');

  mostrarFallbackCapaOverlay(conteudo, livro);

  if (livro.capa) {
    const imagem = new Image();
    imagem.crossOrigin = 'anonymous';
    imagem.alt = `Capa de ${livro.titulo}`;
    imagem.onload = () => {
      conteudo.innerHTML = '';
      conteudo.appendChild(imagem);
    };
    imagem.onerror = () => {
      console.warn(`Não foi possível carregar a capa de "${livro.titulo}" no preview. Usando a cor cadastrada.`);
    };
    imagem.src = livro.capa;
  }

  overlay.hidden = false;
}

// Constrói o fallback via DOM (não innerHTML) porque título/autor vêm do
// formulário preenchido pelo usuário — inserir esse texto como HTML bruto
// abriria uma brecha de XSS armazenado.
function mostrarFallbackCapaOverlay(conteudo, livro) {
  conteudo.innerHTML = '';

  const fallback = document.createElement('div');
  fallback.className = 'overlay-capa-fallback';
  fallback.style.backgroundColor = livro.cor || '#8B4513';
  fallback.style.color = corDeContraste(livro.cor);

  const titulo = document.createElement('strong');
  titulo.textContent = livro.titulo;
  const autor = document.createElement('span');
  autor.textContent = livro.autor;

  fallback.appendChild(titulo);
  fallback.appendChild(autor);
  conteudo.appendChild(fallback);
}

function esconderCapaOverlay() {
  document.getElementById('overlay-capa').hidden = true;
}

// Clicar no fundo escurecido (fora da capa/fallback) fecha o preview e volta
// para a interface normal de interação com os livros.
function configurarOverlayCapa() {
  const overlay = document.getElementById('overlay-capa');
  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) {
      esconderCapaOverlay();
    }
  });
}

// ---------------------------------------------------------------------------
// Formulário: criação e edição
// ---------------------------------------------------------------------------

function obterDadosFormulario() {
  return {
    titulo: document.getElementById('campo-titulo').value,
    autor: document.getElementById('campo-autor').value,
    genero: document.getElementById('campo-genero').value,
    ano: document.getElementById('campo-ano').value,
    sinopse: document.getElementById('campo-sinopse').value,
    cor: document.getElementById('campo-cor').value,
    capa: document.getElementById('campo-capa').value
  };
}

// O formulário tem três modos, controlados por estas três funções — cada
// uma deixa o formulário/botões num estado completo e consistente, então
// trocar de modo nunca depende de "lembrar" de desfazer o estado anterior:
//
//   criação      -> campos vazios e editáveis, só o botão "Adicionar livro"
//   visualização -> campos preenchidos com o livro selecionado, mas
//                   desabilitados (não dá pra digitar); botões
//                   Editar/Excluir/Fechar
//   edição       -> campos preenchidos e editáveis; botões
//                   Salvar alterações/Cancelar

function entrarModoCriacao() {
  livroSelecionadoId = null;
  livroEmEdicaoId = null;

  limparFormulario();
  definirCamposEditaveis(true);
  document.getElementById('titulo-formulario').textContent = 'Adicionar livro';

  document.getElementById('botao-adicionar').hidden = false;
  document.getElementById('botao-salvar').hidden = true;
  document.getElementById('botao-cancelar').hidden = true;
  document.getElementById('botao-editar-detalhe').hidden = true;
  document.getElementById('botao-excluir-detalhe').hidden = true;
  document.getElementById('botao-fechar-detalhe').hidden = true;
}

function entrarModoVisualizacao(livro) {
  livroEmEdicaoId = null;

  preencherFormulario(livro);
  definirCamposEditaveis(false);
  esconderErrosFormulario();
  document.getElementById('titulo-formulario').textContent = 'Detalhes do livro';

  document.getElementById('botao-adicionar').hidden = true;
  document.getElementById('botao-salvar').hidden = true;
  document.getElementById('botao-cancelar').hidden = true;
  document.getElementById('botao-editar-detalhe').hidden = false;
  document.getElementById('botao-excluir-detalhe').hidden = false;
  document.getElementById('botao-fechar-detalhe').hidden = false;

  // O painel pode estar rolado (principalmente no celular, onde ele é uma
  // folha inferior curta); volta ao topo para os dados do livro recém
  // selecionado ficarem visíveis sem o usuário precisar rolar.
  const painel = document.querySelector('.painel-crud');
  if (painel) painel.scrollTop = 0;
}

function entrarModoEdicao(id) {
  const livro = livros.find((l) => l.id === id);
  if (!livro) return;

  livroEmEdicaoId = id;
  preencherFormulario(livro);
  definirCamposEditaveis(true);
  document.getElementById('titulo-formulario').textContent = 'Editar livro';

  document.getElementById('botao-adicionar').hidden = true;
  document.getElementById('botao-salvar').hidden = false;
  document.getElementById('botao-cancelar').hidden = false;
  document.getElementById('botao-editar-detalhe').hidden = true;
  document.getElementById('botao-excluir-detalhe').hidden = true;
  document.getElementById('botao-fechar-detalhe').hidden = true;
}

function preencherFormulario(livro) {
  document.getElementById('campo-titulo').value = livro.titulo;
  document.getElementById('campo-autor').value = livro.autor;
  document.getElementById('campo-genero').value = livro.genero;
  document.getElementById('campo-ano').value = livro.ano;
  document.getElementById('campo-sinopse').value = livro.sinopse;
  document.getElementById('campo-cor').value = livro.cor || '#8B4513';
  document.getElementById('campo-capa').value = livro.capa || '';
}

// Habilita/desabilita os campos do formulário. Usamos "disabled" (não
// "readonly") porque readonly não tem efeito em <input type="color">, e
// aqui os dois tipos de campo precisam ficar igualmente bloqueados no modo
// de visualização.
function definirCamposEditaveis(editavel) {
  const idsDosCampos = [
    'campo-titulo',
    'campo-autor',
    'campo-genero',
    'campo-ano',
    'campo-sinopse',
    'campo-cor',
    'campo-capa'
  ];
  idsDosCampos.forEach((id) => {
    document.getElementById(id).disabled = !editavel;
  });
}

// "Cancelar" durante uma edição não limpa a seleção: volta a mostrar os
// dados (não modificados) do livro que estava selecionado, como se a edição
// nunca tivesse começado.
function cancelarEdicao() {
  livroEmEdicaoId = null;
  const livroSelecionado = livros.find((l) => l.id === livroSelecionadoId);
  if (livroSelecionado) {
    entrarModoVisualizacao(livroSelecionado);
  } else {
    entrarModoCriacao();
  }
}

function limparFormulario() {
  document.getElementById('formulario-livro').reset();
  document.getElementById('campo-cor').value = '#8B4513';
  esconderErrosFormulario();
}

function exibirErrosFormulario(erros) {
  const lista = document.getElementById('erros-formulario');
  lista.innerHTML = '';

  erros.forEach((erro) => {
    const item = document.createElement('li');
    item.textContent = erro;
    lista.appendChild(item);
  });

  lista.hidden = false;
  lista.scrollIntoView({ block: 'nearest' });
}

function esconderErrosFormulario() {
  const lista = document.getElementById('erros-formulario');
  lista.hidden = true;
  lista.innerHTML = '';
}

function configurarFormulario() {
  const formulario = document.getElementById('formulario-livro');

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const dados = obterDadosFormulario();

    if (livroEmEdicaoId !== null) {
      atualizarLivro(livroEmEdicaoId, dados);
    } else {
      adicionarLivro(dados);
    }
  });

  document.getElementById('botao-cancelar').addEventListener('click', cancelarEdicao);

  document.getElementById('botao-editar-detalhe').addEventListener('click', () => {
    if (livroSelecionadoId !== null) entrarModoEdicao(livroSelecionadoId);
  });

  document.getElementById('botao-excluir-detalhe').addEventListener('click', () => {
    if (livroSelecionadoId !== null) excluirLivro(livroSelecionadoId);
  });

  document.getElementById('botao-fechar-detalhe').addEventListener('click', limparSelecao);
}

// ---------------------------------------------------------------------------
// Inicialização — READ, equivalente conceitualmente a GET /livros
// ---------------------------------------------------------------------------

function inicializarAplicacao() {
  const resultado = carregarLivros();

  if (resultado.existiaChave) {
    livros = resultado.livros;
  } else {
    livros = criarMocks();
    // Sobrescreve imediatamente: cobre tanto a primeira visita quanto o caso
    // de JSON corrompido, deixando o localStorage num estado válido sem
    // esperar pela próxima escrita do usuário.
    salvarLivros();
  }

  renderizarBiblioteca();
  configurarFormulario();
  configurarOverlayCapa();
}

document.addEventListener('DOMContentLoaded', inicializarAplicacao);
