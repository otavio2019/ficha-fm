import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyFMSheet } from "@shared/fmTypes";
import { ImageAttachmentsPanel } from "./Home";

describe("galeria de imagens da ficha", () => {
  it("renderiza legenda, estado de retrato e remoção após hidratar uma imagem", () => {
    const sheet = createEmptyFMSheet();
    sheet.images = [{ id: "img-1", key: "fichas/maki.png", url: "/manus-storage/fichas/maki.png", name: "maki.png", caption: "Retrato da Maki", createdAt: 100 }];
    sheet.identity.portraitUrl = sheet.images[0].url;
    const markup = renderToStaticMarkup(<ImageAttachmentsPanel sheet={sheet} characterId="ficha-imagem" previewMode={false} updateSheet={() => undefined} addDiary={() => undefined} uploadImage={async () => sheet.images[0]} />);

    expect(markup).toContain("Retrato da Maki");
    expect(markup).toContain("Retrato atual");
    expect(markup).toContain('title="Remover imagem"');
    expect(markup).toContain('aria-label="Legenda de maki.png"');
  });
});
