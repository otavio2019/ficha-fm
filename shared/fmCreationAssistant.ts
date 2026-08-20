import { createEmptyFMSheet, type FMSpell, type FMSpellLevel, type FMTechnique, type FMTechniqueKind, type FMTechniquePower } from "./fmTypes";

export type FMTechniqueCreationPreset = {
  id: string;
  kind: FMTechniqueKind;
  label: string;
  summary: string;
  technique: Omit<FMTechnique, "name" | "powers">;
};

const power = (id: string, name: string, requiredCharacterLevel: number, spellLevel: FMSpellLevel, type: FMTechniquePower["type"], summary: string, requirement: string): FMTechniquePower => ({ id, name, requiredCharacterLevel, spellLevel, type, summary, requirement });

export const FM_TECHNIQUE_CREATION_PRESETS: FMTechniqueCreationPreset[] = [
  { id: "cursed-projection", kind: "cursed", label: "Projeção e impacto", summary: "Para técnicas que lançam, moldam ou concentram energia contra um alvo.", technique: { kind: "cursed", attributeKeys: ["intelligence", "wisdom"], basicFunction: "Canaliza energia amaldiçoada em projeções, impactos ou formas controladas.", intrinsicBenefits: "A técnica oferece manifestações simples coerentes com seu tema.", limitations: "Exige linha de visão; o alvo pode se defender, reagir ou usar uma barreira adequada.", requiredItems: "", reviewNotes: "Defina o tema visual e os limites acordados com o mestre.", counterplay: "Defesa, teste de Reflexos ou barreira adequada." } },
  { id: "cursed-control", kind: "cursed", label: "Controle e vínculo", summary: "Para técnicas que marcam, conectam, restringem ou manipulam alvos e objetos.", technique: { kind: "cursed", attributeKeys: ["wisdom", "presence"], basicFunction: "Estabelece vínculos amaldiçoados para controlar, limitar ou reposicionar alvos e objetos.", intrinsicBenefits: "Pode criar marcas ou conexões narrativas dentro das limitações declaradas.", limitations: "Exige condição de vínculo ou marca prévia; o alvo pode resistir, romper o vínculo ou sair do alcance.", requiredItems: "", reviewNotes: "Declare como o vínculo é criado, mantido e rompido.", counterplay: "Teste de Vontade, ruptura do vínculo ou afastamento do alcance." } },
  { id: "cursed-support", kind: "cursed", label: "Suporte e proteção", summary: "Para técnicas de barreira, fortalecimento, cura ou proteção de aliados.", technique: { kind: "cursed", attributeKeys: ["wisdom", "intelligence"], basicFunction: "Modela energia amaldiçoada para proteger, fortalecer ou estabilizar aliados e áreas.", intrinsicBenefits: "Cria efeitos de suporte declarados sem substituir a resolução da cena.", limitations: "Exige alvo, alcance ou foco definido; efeitos podem ser dissipados, superados ou evitados pela cena.", requiredItems: "", reviewNotes: "Registre custos, área e duração de cada aplicação.", counterplay: "Quebra da barreira, distância, dissipação ou oposição apropriada." } },
  { id: "martial-assault", kind: "martial", label: "Impacto e pressão", summary: "Para estilos de combate direto, golpes encadeados e pressão corporal.", technique: { kind: "martial", attributeKeys: ["strength", "dexterity"], basicFunction: "Combina postura, deslocamento e golpes físicos para manter pressão em curta distância.", intrinsicBenefits: "Oferece manobras e posturas físicas coerentes com o estilo.", limitations: "Exige alcance corporal e posicionamento; o alvo pode defender, aparar, esquivar ou interromper a sequência.", requiredItems: "Arma ou foco marcial, se aplicável.", reviewNotes: "Defina a escola, guarda e arma preferencial do estilo.", counterplay: "Defesa, esquiva, aparo ou quebra de posicionamento." } },
  { id: "martial-guard", kind: "martial", label: "Guarda e contra-ataque", summary: "Para estilos focados em defesa, leitura de movimentos e resposta controlada.", technique: { kind: "martial", attributeKeys: ["constitution", "wisdom"], basicFunction: "Usa guardas, deslocamento mínimo e leitura do adversário para defender e contra-atacar.", intrinsicBenefits: "Permite posturas defensivas e respostas condicionais declaradas.", limitations: "Depende de reação, guarda ou postura ativa; pode ser contornado por fintas, alcance ou pressão múltipla.", requiredItems: "Arma, escudo ou postura corporal definida.", reviewNotes: "Declare gatilhos, duração e limites de cada guarda.", counterplay: "Finta, mudança de alcance, múltiplos atacantes ou quebra de postura." } },
  { id: "martial-mobile", kind: "martial", label: "Mobilidade e precisão", summary: "Para estilos baseados em deslocamento, fintas e ataques precisos.", technique: { kind: "martial", attributeKeys: ["dexterity", "wisdom"], basicFunction: "Explora mobilidade, ângulos e precisão para abrir espaço e atingir pontos vulneráveis.", intrinsicBenefits: "Oferece movimentos e manobras ágeis coerentes com o estilo.", limitations: "Exige rota de movimento e espaço; pode ser limitado por terreno, agarrões ou bloqueio de rota.", requiredItems: "Arma leve ou foco corporal, se aplicável.", reviewNotes: "Descreva como o estilo cria e usa aberturas.", counterplay: "Bloqueio de rota, agarrão, terreno difícil ou reação defensiva." } },
];

export function getTechniqueCreationPresets(kind: FMTechniqueKind) {
  return FM_TECHNIQUE_CREATION_PRESETS.filter(preset => preset.kind === kind);
}

