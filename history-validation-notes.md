# Validação de História de Personagem

A Visão Geral agora apresenta um painel amplo intitulado **História de personagem**, com textarea confortável para origem, acontecimentos, personalidade, objetivos e passado. O painel aparece antes dos aspectos pessoais e do Domínio inato, que permanece em um painel independente.

Na captura desktop em 1280×720, o bloco ocupa a largura principal da ficha e mantém leitura coerente com a hierarquia existente. Na captura móvel em 375×812, o textarea reflui para uma coluna sem transbordamento, e o painel de Domínio continua separado depois dos aspectos pessoais.

A implementação usa `characterHistory?: string`, inicializa fichas novas com texto vazio e hidrata fichas legadas sem apagar ou reinterpretar `personal.innateDomain`. Testes e tipagem foram executados com sucesso antes das capturas.
