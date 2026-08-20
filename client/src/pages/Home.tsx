import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLiveSocketAuth } from "@/lib/liveAuth";
import { FM_RULE_CITATIONS } from "@shared/fmCitations";
import { useAuth } from "@/_core/hooks/useAuth";
import { BookOpen, ChevronLeft, CirclePlus, Copy, Dice5, Download, Flame, Library, Loader2, LogOut, Menu, MoonStar, Plus, Printer, ScrollText, Share2, Shield, Swords, Trash2, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { FM_ATTRIBUTE_LABELS, FM_SAVING_THROW_LABELS, FM_SPECIALIZATION_LABELS, getAttackBonus, getDerivedValues, getHighestSpellLevel, getResourceLabel, getSkillBonus, getSpellCost, getSustainCost, rollD20 } from "@shared/fmRules";
import { createEmptyFMSheet, fmAttributeKeys, fmSavingThrowKeys, type FMAttack, type FMCharacterSheet, type FMSpell, type FMSpellLevel, type FMSpecializationKey, type FMTechnique } from "@shared/fmTypes";
import { getExperienceForLevel, getInfiniteWorldProgress, getMissionExperienceReward, getMissionMoneyReward, type InfiniteWorldMissionDifficulty, type InfiniteWorldMoneyDifficulty } from "@shared/infiniteWorlds";
import { FM_TECHNIQUE_CREATION_CITATION, getPrimaryTechniqueAttribute, getTechniqueCopy, getTechniqueKindForSpecialization, isTechniqueReady, validateTechnique } from "@shared/fmTechniques";

type TabId = "overview" | "attributes" | "skills" | "spells" | "combat" | "equipment" | "diary";

const tabs: Array<{ id: TabId; label: string; icon: typeof BookOpen }> = [
  { id: "overview", label: "Visão geral", icon: BookOpen },
  { id: "attributes", label: "Atributos", icon: Flame },
  { id: "skills", label: "Perícias", icon: ScrollText },
  { id: "spells", label: "Magias/Maldições", icon: WandSparkles },
  { id: "combat", label: "Combate", icon: Swords },
  { id: "equipment", label: "Equipamento", icon: Shield },
  { id: "diary", label: "Diário", icon: BookOpen },
];

const id = () => crypto.randomUUID();
const asNumber = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;

function hydrateSheet(raw: Record<string, unknown> | null | undefined): FMCharacterSheet {
  const empty = createEmptyFMSheet();
  const source = raw as Partial<FMCharacterSheet> | undefined;
  if (!source) return empty;
  return {
    ...empty,
    ...source,
    identity: { ...empty.identity, ...(source.identity ?? {}) },
    personal: { ...empty.personal, ...(source.personal ?? {}) },
    progression: { ...empty.progression, ...(source.progression ?? {}), experience: typeof source.progression?.experience === "number" ? source.progression.experience : getExperienceForLevel(typeof source.progression?.level === "number" ? source.progression.level : 1) },
    origin: { ...empty.origin, ...(source.origin ?? {}) },
    technique: { ...empty.technique, ...(source.technique ?? {}) },
    attributes: {
      base: { ...empty.attributes.base, ...(source.attributes?.base ?? {}) },
      permanentBonuses: { ...empty.attributes.permanentBonuses, ...(source.attributes?.permanentBonuses ?? {}) },
    },
    bonuses: { ...empty.bonuses, ...(source.bonuses ?? {}) },
    resources: {
      health: { ...empty.resources.health, ...(source.resources?.health ?? {}) },
      energy: { ...empty.resources.energy, ...(source.resources?.energy ?? {}) },
    },
    skills: Array.isArray(source.skills) ? source.skills : [],
    spells: Array.isArray(source.spells) ? source.spells : [],
    equipment: Array.isArray(source.equipment) ? source.equipment : [],
    attacks: Array.isArray(source.attacks) ? source.attacks : [],
    defenses: Array.isArray(source.defenses) ? source.defenses : [],
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    combatants: Array.isArray(source.combatants) ? source.combatants : [],
    diary: Array.isArray(source.diary) ? source.diary : [],
  };
}

function createNewSheet(name: string) {
  const sheet = createEmptyFMSheet();
  sheet.identity.name = name;
  const derived = getDerivedValues(sheet);
  sheet.resources.health.current = derived.healthMaximum;
  sheet.resources.energy.current = derived.energyMaximum;
  return sheet;
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-3 border-b border-violet-300/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="font-display text-xs uppercase tracking-[0.24em] text-amber-300/70">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl text-stone-100">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">{description}</p> : null}
    </div>
    {action}
  </div>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-violet-300/10 bg-[#120c1d]/80 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.28)] backdrop-blur sm:p-5 ${className}`}>{children}</section>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-stone-300">
    <span>{label}</span>
    {children}
    {hint ? <span className="text-xs font-normal leading-5 text-stone-500">{hint}</span> : null}
  </label>;
}

function ActionButton({ children, onClick, title, className = "" }: { children: React.ReactNode; onClick: () => void; title: string; className?: string }) {
  return <button type="button" onClick={onClick} title={title} className={`inline-flex h-9 items-center justify-center rounded-lg border border-violet-300/15 bg-[#20122e] px-3 text-sm text-violet-100 transition hover:border-amber-300/45 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300/70 active:scale-[0.97] ${className}`}>{children}</button>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const previewVariant = new URLSearchParams(window.location.search).get("preview");
  const previewMode = previewVariant === "full" || previewVariant === "library";
  const previewLibraryMode = previewVariant === "library";
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(() => previewVariant === "full" ? "preview-local" : new URLSearchParams(window.location.search).get("ficha"));
  const [sheet, setSheet] = useState<FMCharacterSheet | null>(null);
  const [tab, setTab] = useState<TabId>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    return ["overview", "attributes", "skills", "spells", "combat", "equipment", "diary"].includes(requested ?? "") ? requested! : "overview";
  });
  const [creating, setCreating] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [techniqueCharacterId, setTechniqueCharacterId] = useState<string | null>(() => previewVariant === "library" ? "preview-technique" : null);
  const [previewTechniqueSheet, setPreviewTechniqueSheet] = useState<FMCharacterSheet>(() => {
    const previewSheet = createNewSheet("Pré-visualização da Forja");
    previewSheet.technique = { ...previewSheet.technique, name: "Fios da Aurora", basicFunction: "Manipula fios de energia para conectar alvos e objetos, criando aplicações práticas por meio de feitiços.", attributeKeys: ["dexterity", "intelligence"], intrinsicBenefits: "Recebe um carretel simples como ferramenta essencial.", limitations: "Exige linha de visão e não atravessa barreiras sólidas.", requiredItems: "Carretel amaldiçoado e luvas condutoras.", reviewNotes: "Exemplo local para revisão visual; não é salvo." };
    return previewSheet;
  });

  const charactersQuery = trpc.characters.list.useQuery(undefined, { enabled: isAuthenticated });
  const activeQuery = trpc.characters.get.useQuery({ id: activeCharacterId ?? "sem-ficha" }, { enabled: isAuthenticated && Boolean(activeCharacterId) && !previewMode });
  const techniqueTargetQuery = trpc.characters.get.useQuery({ id: techniqueCharacterId ?? "sem-tecnica" }, { enabled: isAuthenticated && Boolean(techniqueCharacterId) && !previewMode });
  const sharesQuery = trpc.shares.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveMutation = trpc.characters.save.useMutation({ onSuccess: () => utils.characters.list.invalidate(), onError: () => toast.error("A ficha contém dados inválidos e não foi salva.") });
  const removeMutation = trpc.characters.remove.useMutation({ onSuccess: () => utils.characters.list.invalidate() });
  const duplicateMutation = trpc.characters.duplicate.useMutation({ onSuccess: () => utils.characters.list.invalidate() });
  const shareMutation = trpc.characters.share.useMutation();
  const refetchActiveCharacter = activeQuery.refetch;
  const refetchCharacterLibrary = charactersQuery.refetch;

  useEffect(() => {
    if (previewMode && !previewLibraryMode) {
      setSheet(createNewSheet("Pré-visualização Infinite Worlds"));
      return;
    }
    if (activeQuery.data && activeQuery.data.id === activeCharacterId) {
      setSheet(hydrateSheet(activeQuery.data.sheet));
    }
  }, [activeCharacterId, activeQuery.data, previewLibraryMode, previewMode]);

  useEffect(() => {
    if (!activeCharacterId || previewMode) return;
    const socket = io({ path: "/api/live", transports: ["websocket", "polling"], withCredentials: true, auth: getLiveSocketAuth() });
    socket.on("connect", () => socket.emit("watch-character", activeCharacterId));
    socket.on("character-updated", () => {
      void refetchActiveCharacter();
      void refetchCharacterLibrary();
    });
    return () => { socket.disconnect(); };
  }, [activeCharacterId, previewMode, refetchActiveCharacter, refetchCharacterLibrary]);

  useEffect(() => {
    if (!sheet || !activeCharacterId || !isAuthenticated || previewMode || sheet.skills.some(skill => !skill.name.trim())) return;
    const timer = window.setTimeout(() => {
      saveMutation.mutate({ id: activeCharacterId, name: sheet.identity.name.trim() || "Personagem sem nome", portraitUrl: sheet.identity.portraitUrl, sheet: sheet as unknown as Record<string, unknown> });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeCharacterId, isAuthenticated, previewMode, sheet]);

  const derived = useMemo(() => sheet ? getDerivedValues(sheet) : null, [sheet]);
  const updateSheet = (updater: (current: FMCharacterSheet) => FMCharacterSheet) => setSheet(current => current ? updater(current) : current);

  const addDiary = (title: string, detail: string, category: FMCharacterSheet["diary"][number]["category"] = "note") => updateSheet(current => ({
    ...current,
    diary: [{ id: id(), at: Date.now(), category, title, detail }, ...current.diary],
  }));

  const createCharacter = async () => {
    const name = newCharacterName.trim() || "Novo integrante";
    const newSheet = createNewSheet(name);
    const characterId = id();
    try {
      await saveMutation.mutateAsync({ id: characterId, name, portraitUrl: null, sheet: newSheet as unknown as Record<string, unknown> });
      setCreating(false);
      setNewCharacterName("");
      setActiveCharacterId(characterId);
      window.history.replaceState(null, "", `/?ficha=${characterId}`);
      setSheet(newSheet);
      setTab("overview");
      toast.success("Ficha criada e vinculada à sua conta.");
    } catch {
      toast.error("Não foi possível criar a ficha. Tente novamente.");
    }
  };

  const openCharacter = (characterId: string) => {
    setActiveCharacterId(characterId);
    window.history.replaceState(null, "", `/?ficha=${characterId}`);
    setSheet(null);
    setTab("overview");
  };

  const deleteCharacter = async (characterId: string, name: string) => {
    if (!window.confirm(`Excluir definitivamente a ficha “${name}”?`)) return;
    try {
      await removeMutation.mutateAsync({ id: characterId });
      if (characterId === activeCharacterId) {
        setActiveCharacterId(null);
        setSheet(null);
        window.history.replaceState(null, "", "/");
      }
      toast.success("Ficha excluída.");
    } catch {
      toast.error("Não foi possível excluir a ficha.");
    }
  };

  const duplicateCharacter = async (characterId: string) => {
    try {
      const duplicate = await duplicateMutation.mutateAsync({ id: characterId });
      setActiveCharacterId(duplicate.id);
      window.history.replaceState(null, "", `/?ficha=${duplicate.id}`);
      setSheet(hydrateSheet(duplicate.sheet));
      toast.success("Cópia criada na sua biblioteca.");
    } catch {
      toast.error("Não foi possível duplicar a ficha.");
    }
  };

  const shareCurrentCharacter = async () => {
    if (!activeCharacterId) return;
    try {
      const result = await shareMutation.mutateAsync({ characterId: activeCharacterId });
      const url = `${window.location.origin}/ficha/${result.token}`;
      await navigator.clipboard.writeText(url);
      await utils.shares.invalidate();
      toast.success("Link público copiado. A visualização é somente leitura.");
    } catch {
      toast.error("Não foi possível criar o link público.");
    }
  };

  const saveLibraryTechnique = async (character: { id: string; name: string; portraitUrl: string | null; sheet: FMCharacterSheet }, technique: FMTechnique, diaryTitle: string) => {
    const kind = getTechniqueKindForSpecialization(character.sheet.progression.specialization);
    const normalizedTechnique = { ...technique, kind };
    const primaryAttribute = getPrimaryTechniqueAttribute(normalizedTechnique, character.sheet.progression.techniqueAttribute);
    const detail = normalizedTechnique.name.trim() ? `${normalizedTechnique.name.trim()} foi vinculada à ficha pela Forja de Técnicas.` : "A técnica ou o estilo foi removido da ficha pela Forja de Técnicas.";
    const nextSheet: FMCharacterSheet = {
      ...character.sheet,
      technique: normalizedTechnique,
      progression: { ...character.sheet.progression, techniqueAttribute: primaryAttribute },
      diary: [{ id: id(), at: Date.now(), category: "note", title: diaryTitle, detail }, ...character.sheet.diary],
    };
    if (previewLibraryMode) {
      setPreviewTechniqueSheet(nextSheet);
      toast.success("Pré-visualização atualizada localmente; nenhum dado foi salvo.");
      return;
    }
    try {
      await saveMutation.mutateAsync({ id: character.id, name: nextSheet.identity.name.trim() || character.name, portraitUrl: character.portraitUrl, sheet: nextSheet as unknown as Record<string, unknown> });
      await utils.characters.get.invalidate({ id: character.id });
      await utils.characters.list.invalidate();
      toast.success(normalizedTechnique.name.trim() ? "Técnica registrada na ficha selecionada." : "Técnica removida da ficha selecionada.");
    } catch {
      toast.error("Não foi possível registrar a técnica. Revise os campos e tente novamente.");
    }
  };

  const exportSheet = () => {
    if (!sheet) return;
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sheet.identity.name.trim().replaceAll(/[^a-z0-9]+/gi, "-").toLocaleLowerCase() || "infinite-worlds"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    addDiary("Ficha exportada", "Uma cópia editável em JSON foi baixada.", "note");
  };

  if (loading && !previewMode) return <div className="grid min-h-screen place-items-center bg-[#09060f] text-violet-100"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div>;

  if (!isAuthenticated && !previewMode) return <PublicWelcome onLogin={startLogin} />;

  if (charactersQuery.isError || sharesQuery.isError) {
    return <LibraryLoadError onRetry={() => { void charactersQuery.refetch(); void sharesQuery.refetch(); }} onLogout={logout} />;
  }

  if (activeCharacterId && activeQuery.isError) {
    return <CharacterLoadError onBack={() => { setActiveCharacterId(null); setSheet(null); }} onRetry={() => void activeQuery.refetch()} />;
  }

  if (!activeCharacterId || !sheet || !derived) {
    const previewCharacter = { id: "preview-technique", name: previewTechniqueSheet.identity.name, portraitUrl: null, updatedAt: new Date(0) };
    const libraryCharacters = previewLibraryMode ? [previewCharacter] : charactersQuery.data ?? [];
    const selectedTechniqueTarget = previewLibraryMode
      ? techniqueCharacterId === previewCharacter.id ? { ...previewCharacter, sheet: previewTechniqueSheet } : null
      : techniqueTargetQuery.data ? { ...techniqueTargetQuery.data, sheet: hydrateSheet(techniqueTargetQuery.data.sheet) } : null;
    return <CharacterLibrary
      userName={previewLibraryMode ? "Pré-visualização local" : user?.name ?? "Integrante"}
      characters={libraryCharacters}
      sharedCount={previewLibraryMode ? 0 : sharesQuery.data?.length ?? 0}
      loading={previewLibraryMode ? false : charactersQuery.isLoading}
      creating={creating}
      newName={newCharacterName}
      onNewName={setNewCharacterName}
      onCreate={() => void createCharacter()}
      onOpen={openCharacter}
      onDuplicate={characterId => void duplicateCharacter(characterId)}
      onDelete={(characterId, name) => void deleteCharacter(characterId, name)}
      techniqueCharacterId={techniqueCharacterId}
      techniqueTarget={selectedTechniqueTarget}
      techniqueLoading={previewLibraryMode ? false : techniqueTargetQuery.isFetching}
      onTechniqueCharacterChange={setTechniqueCharacterId}
      onSaveTechnique={(character, technique, diaryTitle) => saveLibraryTechnique(character, technique, diaryTitle)}
      onToggleCreate={() => setCreating(value => !value)}
      onLogout={logout}
    />;
  }

  return <main className="min-h-screen bg-[#09060f] text-stone-100">
    <header className="sticky top-0 z-30 border-b border-violet-300/10 bg-[#0d0715]/92 backdrop-blur">
      <div className="mx-auto flex max-w-[1540px] items-center gap-3 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => { setActiveCharacterId(null); setSheet(null); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-300/15 px-3 text-sm text-stone-300 transition hover:border-amber-300/40 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300/70"><ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Biblioteca</span></button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-amber-300/65">Infinite Worlds · Guilda F&M</p>
          <p className="truncate font-display text-lg text-stone-100">{sheet.identity.name || "Personagem sem nome"}</p>
        </div>
        <span className="hidden text-xs text-stone-500 lg:inline">{saveMutation.isPending ? "Salvando…" : "Salvamento automático"}</span>
        <ActionButton title="Compartilhar ficha" onClick={() => void shareCurrentCharacter()}><Share2 className="h-4 w-4" /><span className="ml-2 hidden xl:inline">Compartilhar</span></ActionButton>
        <ActionButton title="Exportar JSON" onClick={exportSheet}><Download className="h-4 w-4" /></ActionButton>
        <ActionButton title="Imprimir ou salvar PDF" onClick={() => window.print()}><Printer className="h-4 w-4" /></ActionButton>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1540px] gap-5 p-4 lg:grid-cols-[255px_minmax(0,1fr)] lg:p-6">
      <aside className="no-print rounded-2xl border border-violet-300/10 bg-[#110a1b] p-3 lg:sticky lg:top-[84px] lg:h-[calc(100vh-108px)]">
        <label className="mb-3 flex items-center gap-2 rounded-xl border border-violet-300/10 bg-[#1a1026] px-3 py-2 text-sm text-stone-400 lg:hidden"><Menu className="h-4 w-4 text-amber-300" /><span className="sr-only">Escolha uma aba</span><select className="min-w-0 flex-1 bg-transparent text-stone-100 outline-none" value={tab} onChange={event => setTab(event.target.value as TabId)}>{tabs.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <nav className="hidden gap-1 lg:grid" aria-label="Seções da ficha">{tabs.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-300/70 ${active ? "bg-gradient-to-r from-violet-700/50 to-violet-700/10 text-amber-100 shadow-[inset_3px_0_0_#f4c85f]" : "text-stone-400 hover:bg-violet-300/5 hover:text-stone-100"}`}><Icon className="h-4 w-4" />{item.label}</button>;
        })}</nav>
        <div className="mt-5 border-t border-violet-300/10 pt-4 text-xs leading-5 text-stone-500"><p className="font-display uppercase tracking-[0.18em] text-amber-300/60">Guilda Infinite Worlds</p><p className="mt-2">F&M v2.5.2 com progressão de níveis, graus, XP e recompensas oficiais da guilda.</p></div>
      </aside>
      <section className="min-w-0">{renderTab({ tab, sheet, derived, updateSheet, addDiary, setNewNote, newNote })}</section>
    </div>
  </main>;
}

function PublicWelcome({ onLogin }: { onLogin: () => void }) {
  return <main className="relative isolate min-h-screen overflow-hidden bg-[#09060f] px-5 text-stone-100"><div className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_78%_14%,rgba(111,49,170,.30),transparent_26%),radial-gradient(circle_at_15%_92%,rgba(181,128,36,.17),transparent_25%)]" />
    <div className="mx-auto flex min-h-screen max-w-6xl items-center py-14"><div className="grid w-full gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1.5 font-display text-xs uppercase tracking-[0.2em] text-amber-200"><MoonStar className="h-3.5 w-3.5" />Infinite Worlds · Guilda F&M</div><h1 className="max-w-3xl font-display text-5xl leading-[.94] text-stone-100 sm:text-7xl">Sua técnica.<br /><span className="text-amber-300">Seu mundo infinito.</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-stone-400 sm:text-lg">A ficha digital da guilda Infinite Worlds: regras F&M, progressão por XP e Grau, recompensas de missão e registros de cada cena.</p><div className="mt-8 flex flex-wrap gap-3"><Button onClick={onLogin} className="bg-amber-300 text-[#170d06] hover:bg-amber-200"><Flame className="mr-2 h-4 w-4" />Entrar para acessar as fichas</Button></div><p className="mt-4 text-xs text-stone-600">As fichas são vinculadas à conta; links compartilhados são somente leitura.</p></div><Panel className="relative overflow-hidden border-amber-300/15 bg-[#130a1e] p-6 sm:p-8"><div className="absolute -right-12 -top-12 h-44 w-44 rounded-full border border-amber-300/10" /><p className="font-display text-xs uppercase tracking-[0.24em] text-amber-300/70">Central da guilda</p><div className="mt-6 space-y-4">{[["XP e Graus", "Progrida do 4º Grau ao Grau Especial por meio de XP de missões."], ["Magias/Maldições", "Feitiços: nível, custo, duração, alcance e efeito documentados."], ["Combate e recompensas", "Rolagens d20, missões e recompensas preservadas no Diário."]].map(([title, text]) => <div key={title} className="rounded-xl border border-violet-300/10 bg-black/20 p-4"><p className="font-medium text-stone-200">{title}</p><p className="mt-1 text-sm leading-6 text-stone-500">{text}</p></div>)}</div></Panel></div></div></main>;
}

function LibraryLoadError({ onRetry, onLogout }: { onRetry: () => void; onLogout: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#09060f] px-5 text-stone-100"><Panel className="max-w-lg text-center"><Library className="mx-auto h-10 w-10 text-amber-300" /><h1 className="mt-5 font-display text-3xl">O arquivo não respondeu</h1><p className="mt-3 text-sm leading-6 text-stone-400">Não foi possível carregar suas fichas ou links compartilhados. Seus dados não foram alterados.</p><div className="mt-6 flex justify-center gap-3"><Button onClick={onRetry} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">Tentar novamente</Button><ActionButton title="Sair da conta" onClick={onLogout}>Sair</ActionButton></div></Panel></main>;
}

function CharacterLoadError({ onBack, onRetry }: { onBack: () => void; onRetry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#09060f] px-5 text-stone-100"><Panel className="max-w-lg text-center"><BookOpen className="mx-auto h-10 w-10 text-amber-300" /><h1 className="mt-5 font-display text-3xl">A ficha não pôde ser aberta</h1><p className="mt-3 text-sm leading-6 text-stone-400">Acesse sua biblioteca ou tente carregar novamente. Não houve alteração em seus dados.</p><div className="mt-6 flex justify-center gap-3"><Button onClick={onRetry} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">Tentar novamente</Button><ActionButton title="Voltar à biblioteca" onClick={onBack}>Voltar</ActionButton></div></Panel></main>;
}

function CharacterLibrary({ userName, characters, sharedCount, loading, creating, newName, onNewName, onCreate, onOpen, onDuplicate, onDelete, techniqueCharacterId, techniqueTarget, techniqueLoading, onTechniqueCharacterChange, onSaveTechnique, onToggleCreate, onLogout }: {
  userName: string; characters: Array<{ id: string; name: string; portraitUrl: string | null; updatedAt: Date }>; sharedCount: number; loading: boolean; creating: boolean; newName: string; onNewName: (value: string) => void; onCreate: () => void; onOpen: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string, name: string) => void; techniqueCharacterId: string | null; techniqueTarget: { id: string; name: string; portraitUrl: string | null; sheet: FMCharacterSheet } | null; techniqueLoading: boolean; onTechniqueCharacterChange: (id: string) => void; onSaveTechnique: (character: { id: string; name: string; portraitUrl: string | null; sheet: FMCharacterSheet }, technique: FMTechnique, diaryTitle: string) => Promise<void>; onToggleCreate: () => void; onLogout: () => void;
}) {
  return <main className="min-h-screen bg-[#09060f] px-4 py-6 text-stone-100 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl"><header className="mb-10 flex flex-col justify-between gap-5 border-b border-violet-300/10 pb-7 sm:flex-row sm:items-end"><div><p className="font-display text-xs uppercase tracking-[0.25em] text-amber-300/70">Infinite Worlds · Guilda F&M</p><h1 className="mt-2 font-display text-4xl text-stone-100">Biblioteca da guilda</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">Bem-vindo, {userName}. Cada ficha é salva na sua conta e pode gerar um link público somente leitura.</p></div><div className="flex gap-2"><ActionButton title="Sair da conta" onClick={onLogout}><LogOut className="h-4 w-4" /><span className="ml-2">Sair</span></ActionButton><Button onClick={onToggleCreate} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><CirclePlus className="mr-2 h-4 w-4" />Nova ficha</Button></div></header>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><Panel><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Fichas salvas</p><p className="mt-1 font-display text-3xl text-amber-200">{characters.length}</p></Panel><Panel><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Links públicos</p><p className="mt-1 font-display text-3xl text-amber-200">{sharedCount}</p></Panel><Panel><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Modo de sincronização</p><p className="mt-2 text-sm text-violet-200">Conta autenticada</p></Panel></div>
    <TechniqueForge characters={characters} selectedCharacterId={techniqueCharacterId} target={techniqueTarget} loading={techniqueLoading} onSelectCharacter={onTechniqueCharacterChange} onSave={onSaveTechnique} />
    {creating ? <Panel className="mb-6 border-amber-300/20"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><Field label="Nome do personagem"><Input autoFocus value={newName} onChange={event => onNewName(event.target.value)} placeholder="Ex.: Aoi Todo" /></Field><Button onClick={onCreate} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">Criar ficha</Button><ActionButton title="Cancelar criação" onClick={onToggleCreate}>Cancelar</ActionButton></div></Panel> : null}
    {loading ? <div className="grid place-items-center py-20"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div> : characters.length === 0 ? <Panel className="grid min-h-72 place-items-center border-dashed text-center"><div><Library className="mx-auto h-9 w-9 text-violet-300/70" /><h2 className="mt-4 font-display text-2xl">Nenhuma ficha arquivada</h2><p className="mt-2 max-w-md text-sm leading-6 text-stone-500">Crie a primeira ficha para registrar os dados de um feiticeiro, uma maldição ou um restringido.</p><Button onClick={onToggleCreate} className="mt-5 bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Criar a primeira ficha</Button></div></Panel> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{characters.map(character => <Panel key={character.id} className="group flex min-h-52 flex-col justify-between overflow-hidden border-violet-300/10 transition hover:border-amber-300/30"><div><div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-600/20 font-display text-xl text-amber-200">{character.name.slice(0, 1).toUpperCase()}</div><span className="rounded-full border border-violet-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-stone-500">Sincronizada</span></div><h2 className="mt-6 font-display text-2xl text-stone-100">{character.name}</h2><p className="mt-2 text-xs text-stone-500">Atualizada em {new Date(character.updatedAt).toLocaleDateString("pt-BR")}</p></div><div className="mt-7 flex flex-wrap gap-2"><Button size="sm" onClick={() => onOpen(character.id)} className="bg-violet-600/70 text-violet-50 hover:bg-violet-500">Abrir</Button><ActionButton title="Duplicar ficha" onClick={() => onDuplicate(character.id)}><Copy className="h-4 w-4" /></ActionButton><ActionButton title="Excluir ficha" onClick={() => onDelete(character.id, character.name)} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></Panel>)}</div>}</div></main>;
	}

function TechniqueForge({ characters, selectedCharacterId, target, loading, onSelectCharacter, onSave }: {
  characters: Array<{ id: string; name: string; portraitUrl: string | null; updatedAt: Date }>;
  selectedCharacterId: string | null;
  target: { id: string; name: string; portraitUrl: string | null; sheet: FMCharacterSheet } | null;
  loading: boolean;
  onSelectCharacter: (id: string) => void;
  onSave: (character: { id: string; name: string; portraitUrl: string | null; sheet: FMCharacterSheet }, technique: FMTechnique, diaryTitle: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FMTechnique | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) {
      setDraft(null);
      return;
    }
    const kind = getTechniqueKindForSpecialization(target.sheet.progression.specialization);
    setDraft({ ...target.sheet.technique, kind, attributeKeys: target.sheet.technique.attributeKeys.length ? target.sheet.technique.attributeKeys : [target.sheet.progression.techniqueAttribute] });
  }, [target?.id]);

  const kind = target ? getTechniqueKindForSpecialization(target.sheet.progression.specialization) : "cursed";
  const copy = getTechniqueCopy(kind);
  const errors = target && draft ? validateTechnique(draft, target.sheet.progression.specialization) : [];
  const ready = draft ? isTechniqueReady(draft) : false;
  const update = (updater: (current: FMTechnique) => FMTechnique) => setDraft(current => current ? updater(current) : current);
  const toggleAttribute = (attribute: FMCharacterSheet["progression"]["techniqueAttribute"]) => update(current => {
    const selected = current.attributeKeys.includes(attribute);
    if (selected && current.attributeKeys.length === 1) {
      toast.error("A técnica precisa manter pelo menos um atributo.");
      return current;
    }
    return { ...current, attributeKeys: selected ? current.attributeKeys.filter(item => item !== attribute) : [...current.attributeKeys, attribute] };
  });
  const clearDraft = () => {
    if (!target || !window.confirm(`Remover ${copy.singular.toLocaleLowerCase()} de ${target.name}? Os feitiços não serão apagados.`)) return;
    const base = createEmptyFMSheet().technique;
    setDraft({ ...base, kind, attributeKeys: [target.sheet.progression.techniqueAttribute] });
  };
  const save = async () => {
    if (!target || !draft) return;
    if (errors.length) {
      toast.error(errors[0]?.message ?? "Revise a técnica antes de salvar.");
      return;
    }
    if (draft.name.trim() || draft.basicFunction.trim()) {
      if (!ready) {
        toast.error(`Informe nome, ${copy.basicFunction.toLocaleLowerCase()} e ao menos um atributo.`);
        return;
      }
    }
    setSaving(true);
    await onSave(target, { ...draft, kind }, draft.name.trim() ? `${copy.singular} registrada` : `${copy.singular} removida`);
    setSaving(false);
  };

  return <Panel className="relative mb-6 overflow-hidden border-amber-300/20 bg-[radial-gradient(circle_at_92%_7%,rgba(173,111,223,.15),transparent_34%),#120c1d]"><div className="absolute -right-10 -top-12 h-32 w-32 rounded-full border border-amber-300/10" /><div className="relative flex flex-col gap-4 border-b border-amber-300/10 pb-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 font-display text-xs uppercase tracking-[.2em] text-amber-300/75"><WandSparkles className="h-4 w-4" />Forja de Técnicas</div><h2 className="mt-2 font-display text-2xl text-stone-100">Crie o núcleo do personagem</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">Selecione uma ficha para registrar a técnica amaldiçoada ou, para restringidos, o Estilo Marcial. Feitiços são extensões práticas e permanecem na aba Magias/Maldições.</p></div><Field label="Personagem da biblioteca"><select className="h-10 min-w-56 rounded-md border border-violet-300/20 bg-[#0c0713] px-3 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-amber-300/70" value={selectedCharacterId ?? "unselected"} onChange={event => { if (event.target.value !== "unselected") onSelectCharacter(event.target.value); }}><option value="unselected">Selecione uma ficha</option>{characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></Field></div>
    {!selectedCharacterId ? <div className="relative grid min-h-32 place-items-center text-center"><div><WandSparkles className="mx-auto h-7 w-7 text-violet-300/70" /><p className="mt-3 text-sm text-stone-400">Escolha um personagem acima ou use o ícone de técnica no cartão dele.</p></div></div> : loading || !target ? <div className="relative grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-amber-300" /></div> : !draft ? null : <div className="relative mt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-lg text-amber-100">{target.name} · {copy.singular}</p><p className="mt-1 text-xs leading-5 text-stone-500">{FM_TECHNIQUE_CREATION_CITATION}. Os benefícios narrativos não alteram cálculos automaticamente: registre efeitos de combate e feitiços nos campos próprios.</p></div><span className="rounded-full border border-violet-300/15 bg-black/20 px-3 py-1 text-xs text-violet-200">Atributo primário: {FM_ATTRIBUTE_LABELS[draft.attributeKeys[0] ?? target.sheet.progression.techniqueAttribute]}</span></div><div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]"><div className="grid content-start gap-4"><Field label={`Nome da ${copy.singular.toLocaleLowerCase()}`} hint="O nome identifica o núcleo que orienta os feitiços."><Input maxLength={120} value={draft.name} onChange={event => update(current => ({ ...current, name: event.target.value }))} placeholder={kind === "martial" ? "Ex.: Caminho do Predador" : "Ex.: Boneco de Palha"} /></Field><Field label={copy.attributes} hint="Escolha os atributos coerentes com o conceito. O primeiro será usado como atributo principal da ficha."><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{fmAttributeKeys.map(attribute => <label key={attribute} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition ${draft.attributeKeys.includes(attribute) ? "border-amber-300/45 bg-amber-300/10 text-amber-100" : "border-violet-300/10 bg-black/20 text-stone-400 hover:border-violet-300/35"}`}><input type="checkbox" className="accent-amber-300" checked={draft.attributeKeys.includes(attribute)} onChange={() => toggleAttribute(attribute)} /><span>{FM_ATTRIBUTE_LABELS[attribute]}</span></label>)}</div></Field><Field label="Itens ou ferramentas essenciais" hint="Registre apenas recursos indispensáveis ao funcionamento narrativo."><Textarea value={draft.requiredItems} onChange={event => update(current => ({ ...current, requiredItems: event.target.value }))} placeholder="Ex.: martelo, boneco de palha e pregos." /></Field></div><div className="grid content-start gap-4"><Field label={copy.basicFunction} hint={copy.basicFunctionHint}><Textarea className="min-h-32" maxLength={4000} value={draft.basicFunction} onChange={event => update(current => ({ ...current, basicFunction: event.target.value }))} placeholder="Defina o conceito, o que permite fazer e quais efeitos mecânicos precisam constar nos feitiços." /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.benefits} hint="Benefícios pequenos, coerentes e intrínsecos; descreva a origem para aprovação do mestre."><Textarea value={draft.intrinsicBenefits} onChange={event => update(current => ({ ...current, intrinsicBenefits: event.target.value }))} placeholder="Ex.: equipamento simples essencial." /></Field><Field label={copy.limitations} hint="Limitações podem orientar o equilíbrio e a ficção da técnica."><Textarea value={draft.limitations} onChange={event => update(current => ({ ...current, limitations: event.target.value }))} placeholder="Ex.: exige um foco; não causa outro tipo de dano." /></Field></div><Field label="Observações e aprovação do mestre" hint="A ferramenta registra a proposta, mas efeitos criativos e exceções exigem validação da mesa."><Textarea value={draft.reviewNotes} onChange={event => update(current => ({ ...current, reviewNotes: event.target.value }))} placeholder="Restrições acordadas, referências e observações da campanha." /></Field></div></div><div className="mt-5 flex flex-col gap-3 border-t border-violet-300/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className={`text-xs ${ready && errors.length === 0 ? "text-emerald-300" : "text-stone-500"}`}>{ready && errors.length === 0 ? `${copy.singular} pronta para ser registrada.` : `Para registrar uma nova entrada, informe nome, ${copy.basicFunction.toLocaleLowerCase()} e atributo.`}</p><div className="flex flex-wrap gap-2"><ActionButton title={`Limpar ${copy.singular.toLocaleLowerCase()}`} onClick={clearDraft} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /><span className="ml-2">Remover</span></ActionButton><Button type="button" disabled={saving} onClick={() => void save()} className="bg-amber-300 text-[#190d07] hover:bg-amber-200 disabled:opacity-60"><WandSparkles className="mr-2 h-4 w-4" />{saving ? "Registrando…" : "Registrar técnica"}</Button></div></div></div>}</Panel>;
}

