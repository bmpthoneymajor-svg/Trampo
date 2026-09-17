const API_URL = 'https://trampo.up.railway.app/';
// CALCULAR TOTAL
function calcularTotal() {
    let total = 0;

    document.querySelectorAll('.servico-row').forEach(row => {
        const checkbox = row.querySelector('.servico-checkbox');
        const precoInput = row.querySelector('.preco');
        if (!checkbox.checked) {
            precoInput.value = '0.00';
            return;
        }

        const key = checkbox.dataset.key;
        const qtd = parseInt(row.querySelector('.quantidade').value) || 0;

        let precoUnitario = 0;

        switch (key) {
            case 'layout':
                precoUnitario = qtd === 1 ? 700 : 600;
                break;

            case 'animacao':
            case 'video':
                precoUnitario = qtd <= 30 ? 120 : 100;
                break;

            case 'restauracao':
                precoUnitario = qtd === 1 ? 80 : 70;
                break;

            case 'modelagem3d':
                precoUnitario = qtd === 1 ? 170 : 145;
                break;

            case 'reparo3d':
                precoUnitario = qtd === 1 ? 120 : 90;
                break;

            case 'render':
                precoUnitario = qtd === 1 ? 200 : 150;
                break;

            case 'diagramacao':
                if (qtd >= 10 && qtd <= 20) precoUnitario = 6.8;
                else if (qtd >= 21 && qtd <= 30) precoUnitario = 5.9;
                else if (qtd >= 31 && qtd <= 80) precoUnitario = 4.7;
                else if (qtd >= 81 && qtd <= 130) precoUnitario = 3.7;
                else if (qtd >= 131) precoUnitario = 2.3;
                break;

            case 'imagem':
                precoUnitario = 30;
                break;

            case 'cartao':
                precoUnitario = 80;
                break;

            case 'panfleto':
                precoUnitario = 50;
                break;

            case 'folder':
                precoUnitario = 80;
                break;

            case 'banner':
                precoUnitario = 100;
                break;

            case 'Imagem Renderizada':
                precoUnitario = 130;
                break;
        }

        precoInput.value = precoUnitario.toFixed(2);
        total += qtd * precoUnitario;
    });

    document.getElementById('total').textContent = total.toFixed(2);
    return total;
}

async function pagarAgora1() {
    const total = calcularTotal();
    console.log('Total calculado:', total);

    if (total <= 0) {
        alert('Selecione pelo menos um serviço!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/criar-pagamento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ valor: total })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro na resposta do servidor:', response.status, errorText);
            throw new Error('Erro na resposta do servidor');
        }

        const data = await response.json();
        console.log('Data recebida:', data);

        if (!data.link) {
            throw new Error('Link de pagamento não recebido');
        }

        window.location.href = data.link;
    } catch (error) {
        alert('Erro ao processar o pagamento. Verifique o console e se o servidor está rodando.');
        console.error(error);
    }
}

let pageLoaderInterval;

function startPageLoader() {
    const loader = document.getElementById('page-loader');
    const bar = loader?.querySelector('.page-loader-bar');
    if (!loader || !bar) return;

    loader.classList.remove('page-loader-done');
    bar.style.width = '0%';

    let progress = 0;
    clearInterval(pageLoaderInterval);
    pageLoaderInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 6 + 8, 88);
        bar.style.width = `${progress}%`;
    }, 100);
}

function finishPageLoader() {
    const loader = document.getElementById('page-loader');
    const bar = loader?.querySelector('.page-loader-bar');
    if (!loader || !bar) return;

    clearInterval(pageLoaderInterval);
    bar.style.width = '100%';
    setTimeout(() => loader.classList.add('page-loader-done'), 250);
}

