import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLiveSocketAuth } from "@/lib/liveAuth";
import { HouseRulesPanel } from "@/components/HouseRulesPanel";
import { TechniqueLibraryPanel } from "@/components/TechniqueLibraryPanel";
import { HomebrewHub } from "@/components/HomebrewHub";
import { ReviewCenter } from "@/components/ReviewCenter";
import { CharacterTechniqueSelector } from "@/components/CharacterTechniqueSelector";
import { ModifierEditor, RaceSelectionPanel } from "@/components/RaceSelectionPanel";
import { AssetsPanelWithActions, DomainExpansionPanel } from "@/components/CampaignCapabilitiesPanels";
import { AptitudeManagerPanel } from "@/components/AptitudeManagerPanel";
import { CharacterAuditPanel } from "@/components/CharacterAuditPanel";
import { SourceEffectsPanel } from "@/components/SourceEffectsPanel";
import { FM_RULE_CITATIONS } from "@shared/fmCitations";
import { useAuth } from "@/_core/hooks/useAuth";
import { BookOpen, ChevronLeft, CirclePlus, Copy, Dice5, Download, Flame, ImagePlus, Library, Loader2, LogOut, Menu, MoonStar, Plus, Printer, ScrollText, Share2, Shield, Sparkles, Swords, Trash2, WandSparkles, Wrench } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { FM_ATTRIBUTE_LABELS, FM_MULTICLASS_REQUIREMENTS, FM_SAVING_THROW_LABELS, FM_SPECIALIZATION_LABELS, canAddMulticlass, getAttackBonus, getDerivedValues, getHighestSpellLevel, getInventoryLoad, getResourceLabel, getSkillBonus, getSpellCost, getSustainCost, getTechniquePowerProgression, getSpecializationTracks, rollD20 } from "@shared/fmRules";
import { createEmptyFMSheet, fmAttributeKeys, fmSavingThrowKeys, type FMAttack, type FMCharacterSheet, type FMImageAttachment, type FMInvocation, type FMSpell, type FMSpellLevel, type FMSpecializationKey, type FMTechnique, type FMTechniquePower } from "@shared/fmTypes";
import { FM_EQUIPMENT_CATALOG, FM_SKILL_CATALOG, getEquipmentCatalogEntry, getSkillCatalogEntry } from "@shared/fmCatalogs";
import { FM_CLAN_CATALOG, FM_ORIGIN_CATALOG, getClanCatalogEntry, getOriginAttributeAllocation, getOriginCatalogEntry, resolveClanId } from "@shared/fmOrigins";
import { FM_INVOCATION_GRADE_RULES, getInvocationDerived } from "@shared/fmInvocations";
import { applyInfiniteWorldMission, getExperienceForLevel, getInfiniteWorldProgress, getMissionRewardPreview, removeInfiniteWorldMission, type InfiniteWorldMissionDifficulty, type InfiniteWorldMoneyDifficulty } from "@shared/infiniteWorlds";
import { FM_TECHNIQUE_CREATION_CITATION, getPrimaryTechniqueAttribute, getTechniqueCopy, getTechniqueKindForSpecialization, isTechniqueReady, validateTechnique } from "@shared/fmTechniques";
import { FM_HOUSE_RULES_CITATION, getHouseRestAvailability, getMassiveDamageOutcome, rollHouseAttributeGeneration } from "@shared/fmHouseRules";
import { applyAutomatedSpellType, createAutomatedSpell } from "@shared/fmCreationAssistant";
import { calculateCharacterState, FM_MODIFIER_TARGET_LABELS, type FMCharacterState } from "@shared/fmCharacterState";
import { auditCharacter, formatAuditStatus } from "@shared/fmAuditEngine";
import type { FMAuditResult, FMAuditTab } from "@shared/fmAudit";

type TabId = "overview" | "attributes" | "specialization" | "skills" | "aptitudes" | "technique" | "spells" | "domain" | "invocations" | "combat" | "equipment" | "assets" | "progression" | "missions" | "house" | "diary" | "audit";
type CharacterSavePayload = { id: string; name: string; portraitUrl: string | null; sheet: Record<string, unknown>; clientId: string };

type SheetNavItem = { id: TabId; label: string; icon: typeof BookOpen };
const navigationGroups: Array<{ label: string; items: SheetNavItem[] }> = [
  { label: "Perfil", items: [{ id: "overview", label: "Resumo e identidade", icon: BookOpen }, { id: "attributes", label: "Atributos e defesas", icon: Flame }] },
  { label: "Capacidades", items: [{ id: "specialization", label: "Especialização e multiclasse", icon: ScrollText }, { id: "skills", label: "Perícias e treinamento", icon: ScrollText }, { id: "aptitudes", label: "Aptidões e treinamentos", icon: Sparkles }, { id: "technique", label: "Técnica e vínculo", icon: WandSparkles }, { id: "spells", label: "Poderes e feitiços", icon: WandSparkles }, { id: "domain", label: "Domínio e expansão", icon: Shield }, { id: "invocations", label: "Invocações", icon: WandSparkles }] },
  { label: "Aventura", items: [{ id: "combat", label: "Combate e ataques", icon: Swords }, { id: "equipment", label: "Equipamento e carga", icon: Shield }, { id: "assets", label: "Aliados e ferramentas", icon: Wrench }] },
  { label: "Campanha", items: [{ id: "missions", label: "Missões, Grau e Interlúdios", icon: Swords }, { id: "house", label: "Regras da Casa", icon: Shield }, { id: "diary", label: "Diário e registros", icon: BookOpen }, { id: "audit", label: "Auditoria da ficha", icon: Shield }] },
];
const tabs = navigationGroups.flatMap(group => group.items);