function renderTab({ tab, sheet, derived, updateSheet, addDiary, newNote, setNewNote }: { tab: TabId; sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void; newNote: string; setNewNote: (value: string) => void; }) {
  if (tab === "overview") return <OverviewTab sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} />;
  if (tab === "attributes") return <AttributesTab sheet={sheet} derived={derived} updateSheet={updateSheet} />;
  if (tab === "skills") return <SkillsTab sheet={sheet} derived={derived} updateSheet={updateSheet} />;
  if (tab === "spells") return <SpellsTab sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} />;
  if (tab === "combat") return <CombatTab sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} />;
  if (tab === "equipment") return <EquipmentTab sheet={sheet} updateSheet={updateSheet} />;
  return <DiaryTab sheet={sheet} derived={derived} updateSheet={updateSheet} newNote={newNote} setNewNote={setNewNote} addDiary={addDiary} />;
}

function OverviewTab({ sheet, derived, updateSheet, addDiary }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const resourceLabel = getResourceLabel(sheet.progression.specialization, sheet.progression.nonSorcerer);
  const changeResource = (resource: "health" | "energy", delta: number) => updateSheet(current => {
    const values = getDerivedValues(current);
    const maximum = resource === "health" ? values.healthMaximum : values.energyMaximum;
    const currentValue = current.resources[resource].current;
    const nextValue = Math.min(maximum, Math.max(0, currentValue + delta));
    const label = resource === "health" ? "PV" : getResourceLabel(current.progression.specialization, current.progression.nonSorcerer);
    return { ...current, resources: { ...current.resources, [resource]: { ...current.resources[resource], current: nextValue } }, diary: [{ id: id(), at: Date.now(), category: "resource", title: `${label} ajustado`, detail: `${currentValue} → ${nextValue} (${delta > 0 ? "+" : ""}${delta})` }, ...current.diary] };
  });
  const setCurrentResource = (resource: "health" | "energy", value: string) => updateSheet(current => ({ ...current, resources: { ...current.resources, [resource]: { ...current.resources[resource], current: Math.max(0, asNumber(value)) } } }));
  return <><SectionTitle eyebrow="Núcleo do personagem" title="Visão geral" description="Acompanhe a identidade, a progressão Infinite Worlds, os recursos atuais e as fórmulas que sustentam a cena." />
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><Panel><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome"><Input value={sheet.identity.name} onChange={event => updateSheet(current => ({ ...current, identity: { ...current.identity, name: event.target.value } }))} /></Field><Field label="Jogador"><Input value={sheet.identity.player} onChange={event => updateSheet(current => ({ ...current, identity: { ...current.identity, player: event.target.value } }))} /></Field><Field label="Grau"><Input value={sheet.identity.grade} onChange={event => updateSheet(current => ({ ...current, identity: { ...current.identity, grade: event.target.value } }))} placeholder="Ex.: Grau 2" /></Field><Field label="Origem"><Input value={sheet.origin.name} onChange={event => updateSheet(current => ({ ...current, origin: { ...current.origin, name: event.target.value } }))} placeholder="Ex.: Inato" /></Field><Field label="Técnica amaldiçoada" hint="Atributo-chave escolhido na aba Atributos."><Input value={sheet.technique.name} onChange={event => updateSheet(current => ({ ...current, technique: { ...current.technique, name: event.target.value } }))} placeholder="Nome da técnica" /></Field><Field label="Funcionamento básico" hint="O núcleo narrativo e os limites da técnica."><Textarea value={sheet.technique.basicFunction} onChange={event => updateSheet(current => ({ ...current, technique: { ...current.technique, basicFunction: event.target.value } }))} placeholder="Descreva o conceito e as restrições da técnica." /></Field></div></Panel>
      <div className="grid gap-4"><ResourceCard label="Pontos de Vida" shortLabel="PV" value={sheet.resources.health.current} maximum={derived.healthMaximum} onChange={value => setCurrentResource("health", value)} onAdjust={delta => changeResource("health", delta)} /><ResourceCard label={resourceLabel} shortLabel={resourceLabel === "Estamina" ? "ES" : "PE"} value={sheet.resources.energy.current} maximum={derived.energyMaximum} onChange={value => setCurrentResource("energy", value)} onAdjust={delta => changeResource("energy", delta)} /></div></div>
    <GuildProgressPanel sheet={sheet} updateSheet={updateSheet} addDiary={addDiary} />
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FormulaCard label="Defesa" value={derived.defense} formula="10 + Destreza + metade do nível + bônus" source="Livro-base, pp. 19 e 281" /><FormulaCard label="Iniciativa" value={`${derived.initiative >= 0 ? "+" : ""}${derived.initiative}`} formula="Destreza + bônus" source="Livro-base, pp. 19 e 291" /><FormulaCard label="Atenção" value={derived.attention} formula="10 + Percepção + bônus" source="Livro-base, p. 19" /><FormulaCard label="CD da técnica" value={derived.techniqueDc} formula="10 + metade do nível + atributo + treinamento" source="Livro-base, p. 198" /></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel><SectionTitle eyebrow="Aspectos pessoais" title="Quem atravessa a maldição" description="Campos narrativos da criação de personagem." /><div className="grid gap-4 sm:grid-cols-2"><Field label="Traços de personalidade"><Textarea value={sheet.personal.traits} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, traits: event.target.value } }))} /></Field><Field label="Ideais"><Textarea value={sheet.personal.ideals} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, ideals: event.target.value } }))} /></Field><Field label="Ligações"><Textarea value={sheet.personal.bonds} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, bonds: event.target.value } }))} /></Field><Field label="Complicações"><Textarea value={sheet.personal.complications} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, complications: event.target.value } }))} /></Field></div></Panel><Panel><SectionTitle eyebrow="Domínio inato" title="O espaço que define a alma" description="Este campo registra a representação metafísica do personagem." /><Textarea className="min-h-56" value={sheet.personal.innateDomain} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, innateDomain: event.target.value } }))} placeholder="Descreva o domínio inato…" /></Panel></div></>;
}

