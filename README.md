# Inventário v2 — Estoque Pro 1.3

Projeto com frontend React/Vite e API Express/PostgreSQL. Os arquivos de aplicação ficam exclusivamente em `invent-front/` e `invent-back/`.

## Nesta atualização

- Rastreabilidade global separada da triagem: lista equipamentos atuais, arquivados e cancelados com histórico registrado.
- Busca por IMEI/serial, modelo, tipo, técnico e operador; filtros e paginação no servidor.
- Histórico individual com horário, situação, técnico e usuário responsável pelas novas movimentações.
- Interface adaptada ao celular, atalhos de busca, detalhes em diálogo, feedback de operações e confirmações dentro do aplicativo.
- Contas individuais com perfis Administrador e Operador, cadastro, ativação/desativação e troca de senha.
- Backup local do inventário em JSON e restauração transacional.
- Reset com confirmação, senha de administrador e backup do estado atual. Um inventário alterado depois do backup exige novo download.
- Leitor de QR e códigos de barras da revisão anterior preservado, com WASM local e processamento em Web Worker.

## Aplicar ao repositório e publicar

Siga [LEIA-ME.md](LEIA-ME.md). É necessário atualizar as duas pastas e publicar o backend antes do frontend. A migração desta atualização cria contas, auditoria administrativa e a coluna de operador; ela não limpa o inventário.

Documentação específica: [backend](invent-back/README.md), [frontend](invent-front/README.md) e [leitor](invent-front/SCANNER_RAPIDO.md).

## Atalhos administrativos

Entre como administrador e digite ou cole no campo de busca do cabeçalho:

| Código | Ação |
| --- | --- |
| `thereisnourflevel` | Abre o diálogo de reset |
| `zenpoweradd` | Abre o cadastro e gerenciamento de usuários |

O painel também reconhece a sequência digitada fora de campos de formulário no computador. O código apenas abre o painel: autorização é conferida no servidor pelo perfil da conta.

O ícone de download do cabeçalho abre os backups. O reset pode limpar todo o inventário ou somente os seriais, saldos e movimentações, mantendo modelos e técnicos. Em ambos os casos preserva contas e auditoria administrativa.

## Dados antigos e backups

A listagem inclui os seriais presentes no cadastro e identidades encontradas no histórico individual. Dados apagados pela versão antiga sem histórico não podem ser reconstruídos automaticamente. Movimentações antigas podem não ter operador identificado.

O JSON exporta modelos, técnicos, seriais, saldos, movimentações e eventos individuais. Não exporta contas, hashes de senha, segredos do ambiente nem auditoria administrativa. Para um backup completo de infraestrutura e autenticação, mantenha também o backup PostgreSQL do provedor.

A restauração valida formato, integridade e relações no banco antes de concluir a transação. Ela substitui o inventário atual e preserva os acessos. O aplicativo limita a seleção de backup a 25 MB.

## Verificação

Frontend: `npm test`, `npm run lint`, `npm run format:check`, `npm run build`.
Backend: `npm test`, `npm run check`.

Testes de banco locais usam PGlite (PostgreSQL em WASM). Para testar múltiplas conexões, configure `TEST_DATABASE_URL` com um PostgreSQL exclusivo para testes. Nunca use produção nessa variável. O navegador também foi validado com o build de produção e um banco temporário, incluindo download, reset e restauração.


A integração de homologação com o ZenControl admite reinstalação com reaproveitamento. `POST /api/integrations/zencontrol/reusable-items` consulta exclusivamente os códigos enviados; `POST /installations` aceita `reuse: true` para aparelhos já instalados. O recibo é idempotente, registra o evento de reinstalação e preserva os saldos de carga, sem uma segunda movimentação de uso final. A confirmação física do equipamento/veículo é feita pela central na conferência das evidências. O segredo da integração continua restrito aos backends.
