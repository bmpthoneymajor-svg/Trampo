// ======================================================
// BT DESIGN - SCRIPT PRINCIPAL
// PAYPAL V6
// ======================================================

const API_URL = 'https://trampo.up.railway.app';

// ======================================================
// VARIÁVEIS
// ======================================================

let paypalSdk = null;
let paypalSession = null;
let paypalButton = null;

let paypalInicializado = false;
let paypalInicializando = false;

let ultimoTotal = 0;


// ======================================================
// SERVIÇOS SELECIONADOS
// ======================================================

function converterNumero(valor) {
    if (valor === null || valor === undefined) {
        return 0;
    }

    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : 0;
    }

    let texto = String(valor).trim();

    if (!texto) {
        return 0;
    }

    // Remove moeda, espaços e caracteres que não fazem parte do número.
    texto = texto
        .replace(/R\$/gi, '')
        .replace(/\s/g, '');

    // Suporta:
    // 150
    // 150.50
    // 150,50
    // 1.500,50
    // 1,500.50
    if (texto.includes(',') && texto.includes('.')) {
        if (texto.lastIndexOf(',') > texto.lastIndexOf('.')) {
            texto = texto.replace(/\./g, '').replace(',', '.');
        } else {
            texto = texto.replace(/,/g, '');
        }
    } else if (texto.includes(',')) {
        texto = texto.replace(',', '.');
    }

    texto = texto.replace(/[^\d.-]/g, '');

    const numero = Number(texto);

    return Number.isFinite(numero) ? numero : 0;
}


function obterValorCampo(elemento, padrao = 0) {
    if (!elemento) {
        return padrao;
    }

    // Primeiro tenta value, usado normalmente em input.
    if (
        typeof elemento.value !== 'undefined' &&
        elemento.value !== ''
    ) {
        const numero = converterNumero(elemento.value);

        if (numero !== 0 || String(elemento.value).trim() === '0') {
            return numero;
        }
    }

    // Depois tenta data-preco/data-value.
    const dataPreco = elemento.dataset?.preco;

    if (dataPreco !== undefined) {
        return converterNumero(dataPreco);
    }

    const dataValue = elemento.dataset?.value;

    if (dataValue !== undefined) {
        return converterNumero(dataValue);
    }

    // Por último, usa o texto visível.
    const texto = elemento.textContent?.trim();

    if (texto) {
        return converterNumero(texto);
    }

    return padrao;
}


function obterServicosSelecionados() {
    const servicos = [];

    document.querySelectorAll('.servico-row').forEach(row => {

        const checkbox =
            row.querySelector('.servico-checkbox');

        if (!checkbox || !checkbox.checked) {
            return;
        }

        const nome =
            row.querySelector('label')?.innerText.trim() ||
            row.querySelector('.servico-nome')?.innerText.trim() ||
            'Serviço';

        const quantidadeInput =
            row.querySelector('.quantidade');

        const precoInput =
            row.querySelector('.preco');

        const observacaoInput =
            row.querySelector('.observacao');

        const quantidade =
            Math.max(
                1,
                obterValorCampo(quantidadeInput, 1)
            );

        const preco =
            obterValorCampo(precoInput, 0);

        const observacao =
            observacaoInput?.value?.trim() || '';

        servicos.push({
            key: checkbox.dataset.key || '',
            nome,
            quantidade,
            preco,
            observacao,
            subtotal: Number(
                (quantidade * preco).toFixed(2)
            )
        });
    });

    return servicos;
}


// ======================================================
// CALCULAR TOTAL
// ======================================================

function calcularTotal() {

    let total = 0;

    document.querySelectorAll('.servico-row').forEach(row => {

        const checkbox =
            row.querySelector('.servico-checkbox');

        if (!checkbox || !checkbox.checked) {
            return;
        }

        const quantidadeInput =
            row.querySelector('.quantidade');

        const precoInput =
            row.querySelector('.preco');

        let quantidade =
            obterValorCampo(quantidadeInput, 1);

        const preco =
            obterValorCampo(precoInput, 0);

        if (
            !Number.isFinite(quantidade) ||
            quantidade <= 0
        ) {
            quantidade = 1;
        }

        if (
            Number.isFinite(preco) &&
            preco >= 0
        ) {
            total += quantidade * preco;
        }
    });

    total = Number(total.toFixed(2));

    ultimoTotal = total;

    const totalElement =
        document.getElementById('total');

    if (totalElement) {
        totalElement.textContent =
            total.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
    }

    // Atualiza também elementos que eventualmente mostrem
    // o total do orçamento.
    document
        .querySelectorAll(
            '[data-total-orcamento], .total-orcamento'
        )
        .forEach(elemento => {
            elemento.textContent =
                `R$ ${total.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`;
        });

    return total;
}


