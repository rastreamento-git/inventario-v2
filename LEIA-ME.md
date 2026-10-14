# Estoque Pro 1.4 — atualização do frontend

Esta atualização aplica o visual azul aprovado ao sistema completo. O nome permanece **Estoque Pro** e o rodapé mostra **Desenvolvido por Victor Rodrigues**, inclusive na tela de acesso e no celular.

## Atualizar no GitHub

1. Extraia este ZIP.
2. Na raiz do repositório `rastreamento-git/inventario-v2`, copie a pasta **invent-front** extraída sobre a pasta **invent-front** existente, mantendo as subpastas.
3. Inclua os arquivos novos e os dois manifests: `package.json` e `package-lock.json`.
4. Faça commit na branch usada pela Vercel, normalmente `main`.

Exemplos de caminhos que devem existir após a atualização:

- `invent-front/src/styles/theme.css`
- `invent-front/src/components/AppFooter.jsx`
- `invent-front/src/components/Traceability.jsx`
- `invent-front/src/main.jsx`
- `invent-front/package.json`
- `invent-front/package-lock.json`
- `invent-front/vercel.json`

O arquivo `ARQUIVOS_ALTERADOS.txt` lista as mudanças em relação ao frontend 1.3.0. A pasta fornecida contém o frontend completo, com os componentes, o leitor e os testes.

## Publicar na Vercel

Confira as configurações do seu projeto:

| Configuração | Valor |
| --- | --- |
| Root Directory | `invent-front` |
| Install Command | `npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x` |

Mantenha o valor de **VITE_API_URL** que já aponta para sua API no Render. Preserve também seu `.env` local caso utilize um. O ZIP inclui apenas `.env.example`.

Publique o commit atualizado. Se necessário, gere um novo deploy sem reutilizar o cache. O `vercel.json` já fixa os comandos de instalação e build, incluindo o Vite.

Abra o deployment novo e confira:

1. `invent-front@1.4.0` no log de build.
2. O nome **Estoque Pro**, com o visual azul.
3. **Desenvolvido por Victor Rodrigues** no rodapé.
4. O botão **Localizar pela câmera** na rastreabilidade global.

## Compatibilidade

Este pacote atualiza o frontend sobre a versão 1.3.0, que já inclui usuários, backup, reset e rastreabilidade global. Use o backend 1.3 correspondente, entregue no pacote anterior `inventario-v2-ux-admin.zip`.

Para quem já publicou a versão 1.3, esta entrega não exige alterações no Render nem migração do banco. As consultas e movimentações continuam usando a API configurada no projeto.

## O que mudou

- Identidade azul: navegação em azul-marinho, ações em azul e superfícies neutras.
- Tema claro ou escuro conforme a preferência do navegador/sistema.
- Navegação separada em Visão geral, Produção, Inventário e Gestão.
- Filtros de status compactos e serial/modelo reunidos na listagem.
- Ícones padronizados de TAG e rastreador e status com cores próprias.
- Consulta pela câmera na rastreabilidade, com pesquisa automática após a leitura. Fechar a janela ou concluir a leitura encerra a câmera.
- Tela de acesso com a mesma identidade do restante do sistema.
- Crédito visível no rodapé de computador e celular.
- Favicon azul do Estoque Pro.

Na rastreabilidade, o leitor também aceita uma foto ou a digitação do código. Ele consulta o equipamento; as entradas de estoque permanecem no fluxo **Entrada na matriz**.

Os atalhos administrativos continuam disponíveis na pesquisa do cabeçalho: `zenpoweradd` para usuários e `thereisnourflevel` para o painel de reset.

## Validação

- 48 testes do frontend aprovados, incluindo os formatos de QR Code e barras e os atalhos.
- Análise estática e build de produção aprovados.
- Interface conferida com API simulada: login, rastreabilidade, histórico, atalhos administrativos e entrada de equipamentos.
- Busca por QR Code com câmera simulada em 1920 × 1080, incluindo o encerramento da captura ao concluir a leitura.
- Layout conferido de 320 a 1440 pixels, nos temas claro e escuro.

Para verificar localmente:

```sh
cd invent-front
npm ci --include=dev
npm test
npm run lint
npm run build
```
