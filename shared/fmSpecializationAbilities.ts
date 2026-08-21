import type { FMAptitudeEffect, FMCharacterSheet, FMModifierDefinition, FMRequirement, FMSpecializationAbilityChoice, FMSpecializationAbilityKind, FMSpecializationAbilityUnlock, FMSpecializationKey, FMSpecializationTrack } from "./fmTypes";

export type FMSpecializationAbility = {
  id: string;
  name: string;
  description: string;
  requiredLevel: number;
  source: string;
  kind: FMSpecializationAbilityKind;
  requirements: FMRequirement[];
  modifiers: FMModifierDefinition[];
  effects: FMAptitudeEffect[];
  status: "official" | "draft" | "retired";
  isAutomatic: boolean;
  requiresChoice: boolean;
  evolutionOf: string | null;
  displayOrder: number;
  rulesVersion: "2.5.2";
};

export type FMSpecializationChoiceSlot = {
  id: string;
  specialization: FMSpecializationKey;
  requiredLevel: number;
  label: string;
  description: string;
  source: string;
  options: FMSpecializationAbility[];
};

export type FMSpecializationAbilityProgress = {
  specialization: FMSpecializationKey;
  level: number;
  automatic: FMSpecializationAbility[];
  choiceSlots: Array<FMSpecializationChoiceSlot & { selectedAbilityId: string | null; selectedAbility: FMSpecializationAbility | null }>;
  upcomingChoiceSlots: FMSpecializationChoiceSlot[];
  catalogPendingLevels: number[];
};

export type FMSpecializationAbilityGrant = Pick<FMSpecializationAbility, "id" | "name" | "description" | "requirements" | "modifiers" | "effects"> & { specialization: FMSpecializationKey };

type FMSpecializationProgressionInput = Pick<FMCharacterSheet["progression"], "level" | "specialization" | "specializationLevels" | "specializationTracks" | "specializationAbilityChoices">;

const feature = (id: string, name: string, description: string, requiredLevel: number, source: string, options: Partial<Pick<FMSpecializationAbility, "kind" | "requirements" | "modifiers" | "effects" | "status" | "isAutomatic" | "requiresChoice" | "evolutionOf" | "displayOrder">> = {}): FMSpecializationAbility => ({
  id,
  name,
  description,
  requiredLevel,
  source,
  kind: options.kind ?? "passive",
  requirements: options.requirements ?? [],
  modifiers: options.modifiers ?? [],
  effects: options.effects ?? [],
  status: options.status ?? "official",
  isAutomatic: options.isAutomatic ?? false,
  requiresChoice: options.requiresChoice ?? false,
  evolutionOf: options.evolutionOf ?? null,
  displayOrder: options.displayOrder ?? requiredLevel,
  rulesVersion: "2.5.2",
});

const automatic = (id: string, name: string, description: string, requiredLevel: number, source: string, options: Parameters<typeof feature>[5] = {}) => feature(id, name, description, requiredLevel, source, { ...options, isAutomatic: true });
const choice = (id: string, name: string, description: string, requiredLevel: number, source: string, options: Parameters<typeof feature>[5] = {}) => feature(id, name, description, requiredLevel, source, { ...options, kind: "choice", requiresChoice: true });

const fighterExcitement = [
  choice("fighter-adjustment", "Ajuste", "Uma vez por rodada, adiciona o dado de Empolgação ao acerto e dano de um ataque.", 1, "Livro-base, p. 49"),
  choice("fighter-command", "Comando", "Ao atacar, permite que um aliado próximo acompanhe o alvo com uma reação e custo de energia indicado.", 1, "Livro-base, p. 49"),
  choice("fighter-disarm", "Desarme", "Ao acertar, usa o dado de Empolgação no dano e tenta fazer o alvo largar um item manejado.", 1, "Livro-base, p. 49"),
  choice("fighter-dodge", "Esquiva", "Ao sofrer um ataque corpo a corpo, reduz o dano com reação usando Empolgação e Destreza.", 1, "Livro-base, p. 49"),
  choice("fighter-footwork", "Trabalho de Pés", "Como ação bônus, aumenta a Defesa pelo dado de Empolgação até o próximo turno.", 1, "Livro-base, p. 49"),
];

