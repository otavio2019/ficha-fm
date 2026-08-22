# Auditoria da Especificação Consolidada

Data da revisão: 22/08/2026.

## Resultado do mapeamento

| Áreas da especificação | Situação verificada | Evidência no projeto | Decisão |
|---|---|---|---|
| Motor central, modificadores, fontes e ficha modular | Implementado e validado | `fmCharacterState`, `fmModifiers`, `fmSources`, tipos compartilhados e suíte de regras. | Manter a estrutura atual; não criar outro motor. |
| Aptidões, Treinamentos, Técnicas, Feitiços, Votos, Domínios, Invocações e Equipamentos | Implementado ou integrado ao motor existente | Catálogos, painéis próprios, contratos protegidos e hidratação compatível. | Manter e ampliar somente diante de lacuna verificável. |
| Homebrew, compartilhamento, comentários, sugestões e votos | Implementado | Conteúdo compartilhável, revisões pendentes/aceitas/recusadas/aplicadas, votos e Centro de Revisões. | Reutilizar o fluxo atual. |
| Guia, fontes e compatibilidade | Implementado | Rota `/guia`, fonte identificada em conteúdo estruturado e normalização para fichas legadas. | Manter a base consolidada. |
| Versionamento de conteúdo | Parcial | Técnicas e Homebrews chamam `recordContentVersion`; a gravação de personagem ainda não o chama. | Adicionar versão automática ao salvar personagem. |
| Avaliação pública de personagem | Parcial | O contrato público entrega a ficha, mas `PublicReview` ainda apresenta mensagem genérica para personagens. | Renderizar uma prévia somente leitura com identidade, atributos, recursos, capacidades e alertas de cena. |

## Prioridade definida

As duas lacunas escolhidas atendem diretamente às fases de **Compartilhamento**, **Revisão**, **Votos/Avaliações**, **Versionamento** e **Histórico** da especificação, usando campos e procedimentos já existentes. Não serão inventadas regras nem criados sistemas paralelos.
