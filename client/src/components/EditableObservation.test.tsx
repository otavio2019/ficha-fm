import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { EditableObservation } from "./EditableObservation";

describe("EditableObservation", () => {
  it("mostra a ação de adicionar quando a entidade ainda não possui observação", () => {
    const markup = renderToStaticMarkup(<EditableObservation entityType="domain" entityId="domain-1" value="" canEdit onSave={() => undefined} />);
    expect(markup).toContain("Nenhuma observação registrada.");
    expect(markup).toContain("Adicionar observação");
    expect(markup).toContain('data-observation-entity="domain:domain-1"');
  });

  it("mostra o conteúdo existente e a ação de editar para o proprietário", () => {
    const markup = renderToStaticMarkup(<EditableObservation entityType="ally" entityId="ally-1" value="Protege o grupo durante a retirada." canEdit onSave={() => undefined} />);
    expect(markup).toContain("Protege o grupo durante a retirada.");
    expect(markup).toContain("Editar");
    expect(markup).toContain('data-observation-entity="ally:ally-1"');
  });
});