const combatStyles = [
  choice("combat-defensive-style", "Estilo Defensivo", "Foca na defesa e aumenta a Defesa conforme o nível de Especialista em Combate.", 1, "Livro-base, p. 63"),
  choice("combat-thrower-style", "Estilo do Arremessador", "Especializa armas de arremesso, saque e dano conforme o nível.", 1, "Livro-base, p. 63"),
  choice("combat-duelist-style", "Estilo do Duelista", "Especializa o combate com uma arma em uma mão e a outra livre.", 1, "Livro-base, p. 63"),
  choice("combat-interceptor-style", "Estilo do Interceptador", "Usa reação para reduzir dano recebido por aliado dentro do alcance.", 1, "Livro-base, p. 63"),
  choice("combat-protector-style", "Estilo do Protetor", "Impõe desvantagem contra aliado próximo e concede vantagem em Teste de Resistência.", 1, "Livro-base, p. 63"),
  choice("combat-ranged-style", "Estilo Distante", "Especializa ataques e dano com armas a distância conforme o nível.", 1, "Livro-base, p. 63"),
  choice("combat-dual-style", "Estilo Duplo", "Aprimora o manejo de duas armas e o dano do segundo ataque.", 1, "Livro-base, p. 63–64"),
  choice("combat-heavy-style", "Estilo Massivo", "Aprimora armas pesadas ou de duas mãos, permitindo repetir resultados baixos de dano.", 1, "Livro-base, p. 64"),
];

const foundationChanges = [
  choice("technique-cruel-spell", "Feitiço Cruel", "Gasta energia para aumentar a CD de um Feitiço que força Teste de Resistência.", 1, "Livro-base, p. 78"),
  choice("technique-distant-spell", "Feitiço Distante", "Gasta energia para ampliar alcance de Feitiço à distância ou corpo a corpo.", 1, "Livro-base, p. 78"),
  choice("technique-duplicated-spell", "Feitiço Duplicado", "Uma vez por rodada, gasta energia para conceder segundo alvo a um Feitiço de dano elegível.", 1, "Livro-base, p. 78"),
  choice("technique-expansive-spell", "Feitiço Expansivo", "Gasta energia para aumentar a área de um Feitiço em área.", 1, "Livro-base, p. 78"),
  choice("technique-potent-spell", "Feitiço Potente", "Gasta energia para repetir dados de dano de Feitiço e usar os melhores resultados.", 1, "Livro-base, p. 79"),
  choice("technique-precise-spell", "Feitiço Preciso", "Gasta energia para receber bônus de acerto com um Feitiço de ataque.", 1, "Livro-base, p. 79"),
  choice("technique-fast-spell", "Feitiço Rápido", "Uma vez por rodada, reduz o custo de ação de um Feitiço elegível; requer nível 6.", 6, "Livro-base, p. 79"),
];

const cursedFocuses = [
  choice("technique-focus-destruction", "Destruição", "Aprimora dano de Feitiços e Aptidões Amaldiçoadas conforme a regra de Foco Amaldiçoado.", 10, "Livro-base, p. 80"),
  choice("technique-focus-economy", "Economia", "Reduz custo de Feitiços e aumenta o máximo de energia pelo bônus de treinamento.", 10, "Livro-base, p. 80"),
  choice("technique-focus-refinement", "Refino", "Concede Aptidão Amaldiçoada ou Feitiço adicional e aprimora CDs e ataques amaldiçoados.", 10, "Livro-base, p. 80"),
];