const id = () => crypto.randomUUID();
const asNumber = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function hydrateSheet(raw: Record<string, unknown> | null | undefined): FMCharacterSheet {
  const empty = createEmptyFMSheet();
  const source = raw as Partial<FMCharacterSheet> | undefined;
  if (!source) return empty;
  return {
    ...empty,
    ...source,
    identity: { ...empty.identity, ...(source.identity ?? {}) },
    personal: { ...empty.personal, ...(source.personal ?? {}) },
    progression: {
      ...empty.progression,
      ...(source.progression ?? {}),
      primarySpecialization: source.progression && Object.prototype.hasOwnProperty.call(source.progression, "primarySpecialization") ? source.progression.primarySpecialization : source.progression?.specialization ?? empty.progression.primarySpecialization,
      primarySpecializationLocked: source.progression && Object.prototype.hasOwnProperty.call(source.progression, "primarySpecializationLocked") ? Boolean(source.progression.primarySpecializationLocked) : Boolean(source.progression?.specialization),
      specializationTracks: Array.isArray(source.progression?.specializationTracks) ? source.progression.specializationTracks : [{ specialization: source.progression?.specialization ?? empty.progression.specialization, level: Math.max(1, source.progression?.specializationLevels ?? source.progression?.level ?? 1) }],
      experience: typeof source.progression?.experience === "number" ? source.progression.experience : getExperienceForLevel(typeof source.progression?.level === "number" ? source.progression.level : 1),
    },
    houseRules: {
      ...empty.houseRules,
      ...(source.houseRules ?? {}),
      birthVow: { ...empty.houseRules.birthVow, ...(source.houseRules?.birthVow ?? {}) },
      actionDeclaration: { ...empty.houseRules.actionDeclaration, ...(source.houseRules?.actionDeclaration ?? {}) },
      rest: { ...empty.houseRules.rest, ...(source.houseRules?.rest ?? {}) },
      downtime: { ...empty.houseRules.downtime, ...(source.houseRules?.downtime ?? {}), freeBuildOptions: Array.isArray(source.houseRules?.downtime?.freeBuildOptions) ? source.houseRules.downtime.freeBuildOptions : [] },
      customVows: Array.isArray(source.houseRules?.customVows) ? source.houseRules.customVows : [],
    },
    origin: { ...empty.origin, ...(source.origin ?? {}), clanId: resolveClanId(source.origin?.clanId, source.origin?.clan) },
    mechanics: {
      ...empty.mechanics,
      ...(source.mechanics ?? {}),
      race: source.mechanics?.race ? {
        ...source.mechanics.race,
        modifiers: Array.isArray(source.mechanics.race.modifiers) ? source.mechanics.race.modifiers : [],
        requirements: Array.isArray(source.mechanics.race.requirements) ? source.mechanics.race.requirements : [],
        characteristics: Array.isArray(source.mechanics.race.characteristics) ? source.mechanics.race.characteristics : [],
        abilities: Array.isArray(source.mechanics.race.abilities) ? source.mechanics.race.abilities : [],
        evolutions: Array.isArray(source.mechanics.race.evolutions) ? source.mechanics.race.evolutions : [],
      } : null,
    },
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
    invocations: Array.isArray(source.invocations) ? source.invocations : [],
    images: Array.isArray(source.images) ? source.images : [],
    equipment: Array.isArray(source.equipment) ? source.equipment : [],
    attacks: Array.isArray(source.attacks) ? source.attacks : [],
    defenses: Array.isArray(source.defenses) ? source.defenses : [],
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    combatants: Array.isArray(source.combatants) ? source.combatants : [],
    diary: Array.isArray(source.diary) ? source.diary : [],
    missionRewards: Array.isArray(source.missionRewards) ? source.missionRewards : [],
    aptitudes: Array.isArray(source.aptitudes) ? source.aptitudes : [],
    training: Array.isArray(source.training) ? source.training : [],
    customResources: Array.isArray(source.customResources) ? source.customResources : [],
    transformations: Array.isArray(source.transformations) ? source.transformations : [],
    allies: Array.isArray(source.allies) ? source.allies : [],
    cursedTools: Array.isArray(source.cursedTools) ? source.cursedTools : [],
    domainExpansion: source.domainExpansion ?? null,
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

function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-stone-300 ${className}`}>
    <span>{label}</span>
    {children}
    {hint ? <span className="text-xs font-normal leading-5 text-stone-500">{hint}</span> : null}
  </label>;
}

function ActionButton({ children, onClick, title, className = "" }: { children: React.ReactNode; onClick: () => void; title: string; className?: string }) {
  return <button type="button" onClick={onClick} title={title} className={`inline-flex h-9 items-center justify-center rounded-lg border border-violet-300/15 bg-[#20122e] px-3 text-sm text-violet-100 transition hover:border-amber-300/45 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300/70 active:scale-[0.97] ${className}`}>{children}</button>;
}

function CharacterCharacteristicsStrip({ sheet, derived }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues> }) {
  const values = [
    ["FOR", derived.attributes.strength], ["DES", derived.attributes.dexterity], ["CON", derived.attributes.constitution], ["INT", derived.attributes.intelligence], ["SAB", derived.attributes.wisdom], ["PRE", derived.attributes.presence],
    ["PV", `${sheet.resources.health.current}/${derived.healthMaximum}`], [getResourceLabel(sheet.progression.specialization, sheet.progression.nonSorcerer).slice(0, 2).toUpperCase(), `${sheet.resources.energy.current}/${derived.energyMaximum}`], ["DEF", derived.defense], ["INI", `${derived.initiative >= 0 ? "+" : ""}${derived.initiative}`],
  ];
  return <div className="border-b border-violet-300/10 bg-[#0d0715]"><div className="mx-auto grid max-w-[1540px] grid-cols-5 gap-px overflow-hidden border-x border-violet-300/10 bg-violet-300/10 sm:grid-cols-10 lg:px-6"><div className="col-span-5 hidden bg-[#110a1b] px-4 py-2 lg:block"><p className="font-display text-[10px] uppercase tracking-[.18em] text-amber-300/60">Características e valores rápidos</p></div>{values.map(([label, value]) => <div key={label} className="flex min-h-12 flex-col justify-center bg-[#110a1b] px-3 py-1.5"><span className="text-[10px] uppercase tracking-[.14em] text-stone-500">{label}</span><span className="font-display text-base text-amber-100">{value}</span></div>)}</div></div>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const previewVariant = new URLSearchParams(window.location.search).get("preview");
  const previewMode = previewVariant === "full" || previewVariant === "library" || previewVariant === "library-techniques" || previewVariant === "persisted";
  const previewLibraryMode = previewVariant === "library" || previewVariant === "library-techniques";
  const previewPersistedMode = previewVariant === "persisted";
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(() => previewVariant === "full" || previewVariant === "persisted" ? "preview-local" : new URLSearchParams(window.location.search).get("ficha"));
  const [sheet, setSheet] = useState<FMCharacterSheet | null>(null);
  const [tab, setTab] = useState<TabId>(() => {
    const requested = new URLSearchParams(window.location.search).get("tab") as TabId | null;
      return ["overview", "attributes", "specialization", "skills", "aptitudes", "technique", "spells", "domain", "invocations", "combat", "equipment", "assets", "missions", "house", "diary", "audit"].includes(requested ?? "") ? requested! : "overview";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [auditResult, setAuditResult] = useState<FMAuditResult | null>(null);
  const [techniqueCharacterId, setTechniqueCharacterId] = useState<string | null>(() => previewVariant === "library" ? "preview-technique" : null);
  const [previewTechniqueSheet, setPreviewTechniqueSheet] = useState<FMCharacterSheet>(() => {
    const previewSheet = createNewSheet("Pré-visualização da Forja");
    previewSheet.progression = { ...previewSheet.progression, level: 3, specializationLevels: 3, specialization: "technique-specialist", primarySpecialization: "technique-specialist", primarySpecializationLocked: true, specializationTracks: [{ specialization: "technique-specialist", level: 3 }], skillTrainingAttribute: "intelligence", skillTrainingAttributeLocked: true };
    previewSheet.attributes.base.intelligence = 16;
    previewSheet.skills = [{ id: "percepcao", catalogId: "perception", name: "Percepção", attribute: "wisdom", proficiency: "trained", otherBonus: 0, notes: "" }];
    previewSheet.equipment = [{ id: "adaga", catalogId: "dagger", name: "Adaga", category: "weapon", damage: "1d6", damageType: "Perfurante", range: "6/18 m", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Apunhaladora, arremessável, fineza, leve, marcial", quantity: 1, equipped: true, notes: "" }];
    previewSheet.technique = { ...previewSheet.technique, name: "Fios da Aurora", basicFunction: "Manipula fios de energia para conectar alvos e objetos, criando aplicações práticas por meio de feitiços.", attributeKeys: ["dexterity", "intelligence"], intrinsicBenefits: "Recebe um carretel simples como ferramenta essencial.", limitations: "Exige linha de visão e não atravessa barreiras sólidas.", requiredItems: "Carretel amaldiçoado e luvas condutoras.", reviewNotes: "Exemplo local para revisão visual; não é salvo.", powers: [{ id: "fio-vinculo", name: "Laço Vinculante", requiredCharacterLevel: 1, spellLevel: 1, type: "damage", summary: "Fios prendem o alvo e conduzem energia amaldiçoada.", requirement: "Exige linha de visão." }, { id: "fio-escudo", name: "Trama Defensiva", requiredCharacterLevel: 2, spellLevel: 1, type: "auxiliary", summary: "Uma malha de fios absorve e desvia um golpe.", requirement: "Reação; exige um ponto de ancoragem." }, { id: "fio-prisao", name: "Prisão da Aurora", requiredCharacterLevel: 4, spellLevel: 2, type: "special", summary: "Uma rede densa limita o deslocamento em uma área pequena.", requirement: "Alvo deve estar conectado por um fio." }] };
    return previewSheet;
  });

  const charactersQuery = trpc.characters.list.useQuery(undefined, { enabled: isAuthenticated });
  const techniquesQuery = trpc.techniques.list.useQuery(undefined, { enabled: isAuthenticated });
  const activeQuery = trpc.characters.get.useQuery({ id: activeCharacterId ?? "sem-ficha" }, { enabled: isAuthenticated && Boolean(activeCharacterId) && !previewMode });
  const techniqueTargetQuery = trpc.characters.get.useQuery({ id: techniqueCharacterId ?? "sem-tecnica" }, { enabled: isAuthenticated && Boolean(techniqueCharacterId) && !previewMode });
  const sharesQuery = trpc.shares.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveMutation = trpc.characters.save.useMutation({ onSuccess: () => utils.characters.list.invalidate(), onError: () => toast.error("A ficha contém dados inválidos e não foi salva.") });
  const liveClientIdRef = useRef(crypto.randomUUID());
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const queueCharacterSave = useCallback((payload: CharacterSavePayload) => {
    const queued = saveQueueRef.current.then(
      () => saveMutation.mutateAsync(payload).then(() => undefined),
      () => saveMutation.mutateAsync(payload).then(() => undefined),
    );
    saveQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, [saveMutation]);
  const uploadImageMutation = trpc.characters.uploadImage.useMutation();
  const removeMutation = trpc.characters.remove.useMutation({ onSuccess: () => utils.characters.list.invalidate() });
  const duplicateMutation = trpc.characters.duplicate.useMutation({ onSuccess: () => utils.characters.list.invalidate() });
  const shareMutation = trpc.characters.share.useMutation();
  const saveTechniqueMutation = trpc.techniques.save.useMutation({ onSuccess: () => utils.techniques.list.invalidate() });
  const removeTechniqueMutation = trpc.techniques.remove.useMutation({ onSuccess: () => utils.techniques.list.invalidate() });
  const refetchActiveCharacter = activeQuery.refetch;
  const refetchCharacterLibrary = charactersQuery.refetch;

  useEffect(() => {
    if (previewMode && !previewLibraryMode) {
      const stored = previewPersistedMode ? window.localStorage.getItem("infinite-worlds:persisted-preview") : null;
      if (stored) {
        try { setSheet(hydrateSheet(JSON.parse(stored) as Record<string, unknown>)); return; } catch { window.localStorage.removeItem("infinite-worlds:persisted-preview"); }
      }
      const initialSheet = createNewSheet(previewPersistedMode ? "Validação Persistente Infinite Worlds" : "Pré-visualização Infinite Worlds");
      initialSheet.progression = { ...initialSheet.progression, level: 3, specializationLevels: 3, specialization: "technique-specialist", primarySpecialization: "technique-specialist", primarySpecializationLocked: true, specializationTracks: [{ specialization: "technique-specialist", level: 3 }], skillTrainingAttribute: "intelligence", skillTrainingAttributeLocked: true };
      initialSheet.attributes.base.intelligence = 16;
      initialSheet.skills = [{ id: "preview-perception", catalogId: "perception", name: "Percepção", attribute: "wisdom", proficiency: "trained", otherBonus: 0, notes: "" }];
      initialSheet.equipment = [{ id: "preview-dagger", catalogId: "dagger", name: "Adaga", category: "weapon", damage: "1d6", damageType: "Perfurante", range: "6/18 m", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Apunhaladora, arremessável, fineza, leve, marcial", quantity: 1, equipped: true, notes: "" }];
      initialSheet.technique = { ...initialSheet.technique, name: "Fios da Aurora", basicFunction: "Manipula fios de energia para conectar alvos e objetos.", attributeKeys: ["dexterity", "intelligence"], intrinsicBenefits: "Carretel simples essencial.", limitations: "Exige linha de visão e pode ser interrompida por barreiras.", requiredItems: "Carretel amaldiçoado.", reviewNotes: "Pré-visualização local.", powers: [{ id: "fio-vinculo", name: "Laço Vinculante", requiredCharacterLevel: 1, spellLevel: 1, type: "damage", summary: "Fios prendem o alvo e conduzem energia amaldiçoada.", requirement: "Exige linha de visão." }, { id: "fio-escudo", name: "Trama Defensiva", requiredCharacterLevel: 2, spellLevel: 1, type: "auxiliary", summary: "Uma malha de fios absorve e desvia um golpe.", requirement: "Reação; exige um ponto de ancoragem." }, { id: "fio-prisao", name: "Prisão da Aurora", requiredCharacterLevel: 4, spellLevel: 2, type: "special", summary: "Uma rede densa limita o deslocamento em uma área pequena.", requirement: "Alvo deve estar conectado por um fio." }] };
      initialSheet.techniqueLibraryId = "preview-independent-technique";
      if (previewVariant === "full") initialSheet.origin = { catalogId: "inherited", clanId: "gojo", name: "Herdado", clan: "Clã Gojo", attributeBonuses: { intelligence: 2, wisdom: 1 }, description: "Herança estruturada do Clã Gojo para validação local." };
      if (previewVariant === "full") { const previewImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#24113a"/><stop offset="1" stop-color="#8a611e"/></linearGradient></defs><rect width="100%" height="100%" fill="#09060f"/><circle cx="740" cy="155" r="120" fill="url(#g)" opacity=".9"/><path d="M0 520C190 430 260 575 450 480s285-135 510-35v195H0z" fill="#120c1d"/><text x="54" y="94" fill="#f4c85f" font-family="serif" font-size="42">INFINITE WORLDS</text><text x="54" y="148" fill="#eee8df" font-family="sans-serif" font-size="25">Referência visual local</text></svg>')}`; initialSheet.images = [{ id: "preview-image-1", key: "preview/reference.svg", url: previewImage, name: "referência-local.svg", caption: "Símbolo da técnica para o cenário de validação.", createdAt: 0 }]; initialSheet.identity.portraitUrl = previewImage; }
      if (previewVariant === "full") initialSheet.invocations = [{ id: "preview-invocation", name: "Lobo de Papel", concept: "Shikigami de rastreio feito de talismãs dobrados.", grade: "fourth", attributes: { strength: 10, dexterity: 12, constitution: 10, intelligence: 8, wisdom: 12, presence: 8 }, movement: 12, trainedAttack: "melee", trainedSavingThrow: "reflexos", trainedSkills: ["Percepção"], actions: [{ id: "preview-invocation-action", name: "Farejar Maldição", kind: "simple", effect: "Localiza uma presença amaldiçoada em alcance narrativo.", counterplay: "Barreira, ocultação ou contramedida da cena." }], notes: "Exemplo local de validação; não é salvo.", active: false }];
      if (previewVariant === "full") initialSheet.missionRewards = [{ id: "preview-mission-1", at: 0, title: "Ecos do Santuário", grade: "4º Grau", difficulty: "hard", moneyDifficulty: "normal", base: { experience: 8, money: 5000, interludes: 1, description: "Recompensas automáticas da tabela Infinite Worlds." }, extra: { experience: 2, money: 1000, interludes: 0, description: "Talismã selado recebido ao fim da missão." }, total: { experience: 10, money: 6000, interludes: 1, description: "Talismã selado recebido ao fim da missão." } }];
      if (previewVariant === "full") { initialSheet.progression = { ...initialSheet.progression, level: 12, experience: getExperienceForLevel(12), specializationLevels: 12, specializationTracks: [{ specialization: "technique-specialist", level: 12 }] }; initialSheet.houseRules.downtime.interludes = 3; initialSheet.aptitudes = [{ id: "preview-apt-1", catalogId: "barriers", name: "Barreiras", group: "domain", requiredLevel: 3, cost: 1, prerequisite: "—", effect: "Estrutura barreiras com efeito e contrajogo registrados.", approved: true }, { id: "preview-apt-2", catalogId: "incomplete-domain", name: "Expansão de Domínio Incompleta", group: "domain", requiredLevel: 8, cost: 2, prerequisite: "Barreiras", effect: "Expansão incompleta aprovada para a campanha.", approved: false }]; initialSheet.training = [{ trackId: "barriers", stage: 3, notes: "Aprimorando a resistência da barreira." }, { trackId: "comprehension", stage: 1, notes: "Estudos sobre leitura de energia." }]; initialSheet.allies = [{ id: "preview-ally-1", name: "Ieiri", role: "Suporte médico", bond: "Aliada da guilda em missões críticas.", healthCurrent: 18, healthMaximum: 18, defense: 13, actions: [{ id: "preview-ally-action", name: "Tratamento", effect: "Estabiliza um aliado em cena." }], notes: "Exemplo local; não é salvo." }]; initialSheet.cursedTools = [{ id: "preview-tool-1", name: "Lâmina do Selo", category: "weapon", grade: "second", costTier: 2, spaces: 1, requirements: "Manejo de arma", effect: "Canaliza energia em cortes declarados.", approved: true, enchantments: [{ id: "preview-enchantment-1", name: "Corte Vivo", effect: "Amplia a área do corte uma vez por cena.", approved: true }], notes: "Exemplo local; não é salvo." }]; initialSheet.domainExpansion = { name: "Jardim do Silêncio", type: "incomplete", requiredLevel: 8, energyCost: 12, barrierHealth: 30, barrierResilience: 4, guaranteedHit: false, maximumTechnique: "", effect: "Abafa a energia no interior da barreira e limita técnicas declaradas.", counterplay: "Domínio simples, fuga da área ou quebra da barreira.", approved: false }; }
      setSheet(initialSheet);
      return;
    }
    if (activeQuery.data && activeQuery.data.id === activeCharacterId) {
      setSheet(hydrateSheet(activeQuery.data.sheet));
    }
  }, [activeCharacterId, activeQuery.data, previewLibraryMode, previewMode, previewPersistedMode]);

  useEffect(() => {
    if (previewPersistedMode && sheet) window.localStorage.setItem("infinite-worlds:persisted-preview", JSON.stringify(sheet));
  }, [previewPersistedMode, sheet]);

  useEffect(() => {
    if (previewMode && tab === "audit" && new URLSearchParams(window.location.search).get("audit") === "run" && sheet) setAuditResult(auditCharacter(sheet));
  }, [previewMode, sheet, tab]);

  useEffect(() => {
    if (!sheet?.techniqueLibraryId || !Array.isArray(techniquesQuery.data)) return;
    if (techniquesQuery.data.some(technique => technique.id === sheet.techniqueLibraryId)) return;
    setSheet(current => current?.techniqueLibraryId === sheet.techniqueLibraryId ? {
      ...current,
      techniqueLibraryId: null,
      diary: [{ id: id(), at: Date.now(), category: "note", title: "Vínculo de técnica atualizado", detail: "A referência a uma técnica que não está mais na sua biblioteca foi removida; a cópia da técnica da ficha foi preservada." }, ...current.diary],
    } : current);
    toast.info("A referência a uma técnica indisponível foi removida da ficha; a técnica registrada foi preservada.");
  }, [sheet?.techniqueLibraryId, techniquesQuery.data]);

  useEffect(() => {
    if (!activeCharacterId || previewMode) return;
    const socket = io({ path: "/api/live", transports: ["websocket", "polling"], withCredentials: true, auth: getLiveSocketAuth() });
    socket.on("connect", () => socket.emit("watch-character", activeCharacterId));
    socket.on("character-updated", (event: { sourceClientId?: string }) => {
      if (event.sourceClientId === liveClientIdRef.current) return;
      void refetchActiveCharacter();
      void refetchCharacterLibrary();
    });
    return () => { socket.disconnect(); };
  }, [activeCharacterId, previewMode, refetchActiveCharacter, refetchCharacterLibrary]);

  useEffect(() => {
    if (!sheet || !activeCharacterId || !isAuthenticated || previewMode || sheet.skills.some(skill => !skill.name.trim())) return;
    const timer = window.setTimeout(() => {
      void queueCharacterSave({ id: activeCharacterId, name: sheet.identity.name.trim() || "Personagem sem nome", portraitUrl: sheet.identity.portraitUrl, sheet: sheet as unknown as Record<string, unknown>, clientId: liveClientIdRef.current }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeCharacterId, isAuthenticated, previewMode, queueCharacterSave, sheet]);

  const derived = useMemo(() => sheet ? getDerivedValues(sheet) : null, [sheet]);
  const updateSheet = (updater: (current: FMCharacterSheet) => FMCharacterSheet) => setSheet(current => current ? updater(current) : current);
  const runAudit = () => {
    if (!sheet) return;
    const result = auditCharacter(sheet);
    setAuditResult(result);
    setTab("audit");
    if (result.summary.errors) toast.error(`Auditoria concluída: ${result.summary.errors} erro(s) encontrado(s).`);
    else if (result.summary.warnings) toast.info(`Auditoria concluída: ${result.summary.warnings} aviso(s) encontrado(s).`);
    else toast.success("Auditoria concluída: ficha válida.");
  };

  const addDiary = (title: string, detail: string, category: FMCharacterSheet["diary"][number]["category"] = "note") => updateSheet(current => ({
    ...current,
    diary: [{ id: id(), at: Date.now(), category, title, detail }, ...current.diary],
  }));

  const createCharacter = async () => {
    const name = newCharacterName.trim() || "Novo integrante";
    const newSheet = createNewSheet(name);
    const characterId = id();
    try {
      await queueCharacterSave({ id: characterId, name, portraitUrl: null, sheet: newSheet as unknown as Record<string, unknown>, clientId: liveClientIdRef.current });
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
      await queueCharacterSave({ id: character.id, name: nextSheet.identity.name.trim() || character.name, portraitUrl: character.portraitUrl, sheet: nextSheet as unknown as Record<string, unknown>, clientId: liveClientIdRef.current });
      await utils.characters.get.invalidate({ id: character.id });
      await utils.characters.list.invalidate();
      toast.success(normalizedTechnique.name.trim() ? "Técnica registrada na ficha selecionada." : "Técnica removida da ficha selecionada.");
    } catch {
      toast.error("Não foi possível registrar a técnica. Revise os campos e tente novamente.");
    }
  };

  const saveIndependentTechnique = async (input: { id: string; name: string; technique: FMTechnique }) => {
    try {
      await saveTechniqueMutation.mutateAsync({ id: input.id, name: input.name, technique: input.technique as unknown as Record<string, unknown> });
      await utils.techniques.list.invalidate();
      toast.success("Técnica arquivada na biblioteca.");
    } catch {
      toast.error("Não foi possível salvar a técnica. Revise os campos e tente novamente.");
      throw new Error("Falha ao salvar técnica");
    }
  };

  const removeIndependentTechnique = async (techniqueId: string, name: string) => {
    try {
      await removeTechniqueMutation.mutateAsync({ id: techniqueId });
      await utils.techniques.list.invalidate();
      toast.success(`Técnica “${name}” removida da biblioteca.`);
    } catch {
      toast.error("Não foi possível remover a técnica.");
      throw new Error("Falha ao remover técnica");
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

  if (charactersQuery.isError || sharesQuery.isError || techniquesQuery.isError) {
    return <LibraryLoadError onRetry={() => { void charactersQuery.refetch(); void sharesQuery.refetch(); void techniquesQuery.refetch(); }} onLogout={logout} />;
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
      techniques={previewLibraryMode ? [{ id: "preview-independent-technique", name: previewTechniqueSheet.technique.name, technique: previewTechniqueSheet.technique as unknown as Record<string, unknown>, updatedAt: new Date(0) }] : techniquesQuery.data ?? []}
      techniquesLoading={previewLibraryMode ? false : techniquesQuery.isLoading}
      onSaveIndependentTechnique={saveIndependentTechnique}
      onRemoveIndependentTechnique={removeIndependentTechnique}
      onToggleCreate={() => setCreating(value => !value)}
      onLogout={logout}
    />;
  }

  return <main className="min-h-screen bg-[#09060f] text-stone-100">
    <header className="print-sheet-header sticky top-0 z-30 border-b border-violet-300/10 bg-[#0d0715]/92 backdrop-blur">
      <div className="mx-auto flex max-w-[1540px] items-center gap-3 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => { setActiveCharacterId(null); setSheet(null); }} className="no-print inline-flex h-10 items-center gap-2 rounded-xl border border-violet-300/15 px-3 text-sm text-stone-300 transition hover:border-amber-300/40 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300/70"><ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Biblioteca</span></button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-amber-300/65">Infinite Worlds · Guilda F&M</p>
          <p className="truncate font-display text-lg text-stone-100">{sheet.identity.name || "Personagem sem nome"}</p>
        </div>
        <span className="no-print hidden text-xs text-stone-500 lg:inline">{saveMutation.isPending ? "Salvando…" : "Salvamento automático"}</span>
        <button type="button" onClick={runAudit} className={`no-print hidden rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-amber-300/70 md:inline ${auditResult?.summary.status === "needs-correction" ? "border-rose-300/35 bg-rose-300/10 text-rose-100" : auditResult?.summary.status === "valid-with-warnings" ? "border-amber-300/35 bg-amber-300/10 text-amber-100" : auditResult ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-violet-300/20 text-violet-100 hover:border-amber-300/40"}`}>{auditResult ? formatAuditStatus(auditResult) : "Verificar ficha"}</button>
        <ActionButton title="Compartilhar ficha" onClick={() => void shareCurrentCharacter()} className="no-print"><Share2 className="h-4 w-4" /><span className="ml-2 hidden xl:inline">Compartilhar</span></ActionButton>
        <ActionButton title="Exportar JSON" onClick={exportSheet} className="no-print"><Download className="h-4 w-4" /></ActionButton>
        <ActionButton title="Imprimir ou salvar PDF" onClick={() => window.print()} className="no-print"><Printer className="h-4 w-4" /></ActionButton>
      </div>
    </header>
    <div className="no-print"><CharacterCharacteristicsStrip sheet={sheet} derived={derived} /></div>
    <div className="mx-auto grid max-w-[1540px] gap-5 p-4 lg:grid-cols-[255px_minmax(0,1fr)] lg:p-6">
      <aside className="no-print rounded-2xl border border-violet-300/10 bg-[#110a1b] p-3 lg:sticky lg:top-[84px] lg:h-[calc(100vh-108px)]">
        <div className="relative mb-3 lg:hidden"><button type="button" onClick={() => setMobileNavOpen(value => !value)} aria-expanded={mobileNavOpen} aria-controls="mobile-section-menu" className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-violet-300/15 bg-[#1a1026] px-3 text-left text-sm text-stone-100 transition hover:border-amber-300/40 focus:outline-none focus:ring-2 focus:ring-amber-300/70"><Menu className="h-4 w-4 text-amber-300" /><span className="min-w-0 flex-1 truncate">{tabs.find(item => item.id === tab)?.label}</span><span className="text-xs text-stone-500">Seções</span></button>{mobileNavOpen ? <div id="mobile-section-menu" className="absolute z-20 mt-2 grid w-full gap-3 rounded-xl border border-violet-300/20 bg-[#120c1d] p-3 shadow-2xl">{navigationGroups.map(group => <div key={group.label}><p className="mb-1 px-2 font-display text-[10px] uppercase tracking-[.18em] text-amber-300/65">{group.label}</p><div className="grid gap-1">{group.items.map(item => { const Icon = item.icon; const active = item.id === tab; return <button key={item.id} type="button" onClick={() => { setTab(item.id); setMobileNavOpen(false); }} className={`flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/70 ${active ? "bg-violet-700/35 text-amber-100" : "text-stone-300 hover:bg-violet-300/10"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</div></div>)}</div> : null}</div>
        <nav className="hidden gap-4 lg:grid" aria-label="Seções da ficha">{navigationGroups.map(group => <div key={group.label}><p className="mb-1 px-3 font-display text-[10px] uppercase tracking-[.2em] text-amber-300/55">{group.label}</p><div className="grid gap-1">{group.items.map(item => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-300/70 ${active ? "bg-gradient-to-r from-violet-700/50 to-violet-700/10 text-amber-100 shadow-[inset_3px_0_0_#f4c85f]" : "text-stone-400 hover:bg-violet-300/5 hover:text-stone-100"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</div></div>)}</nav>
        <div className="mt-5 border-t border-violet-300/10 pt-4 text-xs leading-5 text-stone-500"><p className="font-display uppercase tracking-[0.18em] text-amber-300/60">Guilda Infinite Worlds</p><p className="mt-2">F&M v2.5.2 com progressão de níveis, graus, XP e recompensas oficiais da guilda.</p></div>
      </aside>
      <section className="min-w-0">{renderTab({ tab, sheet, derived, updateSheet, addDiary, setNewNote, newNote, characterId: activeCharacterId, previewMode, uploadImage: input => uploadImageMutation.mutateAsync(input), techniques: previewMode ? [{ id: "preview-independent-technique", name: "Fios da Aurora", technique: sheet.technique as unknown as Record<string, unknown> }] : techniquesQuery.data ?? [], auditResult, onRunAudit: runAudit, onNavigateAudit: auditTab => setTab(auditTab) })}</section>
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

function CharacterLibrary({ userName, characters, sharedCount, loading, creating, newName, onNewName, onCreate, onOpen, onDuplicate, onDelete, techniqueCharacterId, techniqueTarget, techniqueLoading, onTechniqueCharacterChange, onSaveTechnique, techniques, techniquesLoading, onSaveIndependentTechnique, onRemoveIndependentTechnique, onToggleCreate, onLogout }: {
  userName: string; characters: Array<{ id: string; name: string; portraitUrl: string | null; updatedAt: Date }>; sharedCount: number; loading: boolean; creating: boolean; newName: string; onNewName: (value: string) => void; onCreate: () => void; onOpen: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string, name: string) => void; techniqueCharacterId: string | null; techniqueTarget: { id: string; name: string; portraitUrl: string | null; sheet: FMCharacterSheet } | null; techniqueLoading: boolean; onTechniqueCharacterChange: (id: string) => void; onSaveTechnique: (character: { id: string; name: string; portraitUrl: string | null; sheet: FMCharacterSheet }, technique: FMTechnique, diaryTitle: string) => Promise<void>; techniques: Array<{ id: string; name: string; technique: Record<string, unknown>; updatedAt: Date }>; techniquesLoading: boolean; onSaveIndependentTechnique: (input: { id: string; name: string; technique: FMTechnique }) => Promise<void>; onRemoveIndependentTechnique: (id: string, name: string) => Promise<void>; onToggleCreate: () => void; onLogout: () => void;
}) {
  const [libraryTab, setLibraryTab] = useState<"characters" | "homebrews" | "reviews">(() => new URLSearchParams(window.location.search).get("preview") === "library-techniques" ? "homebrews" : "characters");
  return <main className="min-h-screen bg-[#09060f] px-4 py-6 text-stone-100 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl"><header className="mb-10 flex flex-col justify-between gap-5 border-b border-violet-300/10 pb-7 sm:flex-row sm:items-end"><div><p className="font-display text-xs uppercase tracking-[0.25em] text-amber-300/70">Infinite Worlds · Guilda F&M</p><h1 className="mt-2 font-display text-4xl text-stone-100">Biblioteca da guilda</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">Bem-vindo, {userName}. Cada ficha é salva na sua conta e pode gerar um link público somente leitura.</p></div><div className="flex gap-2"><ActionButton title="Sair da conta" onClick={onLogout}><LogOut className="h-4 w-4" /><span className="ml-2">Sair</span></ActionButton><Button onClick={onToggleCreate} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><CirclePlus className="mr-2 h-4 w-4" />Nova ficha</Button></div></header>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><Panel><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Fichas salvas</p><p className="mt-1 font-display text-3xl text-amber-200">{characters.length}</p></Panel><Panel><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Links públicos</p><p className="mt-1 font-display text-3xl text-amber-200">{sharedCount}</p></Panel><Panel><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Modo de sincronização</p><p className="mt-2 text-sm text-violet-200">Conta autenticada</p></Panel></div>
    <div className="mb-6 flex flex-wrap gap-2 border-b border-violet-300/10 pb-3"><Button type="button" variant={libraryTab === "characters" ? "default" : "outline"} onClick={() => setLibraryTab("characters")} className={libraryTab === "characters" ? "bg-violet-600 text-violet-50 hover:bg-violet-500" : "border-violet-300/20 text-stone-300"}>Personagens</Button><Button type="button" variant={libraryTab === "homebrews" ? "default" : "outline"} onClick={() => setLibraryTab("homebrews")} className={libraryTab === "homebrews" ? "bg-amber-300 text-[#190d07] hover:bg-amber-200" : "border-violet-300/20 text-stone-300"}>Homebrew</Button><Button type="button" variant={libraryTab === "reviews" ? "default" : "outline"} onClick={() => setLibraryTab("reviews")} className={libraryTab === "reviews" ? "bg-violet-600 text-violet-50 hover:bg-violet-500" : "border-violet-300/20 text-stone-300"}>Revisões</Button></div>
    {libraryTab === "homebrews" ? <HomebrewHub techniques={techniques} techniquesLoading={techniquesLoading} onSaveTechnique={onSaveIndependentTechnique} onRemoveTechnique={onRemoveIndependentTechnique} /> : libraryTab === "reviews" ? <ReviewCenter /> : <>{creating ? <Panel className="mb-6 border-amber-300/20"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><Field label="Nome do personagem"><Input autoFocus value={newName} onChange={event => onNewName(event.target.value)} placeholder="Ex.: Aoi Todo" /></Field><Button onClick={onCreate} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">Criar ficha</Button><ActionButton title="Cancelar criação" onClick={onToggleCreate}>Cancelar</ActionButton></div></Panel> : null}{loading ? <div className="grid place-items-center py-20"><Loader2 className="h-7 w-7 animate-spin text-amber-300" /></div> : characters.length === 0 ? <Panel className="grid min-h-72 place-items-center border-dashed text-center"><div><Library className="mx-auto h-9 w-9 text-violet-300/70" /><h2 className="mt-4 font-display text-2xl">Nenhuma ficha arquivada</h2><p className="mt-2 max-w-md text-sm leading-6 text-stone-500">Crie a primeira ficha para registrar os dados de um feiticeiro, uma maldição ou um restringido.</p><Button onClick={onToggleCreate} className="mt-5 bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Criar a primeira ficha</Button></div></Panel> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{characters.map(character => <Panel key={character.id} className="group flex min-h-52 flex-col justify-between overflow-hidden border-violet-300/10 transition hover:border-amber-300/30"><div><div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-600/20 font-display text-xl text-amber-200">{character.name.slice(0, 1).toUpperCase()}</div><span className="rounded-full border border-violet-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-stone-500">Sincronizada</span></div><h2 className="mt-6 font-display text-2xl text-stone-100">{character.name}</h2><p className="mt-2 text-xs text-stone-500">Atualizada em {new Date(character.updatedAt).toLocaleDateString("pt-BR")}</p></div><div className="mt-7 flex flex-wrap gap-2"><Button size="sm" onClick={() => onOpen(character.id)} className="bg-violet-600/70 text-violet-50 hover:bg-violet-500">Abrir</Button><ActionButton title="Duplicar ficha" onClick={() => onDuplicate(character.id)}><Copy className="h-4 w-4" /></ActionButton><ActionButton title="Excluir ficha" onClick={() => onDelete(character.id, character.name)} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></Panel>)}</div>}</>}</div></main>;
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

function GurpsDossierFrame({ tab, children }: { tab: TabId; children: React.ReactNode }) {
  const section = tabs.find(item => item.id === tab)!;
  const group = navigationGroups.find(item => item.items.some(entry => entry.id === tab))!;
  const flow: Record<TabId, string> = { overview: "Identidade → recursos → referências", attributes: "Características → modificadores → resistências", specialization: "Núcleo → níveis → multiclasse", skills: "Perícia → atributo → treinamento", aptitudes: "Pontos → aptidões → focos", technique: "Vínculo → limites → poderes derivados", spells: "Poder → custo → resolução", domain: "Tipo → barreira → contrajogo", invocations: "Grau → atributos → ações", combat: "Ataque → defesa → cena", equipment: "Item → carga → observações", assets: "Vínculo → ferramenta → aprovação", progression: "XP → nível → grau", missions: "Missão → base → extras → registro", house: "Regra → registro → consequência", diary: "Rolagem → evento → memória", audit: "Verificar → entender → navegar" };
  return <div className="grid gap-4 xl:grid-cols-[188px_minmax(0,1fr)]"><aside className="hidden rounded-2xl border border-violet-300/10 bg-[#110a1b] p-4 xl:block"><p className="font-display text-[10px] uppercase tracking-[.2em] text-amber-300/60">Dossiê de personagem</p><p className="mt-4 text-xs uppercase tracking-[.13em] text-stone-500">Grupo</p><p className="mt-1 font-display text-lg text-amber-100">{group.label}</p><div className="mt-5 border-t border-violet-300/10 pt-4"><p className="text-xs uppercase tracking-[.13em] text-stone-500">Seção atual</p><p className="mt-1 text-sm leading-6 text-stone-200">{section.label}</p></div><div className="mt-5 border-t border-violet-300/10 pt-4"><p className="text-xs uppercase tracking-[.13em] text-stone-500">Fluxo</p><p className="mt-1 text-xs leading-5 text-stone-400">{flow[tab]}</p></div></aside><div className="min-w-0">{children}</div></div>;
}

function GurpsSectionLedger({ tab, sheet, derived }: { tab: TabId; sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues> }) {
  const resourceLabel = getResourceLabel(sheet.progression.specialization, sheet.progression.nonSorcerer);
  const inventory = getInventoryLoad(sheet);
  const entries: Record<TabId, Array<[string, string]>> = {
    overview: [["Identidade", sheet.identity.name || "Sem nome"], ["Grau", sheet.identity.grade || "Não informado"], ["Progressão", `Nível ${sheet.progression.level}`]],
    attributes: [["Primárias", "FOR · DES · CON · INT · SAB · PRE"], ["Secundárias", `Defesa ${derived.defense} · Atenção ${derived.attention}`], ["Resistências", "Treinamento e bônus declarados"]],
    specialization: [["Primária", sheet.progression.primarySpecialization ? FM_SPECIALIZATION_LABELS[sheet.progression.primarySpecialization] : "Ainda não escolhida"], ["Nível", String(sheet.progression.level)], ["Núcleos", String(getSpecializationTracks(sheet).length)]],
    skills: [["Base", "Atributo-chave"], ["Treinamento", "Destreinado · Treinado · Mestre"], ["Resultado", "Bônus exibido em cada perícia"]],
    aptitudes: [["Aptidões", String(sheet.aptitudes.length)], ["Trilhas", String(sheet.training.length)], ["Focos", String(Math.max(0, Math.floor(sheet.houseRules.downtime.interludes * 2) - sheet.training.reduce((sum, track) => sum + track.stage, 0)))]],
    technique: [["Núcleo", sheet.technique.name || "Não definido"], ["CD", String(derived.techniqueDc)], ["Origem", sheet.techniqueLibraryId ? "Biblioteca vinculada" : "Cópia local"]],
    spells: [["Capacidade", sheet.technique.name || "Técnica não definida"], ["Energia", `${sheet.resources.energy.current}/${derived.energyMaximum} ${resourceLabel}`], ["Acesso", `Nível máximo ${getHighestSpellLevel(sheet.progression.level)}`]],
    domain: [["Registro", sheet.domainExpansion ? "Estruturado" : "Ausente"], ["Aprovação", sheet.domainExpansion?.approved ? "Mestre aprovou" : "Pendente"], ["Custo", String(sheet.domainExpansion?.energyCost ?? 0)]],
    invocations: [["Arquivo", `${sheet.invocations.length} Invocação(ões)`], ["Controle", sheet.progression.specialization === "controller" ? "Especialização Controlador" : "Disponível por autorização"], ["Campo", `${sheet.invocations.filter(invocation => invocation.active).length} ativa(s)`]],
    combat: [["Ataques", String(sheet.attacks.length)], ["Defesas", String(sheet.defenses.length)], ["Iniciativa", `${derived.initiative >= 0 ? "+" : ""}${derived.initiative}`]],
    equipment: [["Itens", String(sheet.equipment.length)], ["Arsenal", "Armas, proteções e ferramentas"], ["Carga", `${inventory.spaces}/${inventory.capacity} espaços`]],
    assets: [["Aliados", String(sheet.allies.length)], ["Ferramentas", String(sheet.cursedTools.length)], ["Aprovadas", String(sheet.cursedTools.filter(tool => tool.approved).length)]],
    progression: [["Nível", String(sheet.progression.level)], ["XP", String(sheet.progression.experience)], ["Grau", getInfiniteWorldProgress(sheet.progression.experience).grade.label]],
    missions: [["Interlúdios", String(sheet.houseRules.downtime.interludes)], ["Concessões", String(sheet.missionRewards.length)], ["Missões", String(sheet.houseRules.rest.missionCount)]],
    house: [["Atributos", "Geração, Vida Mínima e modificadores"], ["Descanso", `Exaustão ${sheet.houseRules.rest.exhaustion}`], ["Campanha", "Votos, Interlúdios e Dedicação"]],
    diary: [["Registros", String(sheet.diary.length)], ["Rolagens", "Resultados e origem"], ["Memória", "Notas da campanha"]],
    audit: [["Modo", "Verificação manual e somente leitura"], ["Escopo", "Regras, cálculos e requisitos existentes"], ["Ação", "Entender antes de corrigir"]],
  };
  return <div className="no-print mb-4 grid gap-px overflow-hidden rounded-2xl border border-violet-300/10 bg-violet-300/10 sm:grid-cols-3">{entries[tab].map(([label, value]) => <div key={label} className="bg-[#120c1d] px-4 py-3"><p className="text-[10px] uppercase tracking-[.14em] text-stone-500">{label}</p><p className="mt-1 font-medium leading-5 text-stone-200">{value}</p></div>)}</div>;
}

function renderTab({ tab, sheet, derived, updateSheet, addDiary, newNote, setNewNote, characterId, previewMode, uploadImage, techniques, auditResult, onRunAudit, onNavigateAudit }: { tab: TabId; sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void; newNote: string; setNewNote: (value: string) => void; characterId: string; previewMode: boolean; uploadImage: (input: { characterId: string; fileName: string; contentType: "image/jpeg" | "image/png" | "image/webp"; base64: string; caption: string }) => Promise<FMImageAttachment>; techniques: Array<{ id: string; name: string; technique: Record<string, unknown> }>; auditResult: FMAuditResult | null; onRunAudit: () => void; onNavigateAudit: (tab: FMAuditTab) => void; }) {
  const content = tab === "audit" ? <CharacterAuditPanel result={auditResult} onRun={onRunAudit} onNavigate={onNavigateAudit} />
    : tab === "overview" ? <OverviewTab sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} characterId={characterId} previewMode={previewMode} uploadImage={uploadImage} techniques={techniques} />
    : tab === "attributes" ? <AttributesTab sheet={sheet} derived={derived} updateSheet={updateSheet} />
    : tab === "specialization" ? <SpecializationTab sheet={sheet} derived={derived} updateSheet={updateSheet} />
    : tab === "skills" ? <SkillsCatalogTab sheet={sheet} derived={derived} updateSheet={updateSheet} />
    : tab === "aptitudes" ? <AptitudeManagerPanel sheet={sheet} onUpdate={updateSheet} onDiary={addDiary} />
    : tab === "technique" ? <TechniqueProfileTab sheet={sheet} derived={derived} techniques={techniques} updateSheet={updateSheet} addDiary={addDiary} />
    : tab === "spells" ? <SpellsTab sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} />
    : tab === "domain" ? <DomainExpansionPanel sheet={sheet} onUpdate={updateSheet} onDiary={addDiary} />
    : tab === "invocations" ? <InvocationsTab sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} />
    : tab === "combat" ? <CombatTab sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} />
    : tab === "equipment" ? <><EquipmentCatalogTab sheet={sheet} updateSheet={updateSheet} /><EquipmentModifierPanel sheet={sheet} updateSheet={updateSheet} addDiary={addDiary} /></>
    : tab === "assets" ? <><AssetsPanelWithActions sheet={sheet} onUpdate={updateSheet} onDiary={addDiary} /><SourceEffectsPanel sheet={sheet} onUpdate={updateSheet} onDiary={addDiary} /></>
    : tab === "missions" ? <MissionsTab sheet={sheet} updateSheet={updateSheet} addDiary={addDiary} />
    : tab === "house" ? <HouseRulesPanel sheet={sheet} derived={derived} updateSheet={updateSheet} addDiary={addDiary} />
    : <DiaryTab sheet={sheet} derived={derived} updateSheet={updateSheet} newNote={newNote} setNewNote={setNewNote} addDiary={addDiary} />;
  return <GurpsDossierFrame tab={tab}><GurpsSectionLedger tab={tab} sheet={sheet} derived={derived} />{content}</GurpsDossierFrame>;
}

function OverviewTab({ sheet, derived, updateSheet, addDiary, characterId, previewMode, uploadImage, techniques }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void; characterId: string; previewMode: boolean; uploadImage: (input: { characterId: string; fileName: string; contentType: "image/jpeg" | "image/png" | "image/webp"; base64: string; caption: string }) => Promise<FMImageAttachment>; techniques: Array<{ id: string; name: string; technique: Record<string, unknown> }> }) {
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
  return <><SectionTitle eyebrow="Núcleo do personagem" title="Visão geral" description="Acompanhe identidade, retrato principal, recursos atuais e as fórmulas que sustentam a cena." />
    <CharacterPortraitPanel sheet={sheet} updateSheet={updateSheet} addDiary={addDiary} characterId={characterId} previewMode={previewMode} uploadImage={uploadImage} />
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]"><Panel><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome"><Input value={sheet.identity.name} onChange={event => updateSheet(current => ({ ...current, identity: { ...current.identity, name: event.target.value } }))} /></Field><Field label="Jogador"><Input value={sheet.identity.player} onChange={event => updateSheet(current => ({ ...current, identity: { ...current.identity, player: event.target.value } }))} /></Field><Field label="Grau"><Input value={sheet.identity.grade} onChange={event => updateSheet(current => ({ ...current, identity: { ...current.identity, grade: event.target.value } }))} placeholder="Ex.: Grau 2" /></Field><Field label="Origem"><Input value={sheet.origin.name} onChange={event => updateSheet(current => ({ ...current, origin: { ...current.origin, name: event.target.value } }))} placeholder="Ex.: Inato" /></Field><Field label="Técnica amaldiçoada" hint="Atributo-chave escolhido na aba Atributos."><Input value={sheet.technique.name} onChange={event => updateSheet(current => ({ ...current, technique: { ...current.technique, name: event.target.value } }))} placeholder="Nome da técnica" /></Field><Field label="Funcionamento básico" hint="O núcleo narrativo e os limites da técnica."><Textarea value={sheet.technique.basicFunction} onChange={event => updateSheet(current => ({ ...current, technique: { ...current.technique, basicFunction: event.target.value } }))} placeholder="Descreva o conceito e as restrições da técnica." /></Field></div></Panel>
      <div className="grid gap-4"><ResourceCard label="Pontos de Vida" shortLabel="PV" value={sheet.resources.health.current} maximum={derived.healthMaximum} onChange={value => setCurrentResource("health", value)} onAdjust={delta => changeResource("health", delta)} /><ResourceCard label={resourceLabel} shortLabel={resourceLabel === "Estamina" ? "ES" : "PE"} value={sheet.resources.energy.current} maximum={derived.energyMaximum} onChange={value => setCurrentResource("energy", value)} onAdjust={delta => changeResource("energy", delta)} /></div></div>
    <ImageAttachmentsPanel sheet={sheet} updateSheet={updateSheet} addDiary={addDiary} characterId={characterId} previewMode={previewMode} uploadImage={uploadImage} />
    <OriginSelectionPanel sheet={sheet} updateSheet={updateSheet} />
    <OriginBenefitsLedger sheet={sheet} updateSheet={updateSheet} />
    <RaceSelectionPanel sheet={sheet} onUpdate={updateSheet} onDiary={addDiary} previewMode={previewMode} />
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FormulaCard label="Defesa" value={derived.defense} formula="10 + Destreza + metade do nível + bônus" source="Livro-base, pp. 19 e 281" /><FormulaCard label="Iniciativa" value={`${derived.initiative >= 0 ? "+" : ""}${derived.initiative}`} formula="Destreza + bônus" source="Livro-base, pp. 19 e 291" /><FormulaCard label="Atenção" value={derived.attention} formula="10 + Percepção + bônus" source="Livro-base, p. 19" /><FormulaCard label="CD da técnica" value={derived.techniqueDc} formula="10 + metade do nível + atributo + treinamento" source="Livro-base, p. 198" /></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel><SectionTitle eyebrow="Aspectos pessoais" title="Quem atravessa a maldição" description="Campos narrativos da criação de personagem." /><div className="grid gap-4 sm:grid-cols-2"><Field label="Traços de personalidade"><Textarea value={sheet.personal.traits} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, traits: event.target.value } }))} /></Field><Field label="Ideais"><Textarea value={sheet.personal.ideals} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, ideals: event.target.value } }))} /></Field><Field label="Ligações"><Textarea value={sheet.personal.bonds} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, bonds: event.target.value } }))} /></Field><Field label="Complicações"><Textarea value={sheet.personal.complications} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, complications: event.target.value } }))} /></Field></div></Panel><Panel><SectionTitle eyebrow="Domínio inato" title="O espaço que define a alma" description="Este campo registra a representação metafísica do personagem." /><Textarea className="min-h-56" value={sheet.personal.innateDomain} onChange={event => updateSheet(current => ({ ...current, personal: { ...current.personal, innateDomain: event.target.value } }))} placeholder="Descreva o domínio inato…" /></Panel></div></>;
}

