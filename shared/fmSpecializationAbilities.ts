import type { FMAptitudeEffect, FMCharacterSheet, FMSpecializationAbilityChoice, FMSpecializationKey, FMSpecializationTrack } from "./fmTypes";

export type FMSpecializationAbility = {
  id: string;
  name: string;
  description: string;
  requiredLevel: number;
  source: string;
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
  catalogPendingLevels: number[];
};

type FMSpecializationProgressionInput = Pick<FMCharacterSheet["progression"], "level" | "specialization" | "specializationLevels" | "specializationTracks" | "specializationAbilityChoices">;

const feature = (id: string, name: string, description: string, requiredLevel: number, source: string): FMSpecializationAbility => ({ id, name, description, requiredLevel, source });

const fighterExcitement = [
  feature("fighter-adjustment", "Ajuste", "Uma vez por rodada, adiciona o dado de Empolgação ao acerto e dano de um ataque.", 1, "Livro-base, p. 49"),
  feature("fighter-command", "Comando", "Ao atacar, permite que um aliado próximo acompanhe o alvo com uma reação e custo de energia indicado.", 1, "Livro-base, p. 49"),
  feature("fighter-disarm", "Desarme", "Ao acertar, usa o dado de Empolgação no dano e tenta fazer o alvo largar um item manejado.", 1, "Livro-base, p. 49"),
  feature("fighter-dodge", "Esquiva", "Ao sofrer um ataque corpo a corpo, reduz o dano com reação usando Empolgação e Destreza.", 1, "Livro-base, p. 49"),
  feature("fighter-footwork", "Trabalho de Pés", "Como ação bônus, aumenta a Defesa pelo dado de Empolgação até o próximo turno.", 1, "Livro-base, p. 49"),
];

const combatStyles = [
  feature("combat-defensive-style", "Estilo Defensivo", "Foca na defesa e aumenta a Defesa conforme o nível de Especialista em Combate.", 1, "Livro-base, p. 63"),
  feature("combat-thrower-style", "Estilo do Arremessador", "Especializa armas de arremesso, saque e dano conforme o nível.", 1, "Livro-base, p. 63"),
  feature("combat-duelist-style", "Estilo do Duelista", "Especializa o combate com uma arma em uma mão e a outra livre.", 1, "Livro-base, p. 63"),
  feature("combat-interceptor-style", "Estilo do Interceptador", "Usa reação para reduzir dano recebido por aliado dentro do alcance.", 1, "Livro-base, p. 63"),
  feature("combat-protector-style", "Estilo do Protetor", "Impõe desvantagem contra aliado próximo e concede vantagem em Teste de Resistência.", 1, "Livro-base, p. 63"),
  feature("combat-ranged-style", "Estilo Distante", "Especializa ataques e dano com armas a distância conforme o nível.", 1, "Livro-base, p. 63"),
  feature("combat-dual-style", "Estilo Duplo", "Aprimora o manejo de duas armas e o dano do segundo ataque.", 1, "Livro-base, p. 63–64"),
  feature("combat-heavy-style", "Estilo Massivo", "Aprimora armas pesadas ou de duas mãos, permitindo repetir resultados baixos de dano.", 1, "Livro-base, p. 64"),
];

const foundationChanges = [
  feature("technique-cruel-spell", "Feitiço Cruel", "Gasta energia para aumentar a CD de um Feitiço que força Teste de Resistência.", 1, "Livro-base, p. 78"),
  feature("technique-distant-spell", "Feitiço Distante", "Gasta energia para ampliar alcance de Feitiço à distância ou corpo a corpo.", 1, "Livro-base, p. 78"),
  feature("technique-duplicated-spell", "Feitiço Duplicado", "Uma vez por rodada, gasta energia para conceder segundo alvo a um Feitiço de dano elegível.", 1, "Livro-base, p. 78"),
  feature("technique-expansive-spell", "Feitiço Expansivo", "Gasta energia para aumentar a área de um Feitiço em área.", 1, "Livro-base, p. 78"),
  feature("technique-potent-spell", "Feitiço Potente", "Gasta energia para repetir dados de dano de Feitiço e usar os melhores resultados.", 1, "Livro-base, p. 79"),
  feature("technique-precise-spell", "Feitiço Preciso", "Gasta energia para receber bônus de acerto com um Feitiço de ataque.", 1, "Livro-base, p. 79"),
  feature("technique-fast-spell", "Feitiço Rápido", "Uma vez por rodada, reduz o custo de ação de um Feitiço elegível; requer nível 6.", 6, "Livro-base, p. 79"),
];

