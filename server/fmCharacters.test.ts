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