// ======================================================
// ATUALIZAÇÃO AUTOMÁTICA DO TOTAL
// ======================================================

document.addEventListener('input', function (event) {

    if (
        event.target.classList.contains('quantidade') ||
        event.target.classList.contains('preco')
    ) {
        calcularTotal();
    }

});


document.addEventListener('change', function (event) {

    if (
        event.target.classList.contains('servico-checkbox') ||
        event.target.classList.contains('quantidade') ||
        event.target.classList.contains('preco')
    ) {
        calcularTotal();
    }

});


// ======================================================
// INICIALIZAR CÁLCULO QUANDO A PÁGINA CARREGAR
// ======================================================

document.addEventListener('DOMContentLoaded', function () {
    calcularTotal();
});

// ======================================================
// LOADING PAYPAL
// ======================================================

function mostrarLoadingPayPal() {

    const loading =
        document.getElementById('paypal-loading');

    if (loading) {
        loading.style.display = 'block';
    }
}


function esconderLoadingPayPal() {

    const loading =
        document.getElementById('paypal-loading');

    if (loading) {
        loading.style.display = 'none';
    }
}


// ======================================================
// ERROS PAYPAL
// ======================================================

function mostrarErroPayPal(mensagem) {

    let elemento =
        document.getElementById('paypal-error');

    if (!elemento) {

        elemento =
            document.createElement('div');

        elemento.id = 'paypal-error';

        elemento.style.marginTop = '15px';
        elemento.style.padding = '12px';
        elemento.style.borderRadius = '8px';
        elemento.style.background = '#ffe5e5';
        elemento.style.color = '#a00000';
        elemento.style.fontSize = '14px';

        const container =
            document.getElementById(
                'paypal-button-container'
            );

        if (container) {
            container.parentNode.appendChild(elemento);
        }
    }

    elemento.textContent = mensagem;
    elemento.style.display = 'block';
}


function esconderErroPayPal() {

    const elemento =
        document.getElementById('paypal-error');

    if (elemento) {
        elemento.style.display = 'none';
    }
}


// ======================================================
// OBTER CLIENT TOKEN
// ======================================================

async function obterPayPalClientToken() {
    const url = `${API_URL}/api/paypal/client-token`;

    console.log('==========================================');
    console.log('PAYPAL CLIENT TOKEN');
    console.log('URL:', url);
    console.log('==========================================');

    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Accept': 'application/json'
        }
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log(
        'Content-Type:',
        response.headers.get('content-type')
    );

    const texto = await response.text();

    console.log('Resposta bruta do servidor:');
    console.log(texto);

    let data;

    try {
        data = JSON.parse(texto);
    } catch (erro) {
        console.error(
            'O servidor não retornou JSON válido.',
            texto
        );

        throw new Error(
            `Resposta inválida do servidor. Status: ${response.status}`
        );
    }

    if (!response.ok) {
        console.error(
            'Erro ao obter Client Token:',
            data
        );

        throw new Error(
            data.erro ||
            data.error ||
            'Não foi possível obter o Client Token do PayPal.'
        );
    }

    if (!data.clientToken) {
        console.error(
            'JSON recebido, mas sem clientToken:',
            data
        );

        throw new Error(
            'O servidor não retornou o Client Token do PayPal.'
        );
    }

    console.log('Client Token recebido com sucesso.');

    return data.clientToken;
}

// ======================================================
// CRIAR PEDIDO NO BACKEND
// ======================================================