const controllerApexes = [
  choice("controller-concentrated-control", "Controle Concentrado", "Foca uma Invocação, permitindo invocá-la como ação livre no lugar de duas com ação bônus.", 6, "Livro-base, p. 90"),
  choice("controller-dispersed-control", "Controle Disperso", "Amplia quantidade de Invocações ativas, de ativações e concede acesso a Criar Horda.", 6, "Livro-base, p. 90"),
  choice("controller-tuned-control", "Controle Sintonizado", "Permite atacar junto de Invocação e recebe bônus por Invocação em campo.", 6, "Livro-base, p. 90"),
];

export const FM_SPECIALIZATION_AUTOMATIC_ABILITIES: Record<FMSpecializationKey, FMSpecializationAbility[]> = {
  fighter: [
    automatic("fighter-trained-body", "Corpo Treinado", "Permite golpes rápidos, aprimora dano desarmado e escolhe Força ou Destreza para ataques desarmados e marciais.", 1, "Livro-base, p. 49"),
    automatic("fighter-excitement", "Empolgação", "Inicia combate com nível de Empolgação 1 e usa manobras associadas ao dado de Empolgação.", 1, "Livro-base, p. 49"),
    automatic("fighter-evasive-reflex", "Reflexo Evasivo", "Recebe redução contra dano, exceto alma, igual à metade do nível de Lutador.", 2, "Livro-base, p. 50"),
    automatic("fighter-martial-implement", "Implemento Marcial", "Aumenta a CD de Habilidades de Especialização, Feitiços e Aptidões conforme o nível.", 4, "Livro-base, p. 50"),
    automatic("fighter-taste-for-fight", "Gosto pela Luta", "Aprimora ataques desarmados ou marciais, Fortitude e dano conforme o nível.", 5, "Livro-base, p. 50"),
    automatic("fighter-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 50"),
    automatic("fighter-maximum-excitement", "Empolgação Máxima", "Aprimora os dados de Empolgação para patamares superiores.", 11, "Livro-base, p. 50"),
    automatic("fighter-superior", "Lutador Superior", "Aprimora ataques desarmados, libera ataque desarmado como ação livre e aumenta a Empolgação inicial.", 20, "Livro-base, p. 51"),
  ],
  "combat-specialist": [
    automatic("combat-repertoire", "Repertório do Especialista", "Permite escolher estilos de combate como parte da especialização.", 1, "Livro-base, p. 63"),
    automatic("combat-arts", "Artes do Combate", "Concede Pontos de Preparo e artes de combate descritas pela Especialização.", 1, "Livro-base, p. 63–64"),
    automatic("combat-special-strike", "Golpe Especial", "Permite montar ataques especiais com propriedades e custos definidos.", 4, "Livro-base, p. 64"),
    automatic("combat-martial-implement", "Implemento Marcial", "Aumenta a CD de Habilidades de Especialização, Feitiços e Aptidões conforme o nível.", 4, "Livro-base, p. 64"),
    automatic("combat-blood-renewal", "Renovação pelo Sangue", "Recupera energia ao acertar crítico ou reduzir inimigo a 0 PV.", 6, "Livro-base, p. 64"),
    automatic("combat-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 64"),
    automatic("combat-self-sufficient", "Autossuficiente", "Aprimora Golpe Especial e adiciona dano aos ataques conforme a regra de nível 20.", 20, "Livro-base, p. 64"),
  ],
  "technique-specialist": [
    automatic("technique-foundations", "Domínio dos Fundamentos", "Permite escolher Mudanças de Fundamento para os próprios Feitiços.", 1, "Livro-base, p. 78"),
    automatic("technique-enhanced-casting", "Conjuração Aprimorada", "Aprimora dano de Feitiços e libera novos Feitiços em todo nível.", 1, "Livro-base, p. 79"),
    automatic("technique-advance-evolution", "Adiantar a Evolução", "Antecipada o acesso aos níveis 2, 3, 4 e 5 de Feitiços nos níveis definidos.", 4, "Livro-base, p. 79"),
    automatic("technique-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 79"),
    automatic("technique-cursed-focus", "Foco Amaldiçoado", "Permite escolher um foco entre Destruição, Economia e Refino.", 10, "Livro-base, p. 80"),
    automatic("technique-honored", "O Honrado", "Reduz custos e aumenta CD e ataque de Feitiços e Aptidões Amaldiçoadas.", 20, "Livro-base, p. 80"),
  ],
  controller: [
    automatic("controller-training", "Treinamento em Controle", "Concede duas Invocações iniciais e a progressão de Invocações e comandos descrita pela Especialização.", 1, "Livro-base, p. 90"),
    automatic("controller-enhanced-control", "Controle Aprimorado", "Aprimora testes de Invocações e permite aplicações de Aptidões de Controle e Leitura por elas.", 4, "Livro-base, p. 90"),
    automatic("controller-apex", "Apogeu", "Permite escolher um estilo de controle no nível 6.", 6, "Livro-base, p. 90"),
    automatic("controller-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 90"),
    automatic("controller-summon-reserve", "Reserva para Invocação", "Cria uma reserva para reduzir custos de invocar ou ativar Invocações uma vez por descanso curto.", 10, "Livro-base, p. 90"),
    automatic("controller-apex-control", "Ápice do Controle", "Aprimora características, ativações e interações de Invocações no nível 20.", 20, "Livro-base, p. 90–91"),
  ],
  support: [
    automatic("support-combat", "Suporte em Combate", "Permite Apoiar como ação bônus e cura de toque conforme a progressão.", 1, "Livro-base, p. 102"),
    automatic("support-inspiring-presence", "Presença Inspiradora", "Permite inspirar aliados próximos com custo de energia durante uma cena.", 3, "Livro-base, p. 102"),
    automatic("support-versatility", "Versatilidade", "Permite considerar uma perícia não treinada como treinada mediante custo e limite por descanso.", 5, "Livro-base, p. 102"),
    automatic("support-reverse-energy", "Energia Reversa", "Concede a Aptidão Amaldiçoada Energia Reversa.", 6, "Livro-base, p. 102"),
    automatic("support-reverse-energy-release", "Liberação de Energia Reversa", "Concede a Aptidão Amaldiçoada Liberação de Energia Reversa.", 8, "Livro-base, p. 102"),
    automatic("support-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 102"),
    automatic("support-infallible-medicine", "Medicina Infalível", "Aprimora curas e seus usos conforme nível e bônus de treinamento.", 10, "Livro-base, p. 102"),
    automatic("support-absolute", "Suporte Absoluto", "Aprimora Apoiar e cura no nível 20.", 20, "Livro-base, p. 103"),
  ],
  restricted: [
    automatic("restricted-heavenly", "Restrito pelos Céus", "Concede os benefícios físicos, Estamina, ferramenta inicial e Estilo Marcial descritos pela Especialização.", 1, "Livro-base, p. 114"),
    automatic("restricted-sneak-attack", "Ataque Furtivo", "Adiciona dano em ataques surpresa, contra desprevenidos ou flanqueados conforme a progressão.", 2, "Livro-base, p. 114"),
    automatic("restricted-versatility", "Versatilidade", "Concede bônus a todas as perícias, ampliado no nível 10.", 2, "Livro-base, p. 114"),
    automatic("restricted-superhuman-evasion", "Esquiva Sobre-humana", "Aumenta Defesa e Reflexos conforme a progressão.", 3, "Livro-base, p. 114"),
    automatic("restricted-celestial-implement", "Implemento Celeste", "Aumenta a CD de habilidades de Restringido e técnicas marciais conforme o nível.", 4, "Livro-base, p. 114"),
    automatic("restricted-master-saving-throw", "Teste de Resistência Mestre", "Torna-se mestre nos dois Testes de Resistência da Especialização.", 9, "Livro-base, p. 114"),
    automatic("restricted-definitive", "Restrição Definitiva", "Concede os benefícios físicos e de percepção descritos para o nível 10.", 10, "Livro-base, p. 114"),
    automatic("restricted-liberation", "Libertação do Destino", "Concede resistências, bônus de ataque e dano descritos para o nível 20.", 20, "Livro-base, p. 114"),
  ],
};

