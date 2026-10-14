# inventario-v2 — revisão e leitor de câmera

Esta entrega corrige a API e substitui o leitor por captura em alta resolução e decodificação local com confirmação em três quadros. Leia REVISAO.md para as falhas, mudanças, testes e limitações.

## Atualizar

1. Copie os arquivos da entrega para seu projeto. Preserve suas variáveis reais de ambiente. O ZIP contém código-fonte e exemplos, sem node_modules ou dist.
2. No frontend (`invent-front`), execute `npm ci --include=dev`, `npm test` e `npm run build`.
3. No backend (`invent-back`), execute `npm ci`, `npm test` e `npm run check`.
4. Publique as duas pastas no GitHub e faça os redeploys nos serviços já configurados.

Vercel: Root Directory `invent-front`; instalação `npm ci --include=dev`; build `npm run build`; saída `dist`; Node >=22.12. Configure `VITE_API_URL=https://SEU-BACKEND.onrender.com/api` antes do build. O build inclui automaticamente o worker e o WASM em assets; publique todo o dist.

Render: Root Directory `invent-back`; build `npm ci`; start `npm run migrate && npm start`; health check `/healthz`. Preserve DATABASE_URL, DATABASE_SSL, CORS_ORIGINS, APP_PASSWORD e SESSION_SECRET já configurados. CORS_ORIGINS deve incluir o domínio exato da Vercel. Não há nova migração nesta revisão; a inicialização mantém a migração existente.

## Conferir a câmera após publicar

- Abra a aplicação por HTTPS no Chrome/Edge ou navegador móvel e entre em Entrada na matriz.
- Clique em Usar câmera e permita acesso. No celular, a escolha automática prefere a traseira.
- Use Automático para ambos os formatos ou escolha QR/Barras para isolar símbolos de uma etiqueta composta.
- Mantenha o código nítido e inteiro na área indicada. Aguarde a confirmação em três quadros e confira o serial incluído antes de salvar.
- Para reflexos, ajuste distância/iluminação. Use zoom/lanterna se disponíveis. Câmeras de foco fixo não podem ganhar autofocus por software.
- Pause e feche a câmera; confirme que o indicador de uso do navegador apaga. Confira também troca de câmera, reabertura e importação por foto.

Para desenvolver localmente, copie .env.example em cada pasta para .env, configure o banco, rode a migração e `npm start` no backend e `npm run dev` no frontend. O Vite encaminha /api para localhost:3000. Os READMEs de cada pasta detalham a configuração existente.

O arquivo invent-front/vercel.json fixa a instalação incluindo devDependencies, necessária para Vite e seus plugins, mesmo com NODE_ENV=production. Configure Root Directory no painel da Vercel: invent-front (ou a pasta que contém o package.json do frontend, se você publicou apenas essa pasta). Se o projeto usa uma pasta extra inventario-v2 no GitHub, use inventario-v2/invent-front. Depois faça Redeploy sem usar o cache anterior.
