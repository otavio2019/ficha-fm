# Auditoria — Habilidades de Especialização

> Escopo: evolução localizada da ficha **Infinite Worlds / Feiticeiros & Maldições v2.5.2**, sem reconstruir os sistemas de personagem, Homebrew, Raça ou Corpo Amaldiçoado Mutante.

## Estado encontrado

| Área | Estrutura atual | Lacuna confirmada |
| --- | --- | --- |
| Catálogo | `shared/fmSpecializationAbilities.ts` contém habilidades-base automáticas e algumas escolhas oficiais. | As entradas não carregam tipo, requisitos estruturados, modificadores, estado ou ordem; os níveis de Habilidade de Especialização genérica ficam sem opção estruturada. |
| Progressão | `getSpecializationAbilityProgress()` deriva marcos pelo nível de cada trilha. | `catalogPendingLevels` considera todos os níveis 2–20 como pendentes quando não encontra marco local, por isso o nível 3 pode ficar apenas como aviso visual. |
| Ficha | A progressão persiste `specializationAbilityChoices` no JSON de `fm_characters.sheet`; núcleos mutantes armazenam escolhas próprias. | Não há registro explícito de desbloqueio, status ou vínculo com uma habilidade oficial. |
| Motor | O estado calculado já recebe `feature` de Especialização como fonte auditável. | Efeitos de Especialização ainda não podem carregar modificadores estruturados para atributos, derivados ou perícias. |
| Banco | As nove tabelas atuais não incluem catálogo oficial de Especialização nem relação personagem–habilidade. `fm_homebrews.kind = ability` é conteúdo autoral e não substitui o catálogo oficial. | É necessária uma migração aditiva e segura. |

## Regras verificadas

O livro-base v2.5.2 determina que Especialista em Técnicas recebe uma Habilidade de Especialista em Técnicas no nível 2 e em cada nível seguinte; a tabela também lista marcos próprios, como Adiantar Evolução no nível 4 e Foco Amaldiçoado no nível 10. A seção de Suporte registra Presença Inspiradora no nível 3. Esses marcos não devem permanecer somente como mensagem de pendência.

## Decisão de arquitetura

O catálogo oficial será a única definição reutilizável das habilidades. Suas entradas usarão identificador estável, especialização, nível, tipo, ordem, requisitos, modificadores/effects estruturados, estado, origem de regra e metadados de escolha/evolução. A mesma definição será usada para:

1. **Seed idempotente e tabela oficial**, para consulta agrupada e expansão futura.
2. **Validação de contrato e cálculo puro**, com fallback local seguro enquanto a tabela ainda não estiver disponível durante desenvolvimento.
3. **Progresso da ficha**, que deriva automaticamente marcos automáticos e mantém escolhas pendentes explícitas, sem atribuir um benefício arbitrário.

O estado individual será persistido em uma relação `personagem × habilidade`, com `coreId` opcional. Isso mantém o personagem como dono padrão e só vincula a um núcleo quando a regra específica exigir. A ficha continuará carregando uma projeção compatível no JSON para não quebrar salvamentos legados, compartilhamento ou o modo de prévia.

## Critérios de segurança

- A migração apenas cria tabelas e índices novos; não altera ou remove personagens existentes.
- O seed usa IDs estáveis e atualização por chave, portanto pode ser executado mais de uma vez sem duplicar catálogo.
- Desbloqueios automáticos usam uma chave única por personagem, habilidade e núcleo opcional; salvar, recarregar ou subir novamente de nível não produz cópias.
- Uma escolha sem opção confirmada permanece pendente e não injeta modificador no motor.
- Conteúdo sem efeito identificável no livro será catalogado apenas como habilidade narrativa/funcional, sem bônus inventado.

## Evidência visual de implementação

Na prévia desktop, em 21 de agosto de 2026, a Especialização em Técnicas no nível 12 exibiu os cinco marcos automáticos esperados e os cartões de escolha do catálogo. A inspeção também identificou que a regra temporária de criar uma escolha genérica em todos os níveis de 2 a 20 produziu cartões repetidos para níveis que não pertencem à cadência da Especialização. Essa regra será substituída por calendários explícitos por Especialização, preservando a regra confirmada de Especialista em Técnicas em todos os níveis posteriores ao 1 e sem inferir a mesma cadência para as demais Especializações.

A verificação posterior confirmou que o Especialista em Técnicas continua com escolhas nos níveis 2 a 12, conforme sua cadência própria confirmada. As demais Especializações usam somente os marcos automáticos e os slots de escolha já identificados no livro, até que uma nova entrada oficial seja catalogada.
