# Mapeamento da evolução Homebrew e revisão

## Referência do pedido

O pedido anexado define uma evolução incremental para o Infinite Worlds: a central Homebrew deve concentrar conteúdos personalizados, compartilhamento por token, avaliação pública, sugestões específicas, decisões do proprietário e histórico. A referência recebida foi `pasted_content_3.txt`, anexada nesta conversa.

## Estruturas já existentes

| Área | Implementação atual | Evolução necessária |
|---|---|---|
| Categorias | `FM_HOMEBREW_KINDS` possui Técnica, Voto, Aptidão, Raça, Domínio, Treinamento, Item, Regra e Outro. | Adicionar Habilidade e metadados específicos mais completos por categoria. |
| Editor | `HomebrewHub` salva campos comuns e dois campos específicos por categoria. | Dirigir os campos por metadados de categoria e expor todos os grupos pedidos sem inventar regras. |
| Técnicas | `TechniqueLibraryPanel` existe como seção interna do `HomebrewHub`. | Remover a sensação de sistema isolado, integrando-a aos filtros, estados e ações da central. |
| Compartilhamento | `fm_content_shares` já é genérico para `character` e `homebrew`; fichas mantêm link legado compatível. | Incluir estado habilitado, revogação, regeneração e visualização do link sem expor IDs internos. |
| Avaliação | `fm_reviews` já guarda tipo, seção, valor atual/sugerido, motivo, status e resposta. | Adicionar campo específico, filtros e apresentação mais clara de fluxo pendente → aceita → implementada. |
| Histórico | `fm_change_history` registra criação, edição, compartilhamento, sugestão, comentário, resposta, decisão e exclusão. | Cobrir revogação/regeneração, eventos de ficha e apresentar alvo, ator e hora com clareza. |
| Aptidões e Treinamentos | A ficha já tem estruturas oficiais e vínculos Homebrew com origem identificável. | Preservar as regras atuais e completar a experiência de criação, uso, compartilhamento e revisão. |

## Princípios de implementação

1. **Não criar um sistema paralelo.** As tabelas `fm_homebrews`, `fm_content_shares`, `fm_reviews` e `fm_change_history` permanecem como fonte única para conteúdo, links, revisões e eventos.
2. **Não inventar regras de F&M.** Campos específicos armazenam informações declaradas pelo criador; regras automáticas continuam restritas aos módulos oficiais já implementados.
3. **Proprietário controla o original.** Aceitar uma sugestão não altera ficha ou Homebrew; somente a edição do proprietário e a decisão posterior de “Implementada” confirmam a aplicação.
4. **Compatibilidade primeiro.** Links de ficha atuais continuam em funcionamento enquanto os links genéricos novos oferecem controles completos de revogação.