function GuildProgressPanel({ sheet, updateSheet, addDiary }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const [xpDifficulty, setXpDifficulty] = useState<InfiniteWorldMissionDifficulty>("medium");
  const [moneyDifficulty, setMoneyDifficulty] = useState<InfiniteWorldMoneyDifficulty>("normal");
  const progress = getInfiniteWorldProgress(sheet.progression.experience ?? 0);
  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
  const applyExperience = (value: string) => updateSheet(current => {
    const next = getInfiniteWorldProgress(asNumber(value));
    return { ...current, progression: { ...current.progression, experience: next.experience, level: next.level, specializationLevels: next.level }, identity: { ...current.identity, grade: next.grade.label } };
  });
  const applyMissionReward = () => {
    const xp = getMissionExperienceReward(progress.grade.id, xpDifficulty);
    const money = getMissionMoneyReward(progress.grade.id, moneyDifficulty);
    updateSheet(current => {
      const next = getInfiniteWorldProgress((current.progression.experience ?? 0) + xp);
      return { ...current, progression: { ...current.progression, experience: next.experience, level: next.level, specializationLevels: next.level }, identity: { ...current.identity, grade: next.grade.label }, guild: { ...(current.guild ?? { currency: 0 }), currency: (current.guild?.currency ?? 0) + money } };
    });
    addDiary(`Missão concluída — ${progress.grade.label}`, `+${xp} XP (${xpDifficulty}) e ${formatCurrency(money)} (${moneyDifficulty}).`, "note");
    toast.success(`Recompensa registrada: +${xp} XP e ${formatCurrency(money)}.`);
  };
  return <Panel className="mt-4 border-amber-300/20 bg-amber-300/[.035]"><div className="flex flex-col gap-3 border-b border-amber-300/10 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Guilda Infinite Worlds</p><h3 className="mt-1 font-display text-2xl text-stone-100">Progressão de Grau e Nível</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">XP define o nível e o grau automaticamente conforme a tabela da guilda. Recompensas de missão são aplicadas e registradas no Diário.</p></div><span className="w-fit rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-medium text-amber-100">{progress.grade.label}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><FormulaCard label="XP atual" value={progress.experience} formula="Acumulado na guilda" source="Tabela Infinite Worlds" /><FormulaCard label="Nível" value={progress.level} formula={`Faixa ${progress.grade.minLevel}–${progress.grade.maxLevel}`} source="Tabela Infinite Worlds" /><FormulaCard label="Próximo nível" value={progress.nextLevelExperience ?? "Máximo"} formula={progress.experienceToNextLevel === null ? "Nível 30 consolidado" : `Faltam ${progress.experienceToNextLevel} XP`} source="Tabela Infinite Worlds" /><FormulaCard label="Moeda" value={formatCurrency(sheet.guild?.currency ?? 0)} formula="Recompensas de missão acumuladas" source="Tabela Infinite Worlds" /><FormulaCard label="Faixa de XP" value={`${progress.grade.minExperience}–${progress.grade.maxExperience}`} formula="Faixa oficial do grau" source="Tabela Infinite Worlds" /></div><div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]"><Panel className="border-violet-300/10 bg-black/20"><Field label="XP acumulado" hint="Alterar XP atualiza nível e grau automaticamente."><Input type="number" min={0} max={6499} value={progress.experience} onChange={event => applyExperience(event.target.value)} /></Field></Panel><Panel className="border-violet-300/10 bg-black/20"><div className="grid gap-3 md:grid-cols-3"><Field label="Missão: XP"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={xpDifficulty} onChange={event => setXpDifficulty(event.target.value as InfiniteWorldMissionDifficulty)}><option value="easy">Fácil</option><option value="medium">Médio</option><option value="hard">Difícil</option><option value="hard-plus">Difícil+</option></select></Field><Field label="Missão: moeda"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={moneyDifficulty} onChange={event => setMoneyDifficulty(event.target.value as InfiniteWorldMoneyDifficulty)}><option value="easy">Fácil</option><option value="normal">Normal</option><option value="hard">Difícil</option></select></Field><div className="flex items-end"><Button type="button" onClick={applyMissionReward} className="w-full bg-amber-300 text-[#190d07] hover:bg-amber-200">Aplicar recompensa</Button></div></div><p className="mt-3 text-xs leading-5 text-stone-500">Recompensa atual: +{getMissionExperienceReward(progress.grade.id, xpDifficulty)} XP e {formatCurrency(getMissionMoneyReward(progress.grade.id, moneyDifficulty))}.</p></Panel></div></Panel>;
}

