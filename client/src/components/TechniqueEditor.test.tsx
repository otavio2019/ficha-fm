import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ contentShares: { list: { invalidate: vi.fn() }, invalidate: vi.fn() } }),
    contentShares: {
      list: { useQuery: () => ({ data: [] }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      revoke: { useMutation: () => ({ mutate: vi.fn() }) },
      regenerate: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

import { TechniqueEditor } from "./TechniqueEditor";

describe("TechniqueEditor", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { search: "" } } });
  });

  it("mantém biblioteca, estados, etapas e carta de prévia no editor existente", () => {
    const markup = renderToStaticMarkup(<TechniqueEditor techniques={[{ id: "technique-1", name: "Fios da Aurora", technique: { kind: "cursed", name: "Fios da Aurora" }, updatedAt: new Date() }]} loading={false} onSave={async () => undefined} onRemove={async () => undefined} />);

    expect(markup).toContain("Arquivo da Guilda");
    expect(markup).toContain("Pesquisar técnica");
    expect(markup).toContain("Criando Técnica");
    expect(markup).toContain("Rascunho local");
    expect(markup).toContain("Salvar e compartilhar");
    expect(markup).toContain("Informações");
    expect(markup).toContain("Mecânica");
    expect(markup).toContain("Poderes");
    expect(markup).toContain("Compartilhar");
    expect(markup).toContain("Carta de Técnica");
    expect(markup).toContain("Estilo Marcial");
    expect(markup).toContain("Técnica Amaldiçoada");
  });
});
