import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, CirclePlus, Library, Save, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FM_ATTRIBUTE_LABELS } from "@shared/fmRules";
import { getTechniqueCopy, isTechniqueReady, validateTechnique } from "@shared/fmTechniques";
import { createEmptyFMSheet, fmAttributeKeys, type FMTechnique, type FMTechniqueKind } from "@shared/fmTypes";

type LibraryTechnique = { id: string; name: string; technique: Record<string, unknown>; updatedAt: Date };
type Props = {
  techniques: LibraryTechnique[];
  loading: boolean;
  onSave: (input: { id: string; name: string; technique: FMTechnique }) => Promise<void>;
  onRemove: (id: string, name: string) => Promise<void>;
};

function normalizeTechnique(raw?: Record<string, unknown>): FMTechnique {
  const empty = createEmptyFMSheet().technique;
  return { ...empty, ...(raw ?? {}), attributeKeys: Array.isArray(raw?.attributeKeys) ? raw.attributeKeys.filter((key): key is FMTechnique["attributeKeys"][number] => typeof key === "string" && fmAttributeKeys.includes(key as FMTechnique["attributeKeys"][number])) : empty.attributeKeys };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-stone-300"><span>{label}</span>{children}{hint ? <span className="text-xs font-normal leading-5 text-stone-500">{hint}</span> : null}</label>;
}

const selectClass = "h-10 rounded-md border border-violet-300/20 bg-[#0c0713] px-3 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-amber-300/70";

