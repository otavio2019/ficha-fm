import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createFMChangeHistory: vi.fn(),
  createFMCharacterShare: vi.fn(),
  createFMContentShare: vi.fn(),
  createFMReview: vi.fn(),
  deleteFMCharacter: vi.fn(),
  deleteFMHomebrew: vi.fn(),
  deleteFMTechnique: vi.fn(),
  getFMCharacter: vi.fn(),
  getFMCharacterShare: vi.fn(),
  getFMContentShare: vi.fn(),
  getFMHomebrew: vi.fn(),
  getFMReview: vi.fn(),
  getFMTechnique: vi.fn(),
  getSharedFMContent: vi.fn(),
  getSharedFMCharacter: vi.fn(),
  listFMChangeHistory: vi.fn(),
  listFMCharacters: vi.fn(),
  listFMCharacterShares: vi.fn(),
  listFMContentShares: vi.fn(),
  listFMHomebrews: vi.fn(),
  listFMReviews: vi.fn(),
  listFMTechniques: vi.fn(),
  saveFMCharacter: vi.fn(),
  saveFMHomebrew: vi.fn(),
  saveFMTechnique: vi.fn(),
  regenerateFMContentShare: vi.fn(),
  setFMContentShareEnabled: vi.fn(),
  updateFMReview: vi.fn(),
}));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

import { createFMChangeHistory, createFMCharacterShare, createFMContentShare, createFMReview, deleteFMCharacter, deleteFMHomebrew, deleteFMTechnique, getFMCharacter, getFMCharacterShare, getFMContentShare, getFMHomebrew, getFMReview, getFMTechnique, getSharedFMCharacter, getSharedFMContent, listFMHomebrews, listFMTechniques, regenerateFMContentShare, saveFMCharacter, saveFMHomebrew, saveFMTechnique, setFMContentShareEnabled, updateFMReview } from "./db";
import { appRouter } from "./routers";
import { storagePut } from "./storage";
import { createTechniqueFromPreset } from "../shared/fmCreationAssistant";
import { applyInfiniteWorldMission } from "../shared/infiniteWorlds";
import { createEmptyFMSheet } from "../shared/fmTypes";

function createContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: "Teste",
      email: "teste@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("characters.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("abre uma ficha pertencente ao usuário autenticado", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-123", ownerId: 1, name: "Megumi", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.get({ id: "ficha-123" })).resolves.toMatchObject({ id: "ficha-123", name: "Megumi" });
  });

  it("bloqueia a abertura de uma ficha de outro usuário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-456", ownerId: 2, name: "Nobara", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.get({ id: "ficha-456" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("biblioteca de fichas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria uma ficha vinculada ao usuário autenticado", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue(undefined);
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-nova", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.save({ id: "ficha-nova", name: "Yuji", portraitUrl: null, sheet: {} })).resolves.toMatchObject({ ownerId: 1, name: "Yuji" });
    expect(saveFMCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: "ficha-nova", ownerId: 1, name: "Yuji" }));
  });

  it("envia uma imagem apenas para a ficha do proprietário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-imagem", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(storagePut).mockResolvedValue({ key: "fm-characters/1/ficha-imagem/retrato_hash.png", url: "/manus-storage/fm-characters/1/ficha-imagem/retrato_hash.png" });
    const caller = appRouter.createCaller(createContext(1));

    const uploaded = await caller.characters.uploadImage({ characterId: "ficha-imagem", fileName: "retrato.png", contentType: "image/png", base64: Buffer.from("imagem de teste").toString("base64"), caption: "Retrato" });
    expect(uploaded).toMatchObject({ name: "retrato.png", caption: "Retrato", url: "/manus-storage/fm-characters/1/ficha-imagem/retrato_hash.png" });
    expect(storagePut).toHaveBeenCalledWith(expect.stringContaining("fm-characters/1/ficha-imagem/"), expect.any(Buffer), "image/png");
  });

  it("persiste o retrato principal sem adicioná-lo à galeria", async () => {
    const portraitUrl = "/manus-storage/fm-characters/1/ficha-retrato/retrato.png";
    const sheet = { identity: { name: "Maki", portraitUrl }, images: [{ id: "ref-1", key: "fichas/referencia.png", url: "/manus-storage/fichas/referencia.png", name: "referencia.png", caption: "Arma", createdAt: 100 }] };
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-retrato", ownerId: 1, name: "Maki", portraitUrl, sheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-retrato", ownerId: 1, name: "Maki", portraitUrl, sheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-retrato", name: "Maki", portraitUrl, sheet });
    await expect(caller.characters.get({ id: "ficha-retrato" })).resolves.toMatchObject({ portraitUrl, sheet: { identity: { portraitUrl }, images: [{ name: "referencia.png" }] } });
    expect(saveFMCharacter).toHaveBeenCalledWith(expect.objectContaining({ portraitUrl }));
  });

  it("bloqueia o envio de imagem para ficha de outro usuário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-imagem-alheia", ownerId: 2, name: "Nobara", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.uploadImage({ characterId: "ficha-imagem-alheia", fileName: "retrato.png", contentType: "image/png", base64: Buffer.from("imagem").toString("base64"), caption: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storagePut).not.toHaveBeenCalled();
  });

  it("aceita ficha legada sem o bloco de técnica", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue(undefined);
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-legada", ownerId: 1, name: "Yuta", portraitUrl: null, sheet: { identity: { name: "Yuta" } }, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.save({ id: "ficha-legada", name: "Yuta", sheet: { identity: { name: "Yuta" } } })).resolves.toMatchObject({ name: "Yuta" });
  });

  it("persiste e recupera todos os campos da técnica vinculada à ficha", async () => {
    const technique = { kind: "cursed" as const, name: "Fios da Aurora", basicFunction: "Manipula fios de energia para conectar alvos e objetos.", attributeKeys: ["dexterity", "intelligence"], intrinsicBenefits: "Uma ferramenta simples essencial.", limitations: "Exige linha de visão.", requiredItems: "Carretel amaldiçoado.", reviewNotes: "Aguardando aprovação do mestre." };
    const storedSheet = { progression: { specialization: "fighter" }, technique };
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-tecnica", ownerId: 1, name: "Maki", portraitUrl: null, sheet: storedSheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-tecnica", ownerId: 1, name: "Maki", portraitUrl: null, sheet: storedSheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-tecnica", name: "Maki", sheet: storedSheet });
    await expect(caller.characters.get({ id: "ficha-tecnica" })).resolves.toMatchObject({ sheet: { technique } });
    expect(saveFMCharacter).toHaveBeenCalledWith(expect.objectContaining({ sheet: storedSheet }));
  });

  it("persiste e recupera Multiclasse e entradas oficiais dos bancos", async () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.experience = 20;
    sheet.progression.level = 2;
    sheet.progression.specialization = "fighter";
    sheet.progression.specializationLevels = 1;
    sheet.progression.primarySpecialization = "fighter";
    sheet.progression.primarySpecializationLocked = true;
    sheet.progression.specializationTracks = [{ specialization: "fighter", level: 1 }, { specialization: "combat-specialist", level: 1 }];
    sheet.attributes.base.strength = 16;
    sheet.skills = [{ id: "percepcao", catalogId: "perception", name: "Percepção", attribute: "wisdom", proficiency: "trained", otherBonus: 0, notes: "" }];
    sheet.equipment = [{ id: "adaga", catalogId: "dagger", name: "Adaga", category: "weapon", damage: "1d6", damageType: "Perfurante", range: "6/18 m", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Fineza", quantity: 1, equipped: true, notes: "" }];
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-catalogos", ownerId: 1, name: "Maki", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-catalogos", ownerId: 1, name: "Maki", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-catalogos", name: "Maki", sheet });
    await expect(caller.characters.get({ id: "ficha-catalogos" })).resolves.toMatchObject({ sheet: { progression: { primarySpecialization: "fighter", primarySpecializationLocked: true, specializationTracks: [{ specialization: "fighter", level: 1 }, { specialization: "combat-specialist", level: 1 }] }, skills: [{ catalogId: "perception", name: "Percepção" }], equipment: [{ catalogId: "dagger", name: "Adaga", spaces: 1 }] } });
  });

  it("persiste e recupera o bloco completo de Regras da Casa", async () => {
    const houseRules = { rest: { exhaustion: 2, missionCount: 3, lastMissionAt: 1000, lastShortRestAt: null, lastLongRestAt: 2000, longRestMissionCount: 3 }, dedicationRewarding: true, downtime: { interludes: 1, craftingFocus: "Ferraria", professionChecksRequired: true, itemReviewRequired: true, freeBuildOptions: [{ id: "free-1", name: "Barreira", sourceSpecialization: "controller", prerequisites: "Nível 5", interludeCost: 1 }] } };
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-casa", ownerId: 1, name: "Maki", portraitUrl: null, sheet: { houseRules }, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-casa", ownerId: 1, name: "Maki", portraitUrl: null, sheet: { houseRules }, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-casa", name: "Maki", sheet: { houseRules } });
    await expect(caller.characters.get({ id: "ficha-casa" })).resolves.toMatchObject({ sheet: { houseRules } });
  });

  it("persiste e recupera XP, grau, descanso e Interlúdios após registrar uma missão", async () => {
    const base = createEmptyFMSheet();
    base.progression.experience = 75;
    base.progression.level = 4;
    base.progression.specializationLevels = 4;
    base.identity.grade = "4º Grau";
    const sheet = applyInfiniteWorldMission(base, "hard-plus", "normal", 1000, { title: "Rastro de Cinzas", experience: 2, money: 300, interludes: 0.5, description: "Talismã concedido pela guilda." }).sheet;
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-missao", ownerId: 1, name: "Megumi", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-missao", ownerId: 1, name: "Megumi", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-missao", name: "Megumi", sheet });
    await expect(caller.characters.get({ id: "ficha-missao" })).resolves.toMatchObject({ sheet: { progression: { experience: 89, level: 4 }, identity: { grade: "4º Grau" }, guild: { currency: 5300 }, houseRules: { rest: { exhaustion: 1, missionCount: 1 }, downtime: { interludes: 2 } }, missionRewards: [{ title: "Rastro de Cinzas", base: { experience: 12, money: 5000, interludes: 1.5 }, extra: { experience: 2, money: 300, interludes: 0.5, description: "Talismã concedido pela guilda." }, total: { experience: 14, money: 5300, interludes: 2 } }] } });
  });

  it("persiste e recupera origem selecionada e invocações da ficha", async () => {
    const invocations = [{ id: "inv-1", name: "Cão Divino", concept: "Rastreador amaldiçoado de sombra.", grade: "fourth", attributes: { strength: 10, dexterity: 12, constitution: 9, intelligence: 8, wisdom: 11, presence: 7 }, movement: 12, trainedAttack: "melee", trainedSavingThrow: "reflexos", trainedSkills: ["Percepção", "Furtividade"], actions: [{ id: "acao-1", name: "Morder", kind: "complex", effect: "Ataque amaldiçoado", counterplay: "Defesa" }], notes: "Invocação em campo na missão.", active: true }];
    const origin = { catalogId: "inherited", clanId: "zenin", name: "Herdado", clan: "Clã Zenin", attributeBonuses: { dexterity: 2, wisdom: 1 }, description: "Origem herdada." };
    const images = [{ id: "img-1", key: "fm-characters/1/ficha-invocacao/retrato.png", url: "/manus-storage/fm-characters/1/ficha-invocacao/retrato.png", name: "retrato.png", caption: "Referência", createdAt: 100 }];
    const sheet = { origin, invocations, images };
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-invocacao", ownerId: 1, name: "Megumi", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-invocacao", ownerId: 1, name: "Megumi", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-invocacao", name: "Megumi", sheet });
    await expect(caller.characters.get({ id: "ficha-invocacao" })).resolves.toMatchObject({ sheet: { origin, invocations, images } });
  });

  it("persiste e recupera aptidões, treinamentos, aliados, ferramentas e domínio", async () => {
    const sheet = { progression: { level: 3, specialization: "fighter" }, aptitudes: [{ id: "apt-1", catalogId: "barriers", name: "Barreiras", group: "domain", requiredLevel: 3, cost: 1, prerequisite: "—", effect: "Permite estruturar barreiras com efeito e contrajogo registrados.", approved: true }], training: [{ trackId: "barriers", stage: 2, notes: "Treino concluído." }], allies: [{ id: "ally-1", name: "Ieiri", role: "Suporte", bond: "Médica da equipe", healthCurrent: 12, healthMaximum: 12, defense: 13, actions: [{ id: "act-1", name: "Curar", effect: "Recupera recursos." }], notes: "Disponível na base." }], cursedTools: [{ id: "tool-1", name: "Lâmina Selada", category: "weapon", grade: "second", costTier: 2, spaces: 1, requirements: "Manejo de arma", effect: "Corte amaldiçoado.", approved: true, enchantments: [{ id: "ench-1", name: "Corte Vivo", effect: "Amplia o corte.", approved: false }], notes: "Revisada." }], domainExpansion: { name: "Jardim Vazio", type: "incomplete", requiredLevel: 8, energyCost: 12, barrierHealth: 30, barrierResilience: 4, guaranteedHit: false, maximumTechnique: "", effect: "Silencia a área.", counterplay: "Domínio simples.", approved: false } };
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-capacidades", ownerId: 1, name: "Megumi", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-capacidades", ownerId: 1, name: "Megumi", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-capacidades", name: "Megumi", sheet });
    await expect(caller.characters.get({ id: "ficha-capacidades" })).resolves.toMatchObject({ sheet: { aptitudes: [{ catalogId: "barriers", approved: true }], training: [{ trackId: "barriers", stage: 2 }], allies: [{ name: "Ieiri", actions: [{ name: "Curar" }] }], cursedTools: [{ name: "Lâmina Selada", enchantments: [{ name: "Corte Vivo" }] }], domainExpansion: { name: "Jardim Vazio", counterplay: "Domínio simples." } } });
  });

  it("recusa origem ou ação de Invocação inválidas", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-origem-invalida", name: "Yuji", sheet: { origin: { catalogId: "origem-inexistente" } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.characters.save({ id: "ficha-invocacao-invalida", name: "Yuji", sheet: { invocations: [{ name: "Shikigami", grade: "fourth", actions: [{ name: "Investida" }] }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("recusa aptidões fora do catálogo, nível, custo ou pré-requisito", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-aptidao-invalida", name: "Yuji", sheet: { progression: { level: 1, specialization: "fighter" }, aptitudes: [{ id: "apt-1", catalogId: "complete-domain", name: "Expansão de Domínio Completa", group: "domain", requiredLevel: 12, cost: 1, prerequisite: "Expansão de Domínio Incompleta", effect: "Habilita expansão completa com custo e contrajogo declarados.", approved: false }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("bloqueia selecionar poder de técnica antes do nível liberado", async () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.experience = 20;
    sheet.progression.level = 2;
    sheet.progression.specialization = "fighter";
    sheet.progression.specializationLevels = 2;
    sheet.technique.powers = [{ id: "poder-4", name: "Impacto Supremo", requiredCharacterLevel: 4, spellLevel: 1, type: "damage", summary: "Impacto concentrado.", requirement: "" }];
    sheet.spells = [{ id: "spell-1", sourcePowerId: "poder-4", name: "Impacto Supremo", type: "damage", level: 1, casting: "common", reach: "12 metros", targetOrArea: "Uma criatura", durationType: "immediate", durationDetail: "", effect: "Impacto concentrado.", counterplay: "Defesa", requirement: "", damage: "", damageType: "", resolution: "attack", savingThrow: "", costAdjustment: 0, combatModifierTarget: "none", combatModifier: 0, notes: "", active: false }];
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.save({ id: "ficha-poder-bloqueado", name: "Yuji", sheet })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("persiste e recupera um poder liberado selecionado da técnica", async () => {
    const sheet = createEmptyFMSheet();
    sheet.progression.experience = 20;
    sheet.progression.level = 2;
    sheet.progression.specialization = "technique-specialist";
    sheet.progression.specializationLevels = 2;
    sheet.technique.powers = [{ id: "poder-1", name: "Laço", requiredCharacterLevel: 1, spellLevel: 1, type: "damage", summary: "Fios prendem o alvo.", requirement: "Linha de visão." }];
    sheet.spells = [{ id: "spell-1", sourcePowerId: "poder-1", name: "Laço", type: "damage", level: 1, casting: "common", reach: "12 metros", targetOrArea: "Uma criatura", durationType: "immediate", durationDetail: "", effect: "Fios prendem o alvo.", counterplay: "Defesa", requirement: "Linha de visão.", damage: "", damageType: "", resolution: "attack", savingThrow: "", costAdjustment: 0, combatModifierTarget: "none", combatModifier: 0, notes: "", active: false }];
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-poder-liberado", ownerId: 1, name: "Yuta", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-poder-liberado", ownerId: 1, name: "Yuta", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-poder-liberado", name: "Yuta", sheet });
    await expect(caller.characters.get({ id: "ficha-poder-liberado" })).resolves.toMatchObject({ sheet: { technique: { powers: [{ id: "poder-1" }] }, spells: [{ sourcePowerId: "poder-1", name: "Laço" }] } });
  });

  it("aplica restrições estruturadas de origem", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-restringido-invalida", name: "Maki", sheet: { progression: { specialization: "fighter" }, origin: { catalogId: "restricted", attributeBonuses: {} } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.characters.save({ id: "ficha-sem-tecnica-invalida", name: "Kusakabe", sheet: { progression: { specialization: "technique-specialist" }, origin: { catalogId: "technique-less", attributeBonuses: {} }, spells: [{ level: 1 }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.characters.save({ id: "ficha-herdado-sem-cla", name: "Megumi", sheet: { origin: { catalogId: "inherited", clanId: "custom", clan: "", attributeBonuses: {} } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.characters.save({ id: "ficha-gojo-bonus-invalido", name: "Satoru", sheet: { origin: { catalogId: "inherited", clanId: "gojo", clan: "Clã Gojo", attributeBonuses: { strength: 1, intelligence: 2 } } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("bloqueia edição de Origem e Invocações em ficha de outro usuário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-invocacao-alheia", ownerId: 2, name: "Megumi", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-invocacao-alheia", name: "Megumi", sheet: { origin: { catalogId: "inherited", clan: "Zenin" }, invocations: [{ name: "Cão Divino", grade: "fourth", actions: [] }] } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(saveFMCharacter).not.toHaveBeenCalled();
  });

  it("edita uma ficha que já pertence ao usuário autenticado", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-editar", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-editar", ownerId: 1, name: "Yuji revisado", portraitUrl: null, sheet: { skills: [] }, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.save({ id: "ficha-editar", name: "Yuji revisado", sheet: { skills: [] } })).resolves.toMatchObject({ name: "Yuji revisado" });
    expect(saveFMCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: "ficha-editar", ownerId: 1, name: "Yuji revisado" }));
  });

  it("recusa perícias sem nome ou com campos fora do catálogo", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-invalida", name: "Yuji", sheet: { skills: [{ name: "", attribute: "sorte", proficiency: "especial" }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("preserva a primeira especialização contra troca posterior", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-primaria", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: { progression: { specialization: "fighter", primarySpecialization: "fighter" } }, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-primaria", name: "Yuji", sheet: { progression: { specialization: "technique-specialist", primarySpecialization: "technique-specialist" } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveFMCharacter).not.toHaveBeenCalled();
  });

  it("recusa Multiclasse sem atributo exigido e catálogos adulterados", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-multi-invalida", name: "Yuji", sheet: { attributes: { base: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, presence: 10 }, permanentBonuses: {} }, progression: { level: 2, specialization: "fighter", primarySpecialization: "fighter", specializationTracks: [{ specialization: "fighter", level: 1 }, { specialization: "technique-specialist", level: 1 }] } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.characters.save({ id: "ficha-catalogo-adulterado", name: "Yuji", sheet: { skills: [{ catalogId: "perception", name: "Percepção", attribute: "intelligence", proficiency: "trained", otherBonus: 0, notes: "" }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.characters.save({ id: "ficha-item-adulterado", name: "Yuji", sheet: { equipment: [{ catalogId: "dagger", name: "Katana", category: "weapon", spaces: 1 }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("recusa feitiços acima do nível liberado para o personagem", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-feitico-invalido", name: "Yuji", sheet: { progression: { level: 1 }, spells: [{ level: 2 }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("exige contrajogo explícito em feitiços criados sob as Regras da Casa", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-sem-contrajogo", name: "Yuji", sheet: { progression: { level: 1 }, spells: [{ level: 1, counterplay: "" }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("recusa dados inválidos no bloco de Regras da Casa", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-casa-invalida", name: "Yuji", sheet: { houseRules: { attributeGeneration: { values: [3, 3, 3, 3, 3, 3], total: 18 }, rest: { exhaustion: -1, missionCount: -1 } } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("recusa Free Build com origem Restringido", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-free-build-invalida", name: "Yuji", sheet: { houseRules: { downtime: { freeBuildOptions: [{ name: "Golpe", sourceSpecialization: "restricted", prerequisites: "Nível 5", interludeCost: 1 }] } } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("bloqueia a alteração de um voto de nascimento já aprovado", async () => {
    const original = { type: "congenital-restriction", description: "Sem energia amaldiçoada.", approved: true, locked: true };
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-voto", ownerId: 1, name: "Toji", portraitUrl: null, sheet: { houseRules: { birthVow: original } }, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-voto", name: "Toji", sheet: { houseRules: { birthVow: { ...original, description: "Alteração posterior." } } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveFMCharacter).not.toHaveBeenCalled();
  });

  it("recusa Estilo Marcial em ficha que não é restringida", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-tecnica-invalida", name: "Yuji", sheet: { progression: { specialization: "fighter" }, technique: { kind: "martial", name: "Caminho do Predador", basicFunction: "Combate por exaustão do alvo.", attributeKeys: ["strength"], intrinsicBenefits: "", limitations: "", requiredItems: "", reviewNotes: "" } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("bloqueia a alteração de técnica em ficha que pertence a outro usuário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-tecnica-alheia", ownerId: 2, name: "Megumi", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));
    const technique = { kind: "cursed", name: "Dez Sombras", basicFunction: "Invoca shikigamis.", attributeKeys: ["wisdom"], intrinsicBenefits: "", limitations: "", requiredItems: "", reviewNotes: "" };

    await expect(caller.characters.save({ id: "ficha-tecnica-alheia", name: "Megumi", sheet: { progression: { specialization: "fighter" }, technique } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(saveFMCharacter).not.toHaveBeenCalled();
  });

  it("bloqueia a alteração das Regras da Casa em ficha que pertence a outro usuário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-casa-alheia", ownerId: 2, name: "Megumi", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-casa-alheia", name: "Megumi", sheet: { houseRules: { dedicationRewarding: true } } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(saveFMCharacter).not.toHaveBeenCalled();
  });

  it("recusa XP de guilda incompatível com o nível informado", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-xp-invalido", name: "Yuji", sheet: { progression: { level: 5, experience: 75 }, skills: [], spells: [] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("recusa modificadores extras fora do intervalo declarado", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-bonus-invalido", name: "Yuji", sheet: { skills: [{ name: "Furtividade", attribute: "dexterity", proficiency: "trained", otherBonus: 99 }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("exige origem registrada para um modificador extra permitido", async () => {
    const caller = appRouter.createCaller(createContext(1));
    await expect(caller.characters.save({ id: "ficha-bonus-sem-origem", name: "Yuji", sheet: { skills: [{ name: "Furtividade", attribute: "dexterity", proficiency: "trained", otherBonus: 2, notes: "" }] } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("duplica apenas uma ficha que pertence ao usuário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-origem", ownerId: 1, name: "Maki", portraitUrl: null, sheet: { identity: { name: "Maki" } }, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockImplementation(async input => ({ ...input, portraitUrl: input.portraitUrl ?? null, createdAt: new Date(), updatedAt: new Date() }));
    const caller = appRouter.createCaller(createContext(1));

    const copy = await caller.characters.duplicate({ id: "ficha-origem" });
    expect(copy.ownerId).toBe(1);
    expect(copy.name).toBe("Maki — cópia");
    expect(saveFMCharacter).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 1, name: "Maki — cópia" }));
  });

  it("cria e lê um compartilhamento público apenas para a ficha do proprietário", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-compartilhar", ownerId: 1, name: "Panda", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(getFMCharacterShare).mockResolvedValue(undefined);
    vi.mocked(createFMCharacterShare).mockResolvedValue({ id: 1, characterId: "ficha-compartilhar", ownerId: 1, token: "token-publico-de-teste", createdAt: new Date() });
    vi.mocked(getSharedFMCharacter).mockResolvedValue({ id: "ficha-compartilhar", ownerId: 1, name: "Panda", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.share({ characterId: "ficha-compartilhar" })).resolves.toEqual({ token: "token-publico-de-teste" });
    await expect(caller.shared.get({ token: "token-publico-de-teste" })).resolves.toMatchObject({ id: "ficha-compartilhar", name: "Panda" });
  });

  it("remove uma ficha pertencente ao usuário e seus links associados", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-remover", ownerId: 1, name: "Toge", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(deleteFMCharacter).mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.remove({ id: "ficha-remover" })).resolves.toEqual({ success: true });
    expect(deleteFMCharacter).toHaveBeenCalledWith("ficha-remover", 1);
  });
});

describe("biblioteca independente de técnicas", () => {
  const technique = { kind: "cursed", name: "Fios da Aurora", basicFunction: "Manipula fios de energia.", attributeKeys: ["dexterity"], intrinsicBenefits: "", limitations: "Exige linha de visão e pode ser interrompida por barreiras.", requiredItems: "Carretel", reviewNotes: "" };

  beforeEach(() => vi.clearAllMocks());

  it("lista e salva técnicas apenas na biblioteca do proprietário", async () => {
    vi.mocked(listFMTechniques).mockResolvedValue([{ id: "tecnica-001", ownerId: 1, name: technique.name, technique, createdAt: new Date(), updatedAt: new Date() }]);
    vi.mocked(getFMTechnique).mockResolvedValue(undefined);
    vi.mocked(saveFMTechnique).mockResolvedValue({ id: "tecnica-002", ownerId: 1, name: technique.name, technique, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.techniques.list()).resolves.toHaveLength(1);
    await expect(caller.techniques.save({ id: "tecnica-002", name: technique.name, technique })).resolves.toMatchObject({ ownerId: 1, name: technique.name });
    expect(saveFMTechnique).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 1, technique: expect.objectContaining({ name: technique.name }) }));
  });

  it("salva um modelo automatizado de estilo marcial com poderes e contrajogo", async () => {
    const automated = { ...createTechniqueFromPreset("martial-guard"), name: "Guarda da Lua" };
    vi.mocked(getFMTechnique).mockResolvedValue(undefined);
    vi.mocked(saveFMTechnique).mockResolvedValue({ id: "tecnica-modelo", ownerId: 1, name: automated.name, technique: automated, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    const saved = await caller.techniques.save({ id: "tecnica-modelo", name: automated.name, technique: automated });
    expect(saved).toMatchObject({ name: "Guarda da Lua", technique: { kind: "martial" } });
    expect((saved.technique as typeof automated).powers[0]).toMatchObject({ type: "auxiliary" });
    expect(saveFMTechnique).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 1, technique: expect.objectContaining({ limitations: expect.stringContaining("postura"), powers: expect.any(Array) }) }));
  });

  it("bloqueia edição e remoção de técnica pertencente a outro usuário", async () => {
    vi.mocked(getFMTechnique).mockResolvedValue({ id: "tecnica-alheia", ownerId: 2, name: technique.name, technique, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.techniques.save({ id: "tecnica-alheia", name: technique.name, technique })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.techniques.remove({ id: "tecnica-alheia" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deleteFMTechnique).not.toHaveBeenCalled();
  });

  it("recusa vincular uma ficha a técnica de outra biblioteca", async () => {
    vi.mocked(getFMCharacter).mockResolvedValue(undefined);
    vi.mocked(getFMTechnique).mockResolvedValue({ id: "tecnica-alheia", ownerId: 2, name: technique.name, technique, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.save({ id: "ficha-vinculo-invalido", name: "Yuji", sheet: { techniqueLibraryId: "tecnica-alheia" } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(saveFMCharacter).not.toHaveBeenCalled();
  });

  it("remove o vínculo legado de uma técnica ausente e preserva o salvamento da ficha", async () => {
    const legacySheet = { techniqueLibraryId: "tecnica-removida", progression: { specialization: "fighter" }, technique: { ...technique, name: "Estilo preservado" } };
    vi.mocked(getFMCharacter).mockResolvedValue({ id: "ficha-tecnica-legada", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: legacySheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(getFMTechnique).mockResolvedValue(undefined);
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-tecnica-legada", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: { progression: legacySheet.progression, technique: legacySheet.technique }, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.save({ id: "ficha-tecnica-legada", name: "Yuji", sheet: legacySheet })).resolves.toMatchObject({ sheet: { technique: { name: "Estilo preservado" } } });
    expect(saveFMCharacter).toHaveBeenCalledWith(expect.objectContaining({ sheet: expect.not.objectContaining({ techniqueLibraryId: "tecnica-removida" }) }));
  });

  it("persiste e recupera o vínculo com a técnica escolhida", async () => {
    const storedSheet = { techniqueLibraryId: "tecnica-001", progression: { specialization: "fighter" }, technique };
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-vinculo", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: storedSheet, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(getFMTechnique).mockResolvedValue({ id: "tecnica-001", ownerId: 1, name: technique.name, technique, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-vinculo", ownerId: 1, name: "Yuji", portraitUrl: null, sheet: storedSheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-vinculo", name: "Yuji", sheet: storedSheet });
    await expect(caller.characters.get({ id: "ficha-vinculo" })).resolves.toMatchObject({ sheet: { techniqueLibraryId: "tecnica-001", technique } });
    expect(saveFMCharacter).toHaveBeenCalledWith(expect.objectContaining({ sheet: storedSheet }));
  });
});

describe("Homebrew e revisão", () => {
  const aptitude = { id: "homebrew-aptitude-1", kind: "aptitude" as const, name: "Mente Focada", summary: "Aptidão para manter o foco sob pressão.", content: { description: "Concentração adicional em momentos de risco.", requirements: "Inteligência 12", effects: "+1 em testes declarados.", cost: "2 PE", level: "1", notes: "Requer aprovação do mestre.", fields: { group: "Mental", approval: "Pendente" } } };

  beforeEach(() => vi.clearAllMocks());

  it("salva Homebrew somente na conta do proprietário e registra o histórico", async () => {
    vi.mocked(getFMHomebrew).mockResolvedValue(undefined);
    vi.mocked(saveFMHomebrew).mockResolvedValue({ ...aptitude, ownerId: 1, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.homebrews.save(aptitude)).resolves.toMatchObject({ ownerId: 1, name: aptitude.name, kind: "aptitude" });
    expect(saveFMHomebrew).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 1, content: expect.objectContaining({ fields: { group: "Mental", approval: "Pendente" } }) }));
    expect(createFMChangeHistory).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 1, targetType: "homebrew", eventType: "created" }));
  });

  it("compartilha Homebrew por link próprio e recebe sugestões sem dar edição ao avaliador", async () => {
    vi.mocked(getFMHomebrew).mockResolvedValue({ ...aptitude, ownerId: 1, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(getFMContentShare).mockResolvedValue(undefined);
    vi.mocked(createFMContentShare).mockResolvedValue({ id: 1, ownerId: 1, targetType: "homebrew", targetId: aptitude.id, token: "link-homebrew-avaliacao-123", createdAt: new Date() });
    vi.mocked(getSharedFMContent).mockResolvedValue({ id: 1, ownerId: 1, targetType: "homebrew", targetId: aptitude.id, token: "link-homebrew-avaliacao-123", createdAt: new Date() });
    vi.mocked(createFMReview).mockResolvedValue({ id: "review-1", ownerId: 1, targetType: "homebrew", targetId: aptitude.id, reviewerName: "Avaliador", reviewerUserId: null, kind: "suggestion", section: "Técnica", field: "Custo", currentValue: "2 PE", suggestedValue: "1 PE", reason: "Adequar ao benefício inicial.", status: "pending", ownerResponse: "", createdAt: new Date(), updatedAt: new Date() });
    const owner = appRouter.createCaller(createContext(1));
    const publicCaller = appRouter.createCaller({ ...createContext(1), user: null });

    await expect(owner.homebrews.share({ id: aptitude.id })).resolves.toMatchObject({ token: "link-homebrew-avaliacao-123" });
    await expect(publicCaller.reviews.submit({ token: "link-homebrew-avaliacao-123", reviewerName: "Avaliador", kind: "suggestion", section: "Técnica", field: "Custo", currentValue: "2 PE", suggestedValue: "1 PE", reason: "Adequar ao benefício inicial." })).resolves.toMatchObject({ status: "pending", targetType: "homebrew" });
    expect(createFMReview).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 1, targetId: aptitude.id, field: "Custo", status: "pending" }));
  });

  it("só permite ao proprietário decidir o estado de uma sugestão", async () => {
    vi.mocked(getFMReview).mockResolvedValue({ id: "review-1", ownerId: 1, targetType: "homebrew", targetId: aptitude.id, reviewerName: "Avaliador", reviewerUserId: null, kind: "suggestion", section: "Técnica", field: "Custo", currentValue: "2 PE", suggestedValue: "1 PE", reason: "Adequar ao benefício inicial.", status: "pending", ownerResponse: "", createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(updateFMReview).mockResolvedValue({ id: "review-1", ownerId: 1, targetType: "homebrew", targetId: aptitude.id, reviewerName: "Avaliador", reviewerUserId: null, kind: "suggestion", section: "Técnica", field: "Custo", currentValue: "2 PE", suggestedValue: "1 PE", reason: "Adequar ao benefício inicial.", status: "accepted", ownerResponse: "Vamos testar em mesa.", createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.reviews.update({ id: "review-1", status: "accepted", ownerResponse: "Vamos testar em mesa." })).resolves.toMatchObject({ status: "accepted", ownerResponse: "Vamos testar em mesa." });
    expect(updateFMReview).toHaveBeenCalledWith("review-1", 1, { status: "accepted", ownerResponse: "Vamos testar em mesa." });
  });

  it("exige aceite antes de permitir marcar uma sugestão como implementada", async () => {
    vi.mocked(getFMReview).mockResolvedValue({ id: "review-pendente", ownerId: 1, targetType: "homebrew", targetId: aptitude.id, reviewerName: "Avaliador", reviewerUserId: null, kind: "suggestion", section: "Técnica", field: "Custo", currentValue: "2 PE", suggestedValue: "1 PE", reason: "Adequar ao benefício inicial.", status: "pending", ownerResponse: "", createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.reviews.update({ id: "review-pendente", status: "implemented", ownerResponse: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateFMReview).not.toHaveBeenCalled();
  });

  it("cria, revoga e regenera um link genérico sem entregar edição ao visitante", async () => {
    vi.mocked(getFMHomebrew).mockResolvedValue({ ...aptitude, ownerId: 1, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(getFMContentShare).mockResolvedValue(undefined);
    vi.mocked(createFMContentShare).mockResolvedValue({ id: 9, ownerId: 1, targetType: "homebrew", targetId: aptitude.id, token: "link-compartilhado-123", enabled: true, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(setFMContentShareEnabled).mockResolvedValue({ id: 9, ownerId: 1, targetType: "homebrew", targetId: aptitude.id, token: "link-compartilhado-123", enabled: false, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(regenerateFMContentShare).mockResolvedValue({ id: 9, ownerId: 1, targetType: "homebrew", targetId: aptitude.id, token: "link-renovado-123", enabled: true, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.contentShares.create({ targetType: "homebrew", targetId: aptitude.id })).resolves.toMatchObject({ enabled: true, token: "link-compartilhado-123" });
    await expect(caller.contentShares.revoke({ id: 9 })).resolves.toMatchObject({ enabled: false });
    await expect(caller.contentShares.regenerate({ id: 9 })).resolves.toMatchObject({ enabled: true, token: "link-renovado-123" });
    expect(createFMChangeHistory).toHaveBeenCalledWith(expect.objectContaining({ eventType: "revoked", targetId: aptitude.id }));
    expect(createFMChangeHistory).toHaveBeenCalledWith(expect.objectContaining({ eventType: "regenerated", targetId: aptitude.id }));
  });

  it("aceita uma Aptidão Homebrew fiel ao arquivo do criador e rejeita referência de outra conta", async () => {
    const sheet = { progression: { level: 1, specialization: "fighter" }, aptitudes: [{ id: "aptidao-vinculada", catalogId: `homebrew:${aptitude.id}`, homebrewId: aptitude.id, name: aptitude.name, group: "special", requiredLevel: 1, cost: 2, prerequisite: "Inteligência 12", effect: "+1 em testes declarados.", approved: false }], training: [] };
    vi.mocked(getFMCharacter).mockResolvedValue(undefined);
    vi.mocked(getFMHomebrew).mockResolvedValue({ ...aptitude, ownerId: 1, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-homebrew", ownerId: 1, name: "Yuji", portraitUrl: null, sheet, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await expect(caller.characters.save({ id: "ficha-homebrew", name: "Yuji", sheet })).resolves.toMatchObject({ ownerId: 1, sheet });
    vi.mocked(getFMHomebrew).mockResolvedValue({ ...aptitude, ownerId: 2, createdAt: new Date(), updatedAt: new Date() });
    await expect(caller.characters.save({ id: "ficha-homebrew-alheia", name: "Yuji", sheet })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
