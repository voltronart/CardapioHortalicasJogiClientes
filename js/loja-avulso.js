// ==========================================
// loja-avulso.js - Cardápio público para clientes avulsos
// ==========================================
// Diferenças em relação ao loja.js (restaurantes):
// - Não usa slug/?cliente=... na URL, não busca em "clientes"
// - Busca produtos na tabela "produtos_avulso"
// - Nome e telefone só são pedidos na hora de finalizar o pedido
// - Insere via RPC "criar_pedido_avulso" (total calculado no servidor)

const CONFIG = {
  whatsappNumero: "5561996433209",
};

let produtosDisponiveis = [];
let carrinho = {}; // { produtoId: { produto, quantidade } }

const CHAVE_CARRINHO_STORAGE = "carrinho_avulso";

// ==========================================
// 1. Carregar e renderizar produtos
// ==========================================
async function carregarProdutos() {
  const { data, error } = await supabaseClient
    .from("produtos_avulso")
    .select("*")
    .eq("disponivel", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar produtos avulsos:", error);
    mostrarTelaVazia();
    return;
  }

  produtosDisponiveis = data || [];

  if (produtosDisponiveis.length === 0) {
    mostrarTelaVazia();
    return;
  }

  renderizarProdutos(produtosDisponiveis);
  document.getElementById("tela-carregando").classList.add("escondido");
  document.getElementById("tela-loja").classList.remove("escondido");
}

function mostrarTelaVazia() {
  document.getElementById("tela-carregando").classList.add("escondido");
  document.getElementById("tela-loja").classList.add("escondido");
  document.getElementById("tela-vazia").classList.remove("escondido");
}

