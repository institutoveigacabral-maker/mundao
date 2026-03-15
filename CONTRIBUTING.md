# Contributing

## Branch Naming

- `feat/` — nova funcionalidade
- `fix/` — correção de bug
- `chore/` — manutenção, dependências, CI
- `docs/` — documentação
- `refactor/` — refatoração sem mudança de comportamento
- `test/` — adição ou correção de testes

Exemplo: `feat/add-health-endpoint`

## Commit Convention

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(escopo): descrição curta

corpo opcional

Co-Authored-By: Nome <email>
```

Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `style`, `perf`

## Pull Request

1. Crie uma branch a partir de `main`
2. Faça commits seguindo a convenção acima
3. Abra um PR com descrição clara do que foi feito
4. Aguarde a CI passar (lint + typecheck + build + tests)
5. Solicite review

### PR Template

```markdown
## O que mudou
- Descrição das alterações

## Como testar
- Passos para validar as mudanças

## Checklist
- [ ] Testes adicionados/atualizados
- [ ] CI passando
- [ ] Sem breaking changes (ou documentado)
```

## Code Review Checklist

- [ ] Código segue os padrões do projeto
- [ ] Testes cobrem os casos relevantes
- [ ] Sem secrets ou credenciais expostas
- [ ] Performance considerada
- [ ] Sem dependências desnecessárias

## Setup Local

```bash
git clone <repo-url>
cd <repo>
npm install  # ou pnpm install
cp .env.example .env.local
npm run dev
```

## Testes

```bash
npm test          # rodar todos os testes
npm run test:watch # modo watch
```

