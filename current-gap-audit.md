# Auditoria Atual de Lacunas — Infinite Worlds

Data da revisão: 21/08/2026.

## Lacunas confirmadas

| Prioridade | Lacuna | Evidência | Ação definida |
|---|---|---|---|
| Alta | O link público não acompanha a ficha editável. | `SharedCharacter.tsx` possuía hidratação própria e não exibia Invocações, Testes de Morte, reduções de dano, resistências, vulnerabilidades, Inspiração, limite de Energia ou as descrições dos Treinamentos. | Reutilizar o hidratador central e exibir os blocos em modo somente leitura. |
| Média | A revisão pública de personagem não possui uma apresentação rica própria. | `PublicReview.tsx` usa uma mensagem genérica para compartilhamentos do tipo personagem. | Criar uma prévia de personagem orientada a revisão após a paridade do link compartilhado. |
| Média | A impressão/PDF da ficha é parcial. | A cobertura e as regras de impressão atuais concentram-se em Poderes de Técnica. | Compor uma folha de impressão integral após consolidar as superfícies de leitura. |

## Decisão desta revisão

A melhoria de maior prioridade é trazer o **link compartilhado** para a mesma cobertura de informações do editor. Ela não adiciona regras novas, reutiliza campos já persistidos e permite que a ficha completa seja vista por quem recebe o link.