function ResourceCard({ label, shortLabel, value, maximum, onChange, onAdjust }: { label: string; shortLabel: string; value: number; maximum: number; onChange: (value: string) => void; onAdjust: (delta: number) => void }) {
  const percentage = maximum > 0 ? Math.min(100, Math.max(0, value / maximum * 100)) : 0;
  return <Panel className="overflow-hidden"><div className="flex items-start justify-between gap-4"><div><p className="font-display text-xs uppercase tracking-[0.2em] text-amber-300/70">{shortLabel}</p><p className="mt-1 text-sm text-stone-300">{label}</p></div><p className="font-display text-xl text-stone-100">{value}/{maximum}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-300" style={{ width: `${percentage}%` }} /></div><div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2"><ActionButton title={`Reduzir ${label} em 5`} onClick={() => onAdjust(-5)}>−5</ActionButton><Input type="number" min={0} value={value} onChange={event => onChange(event.target.value)} aria-label={`Valor atual de ${label}`} /><ActionButton title={`Aumentar ${label} em 5`} onClick={() => onAdjust(5)}>+5</ActionButton></div><div className="mt-2 grid grid-cols-2 gap-2"><ActionButton title={`Reduzir ${label} em 1`} onClick={() => onAdjust(-1)}>−1</ActionButton><ActionButton title={`Aumentar ${label} em 1`} onClick={() => onAdjust(1)}>+1</ActionButton></div></Panel>;
}