async function criarPedidoPayPal(valor) {

    const response = await fetch(
        `${API_URL}/api/paypal/create-order`,
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                valor: Number(valor).toFixed(2)
            })
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (erro) {

        throw new Error(
            'Resposta inválida do servidor ao criar pedido.'
        );
    }

    if (!response.ok) {

        console.error(
            'Erro ao criar pedido PayPal:',
            data
        );

        throw new Error(
            data.erro ||
            'Não foi possível criar o pedido PayPal.'
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

    // PayPal JS SDK v6 espera um objeto com orderId.
    return {
        orderId: data.id
    };
}


// ======================================================
// CAPTURAR PEDIDO
// ======================================================

async function capturarPedidoPayPal(orderID) {

    console.log(
        'Capturando pedido PayPal:',
        orderID
    );

    const response = await fetch(
        `${API_URL}/api/paypal/capture-order`,
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                orderID
            })
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (erro) {

        throw new Error(
            'Resposta inválida do servidor ao capturar pagamento.'
        );
    }

    if (!response.ok) {

        console.error(
            'Erro ao capturar pagamento:',
            data
        );

        throw new Error(
            data.erro ||
            'Não foi possível concluir o pagamento.'
        );
    }

    console.log(
        'Resposta da captura:',
        data
    );

    if (data.status === 'COMPLETED') {

        esconderLoadingPayPal();

        window.location.href = '/sucesso';

        return;
    }

    esconderLoadingPayPal();

    mostrarErroPayPal(
        `Pagamento processado com status: ${data.status}`
    );
}


// ======================================================
// INICIALIZAR PAYPAL V6
// ======================================================

