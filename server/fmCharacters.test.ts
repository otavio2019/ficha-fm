import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  createFMCharacterShare: vi.fn(),
  deleteFMCharacter: vi.fn(),
  getFMCharacter: vi.fn(),
  getFMCharacterShare: vi.fn(),
  getSharedFMCharacter: vi.fn(),
  listFMCharacters: vi.fn(),
  listFMCharacterShares: vi.fn(),
  saveFMCharacter: vi.fn(),
}));

import { createFMCharacterShare, deleteFMCharacter, getFMCharacter, getFMCharacterShare, getSharedFMCharacter, saveFMCharacter } from "./db";
import { appRouter } from "./routers";

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

  it("persiste e recupera o bloco completo de Regras da Casa", async () => {
    const houseRules = { rest: { exhaustion: 2, missionCount: 3, lastMissionAt: 1000, lastShortRestAt: null, lastLongRestAt: 2000, longRestMissionCount: 3 }, dedicationRewarding: true, downtime: { interludes: 1, craftingFocus: "Ferraria", professionChecksRequired: true, itemReviewRequired: true, freeBuildOptions: [{ id: "free-1", name: "Barreira", sourceSpecialization: "controller", prerequisites: "Nível 5", interludeCost: 1 }] } };
    vi.mocked(getFMCharacter).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: "ficha-casa", ownerId: 1, name: "Maki", portraitUrl: null, sheet: { houseRules }, createdAt: new Date(), updatedAt: new Date() });
    vi.mocked(saveFMCharacter).mockResolvedValue({ id: "ficha-casa", ownerId: 1, name: "Maki", portraitUrl: null, sheet: { houseRules }, createdAt: new Date(), updatedAt: new Date() });
    const caller = appRouter.createCaller(createContext(1));

    await caller.characters.save({ id: "ficha-casa", name: "Maki", sheet: { houseRules } });
    await expect(caller.characters.get({ id: "ficha-casa" })).resolves.toMatchObject({ sheet: { houseRules } });
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
