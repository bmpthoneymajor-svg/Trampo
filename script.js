// ======================================================
// BT DESIGN - SCRIPT PRINCIPAL
// PAYPAL + ORÇAMENTO
// ======================================================

const API_URL = 'https://trampo.up.railway.app'.replace(/\/$/, '');


// ======================================================
// VARIÁVEIS GLOBAIS
// ======================================================

let paypalSdk = null;
let paypalSession = null;
let paypalButton = null;

let paypalInicializado = false;
let paypalInicializando = false;

let ultimoTotal = 0;


// ======================================================
// TABELA DE PREÇOS
// ======================================================

const precosServicos = {

    layout: {
        normal: 700,
        desconto: 600
    },

    animacao: {
        normal: 120,
        desconto: 100
    },

    video: {
        normal: 120,
        desconto: 100
    },

    restauracao: {
        normal: 80,
        desconto: 70
    },

    modelagem3d: {
        normal: 170,
        desconto: 145
    },

    reparo3d: {
        normal: 120,
        desconto: 90
    },

    render: {
        normal: 200,
        desconto: 150
    },

    imagem: {
        normal: 30,
        desconto: 30
    },

    cartao: {
        normal: 80,
        desconto: 80
    },

    panfleto: {
        normal: 50,
        desconto: 50
    },

    folder: {
        normal: 80,
        desconto: 80
    },

    banner: {
        normal: 100,
        desconto: 100
    },

    'Imagem Renderizada': {
        normal: 130,
        desconto: 130
    }
};


// ======================================================
// CALCULAR PREÇO DE UM SERVIÇO
// ======================================================

function calcularPrecoServico(key, quantidade) {

    quantidade = Number(quantidade) || 1;

    // --------------------------------------------------
    // DIAGRAMAÇÃO
    // --------------------------------------------------

    if (key === 'diagramacao') {

        if (quantidade >= 131) {
            return 2.30;
        }

        if (quantidade >= 81) {
            return 3.70;
        }

        if (quantidade >= 31) {
            return 4.70;
        }

        if (quantidade >= 21) {
            return 5.90;
        }

        if (quantidade >= 10) {
            return 6.80;
        }

        return 0;
    }


    // --------------------------------------------------
    // SERVIÇOS NORMAIS
    // --------------------------------------------------

    const servico = precosServicos[key];

    if (!servico) {
        return 0;
    }


    // Para serviços com desconto por quantidade
    if (quantidade > 1) {
        return servico.desconto;
    }

    return servico.normal;
}


// ======================================================
// CALCULAR TOTAL DO ORÇAMENTO
// ======================================================

function calcularTotal() {

    const linhas = document.querySelectorAll('.servico-row');

    let total = 0;


    linhas.forEach(linha => {

        const checkbox = linha.querySelector('.servico-checkbox');
        const quantidadeInput = linha.querySelector('.quantidade');
        const precoInput = linha.querySelector('.preco');

        if (!checkbox || !quantidadeInput || !precoInput) {
            return;
        }


        const quantidade =
            Math.max(1, Number(quantidadeInput.value) || 1);

        const key = checkbox.dataset.key;

        if (!checkbox.checked) {

            precoInput.value = '0.00';

            return;
        }


        const precoUnitario =
            calcularPrecoServico(key, quantidade);


        let subtotal = 0;


        // Diagramação usa preço por página
        if (key === 'diagramacao') {

            subtotal = precoUnitario * quantidade;

        } else {

            subtotal = precoUnitario * quantidade;

        }


        precoInput.value =
            precoUnitario.toFixed(2);


        total += subtotal;

    });


    ultimoTotal = Number(total.toFixed(2));


    // --------------------------------------------------
    // ATUALIZAR TOTAL NA TELA
    // --------------------------------------------------

    const totalElement =
        document.getElementById('total');

    if (totalElement) {

        totalElement.textContent =
            ultimoTotal.toFixed(2).replace('.', ',');

    }


    // --------------------------------------------------
    // ATUALIZAR TOTAL DO PAYPAL
    // --------------------------------------------------

    const paypalTotal =
        document.getElementById('paypal-total');

    if (paypalTotal) {

        paypalTotal.textContent =
            ultimoTotal.toFixed(2).replace('.', ',');

    }


    // --------------------------------------------------
    // ATUALIZAR CAMPOS ANTIGOS CASO EXISTAM
    // --------------------------------------------------

    const transactionAmount =
        document.getElementById('transactionAmount');

    if (transactionAmount) {
        transactionAmount.value =
            ultimoTotal.toFixed(2);
    }


    const transactionAmountPix =
        document.getElementById('transactionAmount-pix');

    if (transactionAmountPix) {
        transactionAmountPix.value =
            ultimoTotal.toFixed(2);
    }


    const transactionAmountBoleto =
        document.getElementById('transactionAmount-boleto');

    if (transactionAmountBoleto) {
        transactionAmountBoleto.value =
            ultimoTotal.toFixed(2);
    }


    return ultimoTotal;
}