const catalogChoices: Record<FMSpecializationKey, FMSpecializationAbility[]> = {
  fighter: [choice("fighter-parry-attack", "Aparar Ataque", "Habilidade de Lutador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Lutador"), choice("fighter-parry-projectiles", "Aparar Projéteis", "Habilidade de Lutador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Lutador"), choice("fighter-reckless-attack", "Ataque Inconsequente", "Habilidade de Lutador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Lutador"), choice("fighter-empty-hand", "Caminho da Mão Vazia", "Habilidade de Lutador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Lutador"), choice("fighter-martial-complement", "Complementação Marcial", "Habilidade de Lutador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Lutador")],
  "combat-specialist": [choice("combat-powerful-throws", "Arremessos Potentes", "Habilidade de Especialista em Combate disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Combate"), choice("combat-cyclic-arsenal", "Arsenal Cíclico", "Habilidade de Especialista em Combate disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Combate"), choice("combat-take-stance", "Assumir Postura", "Habilidade de Especialista em Combate disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Combate"), choice("combat-synced-shots", "Disparos Sincronizados", "Habilidade de Especialista em Combate disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Combate"), choice("combat-aggressive-squire", "Escudeiro Agressivo", "Habilidade de Especialista em Combate disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Combate")],
  "technique-specialist": [choice("technique-blood-fueled", "Abastecido pelo Sangue", "Quando um inimigo morre dentro de 12 metros, permite recuperar Energia Amaldiçoada com reação conforme o livro.", 2, "Livro-base, p. 81"), choice("technique-applied-knowledge", "Conhecimento Aplicado", "Permite gastar Energia Amaldiçoada para receber bônus em Teste de Resistência contra Feitiço conforme o livro.", 2, "Livro-base, p. 81"), choice("technique-defensive-casting", "Conjuração Defensiva", "Habilidade de Especialista em Técnicas disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Técnicas"), choice("technique-energy-economy", "Economia de Energia", "Habilidade de Especialista em Técnicas disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Técnicas"), choice("technique-chain-explosion", "Explosão Encadeada", "Habilidade de Especialista em Técnicas disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Especialista em Técnicas")],
  controller: [choice("controller-acceleration", "Aceleração", "Habilidade de Controlador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Controlador"), choice("controller-enhanced-camouflage", "Camuflagem Aprimorada", "Habilidade de Controlador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Controlador"), choice("controller-destructive-call", "Chamado Destruidor", "Habilidade de Controlador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Controlador"), choice("controller-cursed-companion", "Companheiro Amaldiçoado", "Habilidade de Controlador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Controlador"), choice("controller-shared-pain", "Dor Partilhada", "Habilidade de Controlador disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Controlador")],
  support: [choice("support-unbreakable-friendship", "Amizade Inquebrável", "Habilidade de Suporte disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Suporte"), choice("support-deep-analysis", "Análise Profunda", "Habilidade de Suporte disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Suporte"), choice("support-uncover-terrain", "Desvendar Terreno", "Habilidade de Suporte disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Suporte"), choice("support-advanced-aid", "Apoio Avançado", "Habilidade de Suporte disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Suporte"), choice("support-second-chance", "Conceder Outra Chance", "Habilidade de Suporte disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Suporte")],
  restricted: [choice("restricted-reckless-attack", "Ataque Inconsequente", "Habilidade de Restringido disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Restringido"), choice("restricted-appropriate", "Apropriar-se", "Habilidade de Restringido disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Restringido"), choice("restricted-instinctive-approach", "Aproximação Instintiva", "Habilidade de Restringido disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Restringido"), choice("restricted-imperceptible-existence", "Existência Imperceptível", "Habilidade de Restringido disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Restringido"), choice("restricted-improved-feint", "Finta Melhorada", "Habilidade de Restringido disponível no catálogo oficial de 2º nível.", 2, "Livro-base, seção Habilidades do Restringido")],
};

