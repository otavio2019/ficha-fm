import { describe, expect, it } from "vitest";
import { hydrateSheet } from "@shared/fmSheetHydration";

describe("hidratação de fichas legadas", () => {
  it("adiciona valores seguros das Regras da Casa a uma ficha salva sem esse bloco", () => {
    const sheet = hydrateSheet({ identity: { name: "Ficha antiga" }, progression: { level: 1, specialization: "fighter" } });
    expect(sheet.houseRules).toMatchObject({
      attributeGeneration: null,
      birthVow: { type: "none", approved: false, locked: false },
      actionDeclaration: { attribute: null, locked: false },
      rest: { exhaustion: 0, missionCount: 0 },
      dedicationRewarding: false,
    });
    expect(sheet.origin).toMatchObject({ catalogId: "custom", clanId: "custom", clan: "" });
    expect(sheet.invocations).toEqual([]);
    expect(sheet.images).toEqual([]);
    expect(sheet.missionRewards).toEqual([]);
    expect(sheet.aptitudes).toEqual([]);
    expect(sheet.training).toEqual([]);
    expect(sheet.allies).toEqual([]);
    expect(sheet.cursedTools).toEqual([]);
    expect(sheet.domainExpansion).toBeNull();
  });

  it("reconhece um nome de clã legado sem perder a linhagem textual", () => {
    const sheet = hydrateSheet({ origin: { catalogId: "inherited", clan: "Clã Zenin" } });
    expect(sheet.origin).toMatchObject({ catalogId: "inherited", clanId: "zenin", clan: "Clã Zenin" });
  });

  it("preserva escolha primária vazia em ficha nova e cria uma trilha compatível para ficha legada", () => {
    const newSheet = hydrateSheet({ progression: { specialization: "fighter", primarySpecialization: null, primarySpecializationLocked: false, specializationTracks: [] } });
    const legacySheet = hydrateSheet({ progression: { level: 3, specialization: "technique-specialist", specializationLevels: 3 } });
    expect(newSheet.progression).toMatchObject({ primarySpecialization: null, primarySpecializationLocked: false, specializationTracks: [] });
    expect(legacySheet.progression).toMatchObject({ primarySpecialization: "technique-specialist", primarySpecializationLocked: true, specializationTracks: [{ specialization: "technique-specialist", level: 3 }] });
  });

  it("normaliza uma ficha Restringida legada para Estilo Marcial e inicializa escolhas de Especialização", () => {
    const sheet = hydrateSheet({ progression: { level: 2, specialization: "restricted", specializationLevels: 2 }, technique: { kind: "cursed", name: "Legado" } });
    expect(sheet.technique.kind).toBe("martial");
    expect(sheet.progression.specializationAbilityChoices).toEqual([]);
  });

  it("cria e preserva os três núcleos ao hidratar Corpo Amaldiçoado Mutante mais de uma vez", () => {
    const first = hydrateSheet({ origin: { catalogId: "mutant-cursed-corpse" }, attributes: { base: { strength: 12, dexterity: 11, constitution: 10, intelligence: 10, wisdom: 9, presence: 8 } } });
    const second = hydrateSheet(first);
    expect(first.mutantCores?.cores).toHaveLength(3);
    expect(second.mutantCores?.cores).toHaveLength(3);
    expect(second.mutantCores?.primaryCoreId).toBe(first.mutantCores?.primaryCoreId);
    expect(new Set(second.mutantCores?.cores.map(core => core.id)).size).toBe(3);
  });

  it("preserva identidade, características, técnica, equipamento e diário após recarregar a ficha reorganizada", () => {
    const sheet = hydrateSheet({
      identity: { name: "Maki", player: "Jogadora", grade: "2º Grau" },
      attributes: { base: { strength: 14 }, permanentBonuses: { strength: 1 } },
      techniqueLibraryId: "tecnica-001",
      technique: { name: "Matriz de Aço", basicFunction: "Cria armas amaldiçoadas.", attributeKeys: ["strength"], limitations: "Exige metal disponível.", powers: [{ id: "poder-aco", name: "Lâmina Moldada", requiredCharacterLevel: 2, spellLevel: 1, type: "damage", summary: "Molda uma lâmina de aço.", requirement: "Exige metal disponível." }] },
      spells: [{ id: "spell-aco", sourcePowerId: "poder-aco", name: "Lâmina Moldada", type: "damage", level: 1, casting: "common", reach: "Toque", targetOrArea: "Uma criatura", durationType: "immediate", durationDetail: "", effect: "Molda uma lâmina de aço.", counterplay: "Defesa", requirement: "Exige metal disponível.", damage: "", damageType: "", resolution: "attack", savingThrow: "", costAdjustment: 0, combatModifierTarget: "none", combatModifier: 0, notes: "", active: false }],
      equipment: [{ id: "item-1", name: "Lança", quantity: 1 }],
      images: [{ id: "img-1", key: "fichas/maki.png", url: "/manus-storage/fichas/maki.png", name: "maki.png", caption: "Retrato", createdAt: 100 }],
      diary: [{ id: "nota-1", at: 100, category: "note", title: "Entrada", detail: "Registro preservado." }],
    });
    expect(sheet.identity).toMatchObject({ name: "Maki", player: "Jogadora", grade: "2º Grau" });
    expect(sheet.attributes.base.strength).toBe(14);
    expect(sheet.attributes.permanentBonuses.strength).toBe(1);
    expect(sheet.techniqueLibraryId).toBe("tecnica-001");
    expect(sheet.technique).toMatchObject({ name: "Matriz de Aço", attributeKeys: ["strength"] });
    expect(sheet.technique.powers).toMatchObject([{ id: "poder-aco", requiredCharacterLevel: 2 }]);
    expect(sheet.spells).toMatchObject([{ sourcePowerId: "poder-aco", name: "Lâmina Moldada" }]);
    expect(sheet.equipment).toHaveLength(1);
    expect(sheet.images).toMatchObject([{ name: "maki.png", caption: "Retrato" }]);
    expect(sheet.diary).toHaveLength(1);
  });

  it("preserva o livro-razão de recompensas ao recarregar a ficha", () => {
    const sheet = hydrateSheet({ missionRewards: [{ id: "mission-1", at: 500, title: "Rastro de Cinzas", grade: "4º Grau", difficulty: "hard", moneyDifficulty: "normal", base: { experience: 8, money: 5000, interludes: 1, description: "Tabela Infinite Worlds" }, extra: { experience: 2, money: 1000, interludes: 0, description: "Recebeu um talismã" }, total: { experience: 10, money: 6000, interludes: 1, description: "Recebeu um talismã" } }] });
    expect(sheet.missionRewards).toMatchObject([{ id: "mission-1", title: "Rastro de Cinzas", total: { experience: 10, money: 6000, interludes: 1 } }]);
  });

  it("preserva as capacidades avançadas ao recarregar a ficha", () => {
    const sheet = hydrateSheet({ aptitudes: [{ id: "apt-1", catalogId: "barriers", name: "Barreiras", group: "domain", requiredLevel: 3, cost: 1, prerequisite: "—", effect: "Cria barreiras.", approved: true }], training: [{ trackId: "barriers", stage: 2, notes: "Treino" }], allies: [{ id: "ally-1", name: "Ieiri", role: "Suporte", bond: "Médica", healthCurrent: 12, healthMaximum: 12, defense: 13, actions: [], notes: "" }], cursedTools: [{ id: "tool-1", name: "Lâmina Selada", category: "weapon", grade: "second", costTier: 2, spaces: 1, requirements: "", effect: "Corte", approved: true, enchantments: [], notes: "" }], domainExpansion: { name: "Jardim Vazio", type: "incomplete", requiredLevel: 8, energyCost: 12, barrierHealth: 30, barrierResilience: 4, guaranteedHit: false, maximumTechnique: "", effect: "Silencia", counterplay: "Domínio simples", approved: false } });
    expect(sheet).toMatchObject({ aptitudes: [{ catalogId: "barriers" }], training: [{ trackId: "barriers", stage: 2 }], allies: [{ name: "Ieiri" }], cursedTools: [{ name: "Lâmina Selada" }], domainExpansion: { name: "Jardim Vazio", type: "incomplete" } });
  });

  it("preserva Votos próprios, Recursos Extras e Transformações ao recarregar", () => {
    const sheet = hydrateSheet({
      houseRules: { customVows: [{ id: "voto-1", name: "Pacto", description: "", conditions: "", benefits: [], drawbacks: [], requirements: [], limitations: "", notes: "", approved: true, active: true }] },
      customResources: [{ id: "foco", name: "Foco", description: "", current: 2, baseMaximum: 4, minimum: 0, unit: "cargas", notes: "" }],
      transformations: [{ id: "forma", name: "Forma", description: "", requirements: [], benefits: [], drawbacks: [], durationRounds: null, elapsedRounds: 0, conditions: "", notes: "", active: true }],
      training: [{ trackId: "barriers", stage: 1, notes: "", stageEffects: { 1: { description: "Base", modifiers: [], unlocks: [], limitations: "" } } }],
    });
    expect(sheet).toMatchObject({ houseRules: { customVows: [{ id: "voto-1", active: true }] }, customResources: [{ id: "foco", unit: "cargas" }], transformations: [{ id: "forma", active: true }], training: [{ stageEffects: { 1: { description: "Base" } } }] });
  });

  it("preserva escolhas e evoluções estruturadas de Raça ao recarregar", () => {
    const sheet = hydrateSheet({ mechanics: { race: { id: "linhagem", sourceKind: "custom", name: "Linhagem", description: "", active: true, requirements: [], modifiers: [], characteristics: [], abilities: ["Sentidos ampliados"], choices: [{ id: "afinidade", label: "Afinidade", description: "", requirements: [], options: [{ id: "agil", name: "Ágil", description: "", modifiers: [] }] }], selectedChoices: [{ choiceId: "afinidade", optionId: "agil" }], evolutions: [{ id: "forma-3", name: "Forma desperta", description: "", requirements: [{ type: "level-min", minimum: 3 }], modifiers: [], characteristics: [], abilities: ["Forma desperta"], choices: [] }], selectedEvolutionId: "forma-3" } } });
    expect(sheet.mechanics.race).toMatchObject({ name: "Linhagem", selectedChoices: [{ optionId: "agil" }], evolutions: [{ id: "forma-3", abilities: ["Forma desperta"] }] });
  });

  it("inicializa História de Personagem vazia sem alterar o Domínio legado", () => {
    const sheet = hydrateSheet({ personal: { innateDomain: "Jardim do Silêncio" } });
    expect(sheet.characterHistory).toBe("");
    expect(sheet.personal.innateDomain).toBe("Jardim do Silêncio");
  });

  it("preserva História de Personagem e Domínio como campos independentes", () => {
    const sheet = hydrateSheet({ characterHistory: "Cresceu entre feiticeiros renegados.", personal: { innateDomain: "Arquivo de Cinzas" } });
    expect(sheet.characterHistory).toBe("Cresceu entre feiticeiros renegados.");
    expect(sheet.personal.innateDomain).toBe("Arquivo de Cinzas");
  });

  it("hidrata os blocos de sobrevivência e resistência com valores seguros", () => {
    const sheet = hydrateSheet({ deathSaves: { successes: 2, failures: 1, stabilized: true, notes: "Ajuda recebida" }, damageReductions: [{ id: "rd-1", damageType: "Cortante", amount: 3, notes: "Armadura" }], resistances: ["Fogo"], vulnerabilities: ["Dano na alma"], inspiration: 2, energyLimit: 99 });
    expect(sheet.deathSaves).toEqual({ successes: 2, failures: 1, stabilized: true, notes: "Ajuda recebida" });
    expect(sheet.damageReductions).toMatchObject([{ damageType: "Cortante", amount: 3 }]);
    expect(sheet.resistances).toEqual(["Fogo"]);
    expect(sheet.vulnerabilities).toEqual(["Dano na alma"]);
    expect(sheet.inspiration).toBe(2);
    expect(sheet.energyLimit).toBe(99);
  });
});