// ======================================================
// MOSTRAR / ESCONDER MÉTODOS DE PAGAMENTO
// ======================================================

function mostrarPagamento() {

    const paymentMethods =
        document.getElementById('payment-methods');

    if (!paymentMethods) {
        console.error(
            'Elemento #payment-methods não encontrado.'
        );

        return;
    }

    paymentMethods.classList.remove('hidden');

    paymentMethods.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}


// ======================================================
// PAGAR AGORA
// ======================================================

async function pagarAgora() {

    try {

        const total = calcularTotal();


        if (!total || total <= 0) {

            alert(
                'Selecione pelo menos um serviço antes de continuar.'
            );

            return;
        }


        console.log(
            'Total do orçamento:',
            total
        );


        // Atualiza novamente o valor mostrado
        const paypalTotal =
            document.getElementById('paypal-total');

        if (paypalTotal) {

            paypalTotal.textContent =
                total.toFixed(2).replace('.', ',');
        }


        mostrarPagamento();


        // Inicializa o PayPal
        await inicializarPayPal();


    } catch (erro) {

        console.error(
            'Erro ao iniciar pagamento:',
            erro
        );

        mostrarErroPayPal(
            erro.message ||
            'Não foi possível iniciar o PayPal.'
        );

    }
}


// ======================================================
// OBTER CLIENT ID DO PAYPAL
// ======================================================

async function obterPayPalClientId() {

    const response =
        await fetch(
            `${API_URL}/api/paypal/client-id`
        );


    if (!response.ok) {

        throw new Error(
            'Não foi possível obter o Client ID do PayPal.'
        );
    }


    const data =
        await response.json();


    if (!data.clientId) {

        throw new Error(
            'Client ID do PayPal não foi retornado pelo servidor.'
        );
    }


    return data.clientId;
}


// ======================================================
// INICIALIZAR PAYPAL
// ======================================================

async function inicializarPayPal() {

    if (paypalInicializado) {

        console.log(
            'PayPal já foi inicializado.'
        );

        return;
    }


    if (paypalInicializando) {

        console.log(
            'PayPal já está sendo inicializado.'
        );

        return;
    }


    paypalInicializando = true;


    try {

        mostrarLoadingPayPal();


        // --------------------------------------------------
        // VERIFICAR SDK
        // --------------------------------------------------

        if (!window.paypal) {

            throw new Error(
                'SDK do PayPal ainda não foi carregado.'
            );
        }


        // --------------------------------------------------
        // CLIENT ID
        // --------------------------------------------------

        const clientId =
            await obterPayPalClientId();


        console.log(
            'Client ID PayPal obtido.'
        );


        // --------------------------------------------------
        // CRIAR INSTÂNCIA
        // --------------------------------------------------

        paypalSdk =
            await window.paypal.createInstance({

                clientId: clientId,

                components: [
                    'paypal-payments'
                ],

                pageType: 'checkout'

            });


        console.log(
            'Instância PayPal criada.'
        );


        // --------------------------------------------------
        // VERIFICAR ELEGIBILIDADE
        // --------------------------------------------------

        const eligibility =
            await paypalSdk.findEligibleMethods({

                currencyCode: 'BRL'

            });


        console.log(
            'Elegibilidade PayPal:',
            eligibility
        );


        if (
            !eligibility ||
            !eligibility.isEligible('paypal')
        ) {

            throw new Error(
                'O PayPal não está disponível para esta configuração.'
            );
        }


        // --------------------------------------------------
        // CRIAR BOTÃO
        // --------------------------------------------------

        const container =
            document.getElementById(
                'paypal-button-container'
            );


        if (!container) {

            throw new Error(
                'Container do botão PayPal não encontrado.'
            );
        }


        // Evitar criar dois botões
        container.innerHTML = '';


        paypalButton =
            document.createElement(
                'paypal-button'
            );


        paypalButton.id =
            'paypal-btn';


        paypalButton.type =
            'pay';


        container.appendChild(
            paypalButton
        );


        // --------------------------------------------------
        // CRIAR SESSÃO PAYPAL
        // --------------------------------------------------

        paypalSession =
            paypalSdk.createPayPalOneTimePaymentSession({

                onApprove:
                    async ({ orderId }) => {

                        return await capturarPedidoPayPal(
                            orderId
                        );

                    },


                onCancel:
                    (data) => {

                        console.log(
                            'Pagamento cancelado:',
                            data
                        );


                        esconderLoadingPayPal();


                        mostrarErroPayPal(
                            'O pagamento foi cancelado.'
                        );

                    },


                onError:
                    (erro) => {

                        console.error(
                            'Erro no checkout PayPal:',
                            erro
                        );


                        esconderLoadingPayPal();


                        mostrarErroPayPal(
                            'Ocorreu um erro durante o pagamento.'
                        );

                    }

            });


        // --------------------------------------------------
        // EVENTO DO BOTÃO
        // --------------------------------------------------

        paypalButton.addEventListener(
            'click',
            async () => {

                try {

                    esconderErroPayPal();


                    const totalAtual =
                        calcularTotal();


                    if (
                        !totalAtual ||
                        totalAtual <= 0
                    ) {

                        throw new Error(
                            'O valor do orçamento é inválido.'
                        );
                    }


                    mostrarLoadingPayPal();


                    console.log(
                        'Criando pedido de:',
                        totalAtual
                    );


                    /*
                     * IMPORTANTE:
                     *
                     * Não usar await aqui.
                     *
                     * O PayPal recomenda manter a Promise
                     * de criação do pedido para preservar
                     * a ativação do clique do usuário.
                     */

                    const createOrderPromise =
                        criarPedidoPayPal(
                            totalAtual
                        );


                    await paypalSession.start(
                        {
                            presentationMode: 'auto'
                        },
                        createOrderPromise
                    );

                } catch (erro) {

                    console.error(
                        'Erro ao abrir PayPal:',
                        erro
                    );


                    esconderLoadingPayPal();


                    mostrarErroPayPal(
                        erro.message ||
                        'Não foi possível abrir o PayPal.'
                    );

                }

            }
        );


        paypalInicializado = true;


        esconderLoadingPayPal();


        console.log(
            'PayPal inicializado com sucesso.'
        );


    } catch (erro) {

        console.error(
            'Erro na inicialização do PayPal:',
            erro
        );


        mostrarErroPayPal(
            erro.message ||
            'Erro ao inicializar o PayPal.'
        );


        throw erro;


    } finally {

        paypalInicializando = false;

    }
}


