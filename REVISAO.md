# Revisão do inventario-v2

Base: `1c615ded9a07ac45fb24554677ef9dff8ca46165` (main), obtida em 14/10/2026.
As correções estão nesta cópia; o repositório remoto e os serviços de produção não foram alterados.

## Falhas encontradas e correções

| Prioridade | Local | Problema | Correção |
|---|---|---|---|
| Crítica | invent-back/src/app.js | O arquivo da aplicação Express tinha sido substituído por código Axios de frontend, com import.meta.env e referências a window/sessionStorage. Não exportava createApp usado por server.js e pelos testes. | Aplicação Express recuperada do histórico do próprio projeto, com autenticação, rotas, validações e transações preservadas. |
| Alta | LeitorSeriais.jsx | A região decodificada era limitada a 380 × 150 pixels e 45% da altura da prévia. Isso corta QR Codes quadrados e limita barras longas. A moldura visual também não representava a área realmente decodificada. | Automático analisa todo o quadro. Modos específicos usam regiões próprias para QR e barras, com moldura calculada pelas mesmas coordenadas. |
| Alta | LeitorSeriais.jsx | A captura não solicitava resolução alta nem ajustava foco contínuo. A primeira decodificação era adicionada sem confirmar consistência em outros quadros. | Captura solicita 1920 × 1080 como preferência; usa a resolução real do vídeo, foco/exposição/balanço contínuos quando disponíveis e confirmação em três quadros distintos. |
| Alta | screens.jsx / API | A tela de reclassificação chamava PUT /api/imeis/:codigo, mas não existia uma implementação Express dessa rota no histórico recuperável. | Nova rota transacional com validações, atualização dos saldos de origem e destino e auditoria dos dois modelos. Preserva serial, técnico, status e eventos anteriores. |
| Média | Scanner | Apenas quatro formatos habilitados. Funções de câmera duplicadas entre o componente e scanner.js. Não havia testes de decodificação nem de descarte de resultados ambíguos. | Motor ZXing-C++ em WebAssembly, controles centralizados e testes com imagens geradas por codificador independente. |
| Média | Ciclo de câmera | Tratamento dependente do estado interno do SDK; pausa e fechamento durante permissões exigiam uma fila complexa. | MediaStream gerenciado diretamente. Fechar/pausar/desmontar libera tracks e worker; uma autorização que chega depois do fechamento libera imediatamente o stream atrasado. A aba em segundo plano pausa a câmera. |
| Média | Configuração | READMEs mandavam copiar .env.example, mas esses arquivos não estavam no repositório. Não havia .gitignore para dependências, builds e variáveis locais. | Exemplos de ambiente adicionados e exclusões no .gitignore. |
| Melhoria | lib/api.js | Construção do endpoint era distribuída entre remoção de /api no baseURL e injeção no interceptor. | Base única normalizada, testada para localhost, Render e prefixos de caminho. |

## Leitor atualizado

- Modos Automático, Somente QR Code e Somente código de barras.
- QR Code, Code 128, Code 39, Code 93, EAN-13, EAN-8, UPC-A, UPC-E, ITF e Codabar habilitados. UPC-E está habilitado, mas não foi incluído no conjunto de imagens de teste.
- Rotação, contraste local, redução em escalas internas e tentativa adicional de inversão de cores quando a primeira leitura não encontra código.
- Três leituras consistentes em quadros diferentes antes de incluir o serial; resultados inválidos e erros do decodificador são descartados.
- Se encontrar conteúdos distintos na mesma imagem, exige isolar uma etiqueta. Dois símbolos contendo exatamente o mesmo serial são tratados como um serial.
- Zeros iniciais e texto preservados. O motor representa UPC-A como EAN-13 com um zero inicial; Codabar conserva delimitadores A/B/C/D. Não extraímos automaticamente IMEI de URLs, JSON ou textos compostos de QR Codes.
- Ajustes opcionais de lanterna e zoom aparecem somente se a câmera anunciar suporte.
- Prévia não espelhada, playsInline para celulares e sem exigir microfone.
- Importação de fotos usa o mesmo motor. Não grava nem envia imagens para a API.
- Leitura roda em um Web Worker. O arquivo WASM é publicado no próprio build, com nome versionado; não busca motor em CDN nem serviço de leitura externo.
- Continua sendo utilizado um pacote de código aberto, zxing-wasm 3.1.5, instalado pelo npm. Não é um decodificador escrito do zero.
- Limites de 1.000 seriais, 100 fotos por envio e 10 MB por foto mantidos.

