# Matriz de regras — Feiticeiros & Maldições (F&M)

Este documento fixa a referência funcional da aplicação. O livro-base **Feiticeiros & Maldições v2.5.2** é a autoridade das regras; o suplemento **Regras Opcionais** só altera uma ficha quando a opção correspondente estiver marcada explicitamente.

| Área | Regra que a aplicação deve aplicar | Referência no material fornecido |
|---|---|---|
| Atributos | Força, Destreza, Constituição, Inteligência, Sabedoria e Presença. O valor vai de 0 a 30, com limite natural de 20; 10 é a média. | Livro-base, p. 17 |
| Modificador | `floor((atributo - 10) / 2)`, respeitando a tabela oficial de 1 a 30. | Livro-base, p. 19 e p. 277 |
| Atenção | `10 + bônus em Percepção + outros bônus`. | Livro-base, p. 19 |
| Defesa | `10 + modificador de Destreza + metade do nível + outros bônus`. | Livro-base, p. 19 e p. 281 |
| Iniciativa | `modificador de Destreza + outros bônus`; a cena usa uma rolagem e mantém o resultado até seu fim. | Livro-base, p. 19 e p. 291 |
| Deslocamento | Caminhada padrão de 9 metros; novos tipos são registrados separadamente. | Livro-base, p. 19 e p. 291 |
| Integridade da Alma | Igual ao máximo de Pontos de Vida. | Livro-base, p. 19 |
| Vida | Valor inicial e progressão dependem da especialização, somando o modificador de Constituição; a alteração do modificador é retroativa. | Livro-base, p. 20 |
| Energia | Pontos de Energia Amaldiçoada dependem da especialização; Restringidos usam Estamina em vez de PE. | Livro-base, p. 21 |
| Treinamento | Inicia em +2 e sobe em +1 nos níveis 5, 9, 13 e 17. | Livro-base, p. 281 |
| Perícias | `modificador do atributo-chave + metade do nível + treinamento se treinado + outros bônus`; mestria usa 1,5× o bônus de treinamento. | Livro-base, p. 278 |
| Testes | Rolagem base é `d20 + modificadores` contra CD; vantagem usa o maior de dois d20 e desvantagem, o menor. | Livro-base, p. 276 e p. 282 |
| Ataques | Corpo a corpo usa Força, ou Destreza com Fineza; distância usa Destreza; amaldiçoado usa o atributo da técnica. Todos somam metade do nível, treinamento quando aplicável, bônus e penalidades. | Livro-base, p. 279 |
| Resistências | Astúcia usa Inteligência; Fortitude e Integridade usam Constituição; Reflexos usa Destreza; Vontade usa Sabedoria. | Livro-base, p. 280 |
| CD de técnica | `10 + metade do nível + modificador do atributo da técnica + treinamento + outros valores`. | Livro-base, p. 198 |
| Feitiços | Níveis 0–5, custos-padrão de 0, 2, 5, 8, 12 e 20 PE; o custo mínimo é 1 PE, exceto no nível 0. | Livro-base, p. 199 |
| Acesso a feitiços | Níveis 1–4 acessam 0–1; 5–8, 0–2; 9–12, 0–3; 13–16, 0–4; 17–20, 0–5. | Livro-base, p. 199 |
| Duração de feitiço | Imediata, duradoura, sustentada, concentrada ou variável. Sustentar custa 1 PE/rodada nos níveis 0–2 e 2 PE/rodada nos níveis 3–5. | Livro-base, p. 203 |
| Combate | Cada turno oferece ações comum, bônus, reação, movimento e livres; ações superiores podem substituir ações inferiores. | Livro-base, p. 300 |
| Opções de campanha | Personagem de nível 0: 6 + modificador de Constituição PV, sem PE/especialização e treinamento +1. Não-feiticeiros usam Estamina, têm limite 10 e atributos até 20. | Regras Opcionais, pp. 1–2 |

## Limites de automação

A aplicação automatiza **fórmulas determinísticas**, limites de recursos, custos de PE, rolagens, histórico e dados derivados. Já conteúdos criativos aprovados pelo Narrador — como técnica individual, funcionamento básico, efeitos especiais, requisitos e exceções narrativas — são armazenados como campos explícitos e exibidos com sua origem, sem a aplicação inventar efeitos ou balanceamento.

## Decisões de interface

A terminologia seguirá o livro: **Pontos de Vida (PV)** e **Pontos de Energia Amaldiçoada (PE)**, não “Vida” e “Mana” como nomes primários. A interface, contudo, poderá mostrar “Vida” e “Energia” como rótulos de leitura rápida. A aba **Magias/Maldições** preserva “Feitiço” como termo técnico interno de F&M e inclui tipo, nível, custo, conjuração, alcance, alvo ou área, duração, efeito, requisito, dano e resistência/ataque quando aplicável.