export function createTechniqueFromPreset(presetId: string): FMTechnique {
  const preset = FM_TECHNIQUE_CREATION_PRESETS.find(entry => entry.id === presetId);
  const empty = createEmptyFMSheet().technique;
  if (!preset) return empty;
  return { ...empty, ...preset.technique, name: "", powers: createInitialPowers(preset.kind, preset.id) };
}

export function createInitialPowers(kind: FMTechniqueKind, presetId?: string): FMTechniquePower[] {
  const martial = kind === "martial";
  const prefix = martial ? "Manobra" : "Poder";
  const theme = presetId?.includes("guard") ? "Guarda" : presetId?.includes("mobile") ? "Passo" : presetId?.includes("control") ? "Vínculo" : presetId?.includes("support") ? "Proteção" : "Impacto";
  return [
    power(`${prefix.toLowerCase()}-base`, `${prefix} de ${theme}`, 1, 1, martial ? "auxiliary" : "damage", martial ? "Uma aplicação inicial da postura ou manobra escolhida." : "Uma aplicação inicial do tema da técnica.", martial ? "Exige postura, alcance ou deslocamento adequado." : "Exige alcance e contrajogo declarado."),
    power(`${prefix.toLowerCase()}-evolucao`, `${prefix} Evoluída de ${theme}`, 3, 1, martial ? "special" : "auxiliary", martial ? "Uma resposta, movimento ou sequência evoluída do estilo." : "Uma aplicação de controle, proteção ou variação do poder inicial.", martial ? "Requer condição de abertura ou reação disponível." : "Requer condição, marca, alvo ou foco compatível."),
  ];
}

export function createTechniquePowerTemplate(kind: FMTechniqueKind, type: FMTechniquePower["type"], requiredCharacterLevel = 1): FMTechniquePower {
  const labels: Record<FMTechniquePower["type"], string> = { damage: "Impacto", auxiliary: "Controle", healing: "Recuperação", special: "Aplicação Especial", passive: "Característica Passiva", "level-zero": "Aplicação Menor" };
  const spellLevel = type === "level-zero" ? 0 : 1;
  const martialPrefix = kind === "martial" ? "Manobra" : "Poder";
  return power(crypto.randomUUID(), `${martialPrefix}: ${labels[type]}`, requiredCharacterLevel, spellLevel, type, type === "damage" ? "Causa o efeito ofensivo descrito pela técnica ou estilo." : type === "healing" ? "Recupera ou estabiliza conforme os limites declarados." : type === "passive" ? "Concede uma característica contínua dentro das limitações declaradas." : "Aplica um efeito coerente com o núcleo escolhido.", type === "damage" ? "Defesa, resistência ou barreira apropriada." : "Respeita alcance, condição, reação ou limite narrativo declarado.");
}

export function getAutomatedSpellDefaults(type: FMSpell["type"]) {
  const defaults: Record<FMSpell["type"], Pick<FMSpell, "casting" | "reach" | "targetOrArea" | "durationType" | "resolution" | "savingThrow" | "counterplay" | "damage" | "damageType">> = {
    damage: { casting: "common", reach: "12 metros", targetOrArea: "Uma criatura", durationType: "immediate", resolution: "attack", savingThrow: "", counterplay: "Defesa, teste de Reflexos ou barreira adequada.", damage: "", damageType: "" },
    auxiliary: { casting: "common", reach: "12 metros", targetOrArea: "Uma criatura ou área pequena", durationType: "lasting", resolution: "saving-throw", savingThrow: "Vontade ou Reflexos", counterplay: "Teste de resistência, reação ou afastamento da área.", damage: "", damageType: "" },
    healing: { casting: "common", reach: "Toque", targetOrArea: "Uma criatura voluntária", durationType: "immediate", resolution: "none", savingThrow: "", counterplay: "Exige alvo voluntário, recurso disponível e não reverte consequências permanentes.", damage: "", damageType: "" },
    special: { casting: "common", reach: "12 metros", targetOrArea: "Conforme o efeito", durationType: "variable", resolution: "saving-throw", savingThrow: "Vontade, Reflexos ou Fortitude", counterplay: "A resistência aplicável, reação ou condição de interrupção deve ser escolhida na cena.", damage: "", damageType: "" },
    passive: { casting: "free", reach: "Pessoal", targetOrArea: "Você", durationType: "lasting", resolution: "none", savingThrow: "", counterplay: "Respeita as limitações da técnica e pode ser suprimido por efeitos apropriados.", damage: "", damageType: "" },
    "level-zero": { casting: "free", reach: "6 metros", targetOrArea: "Um objeto ou criatura", durationType: "immediate", resolution: "none", savingThrow: "", counterplay: "O alvo pode evitar, interromper ou negar o efeito conforme a ficção da cena.", damage: "", damageType: "" },
  };
  return defaults[type];
}

export function createAutomatedSpell(type: FMSpell["type"] = "damage", sourcePower?: FMTechniquePower): FMSpell {
  const defaults = getAutomatedSpellDefaults(type);
  const level = sourcePower?.spellLevel ?? (type === "level-zero" ? 0 : 1);
  return { id: crypto.randomUUID(), sourcePowerId: sourcePower?.id, name: sourcePower?.name ?? `Novo ${type === "damage" ? "feitiço ofensivo" : "feitiço"}`, type, level, ...defaults, durationDetail: "", effect: sourcePower?.summary ?? "Descreva o efeito da aplicação escolhida.", requirement: sourcePower?.requirement ?? "", costAdjustment: 0, combatModifierTarget: "none", combatModifier: 0, notes: "", active: false };
}