function FormulaCard({ label, value, formula, source }: { label: string; value: string | number; formula: string; source?: string }) { return <Panel className="border-violet-300/10"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p><p className="mt-1 font-display text-3xl text-amber-200">{value}</p><p className="mt-2 text-xs leading-5 text-stone-500">{formula}</p>{source ? <p className="mt-1 text-[11px] leading-4 text-stone-600">{source}</p> : null}</Panel>; }

function AttributesTab({ sheet, derived, updateSheet }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  return <><SectionTitle eyebrow="Estrutura de poder" title="Atributos e progressão" description={`Atributos de 0 a 30; o limite natural é 20. As fórmulas mostram o efeito do valor atual. ${FM_RULE_CITATIONS.coreValues} e ${FM_RULE_CITATIONS.training}.`} />
    <div className="grid gap-4 xl:grid-cols-[1fr_.84fr]"><Panel><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fmAttributeKeys.map(attribute => <div key={attribute} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium text-stone-200">{FM_ATTRIBUTE_LABELS[attribute]}</span><span className="font-display text-amber-200">{derived.attributes[attribute] >= 10 ? "+" : ""}{Math.floor((derived.attributes[attribute] - 10) / 2)}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><Field label="Base"><Input type="number" min={0} max={30} value={sheet.attributes.base[attribute]} onChange={event => updateSheet(current => ({ ...current, attributes: { ...current.attributes, base: { ...current.attributes.base, [attribute]: Math.min(30, Math.max(0, asNumber(event.target.value))) } } }))} /></Field><Field label="Bônus"><Input type="number" value={sheet.attributes.permanentBonuses[attribute]} onChange={event => updateSheet(current => ({ ...current, attributes: { ...current.attributes, permanentBonuses: { ...current.attributes.permanentBonuses, [attribute]: asNumber(event.target.value) } } }))} /></Field></div></div>)}</div></Panel>
      <Panel><div className="grid gap-4"><Field label="Nível do personagem"><Input type="number" min={sheet.progression.optionalLevelZero ? 0 : 1} max={20} value={sheet.progression.level} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, level: Math.min(20, Math.max(current.progression.optionalLevelZero ? 0 : 1, asNumber(event.target.value))), specializationLevels: Math.min(20, Math.max(current.progression.optionalLevelZero ? 0 : 1, asNumber(event.target.value))) } }))} /></Field><Field label="Especialização"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sheet.progression.specialization} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, specialization: event.target.value as FMSpecializationKey } }))}>{(Object.keys(FM_SPECIALIZATION_LABELS) as FMSpecializationKey[]).map(key => <option key={key} value={key}>{FM_SPECIALIZATION_LABELS[key]}</option>)}</select></Field><Field label="Atributo da técnica"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sheet.progression.techniqueAttribute} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, techniqueAttribute: event.target.value as FMCharacterSheet["progression"]["techniqueAttribute"] } }))}>{fmAttributeKeys.map(key => <option key={key} value={key}>{FM_ATTRIBUTE_LABELS[key]}</option>)}</select></Field><Field label="Bônus de treinamento"><Input readOnly value={`+${derived.trainingBonus} — cresce nos níveis 5, 9, 13 e 17`} /></Field><label className="flex items-start gap-3 rounded-xl border border-violet-300/10 bg-black/20 p-3 text-sm text-stone-300"><input type="checkbox" className="mt-1 accent-amber-300" checked={sheet.progression.optionalLevelZero} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, optionalLevelZero: event.target.checked, level: event.target.checked ? 0 : Math.max(1, current.progression.level), nonSorcerer: event.target.checked ? false : current.progression.nonSorcerer } }))} /><span><strong className="text-stone-100">Regra opcional: personagem de nível 0</strong><br /><span className="text-xs leading-5 text-stone-500">PV = 6 + Constituição, sem energia e com treinamento +1.</span></span></label><label className="flex items-start gap-3 rounded-xl border border-violet-300/10 bg-black/20 p-3 text-sm text-stone-300"><input type="checkbox" className="mt-1 accent-amber-300" checked={sheet.progression.nonSorcerer} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, nonSorcerer: event.target.checked, optionalLevelZero: event.target.checked ? false : current.progression.optionalLevelZero } }))} /><span><strong className="text-stone-100">Regra opcional: não-feiticeiro</strong><br /><span className="text-xs leading-5 text-stone-500">Usa Estamina (máximo 10 + bônus) e limita atributos a 20.</span></span></label></div></Panel></div>
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FormulaCard label="PV máximo" value={derived.healthMaximum} formula="Especialização + Constituição por nível + bônus" source="Livro-base, pp. 20 e 49–128" /><FormulaCard label={getResourceLabel(sheet.progression.specialization, sheet.progression.nonSorcerer)} value={derived.energyMaximum} formula="Especialização por nível, ou Estamina limitada quando não-feiticeiro" source="Livro-base, p. 21; Regras Opcionais, pp. 1–2" /><FormulaCard label="Integridade da Alma" value={derived.integrity} formula="Igual ao máximo de PV" source="Livro-base, p. 19" /><FormulaCard label="Deslocamento" value={`${derived.movement} m`} formula="9 m + bônus registrados" source="Livro-base, p. 19" /></div>
    <Panel className="mt-4"><div className="mb-4"><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Testes de Resistência</p><h3 className="mt-1 font-display text-xl text-stone-100">Resistências/TRs</h3><p className="mt-1 text-sm text-stone-500">Atributo-chave + metade do nível + treinamento quando aplicável.</p><p className="mt-1 text-xs text-stone-600">Livro-base, p. 280.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{fmSavingThrowKeys.map(key => <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-violet-300/10 bg-black/20 p-3"><span><span className="block text-sm font-medium text-stone-200">{FM_SAVING_THROW_LABELS[key]}</span><span className="mt-1 block font-display text-xl text-amber-200">{derived.savingThrows[key] >= 0 ? "+" : ""}{derived.savingThrows[key]}</span></span><input type="checkbox" className="h-4 w-4 accent-amber-300" checked={sheet.progression.savingThrowTraining[key]} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, savingThrowTraining: { ...current.progression.savingThrowTraining, [key]: event.target.checked } } }))} aria-label={`Treinado em ${FM_SAVING_THROW_LABELS[key]}`} /> </label>)}</div></Panel></>;
}

function SkillsTab({ sheet, derived, updateSheet }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const addSkill = () => updateSheet(current => ({ ...current, skills: [...current.skills, { id: id(), name: "Nova perícia", attribute: "intelligence", proficiency: "untrained", otherBonus: 0, notes: "" }] }));
  const hasInvalidSkills = sheet.skills.some(skill => !skill.name.trim());
  return <><SectionTitle eyebrow="Testes de perícia" title="Perícias" description={hasInvalidSkills ? "Cada perícia precisa de um nome antes de a ficha poder ser salva." : "Bônus = atributo-chave + metade do nível + treinamento (ou mestria) + outros bônus. Livro-base, p. 278."} action={<Button size="sm" onClick={addSkill} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Adicionar perícia</Button>} />
    <div className="space-y-3">{sheet.skills.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">Nenhuma perícia registrada. Adicione as perícias em que o personagem possui treinamento.</Panel> : sheet.skills.map(skill => { const bonus = getSkillBonus(sheet.progression.level, derived.attributes, skill.attribute, skill.proficiency, skill.otherBonus, derived.trainingBonus); return <Panel key={skill.id}><div className="grid gap-3 lg:grid-cols-[minmax(160px,1.3fr)_minmax(130px,.8fr)_minmax(130px,.8fr)_100px_110px_auto]"><Field label="Perícia"><Input value={skill.name} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Atributo"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={skill.attribute} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, attribute: event.target.value as typeof item.attribute } : item) }))}>{fmAttributeKeys.map(key => <option key={key} value={key}>{FM_ATTRIBUTE_LABELS[key]}</option>)}</select></Field><Field label="Proficiência"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={skill.proficiency} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, proficiency: event.target.value as typeof item.proficiency } : item) }))}><option value="untrained">Sem treino</option><option value="trained">Treinado</option><option value="master">Mestre</option></select></Field><Field label="Outros"><Input type="number" value={skill.otherBonus} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, otherBonus: asNumber(event.target.value) } : item) }))} /></Field><Field label="Bônus"><Input readOnly value={`${bonus >= 0 ? "+" : ""}${bonus}`} /></Field><ActionButton title="Remover perícia" onClick={() => updateSheet(current => ({ ...current, skills: current.skills.filter(item => item.id !== skill.id) }))} className="self-end hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div>{skill.notes ? <p className="mt-3 text-xs text-stone-500">{skill.notes}</p> : null}</Panel>})}</div></>;
}