export function TechniqueLibraryPanel({ techniques, loading, onSave, onRemove }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FMTechnique>(() => createEmptyFMSheet().technique);
  const [saving, setSaving] = useState(false);
  const selected = useMemo(() => techniques.find(item => item.id === selectedId) ?? null, [selectedId, techniques]);
  const kind = draft.kind as FMTechniqueKind;
  const copy = getTechniqueCopy(kind);
  const errors = validateTechnique(draft, kind === "martial" ? "restricted" : "fighter");
  const ready = isTechniqueReady(draft) && errors.length === 0;

  useEffect(() => {
    if (!selected) return;
    setDraft(normalizeTechnique(selected.technique));
  }, [selected?.id]);

  const startNew = () => {
    setSelectedId(null);
    setDraft(createEmptyFMSheet().technique);
  };
  const update = (updater: (current: FMTechnique) => FMTechnique) => setDraft(current => updater(current));
  const toggleAttribute = (attribute: FMTechnique["attributeKeys"][number]) => update(current => {
    const selectedAttribute = current.attributeKeys.includes(attribute);
    if (selectedAttribute && current.attributeKeys.length === 1) return current;
    return { ...current, attributeKeys: selectedAttribute ? current.attributeKeys.filter(item => item !== attribute) : [...current.attributeKeys, attribute] };
  });
  const save = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const id = selectedId ?? crypto.randomUUID();
      await onSave({ id, name: draft.name.trim(), technique: { ...draft, name: draft.name.trim() } });
      setSelectedId(id);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!selected || !window.confirm(`Excluir a técnica “${selected.name}” da biblioteca? Personagens já vinculados mantêm sua cópia atual.`)) return;
    await onRemove(selected.id, selected.name);
    startNew();
  };

  return <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
    <aside className="rounded-2xl border border-violet-300/10 bg-[#110a1b] p-4 xl:sticky xl:top-5 xl:h-[calc(100vh-40px)]"><div className="flex items-start justify-between gap-3"><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Arquivo</p><h2 className="mt-1 font-display text-2xl text-stone-100">Técnicas</h2></div><span className="grid h-9 min-w-9 place-items-center rounded-lg border border-amber-300/20 bg-amber-300/5 font-display text-amber-200">{techniques.length}</span></div><p className="mt-3 text-sm leading-6 text-stone-400">Cadastre técnicas uma vez e escolha qual delas será usada em cada personagem.</p><Button type="button" onClick={startNew} className="mt-5 w-full bg-amber-300 text-[#190d07] hover:bg-amber-200"><CirclePlus className="mr-2 h-4 w-4" />Nova técnica</Button><div className="mt-5 space-y-2 overflow-y-auto xl:max-h-[calc(100vh-250px)]">{loading ? <p className="py-8 text-center text-sm text-stone-500">Carregando técnicas…</p> : techniques.length === 0 ? <div className="rounded-xl border border-dashed border-violet-300/15 p-4 text-center text-sm leading-6 text-stone-500"><Library className="mx-auto mb-2 h-6 w-6 text-violet-300/60" />Nenhuma técnica arquivada.</div> : techniques.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-amber-300/70 ${selectedId === item.id ? "border-amber-300/45 bg-amber-300/10" : "border-violet-300/10 bg-black/20 hover:border-violet-300/35"}`}><p className="truncate font-medium text-stone-100">{item.name}</p><p className="mt-1 text-xs text-stone-500">{normalizeTechnique(item.technique).kind === "martial" ? "Estilo Marcial" : "Técnica Amaldiçoada"}</p></button>)}</div></aside>
    <section className="min-w-0 rounded-2xl border border-amber-300/15 bg-[radial-gradient(circle_at_95%_4%,rgba(173,111,223,.14),transparent_27%),#120c1d] p-4 shadow-[0_24px_70px_rgba(0,0,0,.3)] sm:p-6"><div className="flex flex-col gap-4 border-b border-violet-300/10 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Forja independente</p><h1 className="mt-1 font-display text-3xl text-stone-100">{selected ? "Editar técnica" : "Criar técnica"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">A técnica não pertence a uma ficha. Depois de salva, ela pode ser escolhida por qualquer personagem compatível da sua biblioteca.</p></div>{selected ? <span className="rounded-full border border-violet-300/15 bg-black/20 px-3 py-1 text-xs text-violet-200">Editando arquivo</span> : null}</div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[.78fr_1.22fr]"><div className="grid content-start gap-4"><Field label="Nome da técnica"><Input maxLength={120} value={draft.name} onChange={event => update(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: Boneco de Palha" /></Field><Field label="Tipo"><select className={selectClass} value={kind} onChange={event => update(current => ({ ...current, kind: event.target.value as FMTechniqueKind }))}><option value="cursed">Técnica Amaldiçoada</option><option value="martial">Estilo Marcial</option></select></Field><Field label={copy.attributes} hint="O primeiro atributo será utilizado como principal ao escolher a técnica em uma ficha."><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{fmAttributeKeys.map(attribute => <label key={attribute} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition ${draft.attributeKeys.includes(attribute) ? "border-amber-300/45 bg-amber-300/10 text-amber-100" : "border-violet-300/10 bg-black/20 text-stone-400 hover:border-violet-300/35"}`}><input type="checkbox" className="accent-amber-300" checked={draft.attributeKeys.includes(attribute)} onChange={() => toggleAttribute(attribute)} /><span>{FM_ATTRIBUTE_LABELS[attribute]}</span></label>)}</div></Field><Field label="Itens ou ferramentas essenciais"><Textarea value={draft.requiredItems} onChange={event => update(current => ({ ...current, requiredItems: event.target.value }))} placeholder="Ex.: boneco, pregos e martelo." /></Field></div>
        <div className="grid content-start gap-4"><Field label={copy.basicFunction} hint={copy.basicFunctionHint}><Textarea className="min-h-36" maxLength={4000} value={draft.basicFunction} onChange={event => update(current => ({ ...current, basicFunction: event.target.value }))} placeholder="Descreva o conceito, os efeitos e a dinâmica." /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.benefits}><Textarea value={draft.intrinsicBenefits} onChange={event => update(current => ({ ...current, intrinsicBenefits: event.target.value }))} placeholder="Recursos pequenos e intrínsecos." /></Field><Field label={copy.limitations} hint="Declare aqui a resistência, reação ou outro contrajogo possível."><Textarea value={draft.limitations} onChange={event => update(current => ({ ...current, limitations: event.target.value }))} placeholder="Ex.: exige linha de visão e pode ser interrompida." /></Field></div><Field label="Observações e aprovação do mestre"><Textarea value={draft.reviewNotes} onChange={event => update(current => ({ ...current, reviewNotes: event.target.value }))} placeholder="Restrições acordadas e observações da campanha." /></Field></div></div>
      <div className="mt-6 flex flex-col gap-3 border-t border-violet-300/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm ${ready ? "text-emerald-300" : "text-stone-500"}`}>{ready ? <><Check className="mr-2 inline h-4 w-4" />Pronta para arquivar e escolher em personagens.</> : "Informe nome, funcionamento, atributo e contrajogo para salvar."}</p><div className="flex flex-wrap gap-2">{selected ? <Button type="button" variant="outline" onClick={() => void remove()} className="border-red-400/30 text-red-200 hover:bg-red-400/10"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}<Button type="button" disabled={!ready || saving} onClick={() => void save()} className="bg-amber-300 text-[#190d07] hover:bg-amber-200 disabled:opacity-50"><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar técnica"}</Button></div></div>
    </section>
  </div>;
}