function renderizarProdutos(produtos) {
  const grid = document.getElementById("grid-produtos");
  grid.innerHTML = "";

  produtos.forEach((produto) => {
    const card = document.createElement("div");
    card.className = "card-produto";
    card.innerHTML = `
      <img src="${produto.imagem_url || ""}" alt="${produto.nome}" class="card-produto-imagem">
      <h3 class="card-produto-nome">${produto.nome}</h3>
      <p class="card-produto-descricao">${produto.descricao || ""}</p>
      <p class="card-produto-preco">${formatarPreco(produto.preco)} / ${produto.unidade}</p>
      <div class="card-produto-acoes">
        <input type="number" id="qtd-${produto.id}" min="1" value="1" class="input-quantidade">
        <button class="botao-primario btn-adicionar-carrinho" data-produto-id="${produto.id}">
          Adicionar
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll(".btn-adicionar-carrinho").forEach((btn) => {
    btn.addEventListener("click", () => {
      const produtoId = btn.dataset.produtoId;
      const quantidadeInput = document.getElementById(`qtd-${produtoId}`);
      const quantidade = parseInt(quantidadeInput.value) || 1;
      adicionarAoCarrinho(produtoId, quantidade);
      mostrarToast(`${nomeProdutoPorId(produtoId)} adicionado ao carrinho`);
    });
  });
}

function nomeProdutoPorId(produtoId) {
  const produto = produtosDisponiveis.find((p) => String(p.id) === String(produtoId));
  return produto ? produto.nome : "Item";
}

// ==========================================
// 2. Carrinho (persistido em localStorage)
// ==========================================
function salvarCarrinhoStorage() {
  localStorage.setItem(CHAVE_CARRINHO_STORAGE, JSON.stringify(carrinho));
}

function carregarCarrinhoStorage() {
  const salvo = localStorage.getItem(CHAVE_CARRINHO_STORAGE);
  carrinho = salvo ? JSON.parse(salvo) : {};
}

function adicionarAoCarrinho(produtoId, quantidade) {
  const produto = produtosDisponiveis.find((p) => String(p.id) === String(produtoId));
  if (!produto) return;

  if (carrinho[produtoId]) {
    carrinho[produtoId].quantidade += quantidade;
  } else {
    carrinho[produtoId] = { produto, quantidade };
  }

  salvarCarrinhoStorage();
  renderizarCarrinho();
}

function removerDoCarrinho(produtoId) {
  delete carrinho[produtoId];
  salvarCarrinhoStorage();
  renderizarCarrinho();
}

function atualizarQuantidadeCarrinho(produtoId, novaQuantidade) {
  if (!carrinho[produtoId]) return;

  if (novaQuantidade <= 0) {
    removerDoCarrinho(produtoId);
    return;
  }

  carrinho[produtoId].quantidade = novaQuantidade;
  salvarCarrinhoStorage();
  renderizarCarrinho();
}

function calcularTotalCarrinho() {
  return Object.values(carrinho).reduce((soma, item) => {
    return soma + item.produto.preco * item.quantidade;
  }, 0);
}

function calcularQuantidadeTotalCarrinho() {
  return Object.values(carrinho).reduce((soma, item) => soma + item.quantidade, 0);
}

function renderizarCarrinho() {
  const lista = document.getElementById("carrinho-lista");
  const totalEl = document.getElementById("carrinho-total");
  const contadorEl = document.getElementById("cartCount");

  const itens = Object.entries(carrinho);

  lista.innerHTML = "";

  if (itens.length === 0) {
    lista.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
  }

  itens.forEach(([produtoId, item]) => {
    const subtotal = item.produto.preco * item.quantidade;

    const linha = document.createElement("div");
    linha.className = "carrinho-item";
    linha.innerHTML = `
      <span class="carrinho-item-nome">${item.produto.nome}</span>
      <input type="number" min="1" value="${item.quantidade}" class="input-quantidade carrinho-item-qtd" data-produto-id="${produtoId}">
      <span class="carrinho-item-subtotal">${formatarPreco(subtotal)}</span>
      <button class="botao-icone btn-remover-item" data-produto-id="${produtoId}">Remover</button>
    `;
    lista.appendChild(linha);
  });

  document.querySelectorAll(".carrinho-item-qtd").forEach((input) => {
    input.addEventListener("change", (e) => {
      const produtoId = e.target.dataset.produtoId;
      const novaQuantidade = parseInt(e.target.value) || 0;
      atualizarQuantidadeCarrinho(produtoId, novaQuantidade);
    });
  });

  document.querySelectorAll(".btn-remover-item").forEach((btn) => {
    btn.addEventListener("click", () => removerDoCarrinho(btn.dataset.produtoId));
  });

  totalEl.textContent = formatarPreco(calcularTotalCarrinho());

  if (contadorEl) {
    contadorEl.textContent = calcularQuantidadeTotalCarrinho();
  }
}

// ==========================================
// 3. Abrir/fechar carrinho
// ==========================================
function abrirCarrinho() {
  document.getElementById("cartDrawer").classList.remove("escondido");
}

function fecharCarrinho() {
  document.getElementById("cartDrawer").classList.add("escondido");
}

// ==========================================
// 4. Toast
// ==========================================
let toastTimeout = null;

function mostrarToast(mensagem) {
  const toast = document.getElementById("cartToast");
  if (!toast) return;

  toast.textContent = mensagem;
  toast.classList.add("visivel");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("visivel");
  }, 2200);
}

// ==========================================
// 5. Modal de dados do cliente (nome + telefone)
// ==========================================
function abrirModalDados() {
  const itensCarrinho = Object.values(carrinho);

  if (itensCarrinho.length === 0) {
    alert("Seu carrinho está vazio.");
    return;
  }

  document.getElementById("modalDadosCliente").classList.remove("escondido");
}

function fecharModalDados() {
  document.getElementById("modalDadosCliente").classList.add("escondido");
}

// ==========================================
// 6. Finalizar pedido (chamado ao confirmar o modal de dados)
// ==========================================
async function finalizarPedido(event) {
  event.preventDefault();

  const nome = document.getElementById("cliente-nome").value.trim();
  const telefone = document.getElementById("cliente-telefone").value.trim();
  const endereco = document.getElementById("cliente-endereco").value.trim();

  if (!nome || !telefone || !endereco) {
    alert("Preencha nome, WhatsApp e endereço para continuar.");
    return;
  }

  const itensCarrinho = Object.values(carrinho);

  if (itensCarrinho.length === 0) {
    alert("Seu carrinho está vazio.");
    return;
  }

  const btnEnviar = document.querySelector("#form-dados-cliente button[type='submit']");
  btnEnviar.disabled = true;
  btnEnviar.textContent = "Enviando pedido...";

  try {
    const itensParaSalvar = itensCarrinho.map((item) => ({
      produto: item.produto.nome,
      quantidade: item.quantidade,
      preco: item.produto.preco,
    }));

    // O total NÃO é enviado - a function "criar_pedido_avulso" recalcula
    // no servidor usando o preco de cada produto, por segurança.
    const { data: pedidoId, error } = await supabaseClient.rpc("criar_pedido_avulso", {
      p_nome: nome,
      p_telefone: telefone,
      p_endereco: endereco,
      p_itens: itensParaSalvar,
    });

    if (error) {
      console.error("Erro ao criar pedido avulso:", error);
      alert("Erro ao enviar pedido: " + error.message);
      return;
    }

    const total = calcularTotalCarrinho();

    abrirWhatsApp(itensParaSalvar, total, pedidoId, nome, endereco);

    carrinho = {};
    salvarCarrinhoStorage();
    renderizarCarrinho();
    fecharCarrinho();
    fecharModalDados();
    document.getElementById("form-dados-cliente").reset();

    mostrarToast("Pedido enviado com sucesso!");

  } catch (erro) {
    console.error("Erro ao finalizar pedido:", erro);
    alert("Erro ao finalizar pedido: " + erro.message);
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = "Enviar pedido";
  }
}

// ==========================================
// 7. Mensagem do WhatsApp
// ==========================================
function abrirWhatsApp(itens, total, pedidoId, nomeCliente, endereco) {
  const numeroPedido = String(pedidoId).padStart(3, "0");

  let mensagem = `📋 *NOVO PEDIDO AVULSO #${numeroPedido}*\n`;
  mensagem += `👤 ${nomeCliente}\n`;
  mensagem += `📍 ${endereco}\n\n`;

  mensagem += `🛒 *Itens:*\n`;
  itens.forEach((item) => {
    const subtotal = item.quantidade * item.preco;
    mensagem += `• ${item.quantidade}x ${item.produto} — ${formatarPreco(subtotal)}\n`;
  });

  mensagem += `\n💰 *Total: ${formatarPreco(total)}*`;

  const mensagemCodificada = encodeURIComponent(mensagem);
  const url = `https://wa.me/${CONFIG.whatsappNumero}?text=${mensagemCodificada}`;

  window.open(url, "_blank");
}

// ==========================================
// Utilitário de formatação de preço
// ==========================================
function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ==========================================
// Inicialização
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  carregarCarrinhoStorage();
  await carregarProdutos();
  renderizarCarrinho();

  document.getElementById("cartBtn").addEventListener("click", abrirCarrinho);
  document.getElementById("btn-fechar-carrinho").addEventListener("click", fecharCarrinho);

  // Abre o modal pedindo nome/telefone só quando clica em finalizar
  document.getElementById("btn-finalizar-pedido").addEventListener("click", abrirModalDados);
  document.getElementById("btn-cancelar-dados").addEventListener("click", fecharModalDados);
  document.getElementById("form-dados-cliente").addEventListener("submit", finalizarPedido);
});
