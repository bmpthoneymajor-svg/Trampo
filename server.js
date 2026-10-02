const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// ======================================================
// CONFIGURAÇÃO DO PAYPAL
// ======================================================

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_ENVIRONMENT =
  (process.env.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase();

if (!PAYPAL_CLIENT_ID) {
  throw new Error('PAYPAL_CLIENT_ID não configurado na Railway.');
}

if (!PAYPAL_CLIENT_SECRET) {
  throw new Error('PAYPAL_CLIENT_SECRET não configurado na Railway.');
}

// URL da API do PayPal
const PAYPAL_API =
  PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

console.log('==========================================');
console.log('      CONFIGURAÇÃO DO PAYPAL');
console.log('==========================================');
console.log(
  `Ambiente PayPal: ${
    PAYPAL_ENVIRONMENT === 'production' ? 'PRODUÇÃO' : 'SANDBOX'
  }`
);
console.log(
  `Client ID configurado: ${PAYPAL_CLIENT_ID.substring(0, 12)}...`
);
console.log('Client Secret configurado: SIM');
console.log(`API PayPal: ${PAYPAL_API}`);
console.log('==========================================');

// ======================================================
// OBTER ACCESS TOKEN DO PAYPAL
// ======================================================

async function generateAccessToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',

    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },

    body: 'grant_type=client_credentials'
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Erro ao obter Access Token do PayPal:');
    console.error(JSON.stringify(data, null, 2));

    throw new Error(
      data.error_description ||
      data.error ||
      'Não foi possível autenticar no PayPal.'
    );
  }

  return data.access_token;
}

// ======================================================
// CRIAR PEDIDO PAYPAL
// ======================================================

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { valor } = req.body;

    console.log('------------------------------------------');
    console.log('CRIANDO PEDIDO PAYPAL');
    console.log('Valor recebido:', valor);

    const valorNumerico = Number(valor);

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({
        erro: 'Valor inválido.'
      });
    }

    const valorFormatado = valorNumerico.toFixed(2);

    const accessToken = await generateAccessToken();

    const orderData = {
      intent: 'CAPTURE',

      purchase_units: [
        {
          description: 'Orçamento de Serviços - BT Design',

          amount: {
            currency_code: 'BRL',
            value: valorFormatado
          }
        }
      ]
    };

    console.log(
      'Dados enviados ao PayPal:',
      JSON.stringify(orderData, null, 2)
    );

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'return=representation'
        },

        body: JSON.stringify(orderData)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao criar pedido PayPal:');
      console.error(JSON.stringify(data, null, 2));

      return res.status(response.status).json({
        erro: 'Erro ao criar pedido no PayPal.',
        detalhes: data
      });
    }

    console.log('Pedido PayPal criado:', data.id);
    console.log('Status:', data.status);

    return res.json({
      success: true,
      id: data.id,
      status: data.status
    });

  } catch (erro) {
    console.error('ERRO AO CRIAR PEDIDO PAYPAL:');
    console.error(erro);

    return res.status(500).json({
      erro: 'Erro interno ao criar pedido PayPal.',
      detalhes: erro.message
    });
  }
});

// ======================================================
// CAPTURAR PEDIDO PAYPAL
// ======================================================

app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID } = req.body;

    console.log('------------------------------------------');
    console.log('CAPTURANDO PEDIDO PAYPAL');
    console.log('Order ID:', orderID);

    if (!orderID) {
      return res.status(400).json({
        erro: 'Order ID não informado.'
      });
    }

    const accessToken = await generateAccessToken();

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'return=representation'
        },

        body: JSON.stringify({})
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao capturar pedido PayPal:');
      console.error(JSON.stringify(data, null, 2));

      return res.status(response.status).json({
        erro: 'Erro ao capturar pagamento PayPal.',
        detalhes: data
      });
    }

    console.log('------------------------------------------');
    console.log('PAGAMENTO PAYPAL PROCESSADO');
    console.log('Order ID:', data.id);
    console.log('Status:', data.status);

    // O pagamento normalmente deve chegar como COMPLETED
    if (data.status === 'COMPLETED') {
      console.log('PAGAMENTO APROVADO COM SUCESSO!');
    }

    return res.json({
      success: true,
      orderID: data.id,
      status: data.status,
      detalhes: data
    });

  } catch (erro) {
    console.error('ERRO AO CAPTURAR PAGAMENTO PAYPAL:');
    console.error(erro);

    return res.status(500).json({
      erro: 'Erro interno ao capturar pagamento PayPal.',
      detalhes: erro.message
    });
  }
});

// ======================================================
// VERIFICAR PEDIDO PAYPAL
// ======================================================

app.get('/api/paypal/order/:orderID', async (req, res) => {
  try {
    const { orderID } = req.params;

    if (!orderID) {
      return res.status(400).json({
        erro: 'Order ID não informado.'
      });
    }

    const accessToken = await generateAccessToken();

    const response = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}`,
      {
        method: 'GET',

        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        erro: 'Não foi possível consultar o pedido.',
        detalhes: data
      });
    }

    return res.json(data);

  } catch (erro) {
    console.error('Erro ao consultar pedido PayPal:', erro);

    return res.status(500).json({
      erro: 'Erro interno ao consultar pedido.',
      detalhes: erro.message
    });
  }
});

// ======================================================
// PÁGINAS DE RETORNO
// ======================================================

app.get('/sucesso', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Pagamento aprovado</title>
    </head>

    <body>
      <h1>Pagamento aprovado!</h1>
      <p>Obrigado pela sua compra.</p>
      <p>Seu pagamento foi processado com sucesso.</p>
      <a href="/">Voltar ao site</a>
    </body>
    </html>
  `);
});

app.get('/falha', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Pagamento não concluído</title>
    </head>

    <body>
      <h1>Pagamento não concluído</h1>
      <p>O pagamento não foi realizado.</p>
      <a href="/">Voltar ao site</a>
    </body>
    </html>
  `);
});

// ======================================================
// STATUS DA API
// ======================================================

app.get('/api/status', (req, res) => {
  res.json({
    online: true,
    pagamento: 'PayPal',
    ambiente: PAYPAL_ENVIRONMENT,
    paypalConfigured: true
  });
});

// ======================================================
// FRONTEND
// ======================================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ======================================================
// SERVIDOR
// ======================================================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('==========================================');
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${PAYPAL_ENVIRONMENT}`);
  console.log('Pagamento: PAYPAL');
  console.log('==========================================');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Erro: porta ${PORT} já está em uso.`
    );
  } else {
    console.error('Erro ao iniciar servidor:', error);
  }

  process.exit(1);
});