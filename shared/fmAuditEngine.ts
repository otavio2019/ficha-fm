import { getAptitudeCatalogEntry, getAptitudeDefinition, getAptitudePointSummary, getTrainingFocusSummary } from "./fmCampaignCapabilities";
import { getEquipmentCatalogEntry, getSkillCatalogEntry } from "./fmCatalogs";
import { calculateCharacterState, formatRequirement, getCharacterModifierSources } from "./fmCharacterState";
import { validateHouseRules } from "./fmHouseRules";
import { getClanCatalogEntry, getOriginAttributeAllocation, getOriginCatalogEntry } from "./fmOrigins";
import { getInfiniteWorldLevel } from "./infiniteWorlds";
import { getDerivedValues, getHighestSpellLevel, getInventoryLoad, getTechniquePowerProgression } from "./fmRules";
import { validateTechnique } from "./fmTechniques";
import type { FMCharacterSheet } from "./fmTypes";
import { FM_AUDIT_CATEGORY_META, auditMeta, summarizeAudit, type FMAuditCategory, type FMAuditFinding, type FMAuditResult, type FMAuditSeverity } from "./fmAudit";

type FindingOptions = Pick<FMAuditFinding, "currentValue" | "expectedValue" | "detail"> & { focus?: string };

function describeValue(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value || "Não informado";
  return "Não informado";
}