export function CharacterPortraitPanel({ sheet, updateSheet, addDiary, characterId, previewMode, uploadImage }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void; characterId: string; previewMode: boolean; uploadImage: (input: { characterId: string; fileName: string; contentType: "image/jpeg" | "image/png" | "image/webp"; base64: string; caption: string }) => Promise<FMImageAttachment> }) {
  const [uploading, setUploading] = useState(false);
  const portraitUrl = sheet.identity.portraitUrl;
  const initials = (sheet.identity.name || "?").trim().slice(0, 1).toLocaleUpperCase("pt-BR");
  const uploadPortrait = async (file: File | undefined) => {
    if (!file) return;
    if (previewMode) { toast.info("O retrato não é enviado na pré-visualização local."); return; }
    if (!( ["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) { toast.error("Envie um retrato JPEG, PNG ou WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("O retrato deve ter até 5 MB."); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Não foi possível ler o retrato.")); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
      const portrait = await uploadImage({ characterId, fileName: file.name, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", base64: dataUrl.split(",")[1] ?? "", caption: "Retrato principal" });
      updateSheet(current => ({ ...current, identity: { ...current.identity, portraitUrl: portrait.url } }));
      addDiary("Retrato atualizado", `${file.name} foi definido como retrato principal da ficha.`, "note");
      toast.success("Retrato principal atualizado.");
    } catch { toast.error("Não foi possível enviar o retrato. Tente novamente."); } finally { setUploading(false); }
  };
  const removePortrait = () => { updateSheet(current => ({ ...current, identity: { ...current.identity, portraitUrl: null }, diary: [{ id: id(), at: Date.now(), category: "note", title: "Retrato removido", detail: "O retrato principal foi removido da ficha.", }, ...current.diary] })); toast.success("Retrato removido."); };
  return <Panel className="mb-4 border-amber-300/20 bg-[radial-gradient(circle_at_10%_0%,rgba(217,156,37,.11),transparent_38%),#120c1d]"><div className="grid gap-5 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-center"><div className="mx-auto h-40 w-40 overflow-hidden rounded-2xl border border-amber-300/25 bg-black/30 shadow-[0_12px_35px_rgba(0,0,0,.3)]">{portraitUrl ? <img src={portraitUrl} alt={`Retrato de ${sheet.identity.name || "personagem"}`} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#261238,#120b1c)] font-display text-6xl text-amber-200">{initials}</div>}</div><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Identidade visual</p><h3 className="mt-1 font-display text-2xl text-stone-100">Retrato do personagem</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">Escolha uma foto exclusiva para o personagem. Ela não aparece nem depende da Galeria de referências. JPEG, PNG ou WebP até 5 MB.</p><div className="mt-4 flex flex-wrap gap-2"><label className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300 px-3 text-sm font-medium text-[#190d07] transition hover:bg-amber-200 ${uploading || previewMode ? "pointer-events-none opacity-60" : ""}`}><ImagePlus className="mr-2 h-4 w-4" />{uploading ? "Enviando…" : portraitUrl ? "Trocar retrato" : "Escolher retrato"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void uploadPortrait(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={uploading || previewMode} /></label>{portraitUrl ? <ActionButton title="Remover retrato" onClick={removePortrait} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="mr-2 h-4 w-4" />Remover retrato</ActionButton> : null}</div></div></div></Panel>;
}

export function ImageAttachmentsPanel({ sheet, updateSheet, addDiary, characterId, previewMode, uploadImage }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void; characterId: string; previewMode: boolean; uploadImage: (input: { characterId: string; fileName: string; contentType: "image/jpeg" | "image/png" | "image/webp"; base64: string; caption: string }) => Promise<FMImageAttachment> }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (previewMode) { toast.info("Anexos não são enviados na pré-visualização local."); return; }
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) { toast.error("Envie uma imagem JPEG, PNG ou WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter até 5 MB."); return; }
    if (sheet.images.length >= 12) { toast.error("A ficha comporta até 12 imagens anexadas."); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Não foi possível ler a imagem.")); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
      const image = await uploadImage({ characterId, fileName: file.name, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", base64: dataUrl.split(",")[1] ?? "", caption: "" });
      updateSheet(current => ({ ...current, images: [...current.images, image] }));
      addDiary("Imagem anexada", `${file.name} foi adicionada à galeria da ficha.`, "note");
      toast.success("Imagem anexada à ficha.");
    } catch {
      toast.error("Não foi possível enviar a imagem. Tente novamente.");
    } finally { setUploading(false); }
  };
  const removeImage = (image: FMImageAttachment) => updateSheet(current => ({ ...current, images: current.images.filter(item => item.id !== image.id), diary: [{ id: id(), at: Date.now(), category: "note", title: "Imagem removida", detail: `${image.name} foi removida da galeria.`, }, ...current.diary] }));
  return <Panel className="mt-4 border-amber-300/15 bg-amber-300/[.025]"><SectionTitle eyebrow="Referências visuais" title="Galeria da ficha" description="Anexe referências de armas, símbolos, cenários e anotações visuais. O retrato principal é escolhido no painel próprio acima e não é alterado pela galeria." action={<label className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-violet-300/15 bg-[#20122e] px-3 text-sm text-violet-100 transition hover:border-amber-300/45 hover:text-amber-100 ${uploading || previewMode ? "pointer-events-none opacity-60" : ""}`}><ImagePlus className="mr-2 h-4 w-4" />{uploading ? "Enviando…" : "Anexar referência"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={uploading || previewMode} /></label>} />{sheet.images.length === 0 ? <div className="rounded-xl border border-dashed border-violet-300/15 bg-black/20 p-5 text-sm leading-6 text-stone-500">Nenhuma referência anexada. Use a galeria para reunir imagens da campanha sem alterar o retrato do personagem.</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sheet.images.map(image => <div key={image.id} className="overflow-hidden rounded-xl border border-violet-300/15 bg-black/20"><img src={image.url} alt={image.caption || image.name} className="h-48 w-full object-cover" /><div className="space-y-3 p-3"><Input value={image.caption} onChange={event => updateSheet(current => ({ ...current, images: current.images.map(item => item.id === image.id ? { ...item, caption: event.target.value } : item) }))} placeholder="Legenda ou uso na cena" aria-label={`Legenda de ${image.name}`} /><ActionButton title="Remover referência" onClick={() => removeImage(image)} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></div>)}</div>}</Panel>;
}

function ProgressionTab({ sheet, updateSheet }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const progress = getInfiniteWorldProgress(sheet.progression.experience ?? 0);
  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
  const applyExperience = (value: string) => updateSheet(current => {
    const next = getInfiniteWorldProgress(asNumber(value));
    const tracks = getSpecializationTracks(current);
    const primary = current.progression.primarySpecialization ?? current.progression.specialization;
    const delta = next.level - current.progression.level;
    const nextTracks = tracks.map(track => track.specialization === primary ? { ...track, level: Math.max(1, track.level + delta) } : track);
    const primaryLevel = nextTracks.find(track => track.specialization === primary)?.level ?? current.progression.specializationLevels;
    return { ...current, progression: { ...current.progression, experience: next.experience, level: next.level, specializationLevels: primaryLevel, specializationTracks: nextTracks }, identity: { ...current.identity, grade: next.grade.label } };
  });
  return <Panel className="border-amber-300/20 bg-amber-300/[.035]"><div className="flex flex-col gap-3 border-b border-amber-300/10 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Registro da Guilda Infinite Worlds</p><h3 className="mt-1 font-display text-2xl text-stone-100">Grau, nível e XP</h3></div><span className="w-fit rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm font-medium text-amber-100">{progress.grade.label}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><FormulaCard label="XP atual" value={progress.experience} formula="Acumulado na guilda" source="Tabela Infinite Worlds" /><FormulaCard label="Nível" value={progress.level} formula={`Faixa ${progress.grade.minLevel}–${progress.grade.maxLevel}`} source="Tabela Infinite Worlds" /><FormulaCard label="Próximo nível" value={progress.nextLevelExperience ?? "Máximo"} formula={progress.experienceToNextLevel === null ? "Nível 30 consolidado" : `Faltam ${progress.experienceToNextLevel} XP`} source="Tabela Infinite Worlds" /><FormulaCard label="Moeda" value={formatCurrency(sheet.guild?.currency ?? 0)} formula="Recompensas acumuladas" source="Tabela Infinite Worlds" /><FormulaCard label="Faixa de XP" value={`${progress.grade.minExperience}–${progress.grade.maxExperience}`} formula="Faixa oficial do grau" source="Tabela Infinite Worlds" /></div><Panel className="mt-4 border-violet-300/10 bg-black/20"><Field label="XP acumulado" hint="Ajustes manuais atualizam nível e grau; a distribuição entre núcleos permanece na aba Especialização e Multiclasse."><Input type="number" min={0} max={6499} value={progress.experience} onChange={event => applyExperience(event.target.value)} /></Field></Panel></Panel>;
}

function MissionsTab({ sheet, updateSheet, addDiary }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const [xpDifficulty, setXpDifficulty] = useState<InfiniteWorldMissionDifficulty>("medium");
  const [moneyDifficulty, setMoneyDifficulty] = useState<InfiniteWorldMoneyDifficulty>("normal");
  const [missionTitle, setMissionTitle] = useState("");
  const [extraExperience, setExtraExperience] = useState("0");
  const [extraMoney, setExtraMoney] = useState("0");
  const [extraInterludes, setExtraInterludes] = useState("0");
  const [extraDescription, setExtraDescription] = useState("");
  const progress = getInfiniteWorldProgress(sheet.progression.experience ?? 0);
  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
  const extra = { title: missionTitle, experience: asNumber(extraExperience), money: asNumber(extraMoney), interludes: asNumber(extraInterludes), description: extraDescription };
  const rewardPreview = getMissionRewardPreview(sheet, xpDifficulty, moneyDifficulty, extra);
  const applyMissionReward = () => {
    const at = Date.now();
    const resolution = applyInfiniteWorldMission(sheet, xpDifficulty, moneyDifficulty, at, extra);
    const { experience, money, interludes, base } = resolution.rewards;
    updateSheet(current => {
      return applyInfiniteWorldMission(current, xpDifficulty, moneyDifficulty, at, extra).sheet;
    });
    addDiary(`Missão concluída — ${resolution.rewards.grade}`, `Base: +${base.experience} XP, ${formatCurrency(base.money)} e +${base.interludes} Interlúdio(s). Total concedido: +${experience} XP, ${formatCurrency(money)} e +${interludes} Interlúdio(s)${extraDescription.trim() ? `. Extra: ${extraDescription.trim()}` : ""}. Exaustão e contagem de missão foram atualizadas.`, "note");
    setMissionTitle("");
    setExtraExperience("0");
    setExtraMoney("0");
    setExtraInterludes("0");
    setExtraDescription("");
    toast.success(`Recompensa registrada: +${experience} XP, ${formatCurrency(money)} e +${interludes} Interlúdio(s).`);
  };
  const removeMissionReward = (recordId: string) => {
    const record = sheet.missionRewards.find(entry => entry.id === recordId);
    if (!record) return;
    if (!window.confirm(`Excluir a missão “${record.title}”? XP, moeda, Interlúdios, Exaustão e contagem de missão desta concessão serão revertidos.`)) return;
    const result = removeInfiniteWorldMission(sheet, recordId);
    if (!result.removed) return;
    updateSheet(current => removeInfiniteWorldMission(current, recordId).sheet);
    toast.success(`Missão removida: ${record.total.experience} XP, ${formatCurrency(record.total.money)} e ${record.total.interludes} Interlúdio(s) revertidos.`);
  };
  return <><SectionTitle eyebrow="Campanha · livro-razão da guilda" title="Missões, Grau e Interlúdios" description="Confira o que a tabela já concede para o Grau atual, registre bônus extras sem substituir a base e mantenha cada concessão arquivada na ficha." /><ProgressionTab sheet={sheet} updateSheet={updateSheet} />
    <Panel className="mt-4 border-amber-300/20 bg-amber-300/[.035]"><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Recompensa da missão</p><div className="mt-4 grid gap-3 xl:grid-cols-3"><FormulaCard label="XP da tabela" value={`+${rewardPreview.base.experience}`} formula={`${progress.grade.label} · ${xpDifficulty}`} source="Tabela Infinite Worlds" /><FormulaCard label="Moeda da tabela" value={formatCurrency(rewardPreview.base.money)} formula={sheet.houseRules.dedicationRewarding ? "Dedicação Recompensadora" : `${progress.grade.label} · ${moneyDifficulty}`} source="Tabela Infinite Worlds" /><FormulaCard label="Interlúdios da tabela" value={`+${rewardPreview.base.interludes}`} formula={xpDifficulty === "hard" ? "Difícil" : xpDifficulty === "hard-plus" ? "Difícil+" : "Sem recompensa nesta dificuldade"} source="Regra da guilda" /></div><div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-violet-300/10 bg-violet-300/10 sm:grid-cols-3"><div className="bg-black/25 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-stone-500">Base automática</p><p className="mt-1 text-sm text-stone-200">+{rewardPreview.base.experience} XP · {formatCurrency(rewardPreview.base.money)} · +{rewardPreview.base.interludes} Interlúdio(s)</p></div><div className="bg-black/25 p-3"><p className="text-[10px] uppercase tracking-[.14em] text-stone-500">Extras declarados</p><p className="mt-1 text-sm text-stone-200">+{rewardPreview.extra.experience} XP · {formatCurrency(rewardPreview.extra.money)} · +{rewardPreview.extra.interludes} Interlúdio(s)</p></div><div className="bg-amber-300/[.06] p-3"><p className="text-[10px] uppercase tracking-[.14em] text-amber-200/70">Total a conceder</p><p className="mt-1 text-sm font-medium text-amber-100">+{rewardPreview.total.experience} XP · {formatCurrency(rewardPreview.total.money)} · +{rewardPreview.total.interludes} Interlúdio(s)</p></div></div></Panel>
    <Panel className="mt-4"><SectionTitle eyebrow="Lançar recompensa" title="Base da guilda e ganhos extras" description="Os extras são adicionais autorizados na missão. Eles não alteram nem recalculam o que a tabela já concede." /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Field label="Nome da missão" hint="Opcional; fica salvo no livro-razão."><Input value={missionTitle} onChange={event => setMissionTitle(event.target.value)} placeholder={`Missão de ${progress.grade.label}`} /></Field><Field label="Dificuldade da missão"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={xpDifficulty} onChange={event => setXpDifficulty(event.target.value as InfiniteWorldMissionDifficulty)}><option value="easy">Fácil</option><option value="medium">Médio</option><option value="hard">Difícil · +1 Interlúdio</option><option value="hard-plus">Difícil+ · +1,5 Interlúdios</option></select></Field><Field label="Categoria de moeda"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={moneyDifficulty} onChange={event => setMoneyDifficulty(event.target.value as InfiniteWorldMoneyDifficulty)}><option value="easy">Fácil</option><option value="normal">Normal</option><option value="hard">Difícil</option></select></Field></div><div className="mt-4 border-t border-violet-300/10 pt-4"><p className="font-display text-xs uppercase tracking-[.18em] text-violet-200/70">Ganhos extras da missão</p><div className="mt-3 grid gap-3 md:grid-cols-3"><Field label="XP extra"><Input type="number" min={0} step={1} value={extraExperience} onChange={event => setExtraExperience(event.target.value)} /></Field><Field label="Moeda extra"><Input type="number" min={0} step={1} value={extraMoney} onChange={event => setExtraMoney(event.target.value)} /></Field><Field label="Interlúdios extras"><Input type="number" min={0} step={0.5} value={extraInterludes} onChange={event => setExtraInterludes(event.target.value)} /></Field></div><div className="mt-3"><Field label="Descrição do ganho extra" hint="Ex.: ferramenta, favor, item, treinamento ou conquista narrativa."><Textarea value={extraDescription} onChange={event => setExtraDescription(event.target.value)} placeholder="Descreva o que foi recebido além da tabela." /></Field></div></div><div className="mt-4 flex flex-col gap-3 border-t border-violet-300/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-6 text-stone-400">Ao registrar, a ficha recebe o total acima, +1 Exaustão e +1 missão para as regras de descanso. A concessão detalhada também é mantida abaixo e no Diário.</p><Button type="button" onClick={applyMissionReward} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">Registrar missão e recompensas</Button></div></Panel>
    <Panel className="mt-4 border-violet-300/15 bg-[#110a1b]"><SectionTitle eyebrow="Arquivo permanente" title="Livro-razão de recompensas" description="Cada missão salva separadamente sua recompensa-base, os extras concedidos e o total aplicado à ficha." />{sheet.missionRewards.length === 0 ? <div className="rounded-xl border border-dashed border-violet-300/15 bg-black/20 p-5 text-sm leading-6 text-stone-500">Ainda não há concessões registradas. Ao concluir a primeira missão, ela será arquivada aqui com todos os valores aplicados.</div> : <div className="space-y-3">{sheet.missionRewards.map(record => <div key={record.id} className="rounded-xl border border-violet-300/15 bg-black/20 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium text-stone-100">{record.title}</p><p className="mt-1 text-xs uppercase tracking-[.13em] text-stone-500">{record.grade} · {record.difficulty} · {new Date(record.at).toLocaleString("pt-BR")}</p></div><div className="flex flex-wrap items-center gap-2"><span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">+{record.total.experience} XP</span><ActionButton title={`Excluir missão ${record.title}`} onClick={() => removeMissionReward(record.id)} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /><span className="ml-1">Excluir</span></ActionButton></div></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><p className="rounded-lg bg-[#150d20] p-2 text-stone-400"><span className="block text-[10px] uppercase tracking-[.12em] text-stone-600">Base</span>+{record.base.experience} XP · {formatCurrency(record.base.money)} · +{record.base.interludes} I</p><p className="rounded-lg bg-[#150d20] p-2 text-stone-400"><span className="block text-[10px] uppercase tracking-[.12em] text-stone-600">Extras</span>+{record.extra.experience} XP · {formatCurrency(record.extra.money)} · +{record.extra.interludes} I</p><p className="rounded-lg bg-amber-300/[.06] p-2 text-amber-100"><span className="block text-[10px] uppercase tracking-[.12em] text-amber-200/70">Total aplicado</span>+{record.total.experience} XP · {formatCurrency(record.total.money)} · +{record.total.interludes} I</p></div>{record.extra.description ? <p className="mt-3 text-sm leading-6 text-stone-400"><span className="text-stone-500">Registro adicional:</span> {record.extra.description}</p> : null}</div>)}</div>}</Panel></>;
}

function ResourceCard({ label, shortLabel, value, maximum, onChange, onAdjust }: { label: string; shortLabel: string; value: number; maximum: number; onChange: (value: string) => void; onAdjust: (delta: number) => void }) {
  const percentage = maximum > 0 ? Math.min(100, Math.max(0, value / maximum * 100)) : 0;
  return <Panel className="overflow-hidden"><div className="flex items-start justify-between gap-4"><div><p className="font-display text-xs uppercase tracking-[0.2em] text-amber-300/70">{shortLabel}</p><p className="mt-1 text-sm text-stone-300">{label}</p></div><p className="font-display text-xl text-stone-100">{value}/{maximum}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-300" style={{ width: `${percentage}%` }} /></div><div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2"><ActionButton title={`Reduzir ${label} em 5`} onClick={() => onAdjust(-5)}>−5</ActionButton><Input type="number" min={0} value={value} onChange={event => onChange(event.target.value)} aria-label={`Valor atual de ${label}`} /><ActionButton title={`Aumentar ${label} em 5`} onClick={() => onAdjust(5)}>+5</ActionButton></div><div className="mt-2 grid grid-cols-2 gap-2"><ActionButton title={`Reduzir ${label} em 1`} onClick={() => onAdjust(-1)}>−1</ActionButton><ActionButton title={`Aumentar ${label} em 1`} onClick={() => onAdjust(1)}>+1</ActionButton></div></Panel>;
}

function FormulaCard({ label, value, formula, source }: { label: string; value: string | number; formula: string; source?: string }) { return <Panel className="border-violet-300/10"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p><p className="mt-1 font-display text-3xl text-amber-200">{value}</p><p className="mt-2 text-xs leading-5 text-stone-500">{formula}</p>{source ? <p className="mt-1 text-[11px] leading-4 text-stone-600">{source}</p> : null}</Panel>; }

function OriginSelectionPanel({ sheet, updateSheet }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const selected = getOriginCatalogEntry(sheet.origin.catalogId);
  const selectedClan = getClanCatalogEntry(sheet.origin.clanId);
  const chooseOrigin = (catalogId: FMCharacterSheet["origin"]["catalogId"]) => updateSheet(current => {
    const entry = getOriginCatalogEntry(catalogId);
    return { ...current, origin: { ...current.origin, catalogId, clanId: catalogId === "inherited" ? current.origin.clanId : "custom", name: entry?.name ?? current.origin.name, clan: catalogId === "inherited" ? current.origin.clan : "", attributeBonuses: {}, description: entry?.description ?? current.origin.description } };
  });
  const chooseClan = (clanId: FMCharacterSheet["origin"]["clanId"]) => updateSheet(current => { const clan = getClanCatalogEntry(clanId); return { ...current, origin: { ...current.origin, clanId, clan: clan?.name ?? current.origin.clan, attributeBonuses: {} } }; });
  return <Panel className="mt-4 border-amber-300/15 bg-amber-300/[.025]"><SectionTitle eyebrow="Fonte de poder" title="Origem" description="Escolha de onde vem o poder do personagem. A origem costuma ser definida na criação; mudanças posteriores exigem decisão da mesa." /><div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]"><div className="grid gap-3"><Field label="Origem escolhida"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sheet.origin.catalogId} onChange={event => chooseOrigin(event.target.value as FMCharacterSheet["origin"]["catalogId"])}><option value="custom">Personalizada / legado</option>{FM_ORIGIN_CATALOG.map(origin => <option key={origin.id} value={origin.id}>{origin.name}{origin.rare ? " · rara" : ""}</option>)}</select></Field>{sheet.origin.catalogId === "inherited" ? <><Field label="Clã estruturado" hint="Os quatro clãs padrão aplicam benefícios e limites do livro F&M."><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sheet.origin.clanId} onChange={event => chooseClan(event.target.value as FMCharacterSheet["origin"]["clanId"])}><option value="custom">Outra linhagem / texto livre</option>{FM_CLAN_CATALOG.map(clan => <option key={clan.id} value={clan.id}>{clan.name}</option>)}</select></Field><Field label="Clã ou linhagem" hint={selectedClan ? "Preenchido pelo catálogo; ajuste apenas para registrar uma variação aprovada." : "Obrigatório para a linhagem personalizada."}><Input value={sheet.origin.clan} onChange={event => updateSheet(current => ({ ...current, origin: { ...current.origin, clan: event.target.value } }))} placeholder="Ex.: Clã Gojo" /></Field></> : <Field label="Clã ou linhagem narrativa" hint="Opcional fora da Origem Herdado; não concede benefícios mecânicos."><Input value={sheet.origin.clan} onChange={event => updateSheet(current => ({ ...current, origin: { ...current.origin, clan: event.target.value } }))} placeholder="Ex.: família ou clã de origem" /></Field>}</div><div className="rounded-xl border border-violet-300/10 bg-black/20 p-4"><p className="font-display text-lg text-amber-100">{(selectedClan?.name ?? selected?.name ?? sheet.origin.name) || "Origem personalizada"}</p><p className="mt-2 text-sm leading-6 text-stone-300">{selectedClan?.description ?? selected?.description ?? sheet.origin.description ?? "Descreva a fonte de força do personagem."}</p><p className="mt-3 rounded-lg border border-amber-300/10 bg-amber-300/5 p-3 text-xs leading-5 text-stone-400">{selectedClan?.creationNote ?? selected?.creationNote ?? "Registre bônus de atributo e características de origem com origem declarada e aprovação da mesa."}</p>{selected?.requiresRestrictedSpecialization && sheet.progression.specialization !== "restricted" ? <p className="mt-3 text-xs leading-5 text-amber-200">Esta origem exige a Especialização Restringido. Ajuste-a em Atributos e defesas antes de salvar.</p> : null}</div></div></Panel>;
}

function OriginBenefitsLedger({ sheet, updateSheet }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const entry = getOriginCatalogEntry(sheet.origin.catalogId);
  const clan = sheet.origin.catalogId === "inherited" ? getClanCatalogEntry(sheet.origin.clanId) : null;
  const allocation = getOriginAttributeAllocation(sheet.origin.catalogId, sheet.origin.clanId);
  if (!entry) return null;
  const total = Object.values(sheet.origin.attributeBonuses).reduce((sum, value) => sum + (value ?? 0), 0);
  const benefits = [...entry.benefits, ...(clan?.benefits ?? [])];
  const restrictions = [...entry.restrictions, ...(clan?.restrictions ?? [])];
  return <Panel className="mt-4"><SectionTitle eyebrow="Características de origem" title={clan ? `Herança de ${clan.name}` : "Benefícios e limites"} description="Os bônus declarados abaixo entram nos atributos totais e permanecem separados dos bônus permanentes da ficha." /><div className="grid gap-4 xl:grid-cols-[.8fr_.8fr_1.2fr]"><div className="rounded-xl border border-violet-300/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-[.15em] text-stone-500">Benefícios</p><ul className="mt-2 space-y-2 text-sm leading-6 text-stone-300">{benefits.map(benefit => <li key={benefit}>• {benefit}</li>)}</ul>{clan ? <><p className="mt-4 text-xs uppercase tracking-[.15em] text-stone-500">Técnicas herdadas</p><p className="mt-2 text-sm leading-6 text-stone-300">{clan.inheritedTechniques.join(" · ")}</p><p className="mt-3 text-xs leading-5 text-stone-500">Treinamentos: {clan.trainedSkills.join(" · ")}</p></> : null}</div><div className="rounded-xl border border-violet-300/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-[.15em] text-stone-500">Restrições</p><ul className="mt-2 space-y-2 text-sm leading-6 text-stone-300">{restrictions.length ? restrictions.map(restriction => <li key={restriction}>• {restriction}</li>) : <li>• Nenhuma restrição mecânica adicional.</li>}</ul></div><div><div className="mb-3 flex items-baseline justify-between gap-3"><p className="text-sm font-medium text-stone-200">Bônus de atributo da Origem</p><span className="text-xs text-amber-200">{total}/{allocation?.total ?? 0} ponto(s)</span></div>{allocation && allocation.total > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fmAttributeKeys.map(attribute => { const currentValue = sheet.origin.attributeBonuses[attribute] ?? 0; const allowed = !allocation.allowedAttributes || allocation.allowedAttributes.includes(attribute); const maximum = allowed ? Math.min(allocation.maximumPerAttribute, Math.max(0, allocation.total - total + currentValue)) : 0; return <Field key={attribute} label={FM_ATTRIBUTE_LABELS[attribute]}><Input type="number" min={0} max={maximum} disabled={!allowed} value={currentValue} onChange={event => updateSheet(current => { const currentValue = current.origin.attributeBonuses[attribute] ?? 0; const currentTotal = Object.values(current.origin.attributeBonuses).reduce((sum, value) => sum + (value ?? 0), 0); const maximum = Math.min(allocation.maximumPerAttribute, Math.max(0, allocation.total - currentTotal + currentValue)); return { ...current, origin: { ...current.origin, attributeBonuses: { ...current.origin.attributeBonuses, [attribute]: Math.max(0, Math.min(maximum, asNumber(event.target.value))) } } }; })} /></Field>; })}</div> : <p className="rounded-xl border border-violet-300/10 bg-black/20 p-4 text-sm leading-6 text-stone-400">Escolha um clã estruturado para aplicar seus bônus, ou registre uma linhagem personalizada com aprovação da mesa.</p>}</div></div></Panel>;
}

function TechniqueProfileTab({ sheet, derived, techniques, updateSheet, addDiary }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; techniques: Array<{ id: string; name: string; technique: Record<string, unknown> }>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const primaryAttribute = sheet.progression.techniqueAttribute;
  return <><SectionTitle eyebrow="Capacidades especiais" title="Técnica e poderes" description="Organize a capacidade central como um bloco próprio: selecione o arquivo de técnica, consulte atributos, limites, contrajogo e então gerencie os feitiços derivados." />
    <CharacterTechniqueSelector sheet={sheet} techniques={techniques} updateSheet={updateSheet} addDiary={addDiary} />
    <TechniqueModifiersPanel sheet={sheet} updateSheet={updateSheet} />
    <div className="mt-4 grid gap-4 xl:grid-cols-[.85fr_1.15fr]"><Panel><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/65">Núcleo da capacidade</p><h3 className="mt-2 font-display text-2xl text-stone-100">{sheet.technique.name || "Técnica não definida"}</h3><dl className="mt-5 grid gap-4 text-sm"><div className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><dt className="text-xs uppercase tracking-[.13em] text-stone-500">Atributo principal</dt><dd className="mt-1 font-display text-xl text-amber-200">{FM_ATTRIBUTE_LABELS[primaryAttribute]}</dd></div><div className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><dt className="text-xs uppercase tracking-[.13em] text-stone-500">CD da técnica</dt><dd className="mt-1 font-display text-xl text-amber-200">{derived.techniqueDc}</dd></div><div className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><dt className="text-xs uppercase tracking-[.13em] text-stone-500">Itens essenciais</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-stone-300">{sheet.technique.requiredItems || "Não informado"}</dd></div></dl></Panel><Panel><div className="grid gap-4"><div><p className="text-xs uppercase tracking-[.13em] text-stone-500">Funcionamento</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-300">{sheet.technique.basicFunction || "Selecione uma técnica da biblioteca para registrar seu funcionamento."}</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><p className="text-xs uppercase tracking-[.13em] text-stone-500">Benefícios intrínsecos</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-300">{sheet.technique.intrinsicBenefits || "Não informado"}</p></div><div className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><p className="text-xs uppercase tracking-[.13em] text-stone-500">Limitações e contrajogo</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-300">{sheet.technique.limitations || "Não informado"}</p></div></div><div className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-sm leading-6 text-stone-400"><span className="font-medium text-amber-100">Poderes derivados:</span> use a seção Poderes e feitiços para cadastrar custo, alcance, duração e efeitos mecânicos da técnica selecionada.</div></div></Panel></div></>;
}

function InvocationsTab({ sheet, derived, updateSheet, addDiary }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const addInvocation = () => updateSheet(current => ({ ...current, invocations: [...current.invocations, { id: id(), name: "Nova invocação", concept: "", grade: "fourth", attributes: { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, presence: 8 }, movement: 9, trainedAttack: "melee", trainedSavingThrow: "fortitude", trainedSkills: [], actions: [], notes: "", active: false }] }));
  const updateInvocation = (invocationId: string, updater: (value: FMInvocation) => FMInvocation) => updateSheet(current => ({ ...current, invocations: current.invocations.map(invocation => invocation.id === invocationId ? updater(invocation) : invocation) }));
  return <><SectionTitle eyebrow="Capacidades de controlador" title="Invocações" description="Monte Shikigamis, corpos amaldiçoados ou outras Invocações por grau, atributos, ações e características. O mestre valida conceitos e exceções." action={<Button size="sm" onClick={addInvocation} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Adicionar invocação</Button>} />{sheet.progression.specialization !== "controller" ? <Panel className="mb-4 border-amber-300/15 bg-amber-300/5 text-sm leading-6 text-stone-400">Controladores recebem Invocações iniciais e progressão própria. Outras especializações podem registrar uma Invocação somente com autorização da campanha.</Panel> : null}<div className="space-y-4">{sheet.invocations.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">Nenhuma Invocação registrada. Adicione uma para montar grau, atributos, ações e características.</Panel> : sheet.invocations.map(invocation => { const values = getInvocationDerived(invocation, sheet.progression.level, derived.trainingBonus); const gradeRule = FM_INVOCATION_GRADE_RULES[invocation.grade]; return <Panel key={invocation.id}><div className="flex flex-col gap-3 border-b border-violet-300/10 pb-4 lg:flex-row lg:items-end lg:justify-between"><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Field label="Nome"><Input value={invocation.name} onChange={event => updateInvocation(invocation.id, current => ({ ...current, name: event.target.value }))} /></Field><Field label="Grau"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={invocation.grade} onChange={event => updateInvocation(invocation.id, current => ({ ...current, grade: event.target.value as FMInvocation["grade"] }))}>{Object.entries(FM_INVOCATION_GRADE_RULES).map(([grade, entry]) => <option key={grade} value={grade}>{entry.label}</option>)}</select></Field></div><div className="flex items-center gap-2"><label className="flex items-center gap-2 rounded-lg border border-violet-300/15 px-3 py-2 text-sm text-stone-300"><input type="checkbox" className="accent-amber-300" checked={invocation.active} onChange={event => { updateInvocation(invocation.id, current => ({ ...current, active: event.target.checked })); addDiary(event.target.checked ? `Invocação ativada — ${invocation.name}` : `Invocação recolhida — ${invocation.name}`, `Custo de ${values.totalSummonCost} PE.`, "combat"); }} />Em campo</label><ActionButton title="Remover invocação" onClick={() => updateSheet(current => ({ ...current, invocations: current.invocations.filter(entry => entry.id !== invocation.id) }))} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></div><div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><div><Field label="Conceito e aparência"><Textarea value={invocation.concept} onChange={event => updateInvocation(invocation.id, current => ({ ...current, concept: event.target.value }))} placeholder="Descreva forma, função e origem da Invocação." /></Field><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fmAttributeKeys.map(attribute => <Field key={attribute} label={FM_ATTRIBUTE_LABELS[attribute]}><Input type="number" min={6} max={gradeRule.attributeMaximum} value={invocation.attributes[attribute]} onChange={event => updateInvocation(invocation.id, current => ({ ...current, attributes: { ...current.attributes, [attribute]: Math.max(6, Math.min(gradeRule.attributeMaximum, asNumber(event.target.value))) } }))} /></Field>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Deslocamento"><Input type="number" min={0} value={invocation.movement} onChange={event => updateInvocation(invocation.id, current => ({ ...current, movement: Math.max(0, asNumber(event.target.value)) }))} /></Field><Field label="Ataque treinado"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={invocation.trainedAttack} onChange={event => updateInvocation(invocation.id, current => ({ ...current, trainedAttack: event.target.value as FMInvocation["trainedAttack"] }))}><option value="melee">Corpo a corpo</option><option value="ranged">À distância</option></select></Field><Field label="TR treinado"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={invocation.trainedSavingThrow} onChange={event => updateInvocation(invocation.id, current => ({ ...current, trainedSavingThrow: event.target.value as FMInvocation["trainedSavingThrow"] }))}><option value="astucia">Astúcia</option><option value="fortitude">Fortitude</option><option value="reflexos">Reflexos</option><option value="vontade">Vontade</option></select></Field></div></div><div className="grid content-start gap-3"><FormulaCard label="PV" value={values.health} formula="Grau + Constituição + nível" source="Livro-base, p. 261" /><FormulaCard label="Defesa" value={values.defense} formula="Base do grau + DES + treinamento" source="Livro-base, p. 261" /><FormulaCard label="Custo ao campo" value={`${values.totalSummonCost} PE`} formula={`${values.summonCost} base + ${values.actionCost} por ações`} source="Livro-base, pp. 260 e 262" /><FormulaCard label="Pontos de atributo" value={`${values.attributeSpend}/${values.attributePoints}`} formula={`Base 8; máximo ${values.attributeMaximum}`} source="Livro-base, p. 260" /></div></div><div className="mt-4 border-t border-violet-300/10 pt-4"><div className="mb-3 flex items-center justify-between"><p className="font-display text-xs uppercase tracking-[.16em] text-amber-300/70">Ações e características · {invocation.actions.length}/{values.actionSlots} base</p><Button type="button" size="sm" variant="outline" onClick={() => updateInvocation(invocation.id, current => ({ ...current, actions: [...current.actions, { id: id(), name: "Nova ação", kind: "simple", effect: "", counterplay: "" }] }))}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></div><div className="space-y-3">{invocation.actions.map(action => <div key={action.id} className="grid gap-3 rounded-xl border border-violet-300/10 bg-black/20 p-3 lg:grid-cols-[.85fr_.8fr_1.3fr_1.25fr_auto]"><Field label="Nome"><Input value={action.name} onChange={event => updateInvocation(invocation.id, current => ({ ...current, actions: current.actions.map(entry => entry.id === action.id ? { ...entry, name: event.target.value } : entry) }))} /></Field><Field label="Tipo"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={action.kind} onChange={event => updateInvocation(invocation.id, current => ({ ...current, actions: current.actions.map(entry => entry.id === action.id ? { ...entry, kind: event.target.value as typeof entry.kind } : entry) }))}><option value="simple">Simples</option><option value="complex">Complexa</option><option value="trait">Característica</option></select></Field><Field label="Efeito"><Input value={action.effect} onChange={event => updateInvocation(invocation.id, current => ({ ...current, actions: current.actions.map(entry => entry.id === action.id ? { ...entry, effect: event.target.value } : entry) }))} /></Field><Field label="Contrajogo"><Input value={action.counterplay} onChange={event => updateInvocation(invocation.id, current => ({ ...current, actions: current.actions.map(entry => entry.id === action.id ? { ...entry, counterplay: event.target.value } : entry) }))} placeholder="Ex.: Defesa ou TR" /></Field><ActionButton title="Remover ação" onClick={() => updateInvocation(invocation.id, current => ({ ...current, actions: current.actions.filter(entry => entry.id !== action.id) }))} className="self-end hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div>)}</div><Field label="Observações e aprovação do mestre" className="mt-3"><Textarea value={invocation.notes} onChange={event => updateInvocation(invocation.id, current => ({ ...current, notes: event.target.value }))} placeholder="Registre perícias treinadas, características especiais e acordos da mesa." /></Field></div></Panel>; })}</div></>;
}

function SpecializationTab({ sheet, derived, updateSheet }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const [candidate, setCandidate] = useState<FMSpecializationKey>("combat-specialist");
  const primary = sheet.progression.primarySpecialization;
  const tracks = getSpecializationTracks(sheet);
  const choosePrimary = (specialization: FMSpecializationKey) => updateSheet(current => ({ ...current, progression: { ...current.progression, specialization, specializationLevels: current.progression.level, primarySpecialization: specialization, primarySpecializationLocked: true, specializationTracks: [{ specialization, level: current.progression.level }], specializationCdAttribute: current.progression.techniqueAttribute } }));
  const addMulticlass = () => {
    if (!primary) { toast.error("Escolha primeiro a especialização primária."); return; }
    if (tracks.some(track => track.specialization === candidate)) { toast.error("Este núcleo já integra a Multiclasse."); return; }
    const eligibility = canAddMulticlass(derived.attributes, primary, candidate);
    if (!eligibility.allowed) { toast.error(eligibility.reason); return; }
    const primaryTrack = tracks.find(track => track.specialization === primary);
    if (!primaryTrack || primaryTrack.level < 2) { toast.error("É necessário possuir ao menos nível 2 no núcleo primário para iniciar Multiclasse."); return; }
    updateSheet(current => ({ ...current, progression: { ...current.progression, specializationLevels: primaryTrack.level - 1, specializationTracks: tracks.map(track => track.specialization === primary ? { ...track, level: track.level - 1 } : track).concat({ specialization: candidate, level: 1 }) } }));
  };
  const removeTrack = (specialization: FMSpecializationKey) => updateSheet(current => {
    const currentTracks = getSpecializationTracks(current);
    const removed = currentTracks.find(track => track.specialization === specialization);
    const primaryKey = current.progression.primarySpecialization ?? current.progression.specialization;
    if (!removed || specialization === primaryKey) return current;
    const nextTracks = currentTracks.filter(track => track.specialization !== specialization).map(track => track.specialization === primaryKey ? { ...track, level: track.level + removed.level } : track);
    const nextPrimary = nextTracks.find(track => track.specialization === primaryKey);
    return { ...current, progression: { ...current.progression, specializationLevels: nextPrimary?.level ?? current.progression.specializationLevels, specializationTracks: nextTracks } };
  });
  const eligibility = canAddMulticlass(derived.attributes, primary, candidate);
  return <><SectionTitle eyebrow="Núcleos de combate" title="Especialização e Multiclasse" description="A primeira especialização define o núcleo do personagem e fica bloqueada depois da escolha. Multiclasse divide os níveis entre núcleos e exige os atributos previstos no livro F&M." />
    {!primary ? <Panel className="border-amber-300/25 bg-amber-300/[.035]"><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Escolha definitiva</p><h3 className="mt-1 font-display text-2xl text-stone-100">Defina a especialização primária</h3><p className="mt-2 text-sm leading-6 text-stone-400">Depois de salva, a primeira escolha não poderá ser substituída; novas especializações entram apenas como Multiclasse.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(Object.keys(FM_SPECIALIZATION_LABELS) as FMSpecializationKey[]).map(key => <button type="button" key={key} onClick={() => choosePrimary(key)} className="rounded-xl border border-violet-300/15 bg-black/20 p-4 text-left transition hover:border-amber-300/45 hover:bg-amber-300/[.04] focus:outline-none focus:ring-2 focus:ring-amber-300/70"><p className="font-display text-lg text-amber-100">{FM_SPECIALIZATION_LABELS[key]}</p><p className="mt-2 text-xs leading-5 text-stone-500">{key === "restricted" ? "Sem Multiclasse." : `Multiclasse: ${FM_MULTICLASS_REQUIREMENTS[key].label}.`}</p></button>)}</div></Panel> : <><div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><Panel><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Núcleo primário</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-2xl text-stone-100">{FM_SPECIALIZATION_LABELS[primary]}</h3><p className="mt-1 text-sm text-stone-400">Escolha bloqueada após a criação da ficha.</p></div><span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm text-amber-100">Nível geral {sheet.progression.level}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{tracks.map(track => <div key={track.specialization} className="rounded-xl border border-violet-300/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-[.14em] text-stone-500">{track.specialization === primary ? "Primária" : "Multiclasse"}</p><p className="mt-1 font-display text-lg text-stone-100">{FM_SPECIALIZATION_LABELS[track.specialization]}</p><p className="mt-1 text-sm text-amber-200">Nível {track.level}</p>{track.specialization !== primary ? <ActionButton title="Remover núcleo de multiclasse" onClick={() => removeTrack(track.specialization)} className="mt-3 hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /><span className="ml-2">Remover</span></ActionButton> : null}</div>)}</div></Panel><Panel><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Configuração do núcleo</p><div className="mt-4 grid gap-3"><Field label="Atributo de CD da especialização"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sheet.progression.specializationCdAttribute} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, specializationCdAttribute: event.target.value as FMCharacterSheet["progression"]["specializationCdAttribute"] } }))}>{fmAttributeKeys.map(key => <option key={key} value={key}>{FM_ATTRIBUTE_LABELS[key]}</option>)}</select></Field><Field label="Atributo da técnica"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sheet.progression.techniqueAttribute} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, techniqueAttribute: event.target.value as FMCharacterSheet["progression"]["techniqueAttribute"] } }))}>{fmAttributeKeys.map(key => <option key={key} value={key}>{FM_ATTRIBUTE_LABELS[key]}</option>)}</select></Field><Field label="Treinamentos por atributo" hint="A escolha entre Inteligência e Sabedoria é definitiva conforme o livro."><select disabled={sheet.progression.skillTrainingAttributeLocked} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-65" value={sheet.progression.skillTrainingAttribute ?? "unselected"} onChange={event => { const value = event.target.value; if (value === "unselected") return; updateSheet(current => ({ ...current, progression: { ...current.progression, skillTrainingAttribute: value as "intelligence" | "wisdom", skillTrainingAttributeLocked: true } })); }}><option value="unselected">Definir na criação</option><option value="intelligence">Inteligência</option><option value="wisdom">Sabedoria</option></select></Field></div></Panel></div>{primary !== "restricted" ? <Panel className="mt-4"><SectionTitle eyebrow="Novo núcleo" title="Adicionar Multiclasse" description="A entrada recebe nível 1; um nível é transferido do núcleo primário. Treinamentos e equipamentos iniciais não são repetidos." action={<Button size="sm" disabled={!eligibility.allowed || tracks.some(track => track.specialization === candidate)} onClick={addMulticlass} className="bg-amber-300 text-[#190d07] hover:bg-amber-200 disabled:opacity-50"><Plus className="mr-2 h-4 w-4" />Adicionar núcleo</Button>} /><div className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label="Especialização desejada"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={candidate} onChange={event => setCandidate(event.target.value as FMSpecializationKey)}>{(Object.keys(FM_SPECIALIZATION_LABELS) as FMSpecializationKey[]).filter(key => key !== primary && key !== "restricted").map(key => <option key={key} value={key}>{FM_SPECIALIZATION_LABELS[key]} · {FM_MULTICLASS_REQUIREMENTS[key].label}</option>)}</select></Field><p className={`self-end pb-2 text-sm ${eligibility.allowed ? "text-emerald-300" : "text-amber-200"}`}>{eligibility.allowed ? "Requisito de atributo atendido." : eligibility.reason}</p></div></Panel> : <Panel className="mt-4 border-amber-300/20 bg-amber-300/[.035] text-sm leading-6 text-amber-100">Restringido é uma especialização exclusiva e não pode realizar Multiclasse.</Panel>}</>}</>;
}

function CalculatedStatePanel({ state }: { state: FMCharacterState }) {
  const derivedEntries = Object.entries(state.derivedBreakdown).filter(([, breakdown]) => breakdown.entries.length > 0);
  const pendingRequirements = state.requirements.filter(requirement => !requirement.met);
  return <Panel className="mb-4 border-amber-300/15 bg-amber-300/[.025]"><div className="flex flex-col gap-2 border-b border-violet-300/10 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Estado calculado</p><h3 className="mt-1 font-display text-xl text-stone-100">Origem dos valores</h3><p className="mt-1 text-sm leading-6 text-stone-400">O valor-base permanece editável. Os efeitos ativos são somados separadamente e podem ser auditados sem poluir a ficha.</p></div><span className="text-xs text-stone-500">{state.appliedModifiers.length} modificador(es) ativo(s)</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{fmAttributeKeys.map(attribute => { const breakdown = state.attributeBreakdown[attribute]; return <details key={attribute} className="group rounded-xl border border-violet-300/10 bg-black/20 p-3"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.13em] text-stone-500">{FM_ATTRIBUTE_LABELS[attribute]}</p><p className="mt-1 text-sm text-stone-400">Base {breakdown.base} · Final <strong className="text-amber-100">{breakdown.final}</strong></p></div><span className="text-xs text-violet-200 group-open:text-amber-100">{breakdown.entries.length ? `${breakdown.entries.length} fonte(s)` : "Sem efeitos"}</span></div></summary><div className="mt-3 border-t border-violet-300/10 pt-3">{breakdown.entries.length ? <ul className="space-y-2 text-xs leading-5 text-stone-400">{breakdown.entries.map(entry => <li key={`${entry.sourceId}:${entry.id}`}><strong className="font-medium text-stone-200">{entry.sourceName}</strong> <span className="text-amber-100">{entry.value >= 0 ? "+" : ""}{entry.value}</span>{entry.note ? ` · ${entry.note}` : ""}</li>)}</ul> : <p className="text-xs text-stone-500">Nenhum modificador ativo para este atributo.</p>}</div></details>; })}</div>{derivedEntries.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{derivedEntries.map(([target, breakdown]) => <details key={target} className="group rounded-xl border border-violet-300/10 bg-black/20 p-3"><summary className="cursor-pointer list-none"><p className="text-xs uppercase tracking-[.13em] text-stone-500">{FM_MODIFIER_TARGET_LABELS[target as keyof typeof FM_MODIFIER_TARGET_LABELS]}</p><p className="mt-1 text-sm text-stone-400">Ajuste final <strong className="text-amber-100">{breakdown.final >= 0 ? "+" : ""}{breakdown.final}</strong></p></summary><ul className="mt-3 space-y-2 border-t border-violet-300/10 pt-3 text-xs leading-5 text-stone-400">{breakdown.entries.map(entry => <li key={`${entry.sourceId}:${entry.id}`}><strong className="font-medium text-stone-200">{entry.sourceName}</strong> {entry.value >= 0 ? "+" : ""}{entry.value}{entry.note ? ` · ${entry.note}` : ""}</li>)}</ul></details>)}</div> : null}{pendingRequirements.length ? <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-sm leading-6 text-amber-100"><strong>Requisitos não atendidos:</strong> {pendingRequirements.map(item => `${item.sourceName}: ${item.message}`).join(" ")}</div> : null}</Panel>;
}

function AttributesTab({ sheet, derived, updateSheet }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const calculatedState = calculateCharacterState(sheet);
  return <><SectionTitle eyebrow="Estrutura de poder" title="Atributos e defesas" description={`Atributos de 0 a 30; o limite natural é 20. Especialização, Multiclasse e nível ficam em sua própria seção. ${FM_RULE_CITATIONS.coreValues} e ${FM_RULE_CITATIONS.training}.`} />
    <CalculatedStatePanel state={calculatedState} />
    <Panel><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fmAttributeKeys.map(attribute => <div key={attribute} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium text-stone-200">{FM_ATTRIBUTE_LABELS[attribute]}</span><span className="font-display text-amber-200">{derived.attributes[attribute] >= 10 ? "+" : ""}{Math.floor((derived.attributes[attribute] - 10) / 2)}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><Field label="Base"><Input type="number" min={0} max={30} value={sheet.attributes.base[attribute]} onChange={event => updateSheet(current => ({ ...current, attributes: { ...current.attributes, base: { ...current.attributes.base, [attribute]: Math.min(30, Math.max(0, asNumber(event.target.value))) } } }))} /></Field><Field label="Bônus"><Input type="number" value={sheet.attributes.permanentBonuses[attribute]} onChange={event => updateSheet(current => ({ ...current, attributes: { ...current.attributes, permanentBonuses: { ...current.attributes.permanentBonuses, [attribute]: asNumber(event.target.value) } } }))} /></Field></div></div>)}</div></Panel>
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FormulaCard label="PV máximo" value={derived.healthMaximum} formula="Especialização + Constituição por nível + bônus" source="Livro-base, pp. 20 e 49–128" /><FormulaCard label={getResourceLabel(sheet.progression.specialization, sheet.progression.nonSorcerer)} value={derived.energyMaximum} formula="Especialização por nível, ou Estamina limitada quando não-feiticeiro" source="Livro-base, p. 21; Regras Opcionais, pp. 1–2" /><FormulaCard label="Integridade da Alma" value={derived.integrity} formula="Igual ao máximo de PV" source="Livro-base, p. 19" /><FormulaCard label="Deslocamento" value={`${derived.movement} m`} formula="9 m + bônus registrados" source="Livro-base, p. 19" /></div>
    <Panel className="mt-4"><div className="mb-4"><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Testes de Resistência</p><h3 className="mt-1 font-display text-xl text-stone-100">Resistências/TRs</h3><p className="mt-1 text-sm text-stone-500">Atributo-chave + metade do nível + treinamento quando aplicável.</p><p className="mt-1 text-xs text-stone-600">Livro-base, p. 280.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{fmSavingThrowKeys.map(key => <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-violet-300/10 bg-black/20 p-3"><span><span className="block text-sm font-medium text-stone-200">{FM_SAVING_THROW_LABELS[key]}</span><span className="mt-1 block font-display text-xl text-amber-200">{derived.savingThrows[key] >= 0 ? "+" : ""}{derived.savingThrows[key]}</span></span><input type="checkbox" className="h-4 w-4 accent-amber-300" checked={sheet.progression.savingThrowTraining[key]} onChange={event => updateSheet(current => ({ ...current, progression: { ...current.progression, savingThrowTraining: { ...current.progression.savingThrowTraining, [key]: event.target.checked } } }))} aria-label={`Treinado em ${FM_SAVING_THROW_LABELS[key]}`} /> </label>)}</div></Panel></>;
}

function SkillsCatalogTab({ sheet, derived, updateSheet }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const [catalogId, setCatalogId] = useState(FM_SKILL_CATALOG[0]?.id ?? "");
  const calculatedState = calculateCharacterState(sheet);
  const addCatalogSkill = () => {
    const entry = getSkillCatalogEntry(catalogId);
    if (!entry) return;
    if (sheet.skills.some(skill => skill.catalogId === entry.id)) { toast.error("Esta perícia já está registrada na ficha."); return; }
    updateSheet(current => ({ ...current, skills: [...current.skills, { id: id(), catalogId: entry.id, name: entry.name, attribute: entry.attribute, proficiency: entry.requiresTraining ? "trained" : "untrained", otherBonus: 0, notes: "" }] }));
  };
  const addCustomSkill = () => updateSheet(current => ({ ...current, skills: [...current.skills, { id: id(), name: "Perícia personalizada", attribute: "intelligence", proficiency: "untrained", otherBonus: 0, notes: "" }] }));
  const hasInvalidSkills = sheet.skills.some(skill => !skill.name.trim());
  return <><SectionTitle eyebrow="Banco de perícias" title="Perícias e treinamento" description={hasInvalidSkills ? "Cada perícia precisa de um nome antes de a ficha poder ser salva." : "Escolha a lista oficial do livro F&M ou crie uma perícia de campanha. Bônus = atributo-chave + metade do nível + treinamento + outros bônus."} action={<div className="flex flex-wrap gap-2"><Button size="sm" onClick={addCustomSkill} variant="outline">Personalizada</Button><Button size="sm" onClick={addCatalogSkill} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Adicionar oficial</Button></div>} />
    <Panel className="mb-4 border-amber-300/15 bg-amber-300/[.025]"><div className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label="Perícia oficial disponível" hint="O banco inclui atributo-chave, necessidade de treinamento e marcação de perícia complementar."><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={catalogId} onChange={event => setCatalogId(event.target.value)}>{FM_SKILL_CATALOG.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {FM_ATTRIBUTE_LABELS[entry.attribute]}{entry.requiresTraining ? " · exige treino" : ""}{entry.complementary ? " · complementar" : ""}</option>)}</select></Field><p className="self-end pb-2 text-sm text-stone-400">{getSkillCatalogEntry(catalogId)?.description}</p></div></Panel>
    <div className="space-y-3">{sheet.skills.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">Nenhuma perícia registrada. Selecione uma entrada do banco oficial ou crie uma perícia de campanha.</Panel> : sheet.skills.map(skill => { const bonus = getSkillBonus(sheet.progression.level, derived.attributes, skill.attribute, skill.proficiency, skill.otherBonus, derived.trainingBonus, calculatedState.skillModifiers[skill.id] ?? 0); const official = skill.catalogId ? getSkillCatalogEntry(skill.catalogId) : null; return <Panel key={skill.id}><div className="grid gap-3 lg:grid-cols-[minmax(180px,1.25fr)_minmax(140px,.75fr)_minmax(130px,.7fr)_90px_90px_auto]"><Field label="Perícia"><Input value={skill.name} disabled={Boolean(official)} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Atributo"><select disabled={Boolean(official)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-65" value={skill.attribute} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, attribute: event.target.value as typeof item.attribute } : item) }))}>{fmAttributeKeys.map(key => <option key={key} value={key}>{FM_ATTRIBUTE_LABELS[key]}</option>)}</select></Field><Field label="Proficiência"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={skill.proficiency} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, proficiency: event.target.value as typeof item.proficiency } : item) }))}><option value="untrained" disabled={official?.requiresTraining}>Sem treino</option><option value="trained">Treinado</option><option value="master">Mestre</option></select></Field><Field label="Outros"><Input type="number" value={skill.otherBonus} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, otherBonus: asNumber(event.target.value) } : item) }))} /></Field><Field label="Bônus"><Input readOnly value={`${bonus >= 0 ? "+" : ""}${bonus}`} /></Field><ActionButton title="Remover perícia" onClick={() => updateSheet(current => ({ ...current, skills: current.skills.filter(item => item.id !== skill.id) }))} className="self-end hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div><div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr]"><p className="rounded-lg border border-violet-300/10 bg-black/20 p-3 text-xs leading-5 text-stone-400">{official ? `${official.description}${official.complementary ? " Perícia complementar." : ""}` : "Perícia personalizada aprovada pela campanha."}</p><Field label="Origem de bônus e observações"><Input value={skill.notes} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, notes: event.target.value } : item) }))} placeholder="Obrigatório se houver outros bônus." /></Field></div></Panel>})}</div></>;
}

function SkillsTab({ sheet, derived, updateSheet }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const calculatedState = calculateCharacterState(sheet);
  const addSkill = () => updateSheet(current => ({ ...current, skills: [...current.skills, { id: id(), name: "Nova perícia", attribute: "intelligence", proficiency: "untrained", otherBonus: 0, notes: "" }] }));
  const hasInvalidSkills = sheet.skills.some(skill => !skill.name.trim());
  return <><SectionTitle eyebrow="Testes de perícia" title="Perícias" description={hasInvalidSkills ? "Cada perícia precisa de um nome antes de a ficha poder ser salva." : "Bônus = atributo-chave + metade do nível + treinamento (ou mestria) + outros bônus. Livro-base, p. 278."} action={<Button size="sm" onClick={addSkill} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Adicionar perícia</Button>} />
    <div className="space-y-3">{sheet.skills.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">Nenhuma perícia registrada. Adicione as perícias em que o personagem possui treinamento.</Panel> : sheet.skills.map(skill => { const bonus = getSkillBonus(sheet.progression.level, derived.attributes, skill.attribute, skill.proficiency, skill.otherBonus, derived.trainingBonus, calculatedState.skillModifiers[skill.id] ?? 0); return <Panel key={skill.id}><div className="grid gap-3 lg:grid-cols-[minmax(160px,1.3fr)_minmax(130px,.8fr)_minmax(130px,.8fr)_100px_110px_auto]"><Field label="Perícia"><Input value={skill.name} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="Atributo"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={skill.attribute} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, attribute: event.target.value as typeof item.attribute } : item) }))}>{fmAttributeKeys.map(key => <option key={key} value={key}>{FM_ATTRIBUTE_LABELS[key]}</option>)}</select></Field><Field label="Proficiência"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={skill.proficiency} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, proficiency: event.target.value as typeof item.proficiency } : item) }))}><option value="untrained">Sem treino</option><option value="trained">Treinado</option><option value="master">Mestre</option></select></Field><Field label="Outros"><Input type="number" value={skill.otherBonus} onChange={event => updateSheet(current => ({ ...current, skills: current.skills.map(item => item.id === skill.id ? { ...item, otherBonus: asNumber(event.target.value) } : item) }))} /></Field><Field label="Bônus"><Input readOnly value={`${bonus >= 0 ? "+" : ""}${bonus}`} /></Field><ActionButton title="Remover perícia" onClick={() => updateSheet(current => ({ ...current, skills: current.skills.filter(item => item.id !== skill.id) }))} className="self-end hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div>{skill.notes ? <p className="mt-3 text-xs text-stone-500">{skill.notes}</p> : null}</Panel>})}</div></>;
}

function SpellsTab({ sheet, derived, updateSheet, addDiary }: { sheet: FMCharacterSheet; derived: ReturnType<typeof getDerivedValues>; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  const addSpell = () => updateSheet(current => ({ ...current, spells: [...current.spells, createAutomatedSpell()] }));
  const highestLevel = getHighestSpellLevel(sheet.progression.level);
  const specializationLevel = Math.max(0, sheet.progression.specializationLevels ?? sheet.progression.level);
  const powerProgression = getTechniquePowerProgression(sheet.progression.specialization, specializationLevel);
  const techniquePowers = Array.isArray(sheet.technique.powers) ? sheet.technique.powers : [];
  const selectedPowerIds = new Set(sheet.spells.map(spell => spell.sourcePowerId).filter((powerId): powerId is string => Boolean(powerId)));
  const addTechniquePower = (power: FMTechniquePower) => {
    if (selectedPowerIds.has(power.id)) return;
    if (power.requiredCharacterLevel > specializationLevel || power.spellLevel > highestLevel || selectedPowerIds.size >= powerProgression.availableSlots) return;
    updateSheet(current => ({ ...current, spells: [...current.spells, createAutomatedSpell(power.type, power)] }));
    addDiary(`Poder selecionado — ${power.name}`, `Poder de ${sheet.technique.name || "técnica"} selecionado no nível ${specializationLevel}.`, "note");
  };
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
  return <><SectionTitle eyebrow="Perfil amaldiçoado" title="Poderes e feitiços" description="Escolha poderes do catálogo da técnica conforme o nível de especialização. Feitiços personalizados continuam disponíveis para homebrew aprovado pelo Narrador." action={<Button size="sm" onClick={addSpell} className="no-print bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Criar poder livre</Button>} />
    <TechniquePowerSelectionPanel powers={techniquePowers} selectedPowerIds={selectedPowerIds} specialization={sheet.progression.specialization} specializationLevel={specializationLevel} highestSpellLevel={highestLevel} progression={powerProgression} onSelect={addTechniquePower} />
    <Panel className="mb-4 border-amber-300/15 bg-amber-300/[.035]"><p className="text-sm text-amber-100">Nível máximo disponível: <strong>{highestLevel}</strong>. Custo padrão: nível 0 = 0 PE; níveis 1–5 = 2, 5, 8, 12 e 20 PE. Um feitiço acima do acesso atual permanece identificado para revisão.</p></Panel>
    <div className="space-y-4">{sheet.spells.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">A técnica não possui feitiços registrados. Personagens com técnica normalmente começam com dois.</Panel> : sheet.spells.map(spell => <div key={spell.id} className="space-y-2"><SpellEditor spell={spell} highestLevel={highestLevel} onCast={() => castSpell(spell)} onSustain={() => sustainSpell(spell)} update={updater => updateSheet(current => ({ ...current, spells: current.spells.map(item => item.id === spell.id ? updater(item) : item) }))} remove={() => updateSheet(current => ({ ...current, spells: current.spells.filter(item => item.id !== spell.id) }))} /><SpellCombatModifier spell={spell} update={updater => updateSheet(current => ({ ...current, spells: current.spells.map(item => item.id === spell.id ? updater(item) : item) }))} /><CounterplayEditor spell={spell} update={updater => updateSheet(current => ({ ...current, spells: current.spells.map(item => item.id === spell.id ? updater(item) : item) }))} /></div>)}</div>
    <div className="mt-4 grid gap-4 md:grid-cols-3"><FormulaCard label="CD da técnica" value={derived.techniqueDc} formula="Usada por feitiços com teste de resistência" source="Livro-base, pp. 198–203" /><FormulaCard label="Atributo da técnica" value={FM_ATTRIBUTE_LABELS[sheet.progression.techniqueAttribute]} formula="Definido no funcionamento básico" source="Livro-base, p. 198" /><FormulaCard label="Energia atual" value={`${sheet.resources.energy.current}/${derived.energyMaximum}`} formula="O uso de feitiço consome PE conforme o custo" source="Livro-base, pp. 200–203" /></div></>;
}

export function TechniquePowerSelectionPanel({ powers, selectedPowerIds, specialization, specializationLevel, highestSpellLevel, progression, onSelect }: { powers: FMTechniquePower[]; selectedPowerIds: Set<string>; specialization: FMSpecializationKey; specializationLevel: number; highestSpellLevel: FMSpellLevel; progression: ReturnType<typeof getTechniquePowerProgression>; onSelect: (power: FMTechniquePower) => void }) {
  const selectedCount = selectedPowerIds.size;
  const canChooseMore = selectedCount < progression.availableSlots;
  if (powers.length === 0) return <Panel className="mb-4 border-dashed border-violet-300/20 text-sm leading-6 text-stone-500">A técnica vinculada ainda não possui um catálogo de poderes. Abra a <strong className="text-stone-300">Biblioteca → Técnicas</strong> para registrar poderes por nível ou crie um poder livre com aprovação do Narrador.</Panel>;
  return <Panel className="print-power-sheet mb-4 border-amber-300/20 bg-[linear-gradient(120deg,rgba(217,156,37,.08),transparent_42%),#120c1d]"><div className="flex flex-col gap-3 border-b border-amber-300/10 pb-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Progressão de poderes</p><h3 className="mt-1 font-display text-2xl text-stone-100">Escolhas da técnica</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400"><strong className="text-amber-100">{FM_SPECIALIZATION_LABELS[specialization]}</strong> · nível de especialização {specializationLevel} · {progression.cadenceLabel}.</p></div><div className="rounded-xl border border-violet-300/15 bg-black/20 px-4 py-2"><p className="text-xs uppercase tracking-[.14em] text-stone-500">Vagas ocupadas</p><p className="mt-1 font-display text-xl text-amber-200">{selectedCount}/{progression.availableSlots}</p><p className="text-xs text-stone-500">{progression.nextUnlockLevel ? `Próxima vaga: nível ${progression.nextUnlockLevel}` : "Todas as vagas liberadas"}</p></div></div><div className="mt-4 grid gap-3 xl:grid-cols-2">{[...powers].sort((a, b) => a.requiredCharacterLevel - b.requiredCharacterLevel || a.name.localeCompare(b.name)).map(power => { const selected = selectedPowerIds.has(power.id); const levelLocked = power.requiredCharacterLevel > specializationLevel; const spellLocked = power.spellLevel > highestSpellLevel; const slotLocked = !selected && !canChooseMore; const locked = levelLocked || spellLocked || slotLocked; const reason = levelLocked ? `Requer nível ${power.requiredCharacterLevel} de especialização.` : spellLocked ? `Requer acesso ao poder de nível ${power.spellLevel}.` : slotLocked ? "Todas as vagas atuais já foram ocupadas." : ""; return <article key={power.id} className={`print-power-card rounded-xl border p-4 ${selected ? "border-emerald-300/30 bg-emerald-500/[.05]" : locked ? "border-violet-300/10 bg-black/20 opacity-70" : "border-amber-300/25 bg-amber-300/[.035]"}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-display text-lg text-stone-100">{power.name}</p><p className="mt-1 text-xs uppercase tracking-[.14em] text-amber-200">Nível {power.requiredCharacterLevel} · Poder {power.spellLevel} · {power.type}</p></div><Button type="button" size="sm" disabled={locked || selected} onClick={() => onSelect(power)} className={`no-print ${selected ? "bg-emerald-600 text-emerald-50" : "bg-amber-300 text-[#190d07] hover:bg-amber-200 disabled:opacity-50"}`}>{selected ? "Selecionado" : locked ? "Bloqueado" : "Selecionar"}</Button></div><p className="mt-3 text-sm leading-6 text-stone-300">{power.summary || "Sem resumo registrado."}</p>{power.requirement ? <p className="mt-3 rounded-lg border border-violet-300/10 bg-black/20 p-2 text-xs leading-5 text-stone-400"><strong className="text-stone-300">Limite:</strong> {power.requirement}</p> : null}{locked ? <p className="mt-3 text-xs text-amber-200">{reason}</p> : null}</article>; })}</div></Panel>;
}

function SpellEditor({ spell, highestLevel, onCast, onSustain, update, remove }: { spell: FMSpell; highestLevel: FMSpellLevel; onCast: () => void; onSustain: () => void; update: (updater: (current: FMSpell) => FMSpell) => void; remove: () => void }) {
  const cost = getSpellCost(spell.level, spell.costAdjustment);
  return <Panel className={spell.level > highestLevel ? "border-red-400/40" : ""}><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Feitiço de nível {spell.level}</p><Input className="mt-2 max-w-md font-display text-xl" value={spell.name} onChange={event => update(current => ({ ...current, name: event.target.value }))} /></div><div className="flex gap-2"><ActionButton title="Conjurar feitiço" onClick={onCast} className="border-amber-300/25 text-amber-100"><WandSparkles className="mr-2 h-4 w-4" />Usar · {cost} PE</ActionButton>{spell.durationType === "sustained" ? <ActionButton title="Sustentar por uma rodada" onClick={onSustain} className="border-violet-300/25 text-violet-100">Sustentar · {getSustainCost(spell.level)} PE</ActionButton> : null}<label className="flex items-center gap-2 rounded-lg border border-violet-300/15 px-3 py-2 text-sm text-stone-300"><input type="checkbox" className="accent-amber-300" checked={spell.active} onChange={event => update(current => ({ ...current, active: event.target.checked }))} />Ativo</label><ActionButton title="Remover feitiço" onClick={remove} className="hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div></div>
    {spell.level > highestLevel ? <p className="mb-4 text-xs text-red-200">Este nível ainda não está liberado pelo nível atual do personagem.</p> : null}<div className="mb-3 rounded-xl border border-violet-300/15 bg-violet-500/[.04] p-3 text-xs leading-5 text-stone-400">Ao trocar o tipo, o assistente ajusta conjuração, alcance, duração, resolução, resistência e contrajogo. Você pode personalizar os campos depois.</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Tipo"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.type} onChange={event => update(current => applyAutomatedSpellType(current, event.target.value as FMSpell["type"]))}><option value="level-zero">Nível 0</option><option value="damage">Dano</option><option value="auxiliary">Auxiliar</option><option value="healing">Curativo</option><option value="special">Especial</option><option value="passive">Passivo</option></select></Field><Field label="Nível de poder"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.level} onChange={event => update(current => ({ ...current, level: asNumber(event.target.value) as FMSpellLevel }))}>{[0, 1, 2, 3, 4, 5].map(level => <option key={level} value={level}>{level}</option>)}</select></Field><Field label="Custo final"><Input readOnly value={`${cost} PE`} /></Field><Field label="Conjuração"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.casting} onChange={event => update(current => ({ ...current, casting: event.target.value as FMSpell["casting"] }))}><option value="common">Ação comum</option><option value="bonus">Ação bônus</option><option value="reaction">Reação</option><option value="movement">Movimento</option><option value="free">Livre</option><option value="complete">Completa</option></select></Field><Field label="Alcance"><Input value={spell.reach} onChange={event => update(current => ({ ...current, reach: event.target.value }))} /></Field><Field label="Alvo ou área"><Input value={spell.targetOrArea} onChange={event => update(current => ({ ...current, targetOrArea: event.target.value }))} /></Field><Field label="Duração"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.durationType} onChange={event => update(current => ({ ...current, durationType: event.target.value as FMSpell["durationType"] }))}><option value="immediate">Imediata</option><option value="lasting">Duradoura</option><option value="sustained">Sustentada</option><option value="concentrated">Concentrada</option><option value="variable">Variável</option></select></Field><Field label="Detalhe da duração"><Input value={spell.durationDetail} onChange={event => update(current => ({ ...current, durationDetail: event.target.value }))} placeholder="Ex.: 3 rodadas" /></Field><Field label="Resolução"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.resolution} onChange={event => update(current => ({ ...current, resolution: event.target.value as FMSpell["resolution"] }))}><option value="attack">Jogada de ataque</option><option value="saving-throw">Teste de resistência</option><option value="none">Sem teste</option></select></Field><Field label="Resistência"><Input value={spell.savingThrow} onChange={event => update(current => ({ ...current, savingThrow: event.target.value }))} placeholder="Ex.: Reflexos" /></Field><Field label="Dano"><Input value={spell.damage} onChange={event => update(current => ({ ...current, damage: event.target.value }))} placeholder="Ex.: 3d8" /></Field><Field label="Tipo de dano"><Input value={spell.damageType} onChange={event => update(current => ({ ...current, damageType: event.target.value }))} /></Field></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Efeito"><Textarea value={spell.effect} onChange={event => update(current => ({ ...current, effect: event.target.value }))} /></Field><Field label="Requisito ou limitação"><Textarea value={spell.requirement} onChange={event => update(current => ({ ...current, requirement: event.target.value }))} /></Field><Field label="Ajuste de custo"><Input type="number" value={spell.costAdjustment} onChange={event => update(current => ({ ...current, costAdjustment: asNumber(event.target.value) }))} /></Field><Field label="Observações"><Textarea value={spell.notes} onChange={event => update(current => ({ ...current, notes: event.target.value }))} /></Field></div></Panel>;
}

function SpellCombatModifier({ spell, update }: { spell: FMSpell; update: (updater: (current: FMSpell) => FMSpell) => void }) {
  return <div className="grid gap-3 rounded-xl border border-violet-300/10 bg-violet-500/[.04] p-3 md:grid-cols-[1fr_160px_auto]"><Field label="Efeito mecânico na cena"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={spell.combatModifierTarget ?? "none"} onChange={event => update(current => ({ ...current, combatModifierTarget: event.target.value as FMSpell["combatModifierTarget"] }))}><option value="none">Sem modificador numérico</option><option value="attack">Bônus de ataque</option><option value="defense">Bônus de defesa</option><option value="initiative">Bônus de iniciativa</option></select></Field><Field label="Valor"><Input type="number" value={spell.combatModifier ?? 0} onChange={event => update(current => ({ ...current, combatModifier: asNumber(event.target.value) }))} /></Field><p className="self-end pb-2 text-xs leading-5 text-stone-500">Aplicado somente enquanto o feitiço estiver ativo; descreva o efeito oficial acima.</p></div>;
}

function CounterplayEditor({ spell, update }: { spell: FMSpell; update: (updater: (current: FMSpell) => FMSpell) => void }) {
  return <div className={`rounded-xl border p-3 ${spell.counterplay?.trim() ? "border-emerald-300/20 bg-emerald-500/[.035]" : "border-amber-300/25 bg-amber-300/[.035]"}`}><Field label="Contrajogo, reação ou resistência" hint="Regra da Casa I: nenhum efeito pode eliminar completamente a possibilidade de resposta do alvo."><Textarea value={spell.counterplay ?? ""} onChange={event => update(current => ({ ...current, counterplay: event.target.value }))} placeholder="Ex.: teste de Reflexos, barreira, reação, distância mínima ou condição para interromper o efeito." /></Field></div>;
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

function TechniqueModifiersPanel({ sheet, updateSheet }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  return <Panel className="mt-4 border-amber-300/15 bg-amber-300/[.025]"><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Efeito ativo</p><h3 className="mt-1 font-display text-xl text-stone-100">Modificadores da técnica</h3><p className="mt-2 text-sm leading-6 text-stone-400">A técnica vinculada não é duplicada: este painel registra somente efeitos declarados que devem integrar o estado calculado do personagem.</p><div className="mt-4"><ModifierEditor modifiers={sheet.technique.modifiers ?? []} onChange={modifiers => updateSheet(current => ({ ...current, technique: { ...current.technique, modifiers } }))} /></div></Panel>;
}

function EquipmentModifierPanel({ sheet, updateSheet, addDiary }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void; addDiary: (title: string, detail: string, category?: FMCharacterSheet["diary"][number]["category"]) => void }) {
  return <section className="mt-4 space-y-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.025] p-4 sm:p-5"><div><p className="font-display text-xs uppercase tracking-[.18em] text-amber-300/70">Estado ativo</p><h3 className="mt-1 font-display text-xl text-stone-100">Equipar e aplicar efeitos</h3><p className="mt-2 text-sm leading-6 text-stone-400">Somente itens equipados aplicam seus modificadores. Carga e inventário permanecem registrados separadamente.</p></div>{sheet.equipment.length ? <div className="grid gap-3 xl:grid-cols-2">{sheet.equipment.map(item => <article key={item.id} className="rounded-xl border border-violet-300/10 bg-[#0d0814] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-stone-100">{item.name}</p><p className="mt-1 text-xs text-stone-500">{item.category} · {item.equipped ? "Equipado" : "No inventário"}</p></div><label className="flex items-center gap-2 text-sm text-stone-300"><input type="checkbox" className="accent-amber-300" checked={item.equipped} onChange={event => { const equipped = event.target.checked; updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, equipped } : entry) })); addDiary(`${equipped ? "Equipado" : "Desequipado"} — ${item.name}`, equipped ? "Os modificadores declarados do item passaram a compor o estado calculado." : "Os modificadores declarados do item foram removidos do estado calculado.", "note"); }} />Equipado</label></div><div className="mt-3"><ModifierEditor label="Modificadores quando equipado" modifiers={item.modifiers ?? []} onChange={modifiers => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, modifiers } : entry) }))} /></div></article>)}</div> : <p className="rounded-xl border border-dashed border-violet-300/15 p-4 text-sm text-stone-500">Adicione um item no catálogo acima para equipá-lo e declarar seus efeitos.</p>}</section>;
}

function EquipmentCatalogTab({ sheet, updateSheet }: { sheet: FMCharacterSheet; updateSheet: (updater: (current: FMCharacterSheet) => FMCharacterSheet) => void }) {
  const [catalogId, setCatalogId] = useState(FM_EQUIPMENT_CATALOG[0]?.id ?? "");
  const load = getInventoryLoad(sheet);
  const addOfficial = () => {
    const entry = getEquipmentCatalogEntry(catalogId);
    if (!entry) return;
    updateSheet(current => ({ ...current, equipment: [...current.equipment, { id: id(), catalogId: entry.id, name: entry.name, category: entry.category, damage: entry.damage, damageType: entry.damageType, range: entry.range, defenseBonus: entry.defenseBonus, weight: entry.weight, spaces: entry.spaces, cost: entry.cost, properties: entry.properties, quantity: 1, equipped: false, notes: "" }] }));
  };
  const addCustom = () => updateSheet(current => ({ ...current, equipment: [...current.equipment, { id: id(), name: "Item personalizado", category: "other", damage: "", damageType: "", range: "", defenseBonus: 0, weight: 1, spaces: 1, cost: 0, properties: "", quantity: 1, equipped: false, notes: "" }] }));
  return <><SectionTitle eyebrow="Banco de equipamentos" title="Equipamento e carga" description="Selecione armas, escudos, uniformes, kits e itens especiais do banco inicial ou registre equipamento de campanha. A carga usa espaços, não peso físico." action={<div className="flex flex-wrap gap-2"><Button size="sm" onClick={addCustom} variant="outline">Personalizado</Button><Button size="sm" onClick={addOfficial} className="bg-amber-300 text-[#190d07] hover:bg-amber-200"><Plus className="mr-2 h-4 w-4" />Adicionar oficial</Button></div>} />
    <div className="mb-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><Panel className="border-amber-300/15 bg-amber-300/[.025]"><Field label="Equipamento oficial disponível"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={catalogId} onChange={event => setCatalogId(event.target.value)}>{FM_EQUIPMENT_CATALOG.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · custo {entry.cost} · {entry.spaces} espaço(s)</option>)}</select></Field><p className="mt-3 text-sm leading-6 text-stone-400">{getEquipmentCatalogEntry(catalogId)?.summary} {getEquipmentCatalogEntry(catalogId)?.properties ? `· ${getEquipmentCatalogEntry(catalogId)?.properties}` : ""}</p></Panel><div className="grid gap-3 sm:grid-cols-3"><FormulaCard label="Carga" value={`${load.spaces}/${load.capacity}`} formula="Espaços ocupados / limite" source="Livro-base, p. 129" /><FormulaCard label="Máximo absoluto" value={load.maximum} formula="Dobro do limite de carga" source="Livro-base, p. 129" /><FormulaCard label="Estado" value={load.impossible ? "Impossível" : load.overloaded ? "Sobrecarregado" : "Regular"} formula={load.overloaded ? "−5 DEF e −4,5 m" : "Sem penalidade"} source="Livro-base, p. 129" /></div></div>
    <div className="space-y-3">{sheet.equipment.length === 0 ? <Panel className="border-dashed text-center text-sm text-stone-500">Nenhum equipamento registrado. A criação padrão concede dois itens de custo 1, uniforme comum e kit de ferramentas.</Panel> : sheet.equipment.map(item => { const official = item.catalogId ? getEquipmentCatalogEntry(item.catalogId) : null; return <Panel key={item.id}><div className="grid gap-3 lg:grid-cols-[minmax(170px,1.2fr)_130px_90px_90px_90px_auto]"><Field label="Item"><Input disabled={Boolean(official)} value={item.name} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, name: event.target.value } : entry) }))} /></Field><Field label="Categoria"><select disabled={Boolean(official)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-65" value={item.category} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, category: event.target.value as typeof entry.category } : entry) }))}><option value="weapon">Arma</option><option value="shield">Escudo</option><option value="uniform">Uniforme</option><option value="tool">Kit</option><option value="special">Especial</option><option value="other">Outro</option></select></Field><Field label="Custo"><Input readOnly={Boolean(official)} type="number" min={0} value={item.cost ?? 0} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, cost: asNumber(event.target.value) } : entry) }))} /></Field><Field label="Espaços"><Input readOnly={Boolean(official)} type="number" min={0} max={4} step={0.5} value={item.spaces ?? item.weight} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, spaces: asNumber(event.target.value), weight: asNumber(event.target.value) } : entry) }))} /></Field><Field label="Qtd."><Input type="number" min={1} value={item.quantity ?? 1} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, quantity: Math.max(1, asNumber(event.target.value)) } : entry) }))} /></Field><ActionButton title="Remover equipamento" onClick={() => updateSheet(current => ({ ...current, equipment: current.equipment.filter(entry => entry.id !== item.id) }))} className="self-end hover:border-red-400/60 hover:text-red-200"><Trash2 className="h-4 w-4" /></ActionButton></div><div className="mt-3 grid gap-3 lg:grid-cols-[.8fr_.8fr_1.4fr]"><Field label="Dano / tipo"><Input readOnly={Boolean(official)} value={[item.damage, item.damageType].filter(Boolean).join(" ")} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, damage: event.target.value, damageType: "" } : entry) }))} /></Field><Field label="Alcance / DEF"><Input readOnly={Boolean(official)} value={item.range || (item.defenseBonus ? `+${item.defenseBonus} DEF` : "—")} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, range: event.target.value } : entry) }))} /></Field><Field label="Propriedades e observações"><Input value={item.notes || item.properties || ""} onChange={event => updateSheet(current => ({ ...current, equipment: current.equipment.map(entry => entry.id === item.id ? { ...entry, notes: event.target.value } : entry) }))} placeholder={official?.properties ?? "Efeito, limitação ou aprovação da campanha"} /></Field></div></Panel>})}</div></>;
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
