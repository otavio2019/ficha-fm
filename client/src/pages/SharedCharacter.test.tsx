import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createEmptyFMSheet } from "@shared/fmTypes";

const sheet = createEmptyFMSheet();
sheet.identity.name = "Rika";
sheet.progression.level = 6;
sheet.deathSaves = { successes: 2, failures: 1, stabilized: false, notes: "Curada por um aliado" };
sheet.damageReductions = [{ id: "rd-cortante", damageType: "Cortante", amount: 3, notes: "Armadura" }];
sheet.resistances = ["Fogo"];
sheet.vulnerabilities = ["Dano na alma"];
sheet.inspiration = 2;
sheet.energyLimit = 88;
sheet.invocations = [{ id: "inv-1", name: "Guardião da Névoa", concept: "Protege a retaguarda", type: "tamed-curse", grade: "third", attributes: { strength: 10, dexterity: 12, constitution: 11, intelligence: 10, wisdom: 10, presence: 10 }, movement: 9, trainedAttack: "melee", trainedSavingThrow: "fortitude", trainedSkills: [], actions: [], notes: "Chamada ao entardecer", active: true }];
sheet.training = [{ trackId: "barriers", label: "Barreiras", stage: 2, notes: "Aprendeu a reforçar o véu." }];

vi.mock("wouter", () => ({ useRoute: () => [true, { token: "share-token" }] }));
vi.mock("socket.io-client", () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn(), emit: vi.fn() }) }));
vi.mock("@/lib/liveAuth", () => ({ getLiveSocketAuth: () => ({}) }));
vi.mock("@/lib/trpc", () => ({ trpc: { shared: { get: { useQuery: () => ({ data: { name: "Rika", sheet }, isLoading: false, isError: false, refetch: vi.fn() }) } } } }));
vi.mock("@/components/PublicReviewForm", () => ({ PublicReviewForm: () => <div>Revisão pública</div> }));

import SharedCharacter from "./SharedCharacter";

describe("SharedCharacter", () => {
  it("mostra no link público os blocos recentes já disponíveis na ficha", () => {
    const markup = renderToStaticMarkup(<SharedCharacter />);
    expect(markup).toContain("Sobrevivência e resistências");
    expect(markup).toContain("2 sucesso(s)");
    expect(markup).toContain("RD Cortante: 3");
    expect(markup).toContain("Invocações");
    expect(markup).toContain("Maldição Domada");
    expect(markup).toContain("Guardião da Névoa");
    expect(markup).toContain("Aprendeu a reforçar o véu.");
  });
});
