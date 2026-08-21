# Corpo Amaldiçoado Mutante — Regras confirmadas (F&M v2.5.2)

> Fonte primária: *Feiticeiros & Maldições v2.5.2*, pp. 39–40, fornecido no projeto.

- A Origem concede **+2 pontos de atributo**, imunidade a dano/condição venenosa e não recebe efeitos de refeições ou itens de Medicina.
- O personagem começa com **três núcleos** e deve escolher um **Núcleo Primário**. Alternar o núcleo ativo em combate custa **Ação Bônus**.
- Os três núcleos usam a mesma soma de atributos, apenas **realocada**, sem nova compra de pontos. O núcleo primário define a Técnica Amaldiçoada e o Funcionamento Básico compartilhado.
- Treinamentos em perícias e equipamentos são compartilhados a partir do núcleo primário. Cada núcleo mantém seus próprios Feitiços, seguindo o Funcionamento Básico do primário.
- Nenhum núcleo pode superar os máximos de PV e Energia do núcleo primário. Na troca, os valores atuais usam a diferença entre máximos; Iniciativa é recalculada pela Destreza ativa.
- Atenção e deslocamento são compartilhados salvo habilidade específica. Dano à alma reduz o máximo de PV em todos; Integridade da Alma é compartilhada e corresponde à metade da soma das integridades dos núcleos.
- Núcleo ativo a 0 PV pode ser trocado com Reação em combate; núcleo inativo a 0 PV fica Danificado e não pode ser ativado até recuperar PV. Testes de morte são individuais.
- Em níveis ímpares, Habilidades de Especialização e Aptidões Amaldiçoadas são fixas, escolhidas pelo núcleo primário; em níveis pares, são versáteis por núcleo. Talentos são sempre fixos. Não há Multiclasse.

## Decisão de arquitetura

`fm_characters.sheet` já é JSON e não possui subentidades relacionais. Os núcleos serão persistidos como subestrutura compatível em `FMCharacterSheet`, preservando um único personagem, compartilhamento e histórico existentes; nenhuma tabela nova é necessária nesta etapa.

Os painéis existentes de Visão Geral e Feitiços leem hoje `resources` e `spells` globais. Para Corpo Amaldiçoado Mutante, eles precisam operar sobre o núcleo ativo; Técnica, perícias, equipamentos e os campos narrativos permanecem compartilhados pelo personagem.

## Evidência de interface

Na prévia local, em 1280×720, a seleção de **Corpo Amaldiçoado Mutante** apresentou os três cartões de núcleo, o limite comum do primário, a integridade compartilhada, os controles de recursos e a realocação completa entre os seis atributos. A inspeção revelou que iniciar núcleos secundários com 0 PV os tornava imediatamente indisponíveis; por isso, a criação passou a copiar os recursos atuais da ficha para os três núcleos. A regra de troca continua aplicando a diferença entre máximos e respeitando os limites do Núcleo Primário.

Após a correção, os dois cartões secundários aparecem sem o aviso de dano e com a ação **Ativar** disponível. A prévia é deliberadamente efêmera: uma atualização de desenvolvimento recompõe seus dados de demonstração, sem alterar fichas reais.

No segundo cartão, o botão **Ativar** permanece visível junto a **Definir primário**, e os campos de PV e Energia preservam os valores iniciais copiados da ficha. Isso permite a troca antes de qualquer edição manual de recursos.

A ação foi executada na prévia local: o resumo passou a exibir **Ativo: Núcleo Secundário I**, enquanto o cartão do secundário recebeu o selo **Ativo** e o primário deixou de exibi-lo. Os valores compartilhados e os limites comuns permaneceram estáveis durante a troca.