export function auditCharacter(sheet: FMCharacterSheet): FMAuditResult {
  const findings: FMAuditFinding[] = [];
  const state = calculateCharacterState(sheet);
  const derived = getDerivedValues(sheet);
  const add = (category: FMAuditCategory, severity: FMAuditSeverity, title: string, description: string, options: FindingOptions = {}) => {
    const meta = auditMeta(category);
    findings.push({ id: `${category}:${findings.length + 1}`, category, severity, title, description, currentValue: options.currentValue, expectedValue: options.expectedValue, detail: options.detail, navigation: { tab: meta.tab, focus: options.focus } });
  };
  const pass = (category: FMAuditCategory, title: string, description: string, options?: FindingOptions) => add(category, "passed", title, description, options);
  const warn = (category: FMAuditCategory, title: string, description: string, options?: FindingOptions) => add(category, "warning", title, description, options);
  const error = (category: FMAuditCategory, title: string, description: string, options?: FindingOptions) => add(category, "error", title, description, options);

  if (sheet.identity.name.trim()) pass("identity", "Identidade principal preenchida", `Personagem: ${sheet.identity.name.trim()}.`, { focus: "identity-name" });
  else error("identity", "Nome do personagem ausente", "A ficha precisa de um nome para ser identificada.", { expectedValue: "Nome preenchido", focus: "identity-name" });
  if (!sheet.identity.player.trim()) warn("identity", "Jogador não informado", "Este é um campo opcional; a ficha não é invalidada por permanecer vazio.", { focus: "identity-player" });
  else pass("identity", "Jogador informado", `Responsável: ${sheet.identity.player.trim()}.`, { focus: "identity-player" });

  const origin = getOriginCatalogEntry(sheet.origin.catalogId);
  if (sheet.origin.catalogId === "custom") warn("origin", "Origem personalizada", "A origem personalizada foi preservada, mas bônus e restrições específicos só podem ser auditados quando forem estruturados.", { focus: "origin" });
  else if (!origin) error("origin", "Origem inválida", "A origem selecionada não pertence ao catálogo estruturado.", { currentValue: sheet.origin.catalogId, focus: "origin" });
  else {
    pass("origin", "Origem reconhecida", `${origin.name} está vinculada ao catálogo da guilda.`, { currentValue: origin.name, focus: "origin" });
    const allocation = getOriginAttributeAllocation(sheet.origin.catalogId, sheet.origin.clanId);
    if (allocation) {
      const bonuses = sheet.origin.attributeBonuses;
      const entries = Object.entries(bonuses);
      const total = entries.reduce((sum, [, value]) => sum + (typeof value === "number" ? value : 0), 0);
      const invalidValue = entries.some(([attribute, value]) => typeof value !== "number" || value < 0 || value > allocation.maximumPerAttribute || Boolean(value) && Boolean(allocation.allowedAttributes) && !allocation.allowedAttributes!.includes(attribute as keyof typeof bonuses));
      const requiredMissing = Object.entries(allocation.requiredBonuses ?? {}).some(([attribute, minimum]) => Number(bonuses[attribute as keyof typeof bonuses] ?? 0) < minimum);
      if (invalidValue || total > allocation.total || requiredMissing) error("origin", "Bônus de origem inconsistentes", "A distribuição não respeita os limites definidos para a origem ou clã.", { currentValue: `${total} ponto(s) distribuído(s)`, expectedValue: `até ${allocation.total}; máximo ${allocation.maximumPerAttribute} por atributo`, focus: "origin-bonuses" });
      else pass("origin", "Bônus de origem válidos", `${total}/${allocation.total} ponto(s) de origem distribuído(s) dentro dos limites.`, { focus: "origin-bonuses" });
    }
  }

  if (sheet.origin.catalogId === "inherited") {
    const clan = getClanCatalogEntry(sheet.origin.clanId);
    if (sheet.origin.clanId === "custom") warn("clan", "Clã personalizado", "A linhagem foi informada como personalizada; a auditoria não inventa restrições para ela.", { focus: "origin-clan" });
    else if (!clan) error("clan", "Clã estruturado inválido", "A origem Herdado exige um clã reconhecido ou uma linhagem personalizada declarada.", { currentValue: sheet.origin.clanId, focus: "origin-clan" });
    else pass("clan", "Clã compatível com a origem", `${clan.name} está corretamente associado à origem Herdado.`, { focus: "origin-clan" });
  } else if (sheet.origin.clanId !== "custom") error("clan", "Clã incompatível com a origem", "Benefícios estruturados de clã só são aplicáveis à origem Herdado.", { currentValue: sheet.origin.clanId, expectedValue: "Origem Herdado", focus: "origin-clan" });
  else pass("clan", "Nenhum clã estruturado incompatível", "A ficha não aplica benefícios de clã fora da origem Herdado.", { focus: "origin-clan" });

  for (const [attribute, breakdown] of Object.entries(state.attributeBreakdown)) {
    const expected = breakdown.base + breakdown.entries.reduce((sum, entry) => sum + entry.value, 0);
    if (breakdown.final !== expected) error("attributes", `${attribute} inconsistente`, "O valor final não corresponde à soma da base e dos modificadores aplicados.", { currentValue: String(breakdown.final), expectedValue: String(expected), focus: `attribute-${attribute}` });
    else pass("attributes", `${attribute} calculado`, `Base ${breakdown.base} + modificadores ${expected - breakdown.base} = final ${breakdown.final}.`, { focus: `attribute-${attribute}` });
  }

  const race = sheet.mechanics.race;
  if (!race) warn("origin", "Raça não estruturada", "Não há uma Raça estruturada aplicada; esta verificação permanece disponível quando a ficha usar esse módulo.", { focus: "race" });
  else {
    const evolution = race.evolutions.find(item => item.id === race.selectedEvolutionId);
    if (race.selectedEvolutionId && !evolution) error("origin", "Evolução de Raça inválida", "A evolução selecionada não pertence à Raça atual.", { currentValue: race.selectedEvolutionId, focus: "race" });
    else if (evolution) pass("origin", "Evolução de Raça reconhecida", `${evolution.name} é a forma ativa da Raça. Seus requisitos e modificadores foram avaliados no estado calculado.`, { focus: "race" });
    else pass("origin", "Raça sem evolução selecionada", `${race.name} usa seus modificadores-base sem duplicação de evolução.`, { focus: "race" });
  }

  sheet.skills.forEach(skill => {
    const catalog = skill.catalogId ? getSkillCatalogEntry(skill.catalogId) : null;
    if (!skill.name.trim()) error("skills", "Perícia sem nome", "Toda perícia precisa ter um nome.", { focus: "skills" });
    else if (skill.catalogId && (!catalog || catalog.name !== skill.name || catalog.attribute !== skill.attribute)) error("skills", `Perícia inválida: ${skill.name}`, "Os dados da perícia não correspondem ao catálogo oficial.", { focus: "skills" });
    else if (catalog?.requiresTraining && skill.proficiency === "untrained") error("skills", `Treinamento ausente: ${skill.name}`, "Esta perícia exige treinamento conforme o catálogo oficial.", { expectedValue: "Treinada ou Mestre", focus: "skills" });
    else pass("skills", `Perícia válida: ${skill.name}`, `Atributo ${skill.attribute} e proficiência ${skill.proficiency} foram reconhecidos.`, { focus: "skills" });
  });
  if (!sheet.skills.length) warn("skills", "Nenhuma Perícia registrada", "A ficha permanece válida; não há perícias estruturadas para verificar.", { focus: "skills" });

  const aptitudePoints = getAptitudePointSummary(sheet);
  if (aptitudePoints.spent > aptitudePoints.total) error("points", "Pontos de Aptidão excedidos", "O custo das Aptidões supera o orçamento liberado pelo nível.", { currentValue: `${aptitudePoints.spent} gastos`, expectedValue: `${aptitudePoints.total} disponíveis`, focus: "aptitudes" });
  else pass("points", "Orçamento de Aptidões consistente", `${aptitudePoints.spent}/${aptitudePoints.total} ponto(s) de Aptidão utilizados.`, { focus: "aptitudes" });
  sheet.aptitudes.forEach(aptitude => {
    if (aptitude.catalogId.startsWith("homebrew:")) {
      if (!aptitude.approved) warn("aptitudes", `Aptidão Homebrew aguardando aprovação: ${aptitude.name}`, "O conteúdo foi mantido como Homebrew e não é tratado como erro automático.", { focus: "aptitudes" });
      else pass("aptitudes", `Aptidão Homebrew aprovada: ${aptitude.name}`, "A referência Homebrew está ativa para o personagem.", { focus: "aptitudes" });
      return;
    }
    const catalog = getAptitudeCatalogEntry(aptitude.catalogId);
    if (!catalog) error("aptitudes", `Aptidão inválida: ${aptitude.name}`, "A Aptidão não pertence ao catálogo oficial.", { focus: "aptitudes" });
    else if (sheet.progression.level < catalog.requiredLevel) error("aptitudes", `Nível insuficiente para ${catalog.name}`, "A Aptidão foi adquirida antes do nível requerido.", { currentValue: `Nível ${sheet.progression.level}`, expectedValue: `Nível ${catalog.requiredLevel}`, focus: "aptitudes" });
    else if (catalog.prerequisite !== "—" && !sheet.aptitudes.some(item => item.name === catalog.prerequisite)) error("aptitudes", `Pré-requisito ausente: ${catalog.name}`, "A cadeia de Aptidões do catálogo não foi atendida.", { expectedValue: catalog.prerequisite, focus: "aptitudes" });
    else pass("aptitudes", `Aptidão válida: ${catalog.name}`, `Custo ${catalog.cost} e requisitos de nível reconhecidos.`, { focus: "aptitudes" });
  });

  const trainingFocus = getTrainingFocusSummary(sheet);
  if (trainingFocus.spent > trainingFocus.total) error("training", "Focos de Treinamento excedidos", "A soma dos estágios supera os focos obtidos por Interlúdios.", { currentValue: `${trainingFocus.spent} gastos`, expectedValue: `${trainingFocus.total} disponíveis`, focus: "aptitudes" });
  else pass("training", "Focos de Treinamento consistentes", `${trainingFocus.spent}/${trainingFocus.total} foco(s) utilizados.`, { focus: "aptitudes" });
  sheet.training.forEach(track => {
    if (track.stage < 0 || track.stage > 4) error("training", `Estágio inválido: ${track.label ?? track.trackId}`, "Treinamentos aceitam apenas estágios de 0 a 4.", { currentValue: String(track.stage), expectedValue: "0 a 4", focus: "aptitudes" });
    else pass("training", `Treinamento válido: ${track.label ?? track.trackId}`, `Estágio ${track.stage} reconhecido.`, { focus: "aptitudes" });
  });

  const specialization = sheet.progression.specialization;
  const techniqueIssues = validateTechnique(sheet.technique, specialization, { requireCounterplay: true });
  if (!sheet.technique.name.trim()) warn("technique", "Nenhuma Técnica estruturada vinculada", "A ficha não possui Técnica para auditar; isto não altera automaticamente a validade geral.", { focus: "technique" });
  else if (techniqueIssues.length) techniqueIssues.forEach(issue => error("technique", `Técnica: ${issue.message}`, "A Técnica não atende à validação já usada no salvamento da ficha.", { focus: "technique" }));
  else pass("technique", `Técnica válida: ${sheet.technique.name}`, "Tipo, campos obrigatórios e contrajogo passaram pela validação compartilhada.", { focus: "technique" });

  const highestSpellLevel = getHighestSpellLevel(sheet.progression.level);
  const progression = getTechniquePowerProgression(specialization, sheet.progression.specializationLevels);
  if (sheet.spells.filter(spell => spell.sourcePowerId).length > progression.availableSlots) error("powers", "Vagas de poder excedidas", "A quantidade de poderes selecionados supera a progressão da especialização.", { currentValue: `${sheet.spells.filter(spell => spell.sourcePowerId).length} selecionados`, expectedValue: `${progression.availableSlots} vaga(s)`, focus: "spells" });
  sheet.spells.forEach(spell => {
    if (spell.level > highestSpellLevel) error("powers", `Feitiço acima do nível: ${spell.name || "Sem nome"}`, "O nível do feitiço excede o limite atual da progressão.", { currentValue: `Nível ${spell.level}`, expectedValue: `até ${highestSpellLevel}`, focus: "spells" });
    else if (spell.sourcePowerId) {
      const power = sheet.technique.powers.find(item => item.id === spell.sourcePowerId);
      if (!power) error("powers", `Poder inválido: ${spell.name || "Sem nome"}`, "O poder selecionado não pertence à Técnica vinculada.", { focus: "spells" });
      else if (power.requiredCharacterLevel > sheet.progression.specializationLevels) error("powers", `Poder bloqueado: ${power.name}`, "O nível de especialização ainda não libera este poder.", { currentValue: `Nível ${sheet.progression.specializationLevels}`, expectedValue: `Nível ${power.requiredCharacterLevel}`, focus: "spells" });
      else pass("powers", `Poder válido: ${power.name}`, "O poder pertence à Técnica e está liberado pela progressão atual.", { focus: "spells" });
    }
  });
  if (!sheet.spells.length) pass("powers", "Nenhum poder selecionado", "Não há poderes ou feitiços estruturados para invalidar.", { focus: "spells" });

  const vow = sheet.houseRules.birthVow;
  if (vow.type === "none") pass("vows", "Nenhum Voto ativo", "A ficha não aplica efeitos de voto de nascimento.", { focus: "house-vow" });
  else if (!vow.approved) warn("vows", "Voto aguardando aprovação", "O Voto permanece registrado, mas seus efeitos não são aplicados até aprovação.", { focus: "house-vow" });
  else if (vow.active === false) warn("vows", "Voto inativo", "O Voto está aprovado, mas foi marcado como inativo e não aplica modificadores.", { focus: "house-vow" });
  else pass("vows", "Voto ativo e aprovado", "Os requisitos e modificadores do Voto foram incluídos no estado calculado.", { focus: "house-vow" });

  const inventory = getInventoryLoad(sheet);
  if (inventory.impossible) error("equipment", "Carga impossível", "A carga excede o máximo absoluto calculado para a ficha.", { currentValue: `${inventory.spaces} espaços`, expectedValue: `até ${inventory.maximum}`, focus: "equipment" });
  else if (inventory.overloaded) warn("equipment", "Carga acima da capacidade", "A carga ultrapassa a capacidade normal, embora ainda não exceda o máximo absoluto.", { currentValue: `${inventory.spaces} espaços`, expectedValue: `até ${inventory.capacity}`, focus: "equipment" });
  else pass("equipment", "Carga válida", `${inventory.spaces}/${inventory.capacity} espaço(s) de carga utilizados.`, { focus: "equipment" });
  sheet.equipment.forEach(item => {
    const catalog = item.catalogId ? getEquipmentCatalogEntry(item.catalogId) : null;
    if (item.catalogId && (!catalog || catalog.name !== item.name || catalog.category !== item.category)) error("equipment", `Equipamento inválido: ${item.name}`, "Os dados não correspondem ao banco oficial.", { focus: "equipment" });
    else pass("equipment", `Equipamento reconhecido: ${item.name}`, item.catalogId ? "O item corresponde ao catálogo oficial." : "Item personalizado mantido sem regra adicional presumida.", { focus: "equipment" });
  });

  const expectedLevel = getInfiniteWorldLevel(sheet.progression.experience);
  if (sheet.progression.level !== expectedLevel) error("progression", "Nível incompatível com XP", "O nível atual não corresponde à tabela Infinite Worlds.", { currentValue: `Nível ${sheet.progression.level}`, expectedValue: `Nível ${expectedLevel}`, focus: "missions" });
  else pass("progression", "Nível compatível com XP", `${sheet.progression.experience} XP corresponde ao nível ${expectedLevel}.`, { focus: "missions" });
  if (sheet.progression.specializationTracks.length) {
    const total = sheet.progression.specializationTracks.reduce((sum, track) => sum + track.level, 0);
    if (total !== sheet.progression.level) error("progression", "Multiclasse inconsistente", "A soma dos níveis de especialização precisa coincidir com o nível geral.", { currentValue: `${total} nível(is)`, expectedValue: `${sheet.progression.level} nível(is)`, focus: "specialization" });
    else pass("progression", "Multiclasse consistente", `A divisão de especializações totaliza nível ${total}.`, { focus: "specialization" });
  }

  state.requirements.forEach(check => {
    const source = getCharacterModifierSources(sheet).find(item => item.id === check.sourceId);
    if (check.met) pass("requirements", `Requisito atendido: ${check.sourceName}`, check.message, { focus: "attributes" });
    else if (source?.enabled) error("requirements", `Requisito não atendido: ${check.sourceName}`, check.message, { currentValue: "Não atendido", expectedValue: formatRequirement(check.requirement), focus: "attributes" });
    else warn("requirements", `Requisito pendente: ${check.sourceName}`, `${check.message} A fonte está inativa ou aguarda aprovação, portanto seus efeitos não foram aplicados.`, { focus: "attributes" });
  });
  if (!state.requirements.length) pass("requirements", "Nenhum requisito mecânico pendente", "Não há fontes estruturadas exigindo condição adicional.", { focus: "attributes" });

  const houseIssues = validateHouseRules(sheet.houseRules);
  if (houseIssues.length) houseIssues.forEach(issue => error("guild-rules", "Regra da Guilda inconsistente", issue, { focus: "house" }));
  else pass("guild-rules", "Regras da Guilda válidas", "Os dados estruturados das Regras da Casa passaram pela validação existente.", { focus: "house" });

  const categories = FM_AUDIT_CATEGORY_META.map(meta => ({ category: meta.id, available: true, findings: findings.filter(item => item.category === meta.id) }));
  return { summary: summarizeAudit(findings), categories, findings };
}

export function formatAuditStatus(result: FMAuditResult) {
  if (result.summary.status === "needs-correction") return "Ficha possui erros";
  if (result.summary.status === "valid-with-warnings") return "Ficha válida com avisos";
  return "Ficha válida";
}