## Verificação

- Frontend: 36 testes aprovados, incluindo 27 imagens independentes, confirmação, ambiguidades, região de leitura, descarte de códigos inválidos, configuração de câmera, API e testes anteriores de seriais/previsão.
- Imagens: QR Code, Code 128, Code 39, Code 93, EAN-13, EAN-8, UPC-A, ITF e Codabar; QR/Code128/EAN13 com rotação de 90°, inclinação de 13°, contraste reduzido, cores invertidas e leve desfoque; imagem vazia e etiquetas com múltiplos símbolos.
- Backend: 22 testes aprovados com PGlite; migrações, autenticação, CORS, movimentações, integridade de estoque, triagem, arquivamento e reclassificação.
- Lint, formatação, build Vite e verificação de sintaxe do backend aprovados.
- Navegador Chromium sobre o build de produção, API simulada e vídeo de câmera simulado: QR Code e Code128 em 1920 × 1080, confirmação/deduplicação, importação de foto QR, pausa/retomada, troca de dispositivo, descarte de permissão tardia, permissão negada com nova tentativa, fechamento, desmontagem e pausa da aba em segundo plano. Layout a 390 pixels sem rolagem horizontal; sem exceções não tratadas ou motor carregado por CDN. Esses testes usam vídeo simulado, não câmera física.
- Auditoria npm das dependências de produção: nenhum alerta retornado nesta execução.

As imagens de teste e o gerador ReportLab/Poppler/Pillow estão em invent-front/test/fixtures e invent-front/scripts. npm test usa as imagens prontas e não precisa dessas ferramentas Python.

## Limitações e próximos passos

Não houve acesso à webcam do usuário, às etiquetas físicas, ao banco Aiven ou aos serviços Vercel/Render. Resultados com imagens controladas não demonstram precisão universal em campo. Etiquetas desfocadas, pequenas, reflexos e câmeras de foco fixo continuam limitando a leitura; aproxime/afaste até o código ficar nítido. HTTPS (ou localhost) e permissão de câmera são necessários.

A aplicação continua usando senha administrativa compartilhada. Não há usuários/permissões individuais nem identificação individual do operador na auditoria. GET /api/imeis entrega a lista inteira; paginação e busca no servidor são recomendadas quando o inventário crescer. O lock global do estoque privilegia consistência, mas serializa gravações; alta carga exige uma revisão específica. Não implementei essas mudanças maiores como parte da correção do scanner.

Referências técnicas: https://github.com/Sec-ant/zxing-wasm e https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints.

## Correção de implantação: vite: command not found

O Vite está corretamente declarado em devDependencies. Se a instalação omitir dependências de desenvolvimento (por NODE_ENV=production, --omit=dev ou configuração npm), o comando de build não encontra o executável. Uma raiz de projeto apontando ao backend também pode instalar um pacote que não declara Vite. Foi adicionado invent-front/vercel.json com npm ci --include=dev, npm run build e dist; o estágio de build do Docker também inclui devDependencies. Configure a raiz do projeto na Vercel para invent-front. Não é necessário instalar Vite globalmente.

Validação adicional: instalação limpa com NODE_ENV=production e npm ci --include=dev seguida de npm run build concluída com sucesso.
