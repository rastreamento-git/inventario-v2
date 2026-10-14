# Implantação — inventário v2 1.3

## 1. Atualize as pastas corretas no GitHub

Extraia o ZIP. Copie `invent-back/` e `invent-front/` para as pastas com os mesmos nomes no repositório, mantendo todas as subpastas.

Exemplos de caminhos obrigatórios:

- `invent-back/src/app.js`, `invent-back/src/auth.js`, `invent-back/src/admin.js` e `invent-back/src/trace.js`.
- `invent-back/migrations/002_users_admin.sql`.
- `invent-front/src/App.jsx` e `invent-front/src/components/AdminTools.jsx`.
- `invent-front/src/components/Traceability.jsx` e `invent-front/src/lib/session.jsx`.
- `invent-front/src/lib/scanner.worker.js`, além dos demais arquivos do leitor.
- `package.json` e `package-lock.json` de cada pasta.

Não coloque `app.js`, `App.jsx` ou os demais arquivos dessas pastas diretamente na raiz. Os serviços usam os caminhos dentro de `invent-back` e `invent-front`.

## 2. Publique primeiro o backend no Render

| Configuração | Valor |
| --- | --- |
| Root Directory | `invent-back` |
| Build Command | `npm ci` |
| Start Command | `npm run migrate && npm start` |
| Health Check Path | `/healthz` |
| Node.js | `24.x`, fixado no package.json e .node-version |

Preserve `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_CA`, `APP_PASSWORD`, `SESSION_SECRET` e os domínios corretos em `CORS_ORIGINS`. Configure `NODE_ENV=production`. Caso já exista `NODE_VERSION` no Render, use uma versão da linha 24 para acompanhar esta entrega.

O comando de migração adiciona as tabelas de contas e auditoria e a coluna de operador. Não executa reset. A inicialização cria o primeiro administrador somente se não houver contas: login `admin` e a senha já configurada em `APP_PASSWORD`. `APP_ADMIN_USER` permite definir outro login inicial.

Depois de criar contas, as senhas passam a ser mantidas no banco. Alterar apenas `APP_PASSWORD` no ambiente não troca a senha de uma conta existente. O painel de usuários permite alterar senhas. As sessões da versão anterior exigem novo login.

## 3. Publique o frontend na Vercel

| Configuração | Valor |
| --- | --- |
| Root Directory | `invent-front` |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x` |

Preserve `VITE_API_URL` apontando para a sua API, por exemplo `https://SEU-BACKEND.onrender.com/api`. Vite precisa das dependências de desenvolvimento para construir o frontend. O `vercel.json` fornecido já define instalação, build e saída.

No Render, `CORS_ORIGINS` deve conter a origem exata utilizada pelo frontend, com `https://` e sem barra final. Se usar domínio de produção e domínio de preview, liste ambos separados por vírgula. Após alterar uma variável `VITE_*`, gere novo deploy do frontend.

## 4. Use a nova rastreabilidade

Entre com o administrador inicial e abra **Rastreabilidade global**. A tela reúne todos os equipamentos identificáveis no cadastro e no histórico individual, inclusive arquivados e cancelados. Use os filtros ou clique no serial para ver as movimentações. **Triagem e reuso** tem uma tela própria para receber e avaliar equipamentos.

## 5. Cadastre os usuários

No campo de pesquisa do cabeçalho, digite ou cole `zenpoweradd`. O painel abre ao completar o código. No computador também é possível digitar a sequência fora de campos de formulário.

Informe nome, login, senha de 12 a 128 caracteres e perfil. Operadores consultam e movimentam o inventário. Administradores também gerenciam usuários, backups, restauração e reset. Senhas são armazenadas como hash com sal aleatório; a API não as devolve.

A desativação de uma conta ou a troca de sua senha invalida as suas sessões existentes. O administrador não pode desativar o próprio acesso. Preserve pelo menos um administrador ativo.

## 6. Faça backup, reset ou restauração

O botão de download do cabeçalho abre **Backups locais**. O arquivo JSON é baixado no navegador; confira a pasta Downloads do dispositivo.

Para começar a produção com dados limpos, digite ou cole `thereisnourflevel` no campo de pesquisa. Abrir o diálogo não apaga dados.

1. Clique em **Baixar backup local** e confira o download.
2. Escolha o escopo: limpar todo o inventário (também modelos e técnicos) ou manter modelos e técnicos e limpar apenas estoque, seriais, movimentações e eventos.
3. Digite sua senha atual de administrador.
4. Clique em **Confirmar reset**. Contas, auditoria administrativa e controle de migrações permanecem.

Se o inventário mudar depois do backup, o servidor bloqueia a confirmação e solicita outro download. Você pode cancelar ou fechar o diálogo antes de confirmar.

Para restaurar, abra **Backups locais**, baixe uma cópia do estado atual, selecione o JSON anterior, informe sua senha e confirme **Restaurar backup**. A restauração substitui o inventário em uma única transação e conserva os usuários.

O JSON inclui os dados de inventário e seu histórico; não inclui contas, senhas ou segredos. Ele não substitui um backup completo do PostgreSQL. Guarde o arquivo em um local protegido, pois contém os seriais e as movimentações.

## Verificações desta entrega

- 27 testes de backend e 48 testes de frontend.
- Análise estática e build de produção do frontend.
- Fluxos de navegador em computador e celular: busca, filtros, histórico, cadastro, permissões, download, reset e restauração.
- Reset e restauração executados exclusivamente em banco temporário de teste.

Esta entrega contém o código-fonte. Ela não altera seu banco de produção nem publica automaticamente nos serviços.
