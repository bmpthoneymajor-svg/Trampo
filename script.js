// ======================================================
// BT DESIGN - SCRIPT PRINCIPAL
// PAYPAL V6
// ======================================================

const API_URL = 'https://trampo.up.railway.app'.replace(/\/$/, '');


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
// PREÇOS / ORÇAMENTO
// ======================================================

function obterServicosSelecionados() {
    const servicos = [];

    document.querySelectorAll('.servico-row').forEach(row => {

        const checkbox = row.querySelector('.servico-checkbox');

        if (!checkbox || !checkbox.checked) {
            return;
        }

        const nome = row.querySelector('label')?.innerText.trim() || 'Serviço';

        const quantidadeInput = row.querySelector('.quantidade');
        const precoInput = row.querySelector('.preco');
        const observacaoInput = row.querySelector('.observacao');

        const quantidade =
            Number(quantidadeInput?.value || 1);

        const preco =
            Number(precoInput?.value || 0);

        const observacao =
            observacaoInput?.value.trim() || '';

        servicos.push({
            key: checkbox.dataset.key || '',
            nome,
            quantidade,
            preco,
            observacao
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

        const quantidade =
            Number(quantidadeInput?.value || 0);

        const preco =
            Number(precoInput?.value || 0);

        if (
            Number.isFinite(quantidade) &&
            Number.isFinite(preco) &&
            quantidade > 0 &&
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
            total.toFixed(2);
    }

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
// LOADING DO PAYPAL
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
// ERROS DO PAYPAL
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

    const response = await fetch(
        `${API_URL}/api/paypal/client-token`,
        {
            method: 'GET',
            cache: 'no-store'
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (erro) {
        throw new Error(
            'O servidor retornou uma resposta inválida.'
        );
    }

    if (!response.ok) {

        console.error(
            'Erro ao obter Client Token:',
            data
        );

        throw new Error(
            data.erro ||
            'Não foi possível obter o Client Token do PayPal.'
        );
    }

    if (!data.clientToken) {

        throw new Error(
            'O servidor não retornou o Client Token do PayPal.'
        );
    }

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

    return data.id;
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

        window.location.href =
            '/sucesso';

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
        // CRIAR INSTÂNCIA PAYPAL
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
        // VERIFICAR MÉTODOS ELEGÍVEIS
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
        // CLIQUE NO BOTÃO
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


                    // Criar pedido no backend
                    const createOrderPromise =
                        criarPedidoPayPal(
                            totalAtual
                        );


                    // Abrir checkout PayPal
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
// FUNÇÃO PAGAR AGORA
// ======================================================

async function pagarAgora() {

    const total =
        calcularTotal();


    if (!total || total <= 0) {

        alert(
            'Selecione pelo menos um serviço e informe um preço válido.'
        );

        return;
    }


    // Mostrar seção de pagamento
    const paymentMethods =
        document.getElementById(
            'payment-methods'
        );

    if (paymentMethods) {

        paymentMethods.classList.remove(
            'hidden'
        );

        paymentMethods.style.display =
            'block';
    }


    // --------------------------------------------------
    // CRIAR CONTAINER DO PAYPAL
    // --------------------------------------------------

    let paypalContainer =
        document.getElementById(
            'paypal-button-container'
        );


    if (!paypalContainer) {

        const paymentSection =
            document.getElementById(
                'payment-methods'
            );

        if (!paymentSection) {

            alert(
                'Área de pagamento não encontrada.'
            );

            return;
        }


        const paypalBox =
            document.createElement(
                'div'
            );

        paypalBox.className =
            'payment-method';


        paypalBox.innerHTML = `

            <h3>Pagamento com PayPal</h3>

            <p>
                Total do orçamento:
                <strong>
                    R$ ${total.toFixed(2)}
                </strong>
            </p>

            <div
                id="paypal-button-container"
                style="margin-top: 20px;"
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

        `;


        paymentSection.appendChild(
            paypalBox
        );


        paypalContainer =
            document.getElementById(
                'paypal-button-container'
            );
    }


    // --------------------------------------------------
    // INICIALIZAR
    // --------------------------------------------------

    try {

        await inicializarPayPal();

    } catch (erro) {

        console.error(
            'Falha ao inicializar PayPal:',
            erro
        );

    }

}


// ======================================================
// INICIALIZAÇÃO DA PÁGINA
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        calcularTotal();

        console.log(
            'BT Design carregado.'
        );

    }


);
async function onPayPalLoaded() {
    console.log('SDK PayPal carregado.');

    try {
        await inicializarPayPal();

        const status =
            document.getElementById('paypal-status');

        if (status) {
            status.textContent =
                'PayPal pronto para pagamento.';
        }

    } catch (erro) {

        console.error(
            'Erro ao carregar PayPal:',
            erro
        );

        const status =
            document.getElementById('paypal-status');

        if (status) {
            status.textContent =
                'Não foi possível carregar o PayPal.';
        }
    }
}