const choiceSlot = (id: string, specialization: FMSpecializationKey, requiredLevel: number, label: string, description: string, source: string, options: FMSpecializationAbility[]): FMSpecializationChoiceSlot => ({ id, specialization, requiredLevel, label, description, source, options });

export const FM_SPECIALIZATION_CHOICE_SLOTS: FMSpecializationChoiceSlot[] = [
  choiceSlot("fighter-excitement-1a", "fighter", 1, "Manobra de Empolgação I", "Escolha uma manobra de Empolgação inicial.", "Livro-base, p. 49", fighterExcitement),
  choiceSlot("fighter-excitement-1b", "fighter", 1, "Manobra de Empolgação II", "Escolha uma segunda manobra de Empolgação inicial distinta.", "Livro-base, p. 49", fighterExcitement),
  choiceSlot("fighter-excitement-6", "fighter", 6, "Manobra de Empolgação III", "Escolha uma nova manobra de Empolgação.", "Livro-base, p. 49", fighterExcitement),
  choiceSlot("fighter-excitement-12", "fighter", 12, "Manobra de Empolgação IV", "Escolha uma nova manobra de Empolgação.", "Livro-base, p. 49", fighterExcitement),
  choiceSlot("fighter-excitement-18", "fighter", 18, "Manobra de Empolgação V", "Escolha uma nova manobra de Empolgação.", "Livro-base, p. 49", fighterExcitement),
  choiceSlot("combat-style-1", "combat-specialist", 1, "Estilo de Combate I", "Escolha o primeiro estilo do Repertório do Especialista.", "Livro-base, p. 63", combatStyles),
  choiceSlot("combat-style-6", "combat-specialist", 6, "Estilo de Combate II", "Escolha um novo estilo de combate.", "Livro-base, p. 63–64", combatStyles),
  choiceSlot("combat-style-12", "combat-specialist", 12, "Estilo de Combate III", "Escolha um novo estilo de combate.", "Livro-base, p. 63–64", combatStyles),
  choiceSlot("technique-foundation-1a", "technique-specialist", 1, "Mudança de Fundamento I", "Escolha uma Mudança de Fundamento inicial.", "Livro-base, p. 78", foundationChanges),
  choiceSlot("technique-foundation-1b", "technique-specialist", 1, "Mudança de Fundamento II", "Escolha uma segunda Mudança de Fundamento inicial distinta.", "Livro-base, p. 78", foundationChanges),
  choiceSlot("technique-foundation-12", "technique-specialist", 12, "Mudança de Fundamento III", "Escolha uma Mudança de Fundamento adicional.", "Livro-base, p. 78", foundationChanges),
  choiceSlot("technique-focus-10", "technique-specialist", 10, "Foco Amaldiçoado", "Escolha Destruição, Economia ou Refino.", "Livro-base, p. 80", cursedFocuses),
  choiceSlot("controller-apex-6", "controller", 6, "Apogeu", "Escolha um estilo de controle para as Invocações.", "Livro-base, p. 90", controllerApexes),
];