function SpellsTab({ sheet, derived, updateSheet, addDiary }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const addSpell = () => updateSheet(current => ({ ...current, spells: [...current.spells, { id: id(), name: "Novo feitiço", type: "damage", level: 1, casting: "common", reach: "12 metros", targetOrArea: "Uma criatura", durationType: "immediate", durationDetail: "", effect: "", requirement: "", damage: "", damageType: "", resolution: "attack", savingThrow: "", costAdjustment: 0, combatModifierTarget: "none", combatModifier: 0, notes: "", active: false }] }));
  const highestLevel = getHighestSpellLevel(sheet.progression.level);
  const castSpell = (spell: FMSpell) => {
    if (spell.level > highestLevel) {
      toast.error(`Este personagem ainda não pode conjurar feitiços de nível ${spell.level}.`);
      return;
    }
    const cost = getSpellCost(spell.level, spell.costAdjustment);
    if (sheet.resources.energy.current < cost) {
      toast.error(`Energia insuficiente para usar ${spell.name}.`);
      return;
    }
    updateSheet(current => ({
      ...current,
      resources: { ...current.resources, energy: { ...current.resources.energy, current: current.resources.energy.current - cost } },
      spells: current.spells.map(item => item.id === spell.id && item.durationType !== "immediate" ? { ...item, active: true } : item),
    }));
    addDiary(`Feitiço: ${spell.name}`, `${cost} PE gastos. ${spell.durationType === "immediate" ? "Efeito imediato resolvido." : "Feitiço marcado como ativo."}`, "spell");
    toast.success(`${spell.name} conjurado: ${cost} PE gastos.`);
  };
  const sustainSpell = (spell: FMSpell) => {
    const cost = getSustainCost(spell.level);
    if (!spell.active || spell.durationType !== "sustained") {
      toast.error("Apenas feitiços sustentados e ativos podem ser mantidos.");
      return;
    }
    if (sheet.resources.energy.current < cost) {
      toast.error(`Energia insuficiente para sustentar ${spell.name}.`);
      return;
    }
    updateSheet(current => ({ ...current, resources: { ...current.resources, energy: { ...current.resources.energy, current: current.resources.energy.current - cost } } }));
    addDiary(`Sustentação: ${spell.name}`, `${cost} PE gastos para sustentar o feitiço nesta rodada.`, "spell");
    toast.success(`${spell.name} sustentado: ${cost} PE gastos.`);
  };
  return <><SectionTitle eyebrow="Perfil amaldiçoado" title="Magias/Maldições" description="Em F&M, o termo oficial interno é Feitiço. Custos, requisitos e efeitos especiais ficam explícitos para validação do Narrador. Livro-base, pp. 198–203." action={<Button size="sm" onClick={addSpell} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Adicionar feitiço</Button>} />
    <Panel className="mb-4 border-amber-300/15 bg-amber-300/[.035]"><p className="text-sm text-amber-100">Nível máximo disponível: <strong>{highestLevel}</strong>. Custo padrão: nível 0 = 0 PE; níveis 1–5 = 2, 5, 8, 12 e 20 PE. Um feitiço acima do acesso atual permanece identificado para revisão.</p></Panel>
    <div className="space-y-4">{sheet.spells.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">A técnica não possui feitiços registrados. Personagens com técnica normalmente começam com dois.</Panel> : sheet.spells.map(spell => <div key={spell.id} className="space-y-2"><SpellEditor spell={spell} highestLevel={highestLevel} onCast={() => castSpell(spell)} onSustain={() => sustainSpell(spell)} update={updater => updateSheet(current => ({ ...current, spells: current.spells.map(item => item.id === spell.id ? updater(item) : item) }))} remove={() => updateSheet(current => ({ ...current, spells: current.spells.filter(item => item.id !== spell.id) }))} /><SpellCombatModifier spell={spell} update={updater => updateSheet(current => ({ ...current, spells: current.spells.map(item => item.id === spell.id ? updater(item) : item) }))} /></div>)}</div>
    <div className="mt-4 grid gap-4 md:grid-cols-3"><FormulaCard label="CD da técnica" value={derived.techniqueDc} formula="Usada por feitiços com teste de resistência" source="Livro-base, pp. 198–203" /><FormulaCard label="Atributo da técnica" value={FM_ATTRIBUTE_LABELS[sheet.progression.techniqueAttribute]} formula="Definido no funcionamento básico" source="Livro-base, p. 198" /><FormulaCard label="Energia atual" value={`${sheet.resources.energy.current}/${derived.energyMaximum}`} formula="O uso de feitiço consome PE conforme o custo" source="Livro-base, pp. 200–203" /></div></>;
}

function SpellEditor({ spell, highestLevel, onCast, onSustain, update, remove }: { spell: FMSpell; highestLevel: FMSpellLevel; onCast: () => void; onSustain: () => void; update: (updater: (current: FMSpell) => FMSpell) => void; remove: () => void }) {
  const cost = getSpellCost(spell.level, spell.costAdjustment);
  return <Panel className={spell.level > highestLevel ? "border-red-400/40" : ""}><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Feitiço de nível {spell.level}</p><Input className="mt-2 max-w-md font-display text-xl" value={spell.name} onChange={event => update(current => ({ ...current, name: event.target.value }))} /></div><div className="flex gap-2"><ActionButton title="Conjurar feitiço" onClick={onCast} className="border-amber-300/25 text-amber-100"><WandSparkles className="mr-2 h-4 w-4" />Usar · {cost} PE</ActionButton>{spell.durationType === "sustained" ? <ActionButton title="Sustentar por uma rodada" onClick={onSustain} className="border-violet-300/25 text-violet-100">Sustentar · {getSustainCost(spell.level)} PE</ActionButton> : null}<label className="flex items-center gap-2 rounded-lg border border-violet-300/15 px-3 py-2 text-sm text-stone-300"><input type="checkbox" className="accent-amber-300" checked={spell.active} onChange={event => update(current => ({ ...current, active: event.target.checked }))} />Ativo</label><ActionButton title="Remover feitiço" onClick={remove} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></div>
    {spell.level > highestLevel ? <p className="mb-4 text-xs text-red-200">Este nível ainda não está liberado pelo nível atual do personagem.</p> : null}<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Tipo"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.type} onChange={event => update(current => ({ ...current, type: event.target.value as FMSpell["type"] }))}><option value="level-zero">Nível 0</option><option value="damage">Dano</option><option value="auxiliary">Auxiliar</option><option value="healing">Curativo</option><option value="special">Especial</option><option value="passive">Passivo</option></select></Field><Field label="Nível de poder"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.level} onChange={event => update(current => ({ ...current, level: asNumber(event.target.value) as FMSpellLevel }))}>{[0, 1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level}</option>)}</select></Field><Field label="Custo final"><Input readOnly value={`${cost} PE`} /></Field><Field label="Conjuração"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.casting} onChange={event => update(current => ({ ...current, casting: event.target.value as FMSpell["casting"] }))}><option value="common">Ação comum</option><option value="bonus">Ação bônus</option><option value="reaction">Reação</option><option value="movement">Movimento</option><option value="free">Livre</option><option value="complete">Completa</option></select></Field><Field label="Alcance"><Input value={spell.reach} onChange={event => update(current => ({ ...current, reach: event.target.value }))} /></Field><Field label="Alvo ou área"><Input value={spell.targetOrArea} onChange={event => update(current => ({ ...current, targetOrArea: event.target.value }))} /></Field><Field label="Duração"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.durationType} onChange={event => update(current => ({ ...current, durationType: event.target.value as FMSpell["durationType"] }))}><option value="immediate">Imediata</option><option value="lasting">Duradoura</option><option value="sustained">Sustentada</option><option value="concentrated">Concentrada</option><option value="variable">Variável</option></select></Field><Field label="Detalhe da duração"><Input value={spell.durationDetail} onChange={event => update(current => ({ ...current, durationDetail: event.target.value }))} placeholder="Ex.: 3 rodadas" /></Field><Field label="Resolução"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.resolution} onChange={event => update(current => ({ ...current, resolution: event.target.value as FMSpell["resolution"] }))}><option value="attack">Jogada de ataque</option><option value="saving-throw">Teste de resistência</option><option value="none">Sem teste</option></select></Field><Field label="Resistência"><Input value={spell.savingThrow} onChange={event => update(current => ({ ...current, savingThrow: event.target.value }))} placeholder="Ex.: Reflexos" /></Field><Field label="Dano"><Input value={spell.damage} onChange={event => update(current => ({ ...current, damage: event.target.value }))} placeholder="Ex.: 3d8" /></Field><Field label="Tipo de dano"><Input value={spell.damageType} onChange={event => update(current => ({ ...current, damageType: event.target.value }))} /></Field></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Efeito"><Textarea value={spell.effect} onChange={event => update(current => ({ ...current, effect: event.target.value }))} /></Field><Field label="Requisito ou limitação"><Textarea value={spell.requirement} onChange={event => update(current => ({ ...current, requirement: event.target.value }))} /></Field><Field label="Ajuste de custo"><Input type="number" value={spell.costAdjustment} onChange={event => update(current => ({ ...current, costAdjustment: asNumber(event.target.value) }))} /></Field><Field label="Observações"><Textarea value={spell.notes} onChange={event => update(current => ({ ...current, notes: event.target.value }))} /></Field></div></Panel>;
}

function SpellCombatModifier({ spell, update }: { spell: FMSpell; update: (updater: (current: FMSpell) => FMSpell) => void }) {
  return <div className="grid gap-3 rounded-xl border border-violet-300/10 bg-violet-500/[.04] p-3 md:grid-cols-[1fr_160px_auto]"><Field label="Efeito mecânico na cena"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.combatModifierTarget ?? "none"} onChange={event => update(current => ({ ...current, combatModifierTarget: event.target.value as FMSpell["combatModifierTarget"] }))}><option value="none">Sem modificador numérico</option><option value="attack">Bônus de ataque</option><option value="defense">Bônus de defesa</option><option value="initiative">Bônus de iniciativa</option></select></Field><Field label="Valor"><Input type="number" value={spell.combatModifier ?? 0} onChange={event => update(current => ({ ...current, combatModifier: asNumber(event.target.value) }))} /></Field><p className="self-end pb-2 text-xs leading-5 text-stone-500">Aplicado somente enquanto o feitiço estiver ativo; descreva o efeito oficial acima.</p></div>;
}

