# Marcos de Especialização Confirmados

Fonte única: `/home/ubuntu/upload/Feiticeiros&Maldições-LivrodeRegrasv2.5.2.pdf`, extraída para `/tmp/fm-v252.txt` em 21/08/2026. Estes registros servem apenas à implementação incremental da ficha; escolhas não integralmente catalogadas permanecem explicitamente pendentes, sem valores inventados.

| Especialização | Marcos automáticos confirmados | Escolhas estruturadas confirmadas |
|---|---|---|
| Lutador | N1 Corpo Treinado e Empolgação; N2 Reflexo Evasivo; N5 Gosto pela Luta; N9 Teste de Resistência Mestre; N11 Empolgação Máxima; N20 Lutador Superior. | N1 escolhe duas manobras de Empolgação e ganha outra em N6, N12 e N18; N2–20 recebe Habilidade de Lutador conforme tabela. |
| Especialista em Combate | N1 Repertório do Especialista e Artes do Combate; N4 Golpe Especial e Implemento Marcial; N6 Renovação pelo Sangue; N9 Teste de Resistência Mestre; N20 Autossuficiente. | Estilo de combate em N1, N6 e N12; N2–20 recebe Habilidade de Especialista em Combate conforme tabela. |
| Especialista em Técnica | N1 Domínio dos Fundamentos e Conjuração Aprimorada; N4 Adiantar a Evolução; N9 Teste de Resistência Mestre; N10 Foco Amaldiçoado; N20 O Honrado. | Duas Mudanças de Fundamento em N1 e outra em N12; Foco Amaldiçoado escolhe Destruição, Economia ou Refino em N10; N2–20 recebe Habilidade de Especialista em Técnicas conforme tabela. |
| Controlador | N1 Treinamento em Controle; N4 Controle Aprimorado; N6 Apogeu; N9 Teste de Resistência Mestre; N10 Reserva para Invocação; N20 Ápice do Controle. | Apogeu escolhe Controle Concentrado, Disperso ou Sintonizado em N6; N2–20 recebe Habilidade de Controlador conforme tabela. |
| Suporte | N1 Suporte em Combate; N3 Presença Inspiradora; N5 Versatilidade; N6 Energia Reversa; N8 Liberação de Energia Reversa; N9 Teste de Resistência Mestre; N10 Medicina Infalível; N20 Suporte Absoluto. | N2–20 recebe Habilidade de Suporte conforme tabela. |
| Restringido | N1 Restrito pelos Céus; N2 Ataque Furtivo e Versatilidade; N3 Esquiva Sobre-humana; N4 Implemento Celeste e Dádiva do Céu; N9 Teste de Resistência Mestre; N10 Restrição Definitiva; N20 Libertação do Destino e Dádiva do Céu. | Dádivas do Céu em N4, N8, N12, N16 e N20; N2–20 recebe Habilidade de Restringido conforme tabela. Não permite Multiclasse. |

## Trechos de referência na extração

- Lutador: linhas 2188–2387.
- Especialista em Combate: linhas 3200–3422.
- Especialista em Técnica: linhas 4264–4463.
- Controlador: linhas 5187–5343.
- Suporte: linhas 5967–6104.
- Restringido: linhas 6784–6938.

## Causa verificada de salvamento

Em logs de 21/08/2026, o contrato recusou uma ficha Restringida com a mensagem: `Personagens restringidos usam Estilo Marcial, não Técnica Amaldiçoada.` A causa é uma ficha legada cuja Especialização foi alterada para `restricted`, mas cujo `technique.kind` permaneceu `cursed`. A correção planejada é normalizar o tipo ao carregar/escolher Especialização, mantendo os demais campos e preservando as regras de validação.
