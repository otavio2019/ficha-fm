# Validação de História de Personagem

A Visão Geral agora apresenta um painel amplo intitulado **História de personagem**, com textarea confortável para origem, acontecimentos, personalidade, objetivos e passado. O painel aparece antes dos aspectos pessoais e do Domínio inato, que permanece em um painel independente.

Na captura desktop em 1280×720, o bloco ocupa a largura principal da ficha e mantém leitura coerente com a hierarquia existente. Na captura móvel em 375×812, o textarea reflui para uma coluna sem transbordamento, e o painel de Domínio continua separado depois dos aspectos pessoais.

A implementação usa `characterHistory?: string`, inicializa fichas novas com texto vazio e hidrata fichas legadas sem apagar ou reinterpretar `personal.innateDomain`. Testes e tipagem foram executados com sucesso antes das capturas.

## Correção de atualização a quente

Foi identificado um aviso atual de atualização a quente do Vite: `Home.tsx` exportava o utilitário `hydrateSheet` junto do componente React, invalidando o Fast Refresh durante edições em desenvolvimento. A rotina foi extraída para `shared/fmSheetHydration.ts`, e Home passou a importar o utilitário sem expô-lo como export não-componente.

A Biblioteca da Guilda renderizou normalmente após o reinício e a correção, em 1280×720 e 375×812. A suíte permaneceu com 155 testes aprovados, sem erros de tipagem e com build de produção aprovado. Os registros anteriores de requisição abortada e a ausência de cookie de sessão são históricos ou próprios dos cenários de teste; não se repetiram como falhas de execução após o reinício.

## Novos painéis — validação desktop

A prévia local de Combate e Aptidões foi capturada em 1280×720. O painel de Combate mantém ataques e iniciativa no topo e reserva o bloco de sobrevivência/resistência para a sequência seguinte. O painel de Aptidões mostra o resumo de pontos, a nova seção `Níveis de Aptidão` e a progressão por nível sem deslocamento lateral aparente. O aviso sobre técnica indisponível continua sendo uma mensagem histórica da prévia e não falha dos novos campos.

## Novos painéis — validação móvel

A prévia local de Combate e Aptidões foi capturada em 375×812. Os cartões de resumo refluem para uma coluna, os cabeçalhos permanecem legíveis e não foi observado overflow horizontal na área visível. A continuidade dos painéis abaixo da dobra permanece acessível por rolagem. O aviso de técnica indisponível segue sendo o aviso histórico da prévia local.
