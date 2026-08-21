# Auditoria de Invocações — F&M v2.5.2

Fonte consultada: `/home/ubuntu/upload/Feiticeiros&Maldições-LivrodeRegrasv2.5.2.pdf`, capítulo 10, páginas 256–266.

O livro define três tipos oficiais de Invocações: **Corpos Amaldiçoados/Marionetes**, **Maldições Domadas** e **Shikigamis**. Os intermediários são, respectivamente, o próprio dispositivo/corpo, o vínculo de dominação e talismãs ou técnica aplicável.

As fórmulas confirmadas são independentes do tipo e dependem do grau: custo base de 2/4/6/8/12 PE para Quarto/Terceiro/Segundo/Primeiro/Especial; atributos iniciam em 8, com 10/15/20/30/40 pontos e máximos 16/20/24/26/30; PV = 10/25 + metade da Constituição + nível do usuário para Quarto/Terceiro, 40 + Constituição + nível para Segundo, 60 + Constituição + 1,5×nível para Primeiro, e 80 + Constituição + 2×nível para Especial; Defesa = base 10/12/16/20/24 + modificador de Destreza + bônus de treinamento do usuário.

Ações e características têm base 2/2/3/3/4 por grau e aumentam o custo em 1 PE para ação simples/característica ou 2 PE para ação complexa. O bônus de Invocação usa modificador do atributo-chave + bônus de treinamento do usuário + metade do nível do Controlador; perícias não treinadas não somam o bônus de treinamento do usuário.

A implementação será aditiva: fichas legadas sem `type` serão interpretadas como `shikigami` para visualização e continuarão salvando sem migração estrutural. O tipo não altera fórmulas básicas; ele orienta intermediário, estado de retorno e destruição conforme o livro.

## Validação visual

A prévia local `/?preview=full&tab=invocations` foi conferida em 1280×720 e 375×812. O seletor mostra `Shikigami`, o cabeçalho informa a classificação oficial e a ficha continua responsiva sem overflow horizontal observado. A prévia exibiu também o aviso já existente de referência de técnica indisponível removida, preservando a técnica registrada; isso não está relacionado ao novo discriminador de Invocação.

A suíte final desta etapa executou 22 arquivos e 156 testes aprovados, com checagem TypeScript e build de produção aprovados. O build manteve apenas o aviso de chunk grande do Vite e o aviso de atualização de `baseline-browser-mapping`, sem falha de compilação.
