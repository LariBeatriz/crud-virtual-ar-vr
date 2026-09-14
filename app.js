// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CHAVE_LIVROS = 'bibliotecaVirtualLivros';
const LIVROS_POR_PRATELEIRA = 6;
const LARGURA_LIVRO = 0.35;
const ALTURA_LIVRO = 0.8;
const PROFUNDIDADE_LIVRO = 0.12;
const ESPACAMENTO_X = 0.42;
const ESPACAMENTO_Y = 1.05;
const X_INICIAL = -((LIVROS_POR_PRATELEIRA - 1) * ESPACAMENTO_X) / 2;
const Y_TOPO = 1.55;
const Z_LIVROS = 0.15;
const ESPESSURA_PAINEL = 0.05;
const PROFUNDIDADE_ESTANTE = 0.45;
const MARGEM_LATERAL = 0.25;
const LARGURA_ESTANTE =
  (LIVROS_POR_PRATELEIRA - 1) * ESPACAMENTO_X + LARGURA_LIVRO + MARGEM_LATERAL * 2;
const GAP_TOPO = 0.15;

const COR_MADEIRA = '#6B4226';
const COR_MADEIRA_ESCURA = '#4A2E1A';
const COR_FUNDO_ESTANTE = '#6A472C';

// ---------------------------------------------------------------------------
// Estado da aplicação
// ---------------------------------------------------------------------------

let livros = [];
let livroSelecionadoId = null;
let livroEmEdicaoId = null;
let numeroDePrateleirasAtual = -1;

// ---------------------------------------------------------------------------
// LocalStorage
// ---------------------------------------------------------------------------

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

function salvarLivros() {
  localStorage.setItem(CHAVE_LIVROS, JSON.stringify(livros));
}

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

function adicionarLivro(dados) {
  const erros = validarFormulario(dados);
  if (erros.length > 0) {
    exibirErrosFormulario(erros);
    return;
  }

  const novoLivro = { id: Date.now(), ...normalizarDadosLivro(dados) };
  livros.push(novoLivro);

  salvarLivros();
  renderizarBiblioteca();
  entrarModoCriacao();
}

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

function excluirLivro(id) {
  const confirmou = window.confirm('Tem certeza que deseja excluir este livro?');
  if (!confirmou) return;

  livros = livros.filter((livro) => livro.id !== id);

  salvarLivros();
  limparSelecao();
  renderizarBiblioteca();
}

// ---------------------------------------------------------------------------
// Cálculo de posição (nunca persistido — sempre derivado do índice)
// ---------------------------------------------------------------------------

function calcularPosicaoLivro(indice, livro) {
  const numeroPrateleira = Math.floor(indice / LIVROS_POR_PRATELEIRA);
  const posicaoNaPrateleira = indice % LIVROS_POR_PRATELEIRA;

  const x = X_INICIAL + posicaoNaPrateleira * ESPACAMENTO_X;
  const ajusteDeAltura = livro ? (calcularAlturaLivro(livro) - ALTURA_LIVRO) / 2 : 0;
  const y = Y_TOPO - numeroPrateleira * ESPACAMENTO_Y + ajusteDeAltura;

  return { x, y, z: Z_LIVROS, numeroPrateleira };
}

function calcularAlturaLivro(livro) {
  const variacao = ((Number(livro.id) % 5) - 2) * 0.04;
  return ALTURA_LIVRO + variacao;
}

function calcularProfundidadeLivro(livro) {
  const variacao = ((Number(livro.id) % 3) - 1) * 0.02;
  return PROFUNDIDADE_LIVRO + variacao;
}

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
  caixa.setAttribute('material', `color: ${cor}; roughness: 0.92; metalness: 0`);
  caixa.setAttribute('position', `${x} ${y} ${z}`);
  return caixa;
}

function renderizarLivros() {
  const container = document.getElementById('livros-container');
  if (!container) return;

  container.innerHTML = '';
  livros.forEach((livro, indice) => {
    container.appendChild(criarLivro3D(livro, indice));
  });

  if (livroSelecionadoId !== null) {
    aplicarDestaque(livroSelecionadoId);
  }
}

function criarLivro3D(livro, indice) {
  const posicao = calcularPosicaoLivro(indice, livro);
  const altura = calcularAlturaLivro(livro);
  const profundidade = calcularProfundidadeLivro(livro);

  const entidade = document.createElement('a-entity');
  entidade.setAttribute('data-id', String(livro.id));
  entidade.classList.add('clickable', 'livro-3d');
  entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z}`);
  entidade.setAttribute('scale', '1 1 1');

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

function textoDaCapa(livro) {
  const LIMITE = 34;
  const encurtar = (valor) =>
    String(valor).length > LIMITE ? `${String(valor).slice(0, LIMITE - 1)}…` : String(valor);

  return `${encurtar(livro.titulo)}\n\n${encurtar(livro.autor)}`;
}

// ---------------------------------------------------------------------------
// Seleção e destaque visual
// ---------------------------------------------------------------------------

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

function aplicarDestaque(id) {
  const indice = livros.findIndex((l) => l.id === id);
  const entidade = document.querySelector(`#livros-container [data-id="${id}"]`);
  if (indice === -1 || !entidade) return;

  const posicao = calcularPosicaoLivro(indice, livros[indice]);
  entidade.setAttribute('position', `${posicao.x} ${posicao.y} ${posicao.z + 0.18}`);
  entidade.setAttribute('scale', '1.12 1.12 1.12');

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
    salvarLivros();
  }

  renderizarBiblioteca();
  configurarFormulario();
  configurarOverlayCapa();
}

document.addEventListener('DOMContentLoaded', inicializarAplicacao);
