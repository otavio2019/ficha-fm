import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getTechniquePowerProgression } from "@shared/fmRules";
import { TechniquePowerSelectionPanel } from "./Home";

describe("composição impressa de Poderes e Feitiços", () => {
  it("mantém o bloco de progressão e marca controles de seleção como não imprimíveis", () => {
    const markup = renderToStaticMarkup(<TechniquePowerSelectionPanel powers={[{ id: "poder-1", name: "Laço", requiredCharacterLevel: 1, spellLevel: 1, type: "damage", summary: "Fios prendem o alvo.", requirement: "Linha de visão." }]} selectedPowerIds={new Set()} specialization="technique-specialist" specializationLevel={1} highestSpellLevel={1} progression={getTechniquePowerProgression("technique-specialist", 1)} onSelect={() => undefined} />);

    expect(markup).toContain("print-power-sheet");
    expect(markup).toContain("Escolhas da técnica");
    expect(markup).toContain("no-print");
    expect(markup).toContain("Selecionar");
  });
});
