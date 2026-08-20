import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "@shared/fmTypes";
import { CharacterPortraitPanel, ImageAttachmentsPanel } from "./Home";

describe("retrato e galeria de imagens da ficha", () => {
  it("mantém a galeria como referência e sem ação de retrato", () => {
    const sheet = createEmptyFMSheet();
    sheet.images = [{ id: "img-1", key: "fichas/maki.png", url: "/manus-storage/fichas/maki.png", name: "maki.png", caption: "Retrato da Maki", createdAt: 100 }];
    sheet.identity.portraitUrl = sheet.images[0].url;
    const markup = renderToStaticMarkup(<ImageAttachmentsPanel sheet={sheet} characterId="ficha-imagem" previewMode={false} updateSheet={() => undefined} addDiary={() => undefined} uploadImage={async () => sheet.images[0]} />);

    expect(markup).toContain("Retrato da Maki");
    expect(markup).toContain("O retrato principal é escolhido no painel próprio acima");
    expect(markup).not.toContain("Usar como retrato");
    expect(markup).toContain('title="Remover referência"');
    expect(markup).toContain('aria-label="Legenda de maki.png"');
  });

  it("renderiza o retrato principal de forma independente da galeria", () => {
    const sheet = createEmptyFMSheet();
    sheet.identity.name = "Maki Zenin";
    sheet.identity.portraitUrl = "/manus-storage/fichas/maki-retrato.png";
    const markup = renderToStaticMarkup(<CharacterPortraitPanel sheet={sheet} characterId="ficha-retrato" previewMode={false} updateSheet={() => undefined} addDiary={() => undefined} uploadImage={async () => ({ id: "portrait-1", key: "fichas/maki-retrato.png", url: sheet.identity.portraitUrl!, name: "maki-retrato.png", caption: "Retrato principal", createdAt: 100 })} />);

    expect(markup).toContain("Retrato do personagem");
    expect(markup).toContain("Trocar retrato");
    expect(markup).toContain('title="Remover retrato"');
    expect(markup).toContain("maki-retrato.png");
  });
});