const genericChoiceLevelsBySpecialization: Record<FMSpecializationKey, number[]> = {
  fighter: [],
  "combat-specialist": [],
  "technique-specialist": Array.from({ length: 19 }, (_, index) => index + 2),
  controller: [],
  support: [],
  restricted: [],
};
const genericSlot = (specialization: FMSpecializationKey, level: number) => choiceSlot(`${specialization}-specialization-ability-${level}`, specialization, level, `Habilidade de Especialização · nível ${level}`, "Escolha uma Habilidade de Especialização oficial para este marco. Nenhum efeito é aplicado até a escolha ser registrada.", "Livro-base v2.5.2, tabela de nível e seção de habilidades", catalogChoices[specialization].filter(option => option.requiredLevel <= level));
const slotsFor = (specialization: FMSpecializationKey) => [...FM_SPECIALIZATION_CHOICE_SLOTS.filter(slot => slot.specialization === specialization), ...genericChoiceLevelsBySpecialization[specialization].map(level => genericSlot(specialization, level))];

export const FM_SPECIALIZATION_ABILITY_SEED: Array<FMSpecializationAbility & { specialization: FMSpecializationKey }> = (Object.keys(FM_SPECIALIZATION_AUTOMATIC_ABILITIES) as FMSpecializationKey[]).flatMap(specialization => [
  ...FM_SPECIALIZATION_AUTOMATIC_ABILITIES[specialization],
  ...slotsFor(specialization).flatMap(slot => slot.options),
].map(ability => ({ ...ability, specialization }))).filter((ability, index, all) => all.findIndex(entry => entry.specialization === ability.specialization && entry.id === ability.id) === index).map((ability, index) => ({ ...ability, displayOrder: index + 1 }));

