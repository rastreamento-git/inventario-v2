# Invent Front — Estoque Pro 1.3

Interface React/Vite para matriz, técnicos, instalações, triagem, compras e rastreabilidade global. Use com `invent-back/` desta mesma entrega. Node.js 24.x.

## Local

```bash
npm ci --include=dev
npm run dev
```

O Vite escuta normalmente em http://localhost:5173 e encaminha `/api` para o backend em http://localhost:3000. `API_PROXY_TARGET` permite mudar esse destino no desenvolvimento. Veja `.env.example`.

## Vercel

Root Directory: `invent-front`. Install Command: `npm ci --include=dev`. Build Command: `npm run build`. Output Directory: `dist`. Node.js: `24.x`.

Configure `VITE_API_URL=https://SEU-BACKEND/api` antes do build e inclua a origem exata do frontend em `CORS_ORIGINS` do backend. O arquivo `vercel.json` fixa os comandos de instalação e build. Nunca coloque variáveis de banco, senhas ou segredos em `VITE_*`.

## Interface e acesso

O login aceita usuário e senha. A sessão fica em sessionStorage e dura até oito horas. O administrador inicial usa `admin` e a senha de APP_PASSWORD; as contas posteriores são armazenadas no banco.

A rastreabilidade global usa busca e paginação do servidor e inclui arquivados e cancelados com histórico. A triagem tem fluxo independente de recebimento e avaliação. Confirmações usam diálogos, com ações identificadas e mensagens de erro na interface.

O cabeçalho permite pesquisar equipamentos e reconhecer os atalhos administrativos `thereisnourflevel` (reset) e `zenpoweradd` (usuários). Os painéis dependem do perfil de administrador e de autorização no backend. O botão de download abre backup e restauração locais.

## Scanner

O leitor usa zxing-wasm 3.1.5 em Web Worker. O Vite publica o WASM no próprio domínio. Modos QR/Barras/Automático analisam o quadro inteiro, preferindo captura em 1080p quando disponível. Leituras são confirmadas em dois ou três quadros conforme o formato; fotos usam o mesmo motor. Veja `SCANNER_RAPIDO.md`.

O leitor e os gráficos são carregados sob demanda. A câmera precisa de HTTPS ou localhost e de permissão do navegador. Publique todos os assets do build, incluindo o WASM e o worker.

## Qualidade

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Os testes incluem tratamento de seriais, scanner, agrupamento de compras, URL de API e reconhecimento dos códigos. Os fluxos administrativos foram verificados no navegador com a API real e um banco temporário.
