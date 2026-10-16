# Estoque Pro — homologação integrada

Esta branch parte de `feat/zencontrol-installation` (PR [#4](https://github.com/rastreamento-git/inventario-v2/pull/4)), revisado e exercitado antes da extensão. Não houve merge na principal, alteração de banco produtivo ou deploy.

Acrescenta leitura autenticada da carga com estado/data e `GET /api/integrations/zencontrol/technicians/:id/history?page=1`. O histórico tem páginas de 50 eventos, categoria/modelo/serial/estados e OS ligada ao recibo de instalação. O mesmo segredo entre servidores protege as rotas. Técnicos continuam sem acesso direto a essas credenciais ou ao banco.

O contrato de instalação do PR #4 permanece atômico e idempotente. Os cenários de autenticação, carga errada, modelo, repetição concorrente, resposta perdida e preservação do recibo são mantidos. As funções existentes de entrada, carga, instalação, devolução, triagem, rastreabilidade, perfis e backup são preservadas.

O ZenField registra solicitações de reposição/recebimento/devolução/transferência; a decisão central não executa esses movimentos automaticamente. Eles são registrados nos fluxos oficiais deste sistema e conferidos no histórico. O contrato automático disponível no adaptador continua sendo instalação.

Para iniciar os três sistemas com dois bancos PostgreSQL WASM locais persistentes, dados fictícios e arquivos de etiquetas/checklist, siga [HOMOLOGACAO.md do ZenControl](https://github.com/rastreamento-git/zencontrol/blob/feat/ecossistema-homologacao/HOMOLOGACAO.md). O inicializador carrega o backend deste repositório oficial, sem apontar para Aiven ou produção. Node.js 24 e dependências de `invent-back`/`invent-front` são necessários.

Validação isolada:

```bash
cd invent-back
npm ci --include=dev
npm run check
npm test
cd ../invent-front
npm ci --include=dev
npm run lint
npm test
VITE_API_URL=http://127.0.0.1:4318 npm run build
```

Por padrão, os testes usam PostgreSQL WASM/PGlite. O workflow de backend usa PostgreSQL 17 com banco de CI próprio. Não apontar `TEST_DATABASE_URL` para produção. A branch de homologação tem deploy automático Vercel desabilitado, inclusive em `invent-front/vercel.json`, diretório usado pelo projeto conectado.

O PR complementar desta branch tem como base o PR #4. Revisar/autorizar a integração dos dois antes de qualquer migração produtiva. A migração 003 e a configuração de segredo do PR #4 continuam necessárias para uma implantação futura autorizada; não foram executadas em produção nesta entrega.