function getTracks(progression: FMSpecializationProgressionInput): FMSpecializationTrack[] {
  const tracks = progression.specializationTracks?.filter(track => track && Number.isInteger(track.level) && track.level > 0) ?? [];
  return tracks.length ? tracks : [{ specialization: progression.specialization, level: Math.max(1, progression.specializationLevels || progression.level) }];
}

export function getSpecializationAbilityProgress(sheet: Pick<FMCharacterSheet, "progression">): FMSpecializationAbilityProgress[] {
  const choices = sheet.progression.specializationAbilityChoices ?? [];
  return getTracks(sheet.progression).map(track => {
    const automaticAbilities = FM_SPECIALIZATION_AUTOMATIC_ABILITIES[track.specialization] ?? [];
    const automatic = automaticAbilities.filter(ability => ability.requiredLevel <= track.level);
    const allSlots = slotsFor(track.specialization);
    const choiceSlots = allSlots.filter(slot => slot.requiredLevel <= track.level).map(slot => {
      const selected = choices.find(entry => entry.specialization === track.specialization && entry.slotId === slot.id);
      return { ...slot, selectedAbilityId: selected?.abilityId ?? null, selectedAbility: slot.options.find(option => option.id === selected?.abilityId) ?? null };
    });
    const upcomingChoiceSlots = allSlots.filter(slot => slot.requiredLevel > track.level).sort((left, right) => left.requiredLevel - right.requiredLevel).slice(0, 3);
    return { specialization: track.specialization, level: track.level, automatic, choiceSlots, upcomingChoiceSlots, catalogPendingLevels: [] };
  });
}

export function validateSpecializationAbilityChoices(progression: FMSpecializationProgressionInput): string[] {
  const tracks = getTracks(progression);
  const choices = progression.specializationAbilityChoices ?? [];
  const errors: string[] = [];
  if (new Set(choices.map(choiceEntry => `${choiceEntry.specialization}:${choiceEntry.slotId}`)).size !== choices.length) errors.push("Cada escolha de habilidade da Especialização pode ser preenchida apenas uma vez.");
  if (new Set(choices.map(choiceEntry => `${choiceEntry.specialization}:${choiceEntry.abilityId}`)).size !== choices.length) errors.push("Uma habilidade de Especialização não pode ser selecionada duas vezes no mesmo personagem.");
  choices.forEach(choiceEntry => {
    const track = tracks.find(item => item.specialization === choiceEntry.specialization);
    const slot = track ? slotsFor(track.specialization).find(item => item.id === choiceEntry.slotId) : undefined;
    if (!track || !slot) { errors.push("A escolha de Especialização não pertence a um núcleo ativo."); return; }
    if (track.level < slot.requiredLevel) errors.push(`${slot.label} exige nível ${slot.requiredLevel} em ${choiceEntry.specialization}.`);
    const ability = slot.options.find(option => option.id === choiceEntry.abilityId);
    if (!ability) errors.push(`A habilidade escolhida não pertence ao campo ${slot.label}.`);
    else if (track.level < ability.requiredLevel) errors.push(`${ability.name} exige nível ${ability.requiredLevel} em ${choiceEntry.specialization}.`);
  });
  return errors;
}

