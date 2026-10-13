# Invent Back — Estoque Pro

API Express/PostgreSQL para usar com `rastreamento-git/invent-front` da mesma entrega.
Node.js 24 recomendado (mínimo 22.12). Banco PostgreSQL 16 ou superior recomendado.

## Instalação local

```bash
npm ci
```

Copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
Para PostgreSQL local use `DATABASE_SSL=disable`. Para nuvem prefira `verify-full`
e forneça `DATABASE_CA` se o provedor usa uma CA própria. `require` é uma opção
explícita de compatibilidade com TLS sem verificar o certificado; não é o padrão.

```bash
npm run migrate
npm run reconcile
npm start
```

A API escuta na porta 3000 por padrão. `/healthz` verifica a conexão com o banco.
Em um banco novo não há produtos nem técnicos: cadastre-os pela interface.

## Atualização de banco existente

Faça backup e teste numa cópia antes de atualizar a produção. Não havia um DDL
versionado no repositório original; a migração preserva as tabelas existentes e
assume as colunas já utilizadas pela API anterior. Ela adiciona `arquivado`,
a tabela `eventos_seriais`, índices e controle de migrações. Não apaga o estoque
nem altera automaticamente os saldos antigos.

1. Pare a API antiga para evitar gravações enquanto atualiza/reconcilia o banco.
2. Execute `npm run migrate`.
3. Execute `npm run reconcile` para conferir diferenças entre saldos e seriais.
4. Se todos os equipamentos físicos estiverem cadastrados por serial, execute
   `npm run reconcile -- --apply` para recalcular os saldos. Se havia estoque
   apenas em quantidade, cadastre/valide os seriais faltantes antes de aplicar.
5. Inicie esta API e publique o frontend revisado em conjunto.

A reconciliação usa os seriais como fonte do saldo. Dados com modelo, técnico ou
status inválido exigem correção manual. Os registros legados de movimentação
continuam disponíveis, mas não contêm a lista de IMEIs; somente as novas operações
gravadas nesta versão possuem histórico individual por serial. IMEIs excluídos
pela limpeza antiga não podem ser recuperados a partir destes repositórios.

## Produção e Render

Build: `npm ci`. Start: `npm run migrate && npm start`. Health check: `/healthz`.
Defina no ambiente do serviço:

| Variável | Uso |
| --- | --- |
| NODE_ENV | `production` |
| DATABASE_URL | URL privada do PostgreSQL |
| DATABASE_SSL | `verify-full`; `disable` somente em conexão local/interna sem TLS |
| DATABASE_CA | Certificado CA do provedor, se necessário, com `\n` entre linhas |
| CORS_ORIGINS | Domínios exatos do frontend, separados por vírgula, sem `/` final |
| APP_PASSWORD | Senha de acesso com no mínimo 12 caracteres |
| SESSION_SECRET | Segredo aleatório com no mínimo 32 caracteres |
| TRUST_PROXY | `1` somente quando houver um proxy confiável na frente da API |
| PORT | Normalmente fornecida automaticamente pela hospedagem |

Gere o segredo com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
Configure os segredos no painel da hospedagem, nunca no GitHub nem no frontend.
O container do backend exige o banco já migrado; o Compose da entrega executa a
migração antes de `npm start`.

## Contrato e regras

As rotas anteriores permanecem, com as seguintes correções:

- `entrada`, `transferir`, `instalar`, `estorno` e `triagem/receber` aceitam de 1 a
  1.000 seriais em texto. Preservam zeros iniciais, validam o lote inteiro e
  devolvem 400/404/409 para dados inválidos, ausentes ou em conflito.
- Um serial já cadastrado faz a entrada inteira falhar com 409. Não há entrada
  parcial nem aumento do saldo por duplicados. Atualize a lista antes de repetir
  uma operação após timeout.
- Todas as gravações de estoque usam uma única conexão de transação e um lock
  transacional compartilhado entre instâncias. As gravações são serializadas,
  adequado ao volume de um inventário administrativo; reavaliar para alta carga.
- Transferência/baixa/devolução conferem modelo, técnico e estado de cada serial.
  A devolução do técnico só aceita `TECNICO`. Instalados retornam por triagem.
- Receber em triagem desconta o saldo de origem. Aprovar/reprovar exige estado
  `TRIAGEM`; repetir a avaliação não aumenta o estoque novamente.
- `GET /api/imeis` inclui `produto_id` e `tecnico_id`; comparação por nomes não é
  necessária. `?incluir_arquivados=true` inclui os instalados arquivados.
- `GET /api/imeis/:codigo/historico` consulta o histórico individual.
- `DELETE /api/limpeza-instalados` **arquiva**, não exclui, instalados com mais de
  30 dias. Resposta: `arquivados`, `apagados: 0`. A identidade permanece única.
- Correção de entrada na matriz remove o serial, mas conserva a auditoria do
  cancelamento. Modelos com equipamentos ou histórico não podem ser excluídos.
- `PUT /api/configurar-alerta` também aceita `tipo: CATEGORIA`, para atualizar todos
  os modelos da categoria numa única transação. Limite zero é válido.
- O dashboard usa o fuso America/Sao_Paulo nas conexões e inclui os sete dias,
  inclusive sem instalações. O desempenho da equipe representa os últimos 30 dias.
- Compras mantêm a fórmula de consumo médio: ponto de pedido = 22,5 dias de
  consumo e meta = 52,5 dias, respeitando o mínimo cadastrado. Valores são inteiros.

## Acesso

`POST /api/auth/login` recebe `{ "password": "..." }` e devolve um token de sessão
assinado, válido por oito horas. Envie `Authorization: Bearer TOKEN` nas consultas
e gravações. `GET /api/auth/session` informa se a sessão está autenticada.
Há limite de tentativas de login. Em produção a API se recusa a iniciar sem
configuração de acesso. Em desenvolvimento, sem APP_PASSWORD, o acesso é livre.

É acesso administrativo por senha compartilhada, não um sistema de contas ou RBAC.
Trocar SESSION_SECRET invalida todos os tokens; trocar só APP_PASSWORD não revoga
as sessões existentes. A limitação de login usa memória por instância; para muitas
instâncias, adote um armazenamento compartilhado e autenticação individual.

## Testes

```bash
npm run check
npm test
npm audit --omit=dev
```

Por padrão os testes usam PGlite, que executa SQL PostgreSQL em WASM, sem depender
do banco de produção. Para testar conexões concorrentes de verdade use um banco
**exclusivo de teste**:

```bash
TEST_DATABASE_URL=postgresql://... npm test
```

Esse modo cria e remove esquemas temporários, nunca deve apontar para produção.
O workflow de GitHub Actions incluído usa PostgreSQL 16 real. O teste local com
PGlite possui uma conexão e enfileira acessos; não reproduz a concorrência de
várias conexões. A entrega foi validada localmente com PGlite e navegador; não
houve acesso ao banco ou à hospedagem do projeto em produção.
