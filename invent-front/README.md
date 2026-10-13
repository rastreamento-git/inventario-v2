# Invent Front — Estoque Pro

Interface React/Vite para matriz, técnicos, IMEIs, instalações, triagem e compras.
Use em conjunto com `rastreamento-git/invent-back` da mesma entrega.

## Local

Node.js 24 recomendado (mínimo 22.12).

```bash
npm ci
```

Copie `.env.example` para `.env`. Inicie o backend na porta 3000 e execute:

```bash
npm run dev
```

Acesse http://localhost:5173. O proxy do Vite encaminha `/api` para o backend.
Se o backend tiver `APP_PASSWORD`, a interface solicita a senha. Em desenvolvimento,
a API pode funcionar sem senha; em produção ela exige senha e segredo de sessão.

## Nuvem

Hospedagem estática: comando de build `npm ci && npm run build`, diretório `dist`.
Configure `VITE_API_URL=https://SEU-BACKEND/api` **antes do build** e inclua o domínio
exato do frontend em `CORS_ORIGINS` no backend. Para preservar o serviço do projeto
original, o endereço anteriormente usado era `https://estoque-api-7l82.onrender.com/api`;
confirme que ele continua sendo o seu backend antes de usá-lo.

Não coloque DATABASE_URL, APP_PASSWORD ou SESSION_SECRET em variáveis `VITE_*`.
Após mudar VITE_API_URL, gere um novo build. Câmera: HTTPS ou localhost e permissão
do navegador. O container fornecido usa `/api` com proxy para um serviço chamado
`backend`; é destinado ao Compose que acompanha a entrega. Para hospedagem
estática separada use `dist`, não esse proxy Nginx.

## Qualidade

```bash
npm run lint
npm run format:check
npm test
npm run build
```

O scanner e os gráficos são carregados sob demanda. Há bloqueio durante gravações,
mensagens de erro, atualização manual, comparação por IDs, deduplicação no TXT e
limite de 1.000 seriais por lote. O botão de atualização preserva a seleção dos
itens que continuam disponíveis. O histórico por IMEI passa a ser gravado pelo
backend revisado; eventos anteriores não são reconstruídos artificialmente.

As notificações do navegador são opcionais e ativadas por botão. Os alertas da
interface funcionam mesmo sem suporte a Notification, e incluem estoque zerado.

A sessão fica em sessionStorage, é enviada como Bearer e dura até oito horas.
Sair remove o token deste navegador. A senha é compartilhada: esta versão não
implementa usuários individuais, funções ou permissões por técnico.
