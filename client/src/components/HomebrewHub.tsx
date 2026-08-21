import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { FM_HOMEBREW_KINDS, FM_HOMEBREW_KIND_META, createEmptyHomebrew, normalizeHomebrewContent, type FMHomebrewDraft, type FMHomebrewKind } from "@shared/fmHomebrew";
import type { FMTechnique } from "@shared/fmTypes";
import { BookOpen, Link2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TechniqueLibraryPanel } from "./TechniqueLibraryPanel";

type TechniqueItem = { id: string; name: string; technique: Record<string, unknown>; updatedAt: Date };

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-stone-300"><span>{label}</span>{children}{hint ? <span className="text-xs font-normal leading-5 text-stone-500">{hint}</span> : null}</label>;
}

function CategoryButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? "border-violet-300/50 bg-violet-500/15 text-violet-100" : "border-violet-300/15 text-stone-400 hover:border-violet-300/35"}`}>{children}</button>;
}

export function HomebrewHub({ techniques, techniquesLoading, onSaveTechnique, onRemoveTechnique }: { techniques: TechniqueItem[]; techniquesLoading: boolean; onSaveTechnique: (input: { id: string; name: string; technique: FMTechnique }) => Promise<void>; onRemoveTechnique: (id: string, name: string) => Promise<void> }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const homebrewsQuery = trpc.homebrews.list.useQuery(undefined, { enabled: isAuthenticated });
  const reviewsQuery = trpc.reviews.list.useQuery(undefined, { enabled: isAuthenticated });
  const contentSharesQuery = trpc.contentShares.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveMutation = trpc.homebrews.save.useMutation({ onSuccess: () => utils.homebrews.list.invalidate() });
  const removeMutation = trpc.homebrews.remove.useMutation({ onSuccess: () => utils.homebrews.list.invalidate() });
  const createShareMutation = trpc.contentShares.create.useMutation({ onSuccess: () => utils.contentShares.list.invalidate() });
  const revokeShareMutation = trpc.contentShares.revoke.useMutation({ onSuccess: () => utils.contentShares.list.invalidate() });
  const regenerateShareMutation = trpc.contentShares.regenerate.useMutation({ onSuccess: () => utils.contentShares.list.invalidate() });
  const [filter, setFilter] = useState<FMHomebrewKind | "all">("all");
  const [draft, setDraft] = useState<FMHomebrewDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => (homebrewsQuery.data ?? []).filter(item => filter === "all" || item.kind === filter), [filter, homebrewsQuery.data]);
  const reviewCountByTarget = useMemo(() => (reviewsQuery.data ?? []).reduce<Record<string, number>>((counts, review) => {
    if (review.targetType === "homebrew") counts[review.targetId] = (counts[review.targetId] ?? 0) + 1;
    return counts;
  }, {}), [reviewsQuery.data]);
  const sharesByTarget = useMemo(() => (contentSharesQuery.data ?? []).reduce<Record<string, NonNullable<typeof contentSharesQuery.data>[number]>>((shares, share) => {
    if (share.targetType === "homebrew") shares[share.targetId] = share;
    return shares;
  }, {}), [contentSharesQuery.data]);
  const updateDraft = (patch: Partial<FMHomebrewDraft>) => setDraft(current => current ? { ...current, ...patch } : current);
  const updateContent = (patch: Partial<FMHomebrewDraft["content"]>) => setDraft(current => current ? { ...current, content: { ...current.content, ...patch } } : current);
  const changeKind = (kind: FMHomebrewKind) => setDraft(current => current ? { ...createEmptyHomebrew(kind), id: current.id, name: current.name, summary: current.summary } : current);
  const edit = (item: NonNullable<typeof homebrewsQuery.data>[number]) => setDraft({ id: item.id, kind: item.kind, name: item.name, summary: item.summary, content: normalizeHomebrewContent(item.content) });
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try { await saveMutation.mutateAsync(draft); toast.success("Homebrew salvo no arquivo da guilda."); setDraft(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Revise os campos obrigatórios do Homebrew."); } finally { setSaving(false); }
  };
  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Excluir o Homebrew “${name}”? O conteúdo e seu link de avaliação serão removidos.`)) return;
    try { await removeMutation.mutateAsync({ id }); toast.success("Homebrew excluído."); if (draft?.id === id) setDraft(null); } catch { toast.error("Não foi possível excluir este Homebrew."); }
  };
  const copyShare = async (id: string) => {
    try {
      const result = await createShareMutation.mutateAsync({ targetType: "homebrew", targetId: id });
      await navigator.clipboard?.writeText(`${window.location.origin}/avaliar/${result.token}`);
      toast.success("Link de avaliação copiado.");
    } catch { toast.error("Não foi possível gerar o link de avaliação."); }
  };
  const revokeShare = async (shareId: number) => {
    try { await revokeShareMutation.mutateAsync({ id: shareId }); toast.success("Link revogado. Visitantes não podem mais abri-lo."); } catch { toast.error("Não foi possível revogar este link."); }
  };
  const regenerateShare = async (shareId: number) => {
    try {
      const result = await regenerateShareMutation.mutateAsync({ id: shareId });
      await navigator.clipboard?.writeText(`${window.location.origin}/avaliar/${result.token}`);
      toast.success("Novo link criado e copiado.");
    } catch { toast.error("Não foi possível gerar um novo link."); }
  };
  const meta = draft ? FM_HOMEBREW_KIND_META[draft.kind] : null;
  const techniqueSelected = filter === "technique";
  const createForFilter = () => setDraft(createEmptyHomebrew(filter === "all" ? "other" : filter));

  return <section className="grid gap-5 xl:grid-cols-[276px_minmax(0,1fr)]">
    <aside className="rounded-2xl border border-violet-300/15 bg-[#110a1b] p-4"><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Central de conteúdo</p><h2 className="mt-1 font-display text-2xl text-stone-100">Homebrew</h2><p className="mt-2 text-sm leading-6 text-stone-400">Crie, organize, compartilhe e revise conteúdos da guilda no mesmo arquivo.</p><div className="mt-5 grid gap-2"><Button type="button" onClick={createForFilter} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Novo Homebrew</Button></div><div className="mt-6 border-t border-violet-300/10 pt-4"><p className="text-[10px] uppercase tracking-[.18em] text-stone-500">Categorias</p><div className="mt-3 flex flex-wrap gap-2"><CategoryButton active={filter === "all"} onClick={() => setFilter("all")}>Todos</CategoryButton>{FM_HOMEBREW_KINDS.map(kind => <CategoryButton active={filter === kind} key={kind} onClick={() => setFilter(kind)}>{FM_HOMEBREW_KIND_META[kind].label}</CategoryButton>)}</div></div><div className="mt-6 rounded-xl border border-violet-300/10 bg-black/20 p-3 text-xs leading-5 text-stone-400"><strong className="font-medium text-stone-200">Meus conteúdos</strong><br />{(homebrewsQuery.data ?? []).length} Homebrews e {techniques.length} Técnicas arquivadas. Revisões são associadas ao conteúdo, nunca ao visitante.</div></aside>
    <div className="min-w-0">{draft && meta ? <section className="rounded-2xl border border-amber-300/20 bg-[#120b1b] p-5 sm:p-6"><div className="flex flex-col gap-4 border-b border-violet-300/10 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Editor estruturado</p><h2 className="mt-1 font-display text-3xl text-stone-100">{draft.name || `Novo ${meta.label}`}</h2><p className="mt-2 text-sm leading-6 text-stone-400">Os campos são declarativos; regras não confirmadas continuam sob aprovação da mesa.</p></div><Button type="button" variant="outline" onClick={() => setDraft(null)} className="border-violet-300/20 text-stone-300">Fechar</Button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Categoria"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={draft.kind} onChange={event => changeKind(event.target.value as FMHomebrewKind)}>{FM_HOMEBREW_KINDS.map(kind => <option key={kind} value={kind}>{FM_HOMEBREW_KIND_META[kind].label}</option>)}</select></Field><Field label="Nome"><Input value={draft.name} onChange={event => updateDraft({ name: event.target.value })} placeholder="Nome do conteúdo" /></Field><Field label="Resumo" hint="Uma apresentação curta para o arquivo."><Textarea value={draft.summary} onChange={event => updateDraft({ summary: event.target.value })} placeholder={meta.summary} /></Field><Field label="Nível ou grau"><Input value={draft.content.level} onChange={event => updateContent({ level: event.target.value })} placeholder="Somente se aplicável" /></Field><Field label="Funcionamento"><Textarea value={draft.content.description} onChange={event => updateContent({ description: event.target.value })} placeholder="Descrição do funcionamento." /></Field><Field label="Efeitos"><Textarea value={draft.content.effects} onChange={event => updateContent({ effects: event.target.value })} placeholder="Efeitos mecânicos ou narrativos declarados." /></Field><Field label="Requisitos"><Textarea value={draft.content.requirements} onChange={event => updateContent({ requirements: event.target.value })} placeholder="Pré-requisitos ou condições." /></Field><Field label="Custo"><Input value={draft.content.cost} onChange={event => updateContent({ cost: event.target.value })} placeholder="Somente se aplicável" /></Field>{meta.fieldSpecs.map(field => <Field key={field.key} label={field.label}>{field.multiline ? <Textarea value={draft.content.fields[field.key] ?? ""} onChange={event => updateContent({ fields: { ...draft.content.fields, [field.key]: event.target.value } })} /> : <Input value={draft.content.fields[field.key] ?? ""} onChange={event => updateContent({ fields: { ...draft.content.fields, [field.key]: event.target.value } })} />}</Field>)}<Field label="Notas do criador"><Textarea value={draft.content.notes} onChange={event => updateContent({ notes: event.target.value })} placeholder="Observações, aprovação ou referências." /></Field></div><div className="mt-5 flex flex-col gap-3 border-t border-violet-300/10 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setDraft(null)} className="border-violet-300/20 text-stone-300">Cancelar</Button><Button type="button" disabled={saving || !draft.name.trim() || !draft.summary.trim() || !draft.content.description.trim()} onClick={save} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar Homebrew</Button></div></section> : null}
      <section className="mt-5"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="font-display text-xs uppercase tracking-[.2em] text-violet-200/70">Arquivo da guilda</p><h2 className="mt-1 font-display text-3xl text-stone-100">{filter === "all" ? "Todos os conteúdos" : FM_HOMEBREW_KIND_META[filter].label}</h2><p className="mt-1 text-sm text-stone-500">{techniqueSelected ? "Técnicas arquivadas e conteúdos técnicos no mesmo fluxo." : "Conteúdos reutilizáveis, editáveis e prontos para revisão."}</p></div><Button type="button" onClick={createForFilter} className="bg-violet-600 text-violet-50 hover:bg-violet-500"><Plus className="mr-2 h-4 w-4" />Novo</Button></div>{techniqueSelected ? <div className="mb-5 rounded-2xl border border-violet-300/15 bg-black/20 p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-amber-300" /><h3 className="font-display text-xl text-stone-100">Biblioteca de Técnicas</h3></div><TechniqueLibraryPanel techniques={techniques} loading={techniquesLoading} onSave={onSaveTechnique} onRemove={onRemoveTechnique} /></div> : null}{homebrewsQuery.isLoading ? <div className="grid min-h-52 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-violet-300/15 bg-black/20 p-7 text-sm leading-6 text-stone-500">Nenhum conteúdo nesta categoria. Crie um Homebrew para organizar, compartilhar e receber sugestões sem alterar o original.</div> : <div className="grid gap-3 md:grid-cols-2">{filtered.map(item => { const reviewCount = reviewCountByTarget[item.id] ?? 0; const share = sharesByTarget[item.id]; return <article key={item.id} className="rounded-2xl border border-violet-300/15 bg-[#110a1b] p-5"><div className="flex items-start justify-between gap-3"><span className="rounded-full border border-violet-300/15 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-100">{FM_HOMEBREW_KIND_META[item.kind].label}</span><span className="text-right text-xs text-stone-500">{reviewCount ? `${reviewCount} revisão${reviewCount === 1 ? "" : "ões"}` : "Sem revisões"}<br />{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</span></div><h3 className="mt-4 font-display text-2xl text-stone-100">{item.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-stone-400">{item.summary}</p><div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-violet-300/10 bg-black/20 px-3 py-2 text-xs"><span className={share?.enabled ? "text-emerald-200" : "text-stone-500"}>{share?.enabled ? "Link ativo para avaliação" : share ? "Link revogado" : "Sem link público"}</span>{share?.enabled ? <button type="button" onClick={() => revokeShare(share.id)} className="text-amber-100 hover:text-amber-200">Revogar</button> : share ? <button type="button" onClick={() => regenerateShare(share.id)} className="text-amber-100 hover:text-amber-200">Gerar novo</button> : null}</div><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" type="button" onClick={() => edit(item)} className="bg-violet-600/80 text-violet-50 hover:bg-violet-500"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button><Button size="sm" type="button" variant="outline" onClick={() => copyShare(item.id)} className="border-amber-300/25 text-amber-100"><Link2 className="mr-1.5 h-3.5 w-3.5" />{share?.enabled ? "Copiar link" : "Compartilhar"}</Button><Button size="sm" type="button" variant="outline" onClick={() => remove(item.id, item.name)} className="border-red-400/25 text-red-200 hover:border-red-400/60"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button></div></article>; })}</div>}</section></div>
  </section>;
}