function initPageLoader() {
    const loader = document.getElementById('page-loader');
    const bar = loader?.querySelector('.page-loader-bar');
    if (!loader || !bar) return;

    let progress = 0;
    pageLoaderInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 8 + 5, 92);
        bar.style.width = `${progress}%`;
    }, 120);

    const onLoadFinish = () => {
        finishPageLoader();
        window.removeEventListener('load', onLoadFinish);
    };

    if (document.readyState === 'complete') {
        finishPageLoader();
    } else {
        window.addEventListener('load', onLoadFinish);
    }
}

initPageLoader();


// EXECUTA QUANDO CARREGA
document.addEventListener("DOMContentLoaded", () => {

    // EVENTO DE CÁLCULO PARA CHECKBOXES
    document.querySelectorAll('.servico-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', calcularTotal);
    });

    // EVENTO DE CÁLCULO PARA QUANTIDADES
    document.querySelectorAll('.quantidade').forEach(input => {
        input.addEventListener('input', calcularTotal);
    });

    // NAVEGAÇÃO SPA
    const links = document.querySelectorAll("nav a");
    const pages = document.querySelectorAll(".page");

    links.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.getAttribute("href").replace("#", "");

            startPageLoader();
            setTimeout(() => {
                pages.forEach(page => page.classList.remove("active"));
                document.getElementById(targetId).classList.add("active");
                finishPageLoader();
            }, 180);
        });
    });

});

// ===== INTEGRAÇÃO MERCADO PAGO =====

// Variáveis globais
let mp;
let cardNumberElement;
let expirationDateElement;
let securityCodeElement;

// Inicializar Mercado Pago
async function initMercadoPago() {
    try {
        console.log('Iniciando Mercado Pago...');

        // Buscar chave pública do servidor
        const response = await fetch(`${API_URL}/api/public-key`);
        const data = await response.json();

        console.log('Chave pública recebida:', data.publicKey ? 'OK' : 'ERRO');

        if (!data.publicKey) {
            console.error('Chave pública não encontrada');
            return;
        }

        // Inicializar SDK
        mp = new MercadoPago(data.publicKey);
        console.log('Mercado Pago inicializado com sucesso');

        // Inicializar campos de cartão
        initCardFields();

        // Carregar tipos de documento
        await loadIdentificationTypes();

    } catch (error) {
        console.error('Erro ao inicializar Mercado Pago:', error);
    }
}

// Inicializar campos de cartão
function initCardFields() {
    if (!mp) return;

    try {
        cardNumberElement = mp.fields.create('cardNumber', {
            placeholder: "Número do cartão"
        }).mount('form-checkout__cardNumber');

        expirationDateElement = mp.fields.create('expirationDate', {
            placeholder: "MM/YY",
        }).mount('form-checkout__expirationDate');

        securityCodeElement = mp.fields.create('securityCode', {
            placeholder: "Código de segurança"
        }).mount('form-checkout__securityCode');

        // Listener para mudança de BIN (primeiros 6 dígitos do cartão)
        cardNumberElement.on('binChange', async (data) => {
            const { bin } = data;
            try {
                if (!bin) {
                    clearSelectsAndSetPlaceholders();
                    document.getElementById('paymentMethodId').value = "";
                    
                    // Limpar status visual
                    const statusElement = document.getElementById('card-status');
                    if (statusElement) {
                        statusElement.textContent = 'Digite o número do cartão para detectar a bandeira';
                        statusElement.style.color = '#666';
                    }
                    
                    return;
                }

                if (bin.length >= 6) {
                    const { results } = await mp.getPaymentMethods({ bin });
                    const paymentMethod = results[0];

                    document.getElementById('paymentMethodId').value = paymentMethod.id;
                    console.log('Método de pagamento detectado:', paymentMethod.id);
                    
                    // Atualizar status visual
                    const statusElement = document.getElementById('card-status');
                    if (statusElement) {
                        statusElement.textContent = `Bandeira detectada: ${paymentMethod.name}`;
                        statusElement.style.color = '#28a745';
                    }
                    
                    updatePCIFieldsSettings(paymentMethod);
                    await updateIssuer(paymentMethod, bin);
                    await updateInstallments(paymentMethod, bin);
                }
            } catch (e) {
                console.error('Erro ao obter métodos de pagamento:', e);
            }
        });

        console.log('Campos de cartão inicializados');
    } catch (error) {
        console.error('Erro ao inicializar campos de cartão:', error);
    }
}

