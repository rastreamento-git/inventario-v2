# Leitor rápido — invent-front 1.2.0

O frontend na main 10c2db9 ainda usava html5-qrcode com recorte de até 380 × 150 pixels e apenas quatro formatos habilitados. A atualização desta pasta troca esse leitor pelo motor local ZXing-C++ em WebAssembly.

## O que muda na produção

- A imagem inteira é analisada em Automático, QR Code e Barras. O modo seleciona o formato, sem exigir posição central.
- Captura prefere 1920 × 1080; foco contínuo é ajustado se a câmera disponibilizar esse controle.
- A maioria dos quadros usa uma análise rápida de até 1280 pixels no maior lado, mantendo proporção e cobertura de toda a imagem. Após duas tentativas sem código, a cada terceiro quadro é feita uma tentativa na resolução original, incluindo inversão de cores se necessário.
- A amostragem ampla de linhas de código de barras e a rotação permanecem habilitadas, inclusive nas análises rápidas, para localizar etiquetas fora do centro.
- Cadência por orçamento de tempo: não soma uma espera fixa de 125 ms ao tempo de cada decodificação. Os trabalhos continuam sequenciais, sem sobreposição.
- QR Code, Code128, Code93 e EAN/UPC exigem duas leituras iguais de quadros distintos. Code39, ITF e Codabar continuam exigindo três. Erros do decodificador são descartados. Uma falha breve de até 450 ms não descarta imediatamente uma leitura boa.
- Códigos já adicionados não voltam a disparar inclusão. Conteúdos diferentes na mesma imagem exigem isolar o símbolo ou escolher QR/Barras. Dois símbolos com o mesmo conteúdo são um único serial.
- Zeros iniciais são preservados. UPC-A é representado pelo motor como EAN-13 com zero inicial; Codabar conserva os delimitadores. Não extraímos IMEI de URLs/JSON automaticamente.
- Fotos e lista TXT continuam disponíveis. Imagens são processadas no navegador, sem envio a serviços de leitura.

## Validação executada

46 testes do frontend aprovados, incluindo 35 imagens independentes: QR, Code128, Code39, Code93, EAN13, EAN8, UPC-A, ITF e Codabar; rotação, contraste, inversão, leve desfoque, múltiplos códigos e imagens vazias. Há oito cenas 1920 × 1080 com QR e Code128 nos quatro cantos, validadas também na tentativa rápida reduzida.

Chromium com câmera simulada: Code128 e QR no canto inferior direito, em Automático e no modo específico; confirmação, repetidos, pausa/retomada, fotos, rejeição de foto ambígua, fechamento e permissão atrasada após fechar. Layout a 390 pixels e ausência de exceções não tratadas. Primeira confirmação após o vídeo ficar pronto: 1.182 ms para Code128 e 1.102 ms para QR nessas execuções; inclui primeira execução do decodificador e do fluxo de câmera.

Medição do decodificador aquecido, isolado, com quatro imagens controladas: medianas de 14–15,5 ms por análise rápida, contra 25–28 ms por análise na resolução original. Esses números não representam throughput de uma câmera física ou quantidade de equipamentos por segundo. Não foi medido o tempo do leitor HTML5 antigo; ele tinha outro motor e uma região de leitura menor.

Build Vite, lint e formatação aprovados. UPC-E está habilitado, mas não faz parte das imagens de teste.

## Publicar sem confundir os caminhos

Esta pasta deve substituir a invent-front existente na raiz do GitHub. Os arquivos src/components/LeitorSeriais.jsx, src/lib/scanner.js, scanner-client.js e scanner.worker.js precisam ficar DENTRO de invent-front. Atualize também package.json e package-lock.json, pois o novo motor é uma dependência de build/execução. O vercel.json força npm ci --include=dev.

Vercel: Root Directory invent-front; Install Command npm ci --include=dev; Build Command npm run build; Output Directory dist. Preserve a variável VITE_API_URL já configurada. Faça Redeploy sem reutilizar o cache. O log deve indicar invent-front@1.2.0; a tela deve mostrar “Leitura rápida · QR Code e barras”.

Um endereço Vercel com identificação de deployment pode continuar apontando ao build anterior. Abra o novo deployment ou use o domínio fixo listado em Settings → Domains. A origem desse domínio deve constar em CORS_ORIGINS no Render, sem barra no final. Não é preciso alterar o código do backend para esta atualização.

## Limites físicos

As cenas são controladas, não filmagens da câmera do usuário. Código precisa estar inteiro e nítido no quadro; iluminação, reflexos, exposição e distância focal ainda influenciam. Software não adiciona autofocus a uma câmera de foco fixo. Use uma etiqueta por vez e confira o serial antes de concluir a movimentação.

Referências técnicas: https://github.com/Sec-ant/zxing-wasm e https://vercel.com/docs/deployments/generated-urls.

Teste de sequência em câmera de canvas controlada: Code128 seguido de outro Code128 e depois Code39, todos no canto inferior direito, totalizando três seriais distintos sem perdas ou duplicações. Após trocar a etiqueta: 1.185 ms para o segundo Code128 e 1.043 ms para Code39 nesta execução. Não são medições de uma linha física de produção.