// ======================================================
// CRIAR PEDIDO NO SERVIDOR
// ======================================================

async function criarPedidoPayPal(valor) {

    console.log(
        'Enviando criação do pedido para o servidor:',
        valor
    );


    const response =
        await fetch(
            `${API_URL}/api/paypal/create-order`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({

                    valor: Number(
                        valor.toFixed(2)
                    )

                })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        console.error(
            'Erro retornado pelo servidor:',
            data
        );


        throw new Error(
            data.erro ||
            'Erro ao criar pedido PayPal.'
        );
    }


    if (!data.id) {

        throw new Error(
            'O PayPal não retornou o ID do pedido.'
        );
    }


    console.log(
        'Pedido PayPal criado:',
        data.id
    );


    /*
     * IMPORTANTE NO SDK V6:
     *
     * createOrder precisa retornar
     * { orderId: "..." }
     */

    return {
        orderId: data.id
    };
}


// ======================================================
// CAPTURAR PEDIDO
// ======================================================

async function capturarPedidoPayPal(orderId) {

    console.log(
        'Capturando pedido:',
        orderId
    );


    try {

        const response =
            await fetch(
                `${API_URL}/api/paypal/capture-order`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({

                        orderID: orderId

                    })

                }
            );


        const data =
            await response.json();


        console.log(
            'Resposta da captura:',
            data
        );


        if (!response.ok) {

            throw new Error(
                data.erro ||
                'Erro ao capturar pagamento.'
            );
        }


        esconderLoadingPayPal();


        // --------------------------------------------------
        // PAGAMENTO CONCLUÍDO
        // --------------------------------------------------

        if (
            data.status ===
            'COMPLETED'
        ) {

            mostrarSucessoPayPal(
                data.orderID ||
                orderId
            );

            return data;
        }


        // --------------------------------------------------
        // OUTRO STATUS
        // --------------------------------------------------

        mostrarErroPayPal(
            `O pagamento foi processado com status: ${data.status}`
        );


        return data;


    } catch (erro) {

        console.error(
            'Erro na captura PayPal:',
            erro
        );


        esconderLoadingPayPal();


        mostrarErroPayPal(
            erro.message ||
            'Não foi possível confirmar o pagamento.'
        );


        throw erro;
    }
}


// ======================================================
// MOSTRAR LOADING
// ======================================================

function mostrarLoadingPayPal() {

    const loading =
        document.getElementById(
            'paypal-loading'
        );


    if (loading) {

        loading.style.display =
            'block';

        loading.textContent =
            'Processando pagamento pelo PayPal...';
    }
}


