import type { FMAptitudeGroup, FMCharacterSheet, FMCursedToolGrade, FMTrainingTrackKey } from "./fmTypes";

export type FMAptitudeCatalogEntry = {
  id: string;
  name: string;
  group: FMAptitudeGroup;
  requiredLevel: number;
  cost: number;
  prerequisite: string;
  effect: string;
};

export const FM_APTITUDE_GROUPS: Array<{ id: FMAptitudeGroup; label: string }> = [
  { id: "aura", label: "Aura" },
  { id: "control-reading", label: "Controle e Leitura" },
  { id: "domain", label: "Domínio" },
  { id: "curse-anatomy", label: "Maldição e Anatomia" },
  { id: "special", label: "Especiais" },
];

export const FM_APTITUDE_CATALOG: FMAptitudeCatalogEntry[] = [
  { id: "expanded-affinity", name: "Afinidade Ampliada", group: "aura", requiredLevel: 1, cost: 1, prerequisite: "—", effect: "Amplia a afinidade declarada com a própria energia." },
  { id: "controlled-aura", name: "Aura Controlada", group: "aura", requiredLevel: 2, cost: 1, prerequisite: "Afinidade Ampliada", effect: "Permite ocultar ou modular a assinatura energética." },
  { id: "reinforced-aura", name: "Aura Reforçada", group: "aura", requiredLevel: 4, cost: 1, prerequisite: "Aura Controlada", effect: "Reforça a aura para aplicações defensivas declaradas." },
  { id: "massive-aura", name: "Aura Maciça", group: "aura", requiredLevel: 8, cost: 2, prerequisite: "Aura Reforçada", effect: "Concentra energia em uma presença defensiva de grande porte." },
  { id: "channel-strike", name: "Canalizar em Golpe", group: "control-reading", requiredLevel: 1, cost: 1, prerequisite: "—", effect: "Canaliza energia em um ataque ou contato declarado." },
  { id: "aura-reading", name: "Leitura de Aura", group: "control-reading", requiredLevel: 2, cost: 1, prerequisite: "Canalizar em Golpe", effect: "Lê sinais básicos de energia amaldiçoada na cena." },
  { id: "project-energy", name: "Projetar Energia", group: "control-reading", requiredLevel: 4, cost: 1, prerequisite: "Leitura de Aura", effect: "Projeta energia para efeitos explicitamente descritos." },
  { id: "reverse-energy", name: "Energia Reversa", group: "control-reading", requiredLevel: 8, cost: 2, prerequisite: "Projetar Energia", effect: "Habilita uso narrativo de energia reversa conforme os poderes aprovados." },
  { id: "domain-coating", name: "Revestimento de Domínio", group: "domain", requiredLevel: 3, cost: 1, prerequisite: "—", effect: "Aplica um revestimento de domínio à técnica ou defesa declarada." },
  { id: "barriers", name: "Barreiras", group: "domain", requiredLevel: 3, cost: 1, prerequisite: "—", effect: "Permite estruturar barreiras com efeito e contrajogo registrados." },
  { id: "simple-domain", name: "Domínio Simples", group: "domain", requiredLevel: 6, cost: 1, prerequisite: "Barreiras", effect: "Habilita um domínio simples declarado." },
  { id: "incomplete-domain", name: "Expansão de Domínio Incompleta", group: "domain", requiredLevel: 8, cost: 2, prerequisite: "Barreiras", effect: "Habilita expansão incompleta com aprovação do mestre." },
  { id: "complete-domain", name: "Expansão de Domínio Completa", group: "domain", requiredLevel: 12, cost: 3, prerequisite: "Expansão de Domínio Incompleta", effect: "Habilita expansão completa com custo e contrajogo declarados." },
  { id: "guaranteed-hit", name: "Acerto Garantido", group: "domain", requiredLevel: 14, cost: 2, prerequisite: "Expansão de Domínio Completa", effect: "Declara o efeito garantido da expansão aprovada." },
  { id: "natural-weapons", name: "Armas Naturais", group: "curse-anatomy", requiredLevel: 1, cost: 1, prerequisite: "—", effect: "Registra armas naturais e sua aplicação de combate." },
  { id: "cursed-coating", name: "Revestimento", group: "curse-anatomy", requiredLevel: 3, cost: 1, prerequisite: "—", effect: "Reveste o corpo ou ferramenta com energia declarada." },
  { id: "body-regeneration", name: "Regeneração Corporal", group: "curse-anatomy", requiredLevel: 6, cost: 2, prerequisite: "Energia Reversa", effect: "Registra regeneração corporal vinculada a energia reversa." },
  { id: "enhanced-regeneration", name: "Regeneração Aprimorada", group: "curse-anatomy", requiredLevel: 10, cost: 2, prerequisite: "Regeneração Corporal", effect: "Aprimora a regeneração aprovada pelo mestre." },
  { id: "divergent-fist", name: "Punho Divergente", group: "special", requiredLevel: 1, cost: 1, prerequisite: "—", effect: "Registra a aplicação especial de energia em golpes desarmados." },
  { id: "black-flash", name: "Raio Negro", group: "special", requiredLevel: 6, cost: 2, prerequisite: "Canalizar em Golpe", effect: "Registra acesso e efeitos declarados do Raio Negro." },
  { id: "maximum-technique", name: "Técnica Máxima", group: "special", requiredLevel: 14, cost: 3, prerequisite: "Expansão de Domínio Completa", effect: "Habilita o registro de uma técnica máxima aprovada." },
];

