# Mundo Rão

Super-app marketplace do ecossistema Mundo Rão. Inclui marketplace com categorias, carrinho de compras, carteira digital, histórico de pedidos e perfil do usuário com autenticação.

## Tech Stack

- React 19 + TypeScript
- Vite + Cloudflare Workers (Hono)
- Tailwind CSS
- React Router
- Lucide React (ícones)

## Como rodar

```bash
git clone https://github.com/institutoveigacabral-maker/mundao.git
cd mundao
npm install
npm run dev
```

## Estrutura

```
src/
  react-app/       # Frontend React (Home, Marketplace, Product, Cart, Wallet, Orders, Profile)
  shared/          # Tipos e utilitários compartilhados
  worker/          # Backend Hono (Cloudflare Workers)
```