const cursedFocuses = [
  feature("technique-focus-destruction", "Destruição", "Aprimora dano de Feitiços e Aptidões Amaldiçoadas conforme a regra de Foco Amaldiçoado.", 10, "Livro-base, p. 80"),
  feature("technique-focus-economy", "Economia", "Reduz custo de Feitiços e aumenta o máximo de energia pelo bônus de treinamento.", 10, "Livro-base, p. 80"),
  feature("technique-focus-refinement", "Refino", "Concede Aptidão Amaldiçoada ou Feitiço adicional e aprimora CDs e ataques amaldiçoados.", 10, "Livro-base, p. 80"),
];

const controllerApexes = [
  feature("controller-concentrated-control", "Controle Concentrado", "Foca uma Invocação, permitindo invocá-la como ação livre no lugar de duas com ação bônus.", 6, "Livro-base, p. 90"),
  feature("controller-dispersed-control", "Controle Disperso", "Amplia quantidade de Invocações ativas, de ativações e concede acesso a Criar Horda.", 6, "Livro-base, p. 90"),
  feature("controller-tuned-control", "Controle Sintonizado", "Permite atacar junto de Invocação e recebe bônus por Invocação em campo.", 6, "Livro-base, p. 90"),
];

export const FM_SPECIALIZATION_AUTOMATIC_ABILITIES: Record<FMSpecializationKey, FMSpecializationAbility[]> = {
  fighter: [
    feature("fighter-trained-body", "Corpo Treinado", "Permite golpes rápidos, aprimora dano desarmado e escolhe Força ou Destreza para ataques desarmados e marciais.", 1, "Livro-base, p. 49"),
    feature("fighter-excitement", "Empolgação", "Inicia combate com nível de Empolgação 1 e usa manobras associadas ao dado de Empolgação.", 1, "Livro-base, p. 49"),
    feature("fighter-evasive-reflex", "Reflexo Evasivo", "Recebe redução contra dano, exceto alma, igual à metade do nível de Lutador.", 2, "Livro-base, p. 50"),
    feature("fighter-martial-implement", "Implemento Marcial", "Aumenta a CD de Habilidades de Especialização, Feitiços e Aptidões conforme o nível.", 4, "Livro-base, p. 50"),
    feature("fighter-taste-for-fight", "Gosto pela Luta", "Aprimora ataques desarmados ou marciais, Fortitude e dano conforme o nível.", 5, "Livro-base, p. 50"),
    feature("fighter-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 50"),
    feature("fighter-maximum-excitement", "Empolgação Máxima", "Aprimora os dados de Empolgação para patamares superiores.", 11, "Livro-base, p. 50"),
    feature("fighter-superior", "Lutador Superior", "Aprimora ataques desarmados, libera ataque desarmado como ação livre e aumenta a Empolgação inicial.", 20, "Livro-base, p. 51"),
  ],
  "combat-specialist": [
    feature("combat-repertoire", "Repertório do Especialista", "Permite escolher estilos de combate como parte da especialização.", 1, "Livro-base, p. 63"),
    feature("combat-arts", "Artes do Combate", "Concede Pontos de Preparo e artes de combate descritas pela Especialização.", 1, "Livro-base, p. 63–64"),
    feature("combat-special-strike", "Golpe Especial", "Permite montar ataques especiais com propriedades e custos definidos.", 4, "Livro-base, p. 64"),
    feature("combat-martial-implement", "Implemento Marcial", "Aumenta a CD de Habilidades de Especialização, Feitiços e Aptidões conforme o nível.", 4, "Livro-base, p. 64"),
    feature("combat-blood-renewal", "Renovação pelo Sangue", "Recupera energia ao acertar crítico ou reduzir inimigo a 0 PV.", 6, "Livro-base, p. 64"),
    feature("combat-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 64"),
    feature("combat-self-sufficient", "Autossuficiente", "Aprimora Golpe Especial e adiciona dano aos ataques conforme a regra de nível 20.", 20, "Livro-base, p. 64"),
  ],
  "technique-specialist": [
    feature("technique-foundations", "Domínio dos Fundamentos", "Permite escolher Mudanças de Fundamento para os próprios Feitiços.", 1, "Livro-base, p. 78"),
    feature("technique-enhanced-casting", "Conjuração Aprimorada", "Aprimora dano de Feitiços e libera novos Feitiços em todo nível.", 1, "Livro-base, p. 79"),
    feature("technique-advance-evolution", "Adiantar a Evolução", "Antecipada o acesso aos níveis 2, 3, 4 e 5 de Feitiços nos níveis definidos.", 4, "Livro-base, p. 79"),
    feature("technique-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 79"),
    feature("technique-cursed-focus", "Foco Amaldiçoado", "Permite escolher um foco entre Destruição, Economia e Refino.", 10, "Livro-base, p. 80"),
    feature("technique-honored", "O Honrado", "Reduz custos e aumenta CD e ataque de Feitiços e Aptidões Amaldiçoadas.", 20, "Livro-base, p. 80"),
  ],
  controller: [
    feature("controller-training", "Treinamento em Controle", "Concede duas Invocações iniciais e a progressão de Invocações e comandos descrita pela Especialização.", 1, "Livro-base, p. 90"),
    feature("controller-enhanced-control", "Controle Aprimorado", "Aprimora testes de Invocações e permite aplicações de Aptidões de Controle e Leitura por elas.", 4, "Livro-base, p. 90"),
    feature("controller-apex", "Apogeu", "Permite escolher um estilo de controle no nível 6.", 6, "Livro-base, p. 90"),
    feature("controller-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 90"),
    feature("controller-summon-reserve", "Reserva para Invocação", "Cria uma reserva para reduzir custos de invocar ou ativar Invocações uma vez por descanso curto.", 10, "Livro-base, p. 90"),
    feature("controller-apex-control", "Ápice do Controle", "Aprimora características, ativações e interações de Invocações no nível 20.", 20, "Livro-base, p. 90–91"),
  ],
  support: [
    feature("support-combat", "Suporte em Combate", "Permite Apoiar como ação bônus e cura de toque conforme a progressão.", 1, "Livro-base, p. 102"),
    feature("support-inspiring-presence", "Presença Inspiradora", "Permite inspirar aliados próximos com custo de energia durante uma cena.", 3, "Livro-base, p. 102"),
    feature("support-versatility", "Versatilidade", "Permite considerar uma perícia não treinada como treinada mediante custo e limite por descanso.", 5, "Livro-base, p. 102"),
    feature("support-reverse-energy", "Energia Reversa", "Concede a Aptidão Amaldiçoada Energia Reversa.", 6, "Livro-base, p. 102"),
    feature("support-reverse-energy-release", "Liberação de Energia Reversa", "Concede a Aptidão Amaldiçoada Liberação de Energia Reversa.", 8, "Livro-base, p. 102"),
    feature("support-master-saving-throw", "Teste de Resistência Mestre", "Torna-se treinado em um segundo Teste de Resistência e mestre no concedido pela Especialização.", 9, "Livro-base, p. 102"),
    feature("support-infallible-medicine", "Medicina Infalível", "Aprimora curas e seus usos conforme nível e bônus de treinamento.", 10, "Livro-base, p. 102"),
    feature("support-absolute", "Suporte Absoluto", "Aprimora Apoiar e cura no nível 20.", 20, "Livro-base, p. 103"),
  ],
  restricted: [
    feature("restricted-heavenly", "Restrito pelos Céus", "Concede os benefícios físicos, Estamina, ferramenta inicial e Estilo Marcial descritos pela Especialização.", 1, "Livro-base, p. 114"),
    feature("restricted-sneak-attack", "Ataque Furtivo", "Adiciona dano em ataques surpresa, contra desprevenidos ou flanqueados conforme a progressão.", 2, "Livro-base, p. 114"),
    feature("restricted-versatility", "Versatilidade", "Concede bônus a todas as perícias, ampliado no nível 10.", 2, "Livro-base, p. 114"),
    feature("restricted-superhuman-evasion", "Esquiva Sobre-humana", "Aumenta Defesa e Reflexos conforme a progressão.", 3, "Livro-base, p. 114"),
    feature("restricted-celestial-implement", "Implemento Celeste", "Aumenta a CD de habilidades de Restringido e técnicas marciais conforme o nível.", 4, "Livro-base, p. 114"),
    feature("restricted-master-saving-throw", "Teste de Resistência Mestre", "Torna-se mestre nos dois Testes de Resistência da Especialização.", 9, "Livro-base, p. 114"),
    feature("restricted-definitive", "Restrição Definitiva", "Concede os benefícios físicos e de percepção descritos para o nível 10.", 10, "Livro-base, p. 114"),
    feature("restricted-liberation", "Libertação do Destino", "Concede resistências, bônus de ataque e dano descritos para o nível 20.", 20, "Livro-base, p. 114"),
  ],
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

const pendingLevelsBySpecialization: Record<FMSpecializationKey, number[]> = {
  fighter: Array.from({ length: 19 }, (_, index) => index + 2),
  "combat-specialist": Array.from({ length: 19 }, (_, index) => index + 2),
  "technique-specialist": Array.from({ length: 19 }, (_, index) => index + 2),
  controller: Array.from({ length: 19 }, (_, index) => index + 2),
  support: Array.from({ length: 19 }, (_, index) => index + 2),
  restricted: Array.from({ length: 19 }, (_, index) => index + 2),
};

function getTracks(progression: FMSpecializationProgressionInput): FMSpecializationTrack[] {
  const tracks = progression.specializationTracks?.filter(track => track && Number.isInteger(track.level) && track.level > 0) ?? [];
  return tracks.length ? tracks : [{ specialization: progression.specialization, level: Math.max(1, progression.specializationLevels || progression.level) }];
}

export function getSpecializationAbilityProgress(sheet: Pick<FMCharacterSheet, "progression">): FMSpecializationAbilityProgress[] {
  const choices = sheet.progression.specializationAbilityChoices ?? [];
  return getTracks(sheet.progression).map(track => {
    const automatic = FM_SPECIALIZATION_AUTOMATIC_ABILITIES[track.specialization].filter(ability => ability.requiredLevel <= track.level);
    const choiceSlots = FM_SPECIALIZATION_CHOICE_SLOTS.filter(slot => slot.specialization === track.specialization && slot.requiredLevel <= track.level).map(slot => {
      const selected = choices.find(choice => choice.specialization === track.specialization && choice.slotId === slot.id);
      return { ...slot, selectedAbilityId: selected?.abilityId ?? null, selectedAbility: slot.options.find(option => option.id === selected?.abilityId) ?? null };
    });
    const modeledLevels = new Set([...automatic.map(ability => ability.requiredLevel), ...choiceSlots.map(slot => slot.requiredLevel)]);
    return { specialization: track.specialization, level: track.level, automatic, choiceSlots, catalogPendingLevels: pendingLevelsBySpecialization[track.specialization].filter(level => level <= track.level && !modeledLevels.has(level)) };
  });
}

export function validateSpecializationAbilityChoices(progression: FMSpecializationProgressionInput): string[] {
  const tracks = getTracks(progression);
  const choices = progression.specializationAbilityChoices ?? [];
  const errors: string[] = [];
  if (new Set(choices.map(choice => `${choice.specialization}:${choice.slotId}`)).size !== choices.length) errors.push("Cada escolha de habilidade da Especialização pode ser preenchida apenas uma vez.");
  if (new Set(choices.map(choice => choice.abilityId)).size !== choices.length) errors.push("Uma habilidade de Especialização não pode ser selecionada duas vezes no mesmo personagem.");
  choices.forEach(choice => {
    const track = tracks.find(item => item.specialization === choice.specialization);
    const slot = FM_SPECIALIZATION_CHOICE_SLOTS.find(item => item.id === choice.slotId && item.specialization === choice.specialization);
    if (!track || !slot) { errors.push("A escolha de Especialização não pertence a um núcleo ativo."); return; }
    if (track.level < slot.requiredLevel) errors.push(`${slot.label} exige nível ${slot.requiredLevel} em ${choice.specialization}.`);
    const ability = slot.options.find(option => option.id === choice.abilityId);
    if (!ability) errors.push(`A habilidade escolhida não pertence ao campo ${slot.label}.`);
    else if (track.level < ability.requiredLevel) errors.push(`${ability.name} exige nível ${ability.requiredLevel} em ${choice.specialization}.`);
  });
  return errors;
}

export function getSpecializationAbilityEffects(sheet: Pick<FMCharacterSheet, "progression">): FMAptitudeEffect[] {
  return getSpecializationAbilityProgress(sheet).flatMap(progress => [
    ...progress.automatic,
    ...progress.choiceSlots.flatMap(slot => slot.selectedAbility ? [slot.selectedAbility] : []),
  ].map(ability => ({ id: `specialization:${progress.specialization}:${ability.id}`, type: "feature" as const, label: ability.name, description: ability.description })));
}

export function updateSpecializationAbilityChoice(choices: FMSpecializationAbilityChoice[] | undefined, specialization: FMSpecializationKey, slotId: string, abilityId: string | null): FMSpecializationAbilityChoice[] {
  const remaining = (choices ?? []).filter(choice => !(choice.specialization === specialization && choice.slotId === slotId));
  return abilityId ? [...remaining, { specialization, slotId, abilityId }] : remaining;
}
