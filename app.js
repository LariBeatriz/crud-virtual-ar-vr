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
  limparFormulario();
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
  limparSelecao();
  renderizarBiblioteca();
  cancelarEdicao();
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

function calcularPosicaoLivro(indice) {
  // Math.floor(indice / N) avança de prateleira a cada N livros completos.
  const numeroPrateleira = Math.floor(indice / LIVROS_POR_PRATELEIRA);
  // indice % N reinicia de 0 a cada nova prateleira: posição dentro da fileira.
  const posicaoNaPrateleira = indice % LIVROS_POR_PRATELEIRA;

  const x = X_INICIAL + posicaoNaPrateleira * ESPACAMENTO_X;
  const y = Y_TOPO - numeroPrateleira * ESPACAMENTO_Y;

  return { x, y, z: Z_LIVROS, numeroPrateleira };
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
      cor: COR_MADEIRA_ESCURA,
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
  caixa.setAttribute('color', cor);
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
  const posicao = calcularPosicaoLivro(indice);

  const entidade = document.createElement('a-entity');
  entidade.setAttribute('data-id', String(livro.id));
  entidade.classList.add('clickable', 'livro-3d');
  entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z}`);
  entidade.setAttribute('scale', '1 1 1');

  // Lombada: sempre visível, usa a cor cadastrada. É o que garante que o
  // livro nunca "quebra" visualmente, com ou sem capa.
  const lombada = document.createElement('a-box');
  lombada.setAttribute('width', LARGURA_LIVRO);
  lombada.setAttribute('height', ALTURA_LIVRO);
  lombada.setAttribute('depth', PROFUNDIDADE_LIVRO);
  lombada.setAttribute('color', livro.cor || '#8B4513');
  lombada.classList.add('clickable');
  entidade.appendChild(lombada);

  // Texto de apoio (título + autor), usado como identificação enquanto não
  // há uma capa carregada com sucesso.
  const texto = document.createElement('a-text');
  texto.setAttribute('value', `${livro.titulo}\n${livro.autor}`);
  texto.setAttribute('align', 'center');
  texto.setAttribute('width', 1.2);
  texto.setAttribute('color', '#FFFFFF');
  texto.setAttribute('position', `0 0 ${PROFUNDIDADE_LIVRO / 2 + 0.001}`);
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
      capaPlano.setAttribute('height', ALTURA_LIVRO * 0.95);
      capaPlano.setAttribute('src', livro.capa);
      capaPlano.setAttribute('position', `0 0 ${PROFUNDIDADE_LIVRO / 2 + 0.002}`);
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

// ---------------------------------------------------------------------------
// Seleção e destaque visual
// ---------------------------------------------------------------------------

// O clique numa entidade 3D só carrega o data-id; é esse id que liga o objeto
// 3D de volta ao registro correspondente no array `livros`.
function selecionarLivro(id) {
  if (livroSelecionadoId === id) return;

  removerDestaque(livroSelecionadoId);
  livroSelecionadoId = id;
  aplicarDestaque(id);

  const livro = livros.find((l) => l.id === id);
  if (livro) mostrarDetalhes(livro);
}

function limparSelecao() {
  removerDestaque(livroSelecionadoId);
  livroSelecionadoId = null;
  esconderDetalhes();
}

// Destaque simples: aproxima o livro da câmera e aumenta levemente sua
// escala, o suficiente para indicar qual está selecionado sem precisar de
// efeitos complexos.
function aplicarDestaque(id) {
  const indice = livros.findIndex((l) => l.id === id);
  const entidade = document.querySelector(`#livros-container [data-id="${id}"]`);
  if (indice === -1 || !entidade) return;

  const posicao = calcularPosicaoLivro(indice);
  entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z + 0.18}`);
  entidade.setAttribute('scale', '1.15 1.15 1.15');
}

function removerDestaque(id) {
  if (id === null || id === undefined) return;

  const indice = livros.findIndex((l) => l.id === id);
  const entidade = document.querySelector(`#livros-container [data-id="${id}"]`);
  if (!entidade) return;

  entidade.setAttribute('scale', '1 1 1');
  if (indice !== -1) {
    const posicao = calcularPosicaoLivro(indice);
    entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z}`);
  }
}

// ---------------------------------------------------------------------------
// Painel de detalhes (HTML)
// ---------------------------------------------------------------------------

function mostrarDetalhes(livro) {
  document.getElementById('detalhe-titulo').textContent = livro.titulo;
  document.getElementById('detalhe-autor').textContent = livro.autor;
  document.getElementById('detalhe-genero').textContent = livro.genero;
  document.getElementById('detalhe-ano').textContent = livro.ano;
  document.getElementById('detalhe-sinopse').textContent = livro.sinopse;
  document.getElementById('painel-detalhes').hidden = false;
}

function esconderDetalhes() {
  document.getElementById('painel-detalhes').hidden = true;
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

function entrarModoEdicao(id) {
  const livro = livros.find((l) => l.id === id);
  if (!livro) return;

  livroEmEdicaoId = id;
  preencherFormularioEdicao(livro);
  alternarBotoesParaEdicao(true);
}

function preencherFormularioEdicao(livro) {
  document.getElementById('campo-titulo').value = livro.titulo;
  document.getElementById('campo-autor').value = livro.autor;
  document.getElementById('campo-genero').value = livro.genero;
  document.getElementById('campo-ano').value = livro.ano;
  document.getElementById('campo-sinopse').value = livro.sinopse;
  document.getElementById('campo-cor').value = livro.cor || '#8B4513';
  document.getElementById('campo-capa').value = livro.capa || '';
}

function cancelarEdicao() {
  livroEmEdicaoId = null;
  limparFormulario();
  alternarBotoesParaEdicao(false);
}

function limparFormulario() {
  document.getElementById('formulario-livro').reset();
  document.getElementById('campo-cor').value = '#8B4513';
  esconderErrosFormulario();
}

function alternarBotoesParaEdicao(estaEditando) {
  document.getElementById('botao-adicionar').hidden = estaEditando;
  document.getElementById('botao-salvar').hidden = !estaEditando;
  document.getElementById('botao-cancelar').hidden = !estaEditando;
  document.getElementById('titulo-formulario').textContent = estaEditando
    ? 'Editar livro'
    : 'Adicionar livro';
}

function exibirErrosFormulario(erros) {
  const lista = document.getElementById('erros-formulario');
  lista.innerHTML = erros.map((erro) => `<li>${erro}</li>`).join('');
  lista.hidden = false;
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
}

document.addEventListener('DOMContentLoaded', inicializarAplicacao);