export const FM_TRAINING_TRACKS: Array<{ id: FMTrainingTrackKey; label: string; description: string }> = [
  { id: "agility", label: "Treino de Agilidade", description: "Mobilidade, esquivas e reflexos." },
  { id: "barriers", label: "Treino de Barreiras", description: "Resistência, modelagem e uso de barreiras." },
  { id: "comprehension", label: "Treino de Compreensão", description: "Leitura e entendimento da energia amaldiçoada." },
  { id: "energy-control", label: "Controle de Energia", description: "Geração e controle de energia durante a cena." },
  { id: "domains", label: "Treino de Domínios", description: "Desenvolvimento de expansões e modificações de domínio." },
  { id: "reverse-energy", label: "Energia Reversa", description: "Recuperação e aplicações de energia reversa." },
  { id: "combat", label: "Treino de Luta", description: "Combate desarmado, manobras e crítico." },
  { id: "weapon-mastery", label: "Manejo de Arma", description: "Maestria em uma ferramenta ou arma escolhida." },
  { id: "skill", label: "Treino de Perícia", description: "Aprimoramento de consistência e especialização em perícias." },
  { id: "saving-throw", label: "Treino de Resistência", description: "Vigor, resistência e testes de morte." },
  { id: "physical-potential", label: "Potencial Físico", description: "Vigor físico e recursos temporários de cena." },
];

export const FM_STARTER_EQUIPMENT_BY_GRADE: Record<FMCursedToolGrade, string> = {
  fourth: "Dois itens de custo 1.",
  third: "Três itens de custo 1 e um item de custo 2.",
  second: "Três itens de custo 1, dois itens de custo 2 e um item de custo 3.",
  first: "Três itens de custo 1, três itens de custo 2, dois itens de custo 3 e um item de custo 4.",
  special: "Itens de custo 1 sem limite, quatro de custo 2, três de custo 3 e dois de custo 4.",
};

export function getAptitudeCatalogEntry(id: string) {
  return FM_APTITUDE_CATALOG.find(entry => entry.id === id);
}

export function getAptitudePointSummary(sheet: Pick<FMCharacterSheet, "progression" | "aptitudes">) {
  const level = Math.max(1, Math.min(30, Math.floor(sheet.progression.level)));
  const total = Math.floor(level / 2) + Math.floor(level / 10);
  const spent = sheet.aptitudes.reduce((sum, aptitude) => sum + Math.max(0, aptitude.cost), 0);
  return { total, spent, available: Math.max(0, total - spent) };
}

export function canLearnAptitude(sheet: Pick<FMCharacterSheet, "progression" | "aptitudes">, catalogId: string) {
  const aptitude = getAptitudeCatalogEntry(catalogId);
  const hasPrerequisite = aptitude?.prerequisite === "—" || sheet.aptitudes.some(item => item.name === aptitude?.prerequisite);
  return Boolean(aptitude && hasPrerequisite && sheet.progression.level >= aptitude.requiredLevel && !sheet.aptitudes.some(item => item.catalogId === catalogId) && getAptitudePointSummary(sheet).available >= aptitude.cost);
}

export function getTrainingFocusSummary(sheet: Pick<FMCharacterSheet, "houseRules" | "training">) {
  const total = Math.max(0, Math.floor(sheet.houseRules.downtime.interludes * 2));
  const spent = sheet.training.reduce((sum, track) => sum + Math.max(0, Math.min(4, track.stage)), 0);
  return { total, spent, available: Math.max(0, total - spent) };
}

export function canAdvanceTraining(sheet: Pick<FMCharacterSheet, "houseRules" | "training">, trackId: FMTrainingTrackKey) {
  const current = sheet.training.find(track => track.trackId === trackId)?.stage ?? 0;
  return current < 4 && getTrainingFocusSummary(sheet).available > 0;
}
