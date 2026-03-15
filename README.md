# Mundo Rao -- Super-App Marketplace

![CI](https://github.com/institutoveigacabral-maker/mundao/actions/workflows/ci.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Super-app marketplace do ecossistema Mundo Rao. Plataforma completa com catalogo de produtos, carrinho de compras, carteira digital, historico de pedidos e autenticacao OAuth.

## Stack

- Hono (API / Cloudflare Workers)
- React + Vite + TypeScript
- Zod (validacao)
- D1 Database (Cloudflare)

## Funcionalidades

- Marketplace com categorias e busca
- Carrinho de compras com calculo automatico
- Carteira digital com historico de transacoes
- Perfil do usuario com autenticacao OAuth
- API RESTful com validacao Zod

## Setup Local

```bash
git clone https://github.com/institutoveigacabral-maker/mundao.git
cd mundao
npm install
cp .env.example .env.local  # configurar variaveis
npm run dev
```

## Testes

```bash
npm test
```

27 testes cobrindo logica de negocio, validacoes e utilitarios.



## Contributing

Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenca

MIT -- ver [LICENSE](LICENSE).