async function inicializarPayPal() {

    if (paypalInicializado) {
        return;
    }

    if (paypalInicializando) {
        return;
    }

    paypalInicializando = true;

    try {

        esconderErroPayPal();

        mostrarLoadingPayPal();


        // --------------------------------------------------
        // VERIFICAR SDK
        // --------------------------------------------------

        if (!window.paypal) {

            throw new Error(
                'SDK do PayPal ainda não foi carregado.'
            );
        }

        console.log(
            'SDK PayPal encontrado.'
        );


        // --------------------------------------------------
        // OBTER CLIENT TOKEN
        // --------------------------------------------------

        console.log(
            'Obtendo Client Token do PayPal...'
        );

        const clientToken =
            await obterPayPalClientToken();

        console.log(
            'Client Token recebido com sucesso.'
        );


        // --------------------------------------------------
        // CRIAR INSTÂNCIA
        // --------------------------------------------------

        console.log(
            'Criando instância PayPal...'
        );

        paypalSdk =
            await window.paypal.createInstance({

                clientToken,

                components: [
                    'paypal-payments'
                ],

                pageType: 'checkout'
            });

        console.log(
            'Instância PayPal criada com sucesso.'
        );


        // --------------------------------------------------
        // VERIFICAR ELEGIBILIDADE
                // --------------------------------------------------

        const eligibility =
            await paypalSdk.findEligibleMethods({

                currencyCode: 'BRL'
            });

        console.log(
            'Métodos elegíveis:',
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
        // CONTAINER
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

        container.innerHTML = '';


        // --------------------------------------------------
        // BOTÃO PAYPAL
        // --------------------------------------------------

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
        // SESSÃO DE PAGAMENTO
        // --------------------------------------------------

        paypalSession =
            paypalSdk.createPayPalOneTimePaymentSession({

                onApprove: async ({
                    orderId
                }) => {

                    console.log(
                        'Pagamento aprovado pelo PayPal.'
                    );

                    return await capturarPedidoPayPal(
                        orderId
                    );
                },


                onCancel: (data) => {

                    console.log(
                        'Pagamento cancelado:',
                        data
                    );

                    esconderLoadingPayPal();

                    mostrarErroPayPal(
                        'O pagamento foi cancelado.'
                    );
                },


                onError: (erro) => {

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
        // CLIQUE NO BOTÃO PAYPAL
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

                    console.log(
                        'Valor do pagamento:',
                        totalAtual
                    );

                    mostrarLoadingPayPal();


                    // Criar pedido no backend.
                    // A Promise é passada diretamente ao start()
                    // para preservar o fluxo do clique do PayPal.
                    const createOrderPromise =
                        criarPedidoPayPal(totalAtual);


                    // Abrir checkout
                    await paypalSession.start(

                        {
                            presentationMode:
                                'auto'
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


        // --------------------------------------------------
        // FINALIZADO
        // --------------------------------------------------

        paypalInicializado = true;

        esconderLoadingPayPal();

        console.log(
            '=========================================='
        );

        console.log(
            'PAYPAL INICIALIZADO COM SUCESSO'
        );

        console.log(
            '=========================================='
        );


    } catch (erro) {

        console.error(
            'Erro na inicialização do PayPal:',
            erro
        );

        esconderLoadingPayPal();

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
// PAGAR AGORA
// ======================================================

window.pagarAgora = async function () {

    const servicos = obterServicosSelecionados();

    if (!servicos.length) {

        alert(
            'Selecione pelo menos um serviço antes de finalizar o orçamento.'
        );

        return;
    }

    const total =
        calcularTotal();

    if (!Number.isFinite(total) || total <= 0) {

        alert(
            'Os serviços selecionados não possuem um preço válido.'
        );

        return;
    }


    // --------------------------------------------------
    // MOSTRAR PAGAMENTO
    // --------------------------------------------------

    const paymentMethods =
        document.getElementById(
            'payment-methods'
        );

    if (!paymentMethods) {

        console.error(
            'Elemento #payment-methods não encontrado.'
        );

        return;
    }

    paymentMethods.classList.remove('hidden');

    paymentMethods.style.display = 'block';


    // --------------------------------------------------
    // LOCALIZAR CONTAINER PAYPAL
    // --------------------------------------------------

    let paypalContainer =
        document.getElementById(
            'paypal-button-container'
        );


    // --------------------------------------------------
    // CRIAR CONTAINER SE NÃO EXISTIR
    // --------------------------------------------------

    if (!paypalContainer) {

        const paypalBox =
            document.createElement('div');

        paypalBox.className =
            'payment-method';

        paypalBox.innerHTML = `

            <h3>Pagamento com PayPal</h3>

            <p class="payment-note">
                Total do orçamento:
                <strong>
                    R$ ${total.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}
                </strong>
            </p>

            <div
                id="paypal-button-container"
                style="margin-top:20px;"
            ></div>

            <div
                id="paypal-loading"
                style="
                    display:none;
                    margin-top:10px;
                    font-size:14px;
                "
            >
                Processando pagamento...
            </div>

            <div
                id="paypal-error"
                style="
                    display:none;
                    margin-top:15px;
                    padding:12px;
                    border-radius:8px;
                    background:#ffe5e5;
                    color:#a00000;
                    font-size:14px;
                "
            ></div>

        `;

        paymentMethods.appendChild(
            paypalBox
        );

        paypalContainer =
            document.getElementById(
                'paypal-button-container'
            );
    }


    // --------------------------------------------------
    // ROLAR ATÉ PAGAMENTO
    // --------------------------------------------------

    paymentMethods.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });


    // --------------------------------------------------
    // INICIALIZAR PAYPAL
    // --------------------------------------------------

    try {

        await inicializarPayPal();

    } catch (erro) {

        console.error(
            'Falha ao inicializar PayPal:',
            erro
        );
    }
};


// ======================================================
// NAVEGAÇÃO DO SITE
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    function () {

        const links =
            document.querySelectorAll(
                'a[href^="#"]'
            );

        const paginas =
            document.querySelectorAll(
                'main .page'
            );


        function mostrarPagina(id) {

            const pagina =
                document.getElementById(id);

            if (!pagina) {
                return;
            }


            // Esconder todas
            paginas.forEach(function (item) {

                item.classList.remove(
                    'active'
                );

            });


            // Mostrar selecionada
            pagina.classList.add(
                'active'
            );


            // Atualizar URL
            if (
                window.location.hash !==
                '#' + id
            ) {

                history.pushState(
                    null,
                    '',
                    '#' + id
                );
            }


            // Voltar ao topo
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }


        // --------------------------------------------------
        // TODOS OS LINKS INTERNOS
        // --------------------------------------------------

        links.forEach(function (link) {

            link.addEventListener(
                'click',
                function (event) {

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

                    mostrarPagina(id);
                }
            );

        });


        // --------------------------------------------------
        // ABRIR PELO HASH
        // --------------------------------------------------

        function abrirPaginaPeloHash() {

            let id =
                window.location.hash
                    .replace('#', '');

            if (!id) {
                id = 'inicio';
            }

            const pagina =
                document.getElementById(id);

            if (!pagina) {

                const inicio =
                    document.getElementById(
                        'inicio'
                    );

                if (inicio) {

                    paginas.forEach(
                        item =>
                            item.classList.remove(
                                'active'
                            )
                    );

                    inicio.classList.add(
                        'active'
                    );
                }

                return;
            }


            paginas.forEach(function (item) {

                item.classList.remove(
                    'active'
                );

            });


            pagina.classList.add(
                'active'
            );
        }


        abrirPaginaPeloHash();


        window.addEventListener(
            'hashchange',
            abrirPaginaPeloHash
        );

    }
);


// ======================================================
// SDK PAYPAL CARREGADO
// ======================================================

window.onPayPalLoaded = function () {

    console.log(
        'SDK PayPal carregado.'
    );

};