# Observações editáveis — decisão de arquitetura

## Estruturas reutilizadas

As entidades da ficha já persistem junto ao JSON do personagem e o autosalvamento existente serializa essa atualização. Foram identificados campos `notes` em perícias, feitiços, invocações, equipamentos, ataques, defesas, treinamentos, aliados, ferramentas amaldiçoadas, recursos, transformações e núcleos mutantes. O conteúdo Homebrew já possui `content.notes`, normalizado de forma compatível.

Para o Domínio, que não tinha campo equivalente, foi acrescentado `notes?: string` ao objeto já persistido em `sheet.domainExpansion`. O valor é opcional para que fichas antigas mantenham o comportamento seguro de campo vazio.

## Componente e persistência

`EditableObservation` é a superfície única de edição. Ele recebe tipo e identificador da entidade, valor atual, permissão, callback de salvamento e textos de interface. A entidade proprietária define somente o callback, reutilizando o autosalvamento da ficha ou o salvamento existente do conteúdo Homebrew; não foi criada uma API paralela.

## Compartilhamento e revisão

Os links compartilhados existentes já expõem o conteúdo completo da ficha, Técnica ou Homebrew em modo somente leitura. As sugestões já carregam seção, campo, valor atual e valor sugerido, por isso observações podem ser encaminhadas como sugestões ao campo `Observações` sem um novo modelo de revisão. A decisão de aceitação permanece registrada no histórico existente; a aplicação direta do texto só será habilitada para caminhos de entidade validados no servidor.
