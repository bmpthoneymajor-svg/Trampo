const express = require('express');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const { v4: uuidv4 } = require('uuid');


const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

/*
  Mercado Pago environment variables

  Sandbox (credenciais de teste):
    MERCADOPAGO_ENVIRONMENT=sandbox
    MERCADOPAGO_TEST_ACCESS_TOKEN=TEST-5024817526090385-041920-dee4861a531f0efb31218164e8c3fe54-2338582345
    MERCADOPAGO_PUBLIC_KEY_TEST=TEST-b85d84a9-da53-4b04-8541-c3fdd53bd9c1

  Produção:
    MERCADOPAGO_ENVIRONMENT=production
    MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
    MERCADOPAGO_PUBLIC_KEY=APP_USR-...
*/
const environment = (process.env.MERCADOPAGO_ENVIRONMENT || 'production').toLowerCase();

let accessToken;
let publicKey;

if (environment === 'sandbox') {
  accessToken = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN;
  publicKey = process.env.MERCADOPAGO_PUBLIC_KEY_TEST;
} else {
  accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;
}

if (!accessToken) {
  throw new Error(
    `Access Token do Mercado Pago não configurado para o ambiente: ${environment}`
  );
}

console.log(`Ambiente Mercado Pago: ${environment}`);
console.log(`Access Token configurado: ${accessToken.substring(0, 12)}...`);

if (publicKey) {
  console.log('Public Key configurada.');
} else {
  console.warn('Public Key NÃO configurada.');
}

console.log(`Ambiente Mercado Pago: ${environment}`);
console.log(`Usando token de ${environment === 'production' ? 'produção' : 'sandbox'}`);
if (publicKey) {
  console.log(`Chave pública disponível para uso no frontend.`);
}

const client = new MercadoPagoConfig({
  accessToken
});

const preferenceClient = new Preference(client);

// Função para criar headers com Idempotency Key
function getHeaders() {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': uuidv4()
  };
}

// Função para fazer POST à API do Mercado Pago (usando Payments API)
async function makePaymentRequest(paymentData) {
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    return await response.json();
  } catch (erro) {
    console.error('Erro ao criar payment:', JSON.stringify(erro, null, 2));
    throw erro;
  }
}

// ROTAS ANTIGAS - Preference (checkout redirect)

app.post('/criar-pagamento', async (req, res) => {
  try {
    const { valor, email } = req.body;
    console.log('Recebido valor:', valor);

    if (!valor || Number(valor) <= 0) {
      return res.status(400).json({ erro: 'Valor inválido' });
    }

    if (!email) {
  return res.status(400).json({
    erro: 'Email do cliente é obrigatório'
  });
    }

    const preferenceData = {
      items: [
        {
          title: 'Orçamento de Serviços',
          quantity: 1,
          unit_price: Number(valor),
          currency_id: 'BRL'
        }
      ],
      payer: {
        email
      },
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
    back_urls: {
  success: 'https://btdesign3d.up.railway.app/sucesso',
  failure: 'https://btdesign3d.up.railway.app/falha',
  pending: 'https://btdesign3d.up.railway.app/pendente'
}
    };

    console.log('Preference data enviada:', JSON.stringify(preferenceData, null, 2));
    const response = await preferenceClient.create({ body: preferenceData });
    const checkoutLink = response.init_point;
    console.log('Preference criada:', checkoutLink);

    if (!checkoutLink) {
      return res.status(500).json({ erro: 'Nenhum link de checkout retornado' });
    }

    return res.json({ link: checkoutLink });
  } catch (erro) {
    console.error('ERRO DETALHADO:', JSON.stringify(erro, null, 2));
    if (erro && erro.cause) {
      console.error('Causa do erro:', JSON.stringify(erro.cause, null, 2));
    }
    return res.status(500).json({ erro: 'Erro ao criar pagamento', detalhes: erro.message || JSON.stringify(erro) });
  }
});

app.get('/sucesso', (req, res) => {
  res.send('<h1>Pagamento aprovado</h1><p>Obrigado! Seu pagamento foi processado com sucesso.</p>');
});

app.get('/falha', (req, res) => {
  res.send('<h1>Pagamento não aprovado</h1><p>O pagamento não foi concluído. Tente novamente.</p>');
});

app.get('/pendente', (req, res) => {
  res.send('<h1>Pagamento pendente</h1><p>O pagamento está pendente. Aguarde a confirmação.</p>');
});