function CombatTab({ sheet, derived, updateSheet, addDiary }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const addAttack = () => updateSheet(current => ({ ...current, attacks: [...current.attacks, { id: id(), name: "Novo ataque", mode: "melee", finesse: false, trained: true, otherBonus: 0, penalties: 0, damage: "1d6", damageType: "Impacto", reach: "Toque", notes: "" }] }));
  const addDefense = () => updateSheet(current => ({ ...current, defenses: [...current.defenses, { id: id(), name: "Nova defesa", trigger: "Ao ser alvo de um ataque", action: "reaction", effect: "", cost: 0, notes: "" }] }));
  const addCombatant = () => updateSheet(current => ({ ...current, combatants: [...current.combatants, { id: id(), name: "Novo participante", initiative: 0, isPlayer: false }] }));
  const rollAttack = (attack: FMAttack) => {
    const modifier = getAttackBonus({ level: sheet.progression.level, attributes: derived.attributes, mode: attack.mode, finesse: attack.finesse, trained: attack.trained, techniqueAttribute: sheet.progression.techniqueAttribute, override: attack.attributeOverride, otherBonus: attack.otherBonus + derived.activeCombatModifiers.attack, penalties: attack.penalties, trainingBonus: derived.trainingBonus });
    const result = rollD20(modifier);
    addDiary(`Ataque: ${attack.name}`, `d20 ${result.kept} + ${modifier >= 0 ? "+" : ""}${modifier} = ${result.total}. Dano registrado: ${attack.damage || "não informado"}.`, "roll");
    toast.success(`${attack.name}: resultado ${result.total}`);
  };
  const playerInitiative = () => {
    const result = rollD20(derived.initiative);
    updateSheet(current => ({ ...current, combatants: [{ id: "player", name: current.identity.name || "Personagem", initiative: result.total, isPlayer: true }, ...current.combatants.filter(item => !item.isPlayer)] }));
    addDiary("Iniciativa", `d20 ${result.kept} + ${derived.initiative >= 0 ? "+" : ""}${derived.initiative} = ${result.total}.`, "roll");
    toast.success(`Iniciativa: ${result.total}`);
  };
  const combatants = [...sheet.combatants].sort((a, b) => b.initiative - a.initiative);
  return <><SectionTitle eyebrow="Cena de conflito" title="Combate" description="Ataques usam os modificadores oficiais e toda rolagem é adicionada ao Diário. Magias/Maldições ativas ficam disponíveis para a cena. Livro-base, pp. 279–281 e 291–300." action={<div className="flex gap-2"><Button size="sm" onClick={addDefense} variant="outline">Defesa</Button><Button size="sm" onClick={addAttack} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Ataque</Button></div>} />
    <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]"><div className="space-y-3">{sheet.attacks.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">Cadastre ataques para rolar corpo a corpo, à distância ou amaldiçoados.</Panel> : sheet.attacks.map(attack => { const bonus = getAttackBonus({ level: sheet.progression.level, attributes: derived.attributes, mode: attack.mode, finesse: attack.finesse, trained: attack.trained, techniqueAttribute: sheet.progression.techniqueAttribute, override: attack.attributeOverride, otherBonus: attack.otherBonus + derived.activeCombatModifiers.attack, penalties: attack.penalties, trainingBonus: derived.trainingBonus }); return <Panel key={attack.id}><div className="grid gap-3 md:grid-cols-[1.2fr_.7fr_.6fr_.6fr_auto]"><Field label="Ataque"><Input value={attack.name} onChange={event => updateSheet(current => ({ ...current, attacks: current.attacks.map(item => item.id === attack.id ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Modo"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={attack.mode} onChange={event => updateSheet(current => ({ ...current, attacks: current.attacks.map(item => item.id === attack.id ? { ...item, mode: event.target.value as FMAttack["mode"] } : item) }))}><option value="melee">Corpo a corpo</option><option value="ranged">À distância</option><option value="cursed">Amaldiçoado</option></select></Field><Field label="Bônus"><Input readOnly value={`${bonus >= 0 ? "+" : ""}${bonus}`} /></Field><Field label="Dano"><Input value={attack.damage} onChange={event => updateSheet(current => ({ ...current, attacks: current.attacks.map(item => item.id === attack.id ? { ...item, damage: event.target.value } : item) }))} /></Field><div className="flex items-end gap-2"><ActionButton title="Rolar ataque" onClick={() => rollAttack(attack)} className="border-amber-300/25 text-amber-100"><Dice5 className="h-4 w-4" /></ActionButton><ActionButton title="Remover ataque" onClick={() => updateSheet(current => ({ ...current, attacks: current.attacks.filter(item => item.id !== attack.id) }))} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></div></Panel>})}</div><div className="space-y-4"><Panel><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Iniciativa</p><p className="mt-2 font-display text-4xl text-stone-100">d20 {derived.initiative >= 0 ? "+" : ""}{derived.initiative}</p><ActionButton title="Rolar iniciativa" onClick={playerInitiative} className="mt-4 w-full border-amber-300/25 text-amber-100"><Dice5 className="mr-2 h-4 w-4" />Rolar iniciativa</ActionButton></Panel><Panel><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Magias/Maldições ativas</p><div className="mt-3 space-y-2">{sheet.spells.filter(spell => spell.active).length ? sheet.spells.filter(spell => spell.active).map(spell => <div key={spell.id} className="rounded-lg border border-violet-300/10 bg-black/20 p-3"><p className="text-sm text-stone-200">{spell.name}</p><p className="mt-1 text-xs text-stone-500">Nível {spell.level} · {getSpellCost(spell.level, spell.costAdjustment)} PE · {spell.durationType}{spell.combatModifierTarget && spell.combatModifierTarget !== "none" ? ` · ${spell.combatModifier >= 0 ? "+" : ""}${spell.combatModifier} ${spell.combatModifierTarget}` : ""}</p></div>) : <p className="text-sm leading-6 text-stone-500">Nenhum feitiço ativo. Ative-os na aba Magias/Maldições.</p>}</div></Panel></div></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel><SectionTitle eyebrow="Respostas" title="Defesas" description="Registre gatilhos, ação necessária, custo, efeito e observações de cada defesa." action={<Button size="sm" onClick={addDefense} variant="outline">Adicionar</Button>} /><div className="space-y-3">{sheet.defenses.length === 0 ? <p className="text-sm text-stone-500">Nenhuma defesa registrada.</p> : sheet.defenses.map(defense => <div key={defense.id} className="grid gap-3 rounded-xl border border-violet-300/10 bg-black/20 p-3 md:grid-cols-2"><Field label="Defesa"><Input value={defense.name} onChange={event => updateSheet(current => ({ ...current, defenses: current.defenses.map(item => item.id === defense.id ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Gatilho"><Input value={defense.trigger} onChange={event => updateSheet(current => ({ ...current, defenses: current.defenses.map(item => item.id === defense.id ? { ...item, trigger: event.target.value } : item) }))} /></Field><Field label="Ação"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={defense.action} onChange={event => updateSheet(current => ({ ...current, defenses: current.defenses.map(item => item.id === defense.id ? { ...item, action: event.target.value as typeof item.action } : item) }))}><option value="reaction">Reação</option><option value="bonus">Ação bônus</option><option value="free">Ação livre</option></select></Field><Field label="Custo"><Input type="number" min={0} value={defense.cost} onChange={event => updateSheet(current => ({ ...current, defenses: current.defenses.map(item => item.id === defense.id ? { ...item, cost: asNumber(event.target.value) } : item) }))} /></Field><Field label="Efeito"><Textarea value={defense.effect} onChange={event => updateSheet(current => ({ ...current, defenses: current.defenses.map(item => item.id === defense.id ? { ...item, effect: event.target.value } : item) }))} /></Field><Field label="Observações"><Textarea value={defense.notes} onChange={event => updateSheet(current => ({ ...current, defenses: current.defenses.map(item => item.id === defense.id ? { ...item, notes: event.target.value } : item) }))} /></Field><ActionButton title="Remover defesa" onClick={() => updateSheet(current => ({ ...current, defenses: current.defenses.filter(item => item.id !== defense.id) }))} className="justify-self-end hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div>)}</div></Panel><Panel><SectionTitle eyebrow="Ordem de turnos" title="Iniciativa da cena" description="A maior iniciativa age primeiro; a ordem fica registrada para a cena atual." action={<Button size="sm" onClick={addCombatant} variant="outline">Participante</Button>} /><div className="space-y-2">{combatants.length === 0 ? <p className="text-sm text-stone-500">Role a iniciativa do personagem ou adicione participantes.</p> : combatants.map((combatant, index) => <div key={combatant.id} className="grid grid-cols-[32px_minmax(0,1fr)_86px_auto] items-end gap-2 rounded-xl border border-violet-300/10 bg-black/20 p-3"><span className="pb-2 text-sm text-amber-200">#{index + 1}</span><Field label="Participante"><Input value={combatant.name} onChange={event => updateSheet(current => ({ ...current, combatants: current.combatants.map(item => item.id === combatant.id ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Iniciativa"><Input type="number" value={combatant.initiative} onChange={event => updateSheet(current => ({ ...current, combatants: current.combatants.map(item => item.id === combatant.id ? { ...item, initiative: asNumber(event.target.value) } : item) }))} /></Field><ActionButton title="Remover participante" onClick={() => updateSheet(current => ({ ...current, combatants: current.combatants.filter(item => item.id !== combatant.id) }))} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div>)}</div></Panel></div></>;
}

function EquipmentTab({ sheet, updateSheet }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const addItem = () => updateSheet(current => ({ ...current, equipment: [...current.equipment, { id: id(), name: "Novo equipamento", category: "other", damage: "", damageType: "", range: "", defenseBonus: 0, weight: 0, equipped: false, notes: "" }] }));
  return <><SectionTitle eyebrow="Arsenal e ferramentas" title="Equipamento" description="Registre armas, uniformes, escudos, kits e itens especiais; os modificadores mecânicos devem ser explicitados." action={<Button size="sm" onClick={addItem} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Adicionar item</Button>} />
    <div className="space-y-3">{sheet.equipment.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">Nenhum equipamento registrado. A criação padrão concede dois equipamentos de custo 1, uniforme e kit.</Panel> : sheet.equipment.map(item => <Panel key={item.id}><div className="grid gap-3 md:grid-cols-[1.2fr_.8fr_.6fr_.6fr_auto]"><Field label="Item"><Input value={item.name} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, name: event.target.value } : entry) }))} /></Field><Field label="Categoria"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={item.category} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, category: event.target.value as typeof entry.category } : entry) }))}><option value="weapon">Arma</option><option value="shield">Escudo</option><option value="uniform">Uniforme</option><option value="tool">Kit</option><option value="special">Especial</option><option value="other">Outro</option></select></Field><Field label="Dano"><Input value={item.damage} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, damage: event.target.value } : entry) }))} /></Field><Field label="Peso"><Input type="number" min={0} value={item.weight} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, weight: asNumber(event.target.value) } : entry) }))} /></Field><ActionButton title="Remover item" onClick={() => updateSheet(current => ({ ...current, equipment: current.equipment.filter(entry => entry.id !== item.id) }))} className="self-end hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></Panel>)}</div></>;
}

function DiaryTab({ sheet, derived, updateSheet, newNote, setNewNote, addDiary }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; newNote: string; setNewNote: (value: string) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const [rollSkillId, setRollSkillId] = useState("generic");
  const [rollMode, setRollMode] = useState<"normal" | "advantage" | "disadvantage">("normal");
  const selectedSkill = sheet.skills.find(skill => skill.id === rollSkillId);
  const modifier = selectedSkill ? getSkillBonus(sheet.progression.level, derived.attributes, selectedSkill.attribute, selectedSkill.proficiency, selectedSkill.otherBonus, derived.trainingBonus) : 0;
  const makeRoll = () => {
    const result = rollD20(modifier, rollMode);
    const label = selectedSkill?.name || "Teste geral";
    const dice = result.dice.join(" / ");
    const mode = rollMode === "advantage" ? " com vantagem" : rollMode === "disadvantage" ? " com desvantagem" : "";
    addDiary(`Teste: ${label}`, `d20${mode}: [${dice}] → ${result.kept} ${modifier >= 0 ? "+" : ""}${modifier} = ${result.total}.`, "roll");
    toast.success(`${label}: ${result.total}`);
  };
  return <><SectionTitle eyebrow="Memória da sessão" title="Diário" description="Cada ajuste de recurso e rolagem é preservado. F&M usa rolagens de d20; vantagem e desvantagem escolhem, respectivamente, o maior e o menor resultado. Livro-base, pp. 276 e 282." />
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><Panel><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Rolagem rápida</p><div className="mt-4 grid gap-3 md:grid-cols-[1fr_.75fr_auto]"><Field label="Perícia ou teste"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={rollSkillId} onChange={event => setRollSkillId(event.target.value)}><option value="generic">Teste geral (+0)</option>{sheet.skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name} ({getSkillBonus(sheet.progression.level, derived.attributes, skill.attribute, skill.proficiency, skill.otherBonus) >= 0 ? "+" : ""}{getSkillBonus(sheet.progression.level, derived.attributes, skill.attribute, skill.proficiency, skill.otherBonus)})</option>)}</select></Field><Field label="Condição"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={rollMode} onChange={event => setRollMode(event.target.value as typeof rollMode)}><option value="normal">Normal</option><option value="advantage">Vantagem</option><option value="disadvantage">Desvantagem</option></select></Field><Button onClick={makeRoll} className="self-end bg-amber-300 text-[#190d07] hover:bg-amber-200"><Dice5 className="mr-2 h-4 w-4" />Rolar d20</Button></div></Panel><Panel><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Nota de sessão</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Textarea value={newNote} onChange={event => setNewNote(event.target.value)} placeholder="Registrar uma nota de sessão…" /><Button onClick={() => { if (!newNote.trim()) return; addDiary("Nota de sessão", newNote.trim()); setNewNote(""); }} className="h-auto bg-amber-300 text-[#190d07] hover:bg-amber-200">Registrar</Button></div></Panel></div><div className="mt-4 space-y-3">{sheet.diary.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">O diário ainda não possui registros.</Panel> : sheet.diary.map(entry => <Panel key={entry.id} className="flex gap-3"><div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-600/20 text-amber-200"><BookOpen className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium text-stone-200">{entry.title}</p><p className="text-xs text-stone-600">{new Date(entry.at).toLocaleString("pt-BR")}</p></div><p className="mt-1 text-sm leading-6 text-stone-400">{entry.detail}</p></div><ActionButton title="Remover registro" onClick={() => updateSheet(current => ({ ...current, diary: current.diary.filter(item => item.id !== entry.id) }))} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></Panel>)}</div></>;
}