// Carregar tipos de documento
async function loadIdentificationTypes() {
    try {
        const identificationTypes = await mp.getIdentificationTypes();
        const elements = [
            'form-checkout__identificationType',
            'form-checkout__identificationType-pix',
            'form-checkout__identificationType-boleto'
        ];

        elements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                createSelectOptions(element, identificationTypes);
            }
        });

        console.log('Tipos de documento carregados');
    } catch (e) {
        console.error('Erro ao carregar tipos de documento:', e);
    }
}

// Função auxiliar para criar opções de select
function createSelectOptions(elem, options, labelsAndKeys = { label: "name", value: "id" }) {
    const { label, value } = labelsAndKeys;

    elem.options.length = 0;

    const tempOptions = document.createDocumentFragment();

    options.forEach(option => {
        const optValue = option[value];
        const optLabel = option[label];

        const opt = document.createElement('option');
        opt.value = optValue;
        opt.textContent = optLabel;

        tempOptions.appendChild(opt);
    });

    elem.appendChild(tempOptions);
}

// Limpar selects e definir placeholders
function clearSelectsAndSetPlaceholders() {
    const issuerElement = document.getElementById('form-checkout__issuer');
    const installmentsElement = document.getElementById('form-checkout__installments');

    clearHTMLSelectChildrenFrom(issuerElement);
    createSelectElementPlaceholder(issuerElement, "Banco emissor");

    clearHTMLSelectChildrenFrom(installmentsElement);
    createSelectElementPlaceholder(installmentsElement, "Parcelas");
}

function clearHTMLSelectChildrenFrom(element) {
    const currOptions = [...element.children];
    currOptions.forEach(child => child.remove());
}

function createSelectElementPlaceholder(element, placeholder) {
    const optionElement = document.createElement('option');
    optionElement.textContent = placeholder;
    optionElement.setAttribute('selected', "");
    optionElement.setAttribute('disabled', "");

    element.appendChild(optionElement);
}

// Atualizar configurações PCI dos campos
function updatePCIFieldsSettings(paymentMethod) {
    const { settings } = paymentMethod;

    const cardNumberSettings = settings[0].card_number;
    cardNumberElement.update({
        settings: cardNumberSettings
    });

    const securityCodeSettings = settings[0].security_code;
    securityCodeElement.update({
        settings: securityCodeSettings
    });
}

// Atualizar banco emissor
async function updateIssuer(paymentMethod, bin) {
    const { additional_info_needed, issuer } = paymentMethod;
    let issuerOptions = [issuer];

    if (additional_info_needed.includes('issuer_id')) {
        issuerOptions = await getIssuers(paymentMethod, bin);
    }

    const issuerElement = document.getElementById('form-checkout__issuer');
    createSelectOptions(issuerElement, issuerOptions);
}

async function getIssuers(paymentMethod, bin) {
    try {
        const { id: paymentMethodId } = paymentMethod;
        return await mp.getIssuers({ paymentMethodId, bin });
    } catch (e) {
        console.error('Erro ao obter emissores:', e);
        return [];
    }
}

// Atualizar parcelas
async function updateInstallments(paymentMethod, bin) {
    try {
        const installments = await mp.getInstallments({
            amount: document.getElementById('transactionAmount').value,
            bin,
            paymentTypeId: 'credit_card'
        });
        const installmentOptions = installments[0].payer_costs;
        const installmentOptionsKeys = { label: 'recommended_message', value: 'installments' };
        const installmentsElement = document.getElementById('form-checkout__installments');
        createSelectOptions(installmentsElement, installmentOptions, installmentOptionsKeys);
    } catch (error) {
        console.error('Erro ao obter parcelas:', error);
    }
}