// ===== NOVA ROTA: Processar pagamento com Cartão (Core Methods) =====
app.post('/process_payment', async (req, res) => {
  try {
    const {
      token,
      issuer_id,
      issuer,
      installments,
      cardholderName,
      identificationType,
      identificationNumber,
      email,
      paymentMethodId,
      transactionAmount
    } = req.body;

    console.log('Recebido pagamento com cartão:', {
      email,
      installments,
      amount: transactionAmount,
      cardholderName,
      identificationType,
      identificationNumber
    });

    if (!token || !paymentMethodId || !transactionAmount) {
      return res.status(400).json({ erro: 'Dados incompletos para pagamento' });
    }

    if (!email || !cardholderName || !identificationType || !identificationNumber) {
      return res.status(400).json({ erro: 'Dados do pagador incompletos' });
    }
     
 
     let valorOriginal = parseFloat(transactionAmount);
     let valorFinal = valorOriginal;
     let parcelasPermitidas = 12;
     let parcelasSolicitadas = parseInt(installments) || 1;

// abaixo de 380 → somente 1x
if (valorFinal < 380 && parcelasSolicitadas > 1) {
  return res.status(400).json({
    erro: 'Parcelamento disponível apenas para compras acima de R$ 380,00'
  });
}

if (valorOriginal >= 380 && valorOriginal < 600) {
  parcelasPermitidas = 4;

  if (parcelasSolicitadas > 1) {
    valorFinal = valorOriginal * 2.50;
  }
}

if (valorOriginal >= 600) {
  parcelasPermitidas = 7;
}

if (parcelasSolicitadas > 1) {
    valorFinal = valorOriginal * 2.50;
 
    if (parcelasSolicitadas > parcelasPermitidas) {
  return res.status(400).json({
    erro: `Máximo permitido para esse valor: ${parcelasPermitidas}x`
  });

  }


}

const paymentData = {
  transaction_amount: Number(valorFinal.toFixed(2)),
  token,
  description: 'Orçamento de Serviços',
  installments: parcelasSolicitadas,
  payment_method_id: paymentMethodId,
  payer: {
    email,
    identification: {
      type: identificationType,
      number: identificationNumber
    },
    first_name: cardholderName
      ? (cardholderName.split(' ')[0] || cardholderName)
      : 'Cliente',
    last_name: cardholderName
      ? (cardholderName.split(' ').slice(1).join(' ') || cardholderName)
      : 'Não informado'
  }
};
    const issuerId = issuer_id || issuer;
    if (issuerId) {
      paymentData.issuer_id = parseInt(issuerId);
    }

    const payment = await makePaymentRequest(paymentData);
    console.log('Payment criado com cartão:', payment.id);

    return res.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      statusDetail: payment.status_detail
    });
    }  catch (erro) {
    console.error('ERRO ao processar pagamento com cartão:', JSON.stringify(erro, null, 2));
    return res.status(400).json({
      erro: 'Erro ao processar pagamento',
      detalhes: erro.message || erro.error || JSON.stringify(erro)
    });
  }
});

// ===== NOVA ROTA: Processar pagamento com Pix =====
app.post('/process_payment_pix', async (req, res) => {
  try {
    const {
      payerFirstName,
      payerLastName,
      email,
      identificationType,
      identificationNumber,
      transactionAmount
    } = req.body;

    console.log('Recebido pagamento com Pix:', { email, amount: transactionAmount });

    if (!email || !transactionAmount) {
      return res.status(400).json({ erro: 'Dados incompletos para pagamento' });
    }

    const paymentData = {
      transaction_amount: parseFloat(transactionAmount),
      description: 'Orçamento de Serviços - Pix',
      payment_method_id: 'pix',
      payer: {
        email,
        first_name: payerFirstName,
        last_name: payerLastName,
        identification: {
          type: identificationType,
          number: identificationNumber
        }
      }
    };

    const payment = await makePaymentRequest(paymentData);
    console.log('Payment criado com Pix:', payment.id);

    return res.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      ticketUrl: payment.point_of_interaction?.transaction_data?.ticket_url,
      qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64
    });
  } catch (erro) {
    console.error('ERRO ao processar pagamento com Pix:', JSON.stringify(erro, null, 2));
    return res.status(400).json({
      erro: 'Erro ao processar pagamento',
      detalhes: erro.message || erro.error || JSON.stringify(erro)
    });
  }
});

// ===== NOVA ROTA: Processar pagamento com Boleto =====
app.post('/process_payment_boleto', async (req, res) => {
  try {
    const {
      payerFirstName,
      payerLastName,
      email,
      identificationType,
      identificationNumber,
      zipCode,
      streetName,
      streetNumber,
      neighborhood,
      city,
      state,
      transactionAmount
    } = req.body;

    console.log('Recebido pagamento com Boleto:', { email, amount: transactionAmount });

    if (!email || !transactionAmount || !zipCode || !streetName || !city || !state) {
      return res.status(400).json({ erro: 'Dados incompletos para pagamento' });
    }

    const paymentData = {
  transaction_amount: Number(parseFloat(transactionAmount).toFixed(2)),
  description: 'Orçamento de Serviços - Boleto',
  payment_method_id: 'bolbradesco',
  payer: {
    email,
    first_name: payerFirstName.trim(),
    last_name: payerLastName.trim(),
    identification: {
      type: identificationType,
      number: identificationNumber
    },
    address: {
      zip_code: zipCode,
      street_name: streetName,
      street_number: streetNumber || 'S/N',
      neighborhood: neighborhood || 'Centro',
      city,
      federal_unit: state
    }
  }
};
    console.log(
  'Boleto enviado:',
  JSON.stringify(paymentData, null, 2)
);

    const payment = await makePaymentRequest(paymentData);
    console.log('Payment criado com Boleto:', payment.id);

    return res.json({
      success: true,
      paymentId: payment.id,
      status: payment.status,
      ticketUrl: payment.transaction_details?.external_resource_url,
      barcode: payment.barcode?.content
    });
  } catch (erro) {
    console.error('ERRO ao processar pagamento com Boleto:', JSON.stringify(erro, null, 2));
    return res.status(400).json({
      erro: 'Erro ao processar pagamento',
      detalhes: erro.message || erro.error || JSON.stringify(erro)
    });
  }
});

// Endpoint para retornar a PUBLIC KEY
app.get('/api/public-key', (req, res) => {
  if (!publicKey) {
    return res.status(500).json({ erro: 'Chave pública não configurada' });
  }
  res.json({ publicKey });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Erro: porta ${PORT} já está em uso. Pare o processo que está usando essa porta ou altere a variável PORT.`);
  } else {
    console.error('Erro ao iniciar o servidor:', error);
  }
  process.exit(1);
});