const grantedAbilities = (sheet: Pick<FMCharacterSheet, "progression">): Array<FMSpecializationAbility & { specialization: FMSpecializationKey; selected: boolean }> => getSpecializationAbilityProgress(sheet).flatMap(progress => [
  ...progress.automatic.map(ability => ({ ...ability, specialization: progress.specialization, selected: false })),
  ...progress.choiceSlots.flatMap(slot => slot.selectedAbility ? [{ ...slot.selectedAbility, specialization: progress.specialization, selected: true }] : []),
]);

export function getSpecializationAbilityUnlocks(sheet: Pick<FMCharacterSheet, "progression">): FMSpecializationAbilityUnlock[] {
  return grantedAbilities(sheet).map(ability => ({ abilityId: ability.id, specialization: ability.specialization, coreId: null, unlockedAt: null, status: ability.selected ? "selected" : "unlocked", selected: ability.selected }));
}

export function getSheetSpecializationAbilityUnlocks(sheet: Pick<FMCharacterSheet, "origin" | "progression" | "mutantCores">): FMSpecializationAbilityUnlock[] {
  const source = sheet as Partial<Pick<FMCharacterSheet, "origin" | "progression" | "mutantCores">>;
  const progression = source.progression;
  if (!progression) return [];
  if (source.origin?.catalogId === "mutant-cursed-corpse" && source.mutantCores?.cores.length) {
    return source.mutantCores.cores.flatMap(core => getSpecializationAbilityUnlocks({ progression: {
      ...progression,
      specialization: core.specialization,
      specializationLevels: progression.level,
      primarySpecialization: core.specialization,
      specializationTracks: [{ specialization: core.specialization, level: progression.level }],
      specializationAbilityChoices: core.specializationAbilityChoices,
    } }).map(unlock => ({ ...unlock, coreId: core.id })));
  }
  return getSpecializationAbilityUnlocks({ progression });
}

export function mergeSpecializationAbilityUnlockHistory(existing: FMSpecializationAbilityUnlock[] | undefined, derived: FMSpecializationAbilityUnlock[], timestamp = Date.now()): FMSpecializationAbilityUnlock[] {
  const records = new Map((existing ?? []).map(unlock => [`${unlock.specialization}:${unlock.abilityId}:${unlock.coreId ?? ""}`, unlock]));
  derived.forEach(unlock => {
    const key = `${unlock.specialization}:${unlock.abilityId}:${unlock.coreId ?? ""}`;
    const previous = records.get(key);
    records.set(key, { ...unlock, unlockedAt: previous?.unlockedAt ?? timestamp });
  });
  return Array.from(records.values());
}

export function getSpecializationAbilityGrants(sheet: Pick<FMCharacterSheet, "progression">): FMSpecializationAbilityGrant[] {
  return grantedAbilities(sheet).map(ability => ({ id: ability.id, name: ability.name, description: ability.description, requirements: ability.requirements, modifiers: ability.modifiers, effects: [{ id: `specialization:${ability.specialization}:${ability.id}`, type: "feature", label: ability.name, description: ability.description }, ...ability.effects], specialization: ability.specialization }));
}

export function getSpecializationAbilityEffects(sheet: Pick<FMCharacterSheet, "progression">): FMAptitudeEffect[] {
  return getSpecializationAbilityGrants(sheet).flatMap(ability => ability.effects);
}

export function updateSpecializationAbilityChoice(choices: FMSpecializationAbilityChoice[] | undefined, specialization: FMSpecializationKey, slotId: string, abilityId: string | null): FMSpecializationAbilityChoice[] {
  const remaining = (choices ?? []).filter(choiceEntry => !(choiceEntry.specialization === specialization && choiceEntry.slotId === slotId));
  return abilityId ? [...remaining, { specialization, slotId, abilityId }] : remaining;
}
