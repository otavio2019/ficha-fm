import { Button } from "@/components/ui/button";
import { Link2, Unlink } from "lucide-react";
import { FM_ATTRIBUTE_LABELS } from "@shared/fmRules";
import { getPrimaryTechniqueAttribute } from "@shared/fmTechniques";
import { createEmptyFMSheet, fmAttributeKeys, type FMCharacterSheet, type FMTechnique } from "@shared/fmTypes";

type Props = {
  sheet: FMCharacterSheet;
  techniques: Array<{ id: string; name: string; technique: Record<string, unknown> }>;
  updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void;
  addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void;
};

function hydrateTechnique(raw: Record<string, unknown>): FMTechnique {
  const empty = createEmptyFMSheet().technique;
  return { ...empty, ...raw, attributeKeys: Array.isArray(raw.attributeKeys) ? raw.attributeKeys.filter((attribute): attribute is FMTechnique["attributeKeys"][number] => typeof attribute === "string" && fmAttributeKeys.includes(attribute as FMTechnique["attributeKeys"][number])) : empty.attributeKeys };
}

export function CharacterTechniqueSelector({ sheet, techniques, updateSheet, addDiary }: Props) {
  const expectedKind = sheet.progression.specialization === "restricted" ? "martial" : "cursed";
  const compatible = techniques.filter(item => hydrateTechnique(item.technique).kind === expectedKind);
  const selected = compatible.find(item => item.id === sheet.techniqueLibraryId) ?? null;
  const choose = (techniqueId: string) => {
    if (!techniqueId) {
      updateSheet(current => ({ ...current, techniqueLibraryId: null }));
      addDiary("Técnica desvinculada", "A ficha deixou de apontar para uma técnica da biblioteca e preservou a cópia atual.");
      return;
    }
    const entry = compatible.find(item => item.id === techniqueId);
    if (!entry) return;
    const technique = hydrateTechnique(entry.technique);
    updateSheet(current => ({ ...current, techniqueLibraryId: entry.id, technique, progression: { ...current.progression, techniqueAttribute: getPrimaryTechniqueAttribute(technique, current.progression.techniqueAttribute) } }));
    addDiary("Técnica escolhida", `${entry.name} foi selecionada da biblioteca para esta ficha.`);
  };

  return <section className="mt-4 rounded-2xl border border-amber-300/20 bg-[radial-gradient(circle_at_92%_5%,rgba(173,111,223,.14),transparent_35%),#120c1d] p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Biblioteca de Técnicas</p><h3 className="mt-1 font-display text-2xl text-stone-100">Técnica escolhida</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">Escolha uma técnica independente compatível. A seleção copia os dados atuais para a ficha e não altera o arquivo original.</p></div><span className="w-fit rounded-full border border-violet-300/15 bg-black/20 px-3 py-1 text-xs text-violet-200">{expectedKind === "martial" ? "Estilo Marcial" : "Técnica Amaldiçoada"}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="grid gap-1.5 text-sm font-medium text-stone-300"><span>Escolher da biblioteca</span><select className="h-10 rounded-md border border-violet-300/20 bg-[#0c0713] px-3 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-amber-300/70" value={sheet.techniqueLibraryId ?? ""} onChange={event => choose(event.target.value)}><option value="">Manter técnica sem vínculo</option>{compatible.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="flex items-end"><Button type="button" variant="outline" disabled={!sheet.techniqueLibraryId} onClick={() => choose("")} className="w-full border-violet-300/20 text-stone-300"><Unlink className="mr-2 h-4 w-4" />Desvincular</Button></div></div>{selected ? <div className="mt-4 rounded-xl border border-violet-300/10 bg-black/20 p-3"><p className="flex items-center gap-2 text-sm font-medium text-amber-100"><Link2 className="h-4 w-4" />{selected.name}</p><p className="mt-1 text-xs leading-5 text-stone-500">Atributo principal: {FM_ATTRIBUTE_LABELS[sheet.progression.techniqueAttribute]}. Edite a técnica na aba Técnicas para criar novas versões; esta ficha preserva os dados escolhidos.</p></div> : <p className="mt-3 text-xs leading-5 text-stone-500">{compatible.length ? "Nenhuma técnica da biblioteca está selecionada." : "Nenhuma técnica compatível foi arquivada ainda. Crie uma na aba Técnicas."}</p>}</section>;
}
