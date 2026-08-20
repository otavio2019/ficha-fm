# Auditoria F&M v2.5.2 — Infinite Worlds

## Base consultada

Esta auditoria usa o texto extraído de `fm-reference/livro-fm.txt`. O sumário delimita os módulos de criação, origens, especializações, equipamentos, ferramentas amaldiçoadas, talentos, aptidões, técnicas, invocações, perícias, combate, descanso, treinamento, aliados e votos de restrição (linhas 45–99).

## O que já está representado na ficha

| Módulo do livro | Estado atual na Infinite Worlds |
| --- | --- |
| Atributos, valores derivados, resistências e recursos | Implementado com motor compartilhado. |
| Origens, clãs e bônus estruturados | Implementado. |
| Técnica, feitiços, contrajogo e catálogo de poderes | Implementado, incluindo seleção por nível. |
| Invocações | Implementado. |
| Combate, ataques, defesas, condições e diário | Implementado. |
| Missões, XP, graus, moeda, descanso e Interlúdios da guilda | Implementado. |
| Perícias e equipamentos | Implementado banco oficial selecionável, compatível com entradas livres legadas e carga por espaços. |
| Especialização e multiclasse | Implementado em seção própria, com primeira escolha bloqueada, divisão de níveis e validação protegida. |

## Lacunas priorizadas e estado da entrega

| Prioridade | Lacuna | Base do livro | Decisão de implementação |
| --- | --- | --- |
| Alta | Especialização primária e multiclasse | Multiclasse: linhas 1588–1622. | **Concluído:** seção própria, primeira escolha imutável e distribuição de níveis por especialização. |
| Alta | Requisitos de multiclasse | Linhas 1483–1511 e requisitos específicos das especializações. | **Concluído:** requisito de atributo, soma de níveis e bloqueio de qualquer combinação com Restringido. |
| Alta | Banco de perícias | Lista oficial: linhas 11713–11743. | **Concluído:** catálogo selecionável com atributo, treinamento obrigatório e indicador complementar; entradas legadas preservadas. |
| Alta | Banco de equipamentos | Carga e equipamento inicial: linhas 5412–5488; tabelas de armas a partir da linha 5531. | **Concluído:** catálogo inicial com categoria, dano, alcance, espaços e custo; carga calculada no motor. |
| Média | Conjunto inicial por grau | Linhas 5457–5484. | Exibir referência de equipamento inicial disponível por grau, sem gerar itens automaticamente. |
| Média | Talentos, aptidões, aliados e votos próprios | Capítulos 7, 8, 13 e 14. | **Pendente:** próximas expansões; exigem modelagem e catálogos independentes. |
| Média | Ferramentas amaldiçoadas, encantamentos e domínio | Capítulos 6 e 9. | **Pendente:** exigem catálogos próprios, regras de uso e aprovação de mestre. |

## Lacunas restantes após esta entrega

| Módulo ainda ausente | Impacto na ficha | Próxima abordagem recomendada |
| --- | --- | --- |
| Talentos e aptidões | Não há seleção formal de benefícios gerais por nível. | Criar catálogo independente com pré-requisitos, custo e seleção por personagem. |
| Aliados | Aliados de campanha ainda dependem do Diário e de Invocações. | Criar bloco de aliado com ficha resumida, vínculo e ações. |
| Ferramentas amaldiçoadas e encantamentos | Itens especiais podem ser anotados, mas não possuem regras próprias. | Estender o banco de equipamentos com propriedades amaldiçoadas, requisitos e efeitos declarados. |
| Domínio e expansões de domínio | Técnica e poderes estão presentes, porém o domínio não tem painel próprio. | Modelar domínio como capacidade de alto nível, com custo, efeito, contrajogo e aprovação de mestre. |

## Regras de multiclasse a aplicar

> “Quando subir de nível, você pode escolher por aumentar um nível em outra especialização” (linhas 1592–1594).

> “Os níveis de especialização são separados para cada uma, enquanto o nível de personagem é o seu geral” (linhas 1605–1613).

> “Restringidos são incapazes de realizar Multiclasse [...] Personagens de outras especializações também não podem obter níveis de Restringido” (linhas 1614–1616).

O primeiro núcleo será preservado como `primarySpecialization`. A soma dos níveis dos núcleos deverá corresponder ao nível geral. A primeira escolha não poderá ser alterada pelo cliente nem pelo contrato de atualização; novos núcleos só poderão receber níveis se o personagem atender ao atributo mínimo da especialização e não houver conflito com Restringido.

## Regras de perícias e equipamentos a aplicar

O livro registra que novas perícias são obtidas por treinamentos e que a escolha entre Inteligência e Sabedoria para treinamentos por atributo é definitiva (linhas 11690–11707). O catálogo marcará Feitiçaria, Medicina, Ofício e Prestidigitação como exigentes de treinamento, e Direção, Sobrevivência e Teologia como complementares (linhas 11723–11743).

Para equipamentos, o limite de carga é **8 espaços + duas vezes o modificador de Força**, com redução para modificadores negativos; ultrapassar o limite reduz Defesa em 5 e deslocamento em 4,5 m, e o máximo absoluto é o dobro do limite (linhas 5412–5438). Esta regra será calculada no motor e exibida no equipamento.