// ======================================================
// ESCONDER LOADING
// ======================================================

function esconderLoadingPayPal() {

    const loading =
        document.getElementById(
            'paypal-loading'
        );


    if (loading) {

        loading.style.display =
            'none';
    }
}


// ======================================================
// MOSTRAR SUCESSO
// ======================================================

function mostrarSucessoPayPal(orderId) {

    const result =
        document.getElementById(
            'paypal-result'
        );


    const orderElement =
        document.getElementById(
            'paypal-order-id'
        );


    const error =
        document.getElementById(
            'paypal-error'
        );


    if (error) {

        error.style.display =
            'none';
    }


    if (result) {

        result.style.display =
            'block';
    }


    if (orderElement) {

        orderElement.textContent =
            orderId || '';
    }


    console.log(
        'PAGAMENTO PAYPAL APROVADO:',
        orderId
    );
}


// ======================================================
// MOSTRAR ERRO
// ======================================================

function mostrarErroPayPal(mensagem) {

    const error =
        document.getElementById(
            'paypal-error'
        );


    const errorMessage =
        document.getElementById(
            'paypal-error-message'
        );


    if (error) {

        error.style.display =
            'block';
    }


    if (errorMessage) {

        errorMessage.textContent =
            mensagem;
    }
}


// ======================================================
// ESCONDER ERRO
// ======================================================

function esconderErroPayPal() {

    const error =
        document.getElementById(
            'paypal-error'
        );


    if (error) {

        error.style.display =
            'none';
    }
}


// ======================================================
// NAVEGAÇÃO SPA
// ======================================================

function mostrarPagina(id) {

    const paginas =
        document.querySelectorAll(
            '.page'
        );


    paginas.forEach(
        pagina => {

            pagina.classList.remove(
                'active'
            );

        }
    );


    const pagina =
        document.getElementById(id);


    if (pagina) {

        pagina.classList.add(
            'active'
        );
    }


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


// ======================================================
// INICIALIZAÇÃO
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        console.log(
            'BT Design carregado.'
        );


        // --------------------------------------------------
        // CHECKBOXES E QUANTIDADES
        // --------------------------------------------------

        const linhas =
            document.querySelectorAll(
                '.servico-row'
            );


        linhas.forEach(
            linha => {

                const checkbox =
                    linha.querySelector(
                        '.servico-checkbox'
                    );


                const quantidade =
                    linha.querySelector(
                        '.quantidade'
                    );


                if (checkbox) {

                    checkbox.addEventListener(
                        'change',
                        () => {

                            calcularTotal();

                        }
                    );

                }


                if (quantidade) {

                    quantidade.addEventListener(
                        'input',
                        () => {

                            calcularTotal();

                        }
                    );

                }

            }
        );


        // --------------------------------------------------
        // LINKS DE NAVEGAÇÃO
        // --------------------------------------------------

        const links =
            document.querySelectorAll(
                'a[href^="#"]'
            );


        links.forEach(
            link => {

                link.addEventListener(
                    'click',
                    event => {

                        const href =
                            link.getAttribute(
                                'href'
                            );


                        if (
                            !href ||
                            href === '#'
                        ) {

                            return;
                        }


                        const id =
                            href.substring(1);


                        const pagina =
                            document.getElementById(
                                id
                            );


                        if (!pagina) {

                            return;
                        }


                        event.preventDefault();


                        mostrarPagina(
                            id
                        );


                        history.pushState(
                            null,
                            '',
                            href
                        );

                    }
                );

            }
        );


        // --------------------------------------------------
        // PÁGINA INICIAL
        // --------------------------------------------------

        const hash =
            window.location.hash;


        if (
            hash &&
            document.getElementById(
                hash.substring(1)
            )
        ) {

            mostrarPagina(
                hash.substring(1)
            );

        } else {

            mostrarPagina(
                'inicio'
            );

        }


        // --------------------------------------------------
        // CALCULAR TOTAL INICIAL
        // --------------------------------------------------

        calcularTotal();


        // --------------------------------------------------
        // LOADER
        // --------------------------------------------------

        const pageLoader =
            document.getElementById(
                'page-loader'
            );


        if (pageLoader) {

            setTimeout(
                () => {

                    pageLoader.classList.add(
                        'hidden'
                    );

                },
                500
            );

        }

    }
);


// ======================================================
// ATUALIZAR PÁGINA QUANDO VOLTAR
// ======================================================

window.addEventListener(
    'popstate',
    () => {

        const hash =
            window.location.hash;


        if (
            hash &&
            document.getElementById(
                hash.substring(1)
            )
        ) {

            mostrarPagina(
                hash.substring(1)
            );

        } else {

            mostrarPagina(
                'inicio'
            );

        }

    }
);