// Criar token do cartão
async function createCardToken(event) {
    event.preventDefault();

    try {
        console.log('Iniciando criação do token do cartão...');

        const tokenElement = document.getElementById('token');
        const cardholderName = document.getElementById('form-checkout__cardholderName').value;
        const identificationType = document.getElementById('form-checkout__identificationType').value;
        const identificationNumber = document.getElementById('form-checkout__identificationNumber').value;

        console.log('Dados para token:', {
            cardholderName,
            identificationType,
            identificationNumber
        });

        if (!mp) {
            throw new Error('Mercado Pago não foi inicializado');
        }

        const token = await mp.fields.createCardToken({
            cardholderName,
            identificationType,
            identificationNumber,
        });

        console.log('Token criado:', token);

        if (!token || !token.id) {
            throw new Error('Token não foi gerado corretamente');
        }

        tokenElement.value = token.id;
        console.log('Token definido no campo oculto:', token.id);
        console.log('Verificação imediata - valor no campo:', document.getElementById('token').value);

        // Pequena pausa para garantir que o DOM foi atualizado
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('Após pausa - valor no campo:', document.getElementById('token').value);

        // Verificar novamente se o token está no campo
        if (!document.getElementById('token').value) {
            throw new Error('Token não foi definido corretamente no campo oculto');
        }

        // Enviar formulário - método alternativo
        const form = document.getElementById('form-checkout');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        console.log('FormData original:', Object.fromEntries(formData));

        // Adicionar campos que podem não estar no FormData
        data.token = tokenElement.value;
        data.paymentMethodId = document.getElementById('paymentMethodId').value;
        data.transactionAmount = document.getElementById('transactionAmount').value;

        console.log('Dados finais a serem enviados:', data);
        console.log('Token no data:', data.token);
        console.log('Token no campo oculto:', tokenElement.value);

        // Verificar se o token está presente
        if (!data.token) {
            throw new Error('Token não foi definido no formulário');
        }

        // Verificar se paymentMethodId está definido
        if (!data.paymentMethodId) {
            throw new Error('Método de pagamento não foi detectado. Digite o número completo do cartão.');
        }

        // Verificar se transactionAmount está definido
        if (!data.transactionAmount || data.transactionAmount === '0.00') {
            throw new Error('Valor da transação não foi definido. Calcule o orçamento primeiro.');
        }

        // Verificar se cardholderName está definido
        if (!data.cardholderName) {
            throw new Error('Nome do titular do cartão não foi preenchido.');
        }
       
        console.log("DADOS ENVIADOS:", data);
       
        const response = await fetch(`${API_URL}/process_payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        console.log('Resposta do servidor:', response.status);

        const result = await response.json();
        console.log('Resultado:', result);

        if (result.success) {
            alert('Pagamento processado com sucesso! Status: ' + result.status);
            // Redirecionar ou mostrar confirmação
        } else {
            alert('Erro no pagamento: ' + result.erro + '\n' + (result.detalhes || ''));
        }
    } catch (e) {
        console.error('Erro ao criar token do cartão:', e);
        alert('Erro ao processar pagamento: ' + (e.message || e || 'Erro desconhecido'));
    }
}

// Processar Pix
async function processPixPayment(event) {
    event.preventDefault();

    try {
        const form = document.getElementById('form-checkout-pix');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const response = await fetch(`${API_URL}/process_payment_pix`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            // Mostrar QR Code e código Pix
            document.getElementById('pix-result').style.display = 'block';

            if (result.qrCodeBase64) {
                document.getElementById('qr-code-container').innerHTML = `<img src="data:image/jpeg;base64,${result.qrCodeBase64}" alt="QR Code Pix">`;
            }

            document.getElementById('copiar').value = result.qrCode;

            alert('Pix gerado com sucesso!');
        } else {
            alert('Erro ao gerar Pix: ' + result.erro);
        }
    } catch (e) {
        console.error('Erro ao processar Pix:', e);
        alert('Erro ao processar Pix: ' + (e.message || e || 'Erro desconhecido'));
    }
}

// Processar Boleto
async function processBoletoPayment(event) {
    event.preventDefault();

    try {
        const form = document.getElementById('form-checkout-boleto');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const response = await fetch(`${API_URL}/process_payment_boleto`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            // Mostrar link do boleto
            document.getElementById('boleto-result').style.display = 'block';
            document.getElementById('boleto-link').href = result.ticketUrl;

            alert('Boleto gerado com sucesso!');
        } else {
            alert('Erro ao gerar boleto: ' + result.erro);
        }
    } catch (e) {
        console.error('Erro ao processar boleto:', e);
        alert('Erro ao processar boleto: ' + (e.message || e || 'Erro desconhecido'));
    }
}

// Copiar código Pix
function copyPixCode() {
    const copyText = document.getElementById('copiar');
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    document.execCommand('copy');
    alert('Código Pix copiado!');
}

// Testar criação do token
async function testTokenCreation() {
    try {
        console.log('Testando criação do token...');

        if (!mp) {
            alert('Mercado Pago não foi inicializado');
            return;
        }

        const cardholderName = document.getElementById('form-checkout__cardholderName').value;
        const identificationType = document.getElementById('form-checkout__identificationType').value;
        const identificationNumber = document.getElementById('form-checkout__identificationNumber').value;
        const paymentMethodId = document.getElementById('paymentMethodId').value;

        console.log('Dados para teste:', {
            cardholderName,
            identificationType,
            identificationNumber,
            paymentMethodId
        });

        if (!paymentMethodId) {
            alert('ATENÇÃO: Método de pagamento não detectado!\n\nDigite o número completo do cartão primeiro (pelo menos 6 dígitos) para que o sistema detecte a bandeira.');
            return;
        }

        const token = await mp.fields.createCardToken({
            cardholderName,
            identificationType,
            identificationNumber,
        });

        console.log('Token de teste criado:', token);

        if (token && token.id) {
            alert('Token criado com sucesso!\nToken ID: ' + token.id + '\nMétodo: ' + paymentMethodId);
        } else {
            alert('Token não foi criado corretamente');
        }

    } catch (e) {
        console.error('Erro no teste do token:', e);
        alert('Erro no teste: ' + (e.message || e || 'Erro desconhecido'));
    }
}

// Modificar função pagarAgora para mostrar métodos de pagamento
function pagarAgora() {
    const total = calcularTotal();
    console.log('Total calculado:', total);

    if (total <= 0) {
        alert('Selecione pelo menos um serviço!');
        return;
    }

    // Atualizar valores nos formulários
    document.getElementById('transactionAmount').value = total;
    document.getElementById('transactionAmount-pix').value = total;
    document.getElementById('transactionAmount-boleto').value = total;

    console.log('Valor definido nos formulários:', total);

    // Mostrar seção de métodos de pagamento
    const paymentMethods = document.getElementById('payment-methods');
    paymentMethods.classList.remove('hidden');
    paymentMethods.scrollIntoView({ behavior: 'smooth' });
}

// Inicializar Mercado Pago quando DOM carregar
document.addEventListener("DOMContentLoaded", () => {
    // Código existente...

    // Inicializar Mercado Pago
    initMercadoPago();

    // Adicionar event listeners para formulários
    document.getElementById('form-checkout').addEventListener('submit', createCardToken);
    document.getElementById('form-checkout-pix').addEventListener('submit', processPixPayment);
    document.getElementById('form-checkout-boleto').addEventListener('submit', processBoletoPayment);
});