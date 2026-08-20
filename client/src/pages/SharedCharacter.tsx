import { BookOpen, Flame, Loader2, MoonStar, Shield, Sparkles, Swords } from "lucide-react";
import { useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLiveSocketAuth } from "@/lib/liveAuth";
import { FM_ATTRIBUTE_LABELS, getDerivedValues, getResourceLabel } from "@shared/fmRules";
import { createEmptyFMSheet, fmAttributeKeys, type FMCharacterSheet } from "@shared/fmTypes";

function hydrateSharedSheet(raw: Record<string, unknown> | null | undefined): FMCharacterSheet {
  const empty = createEmptyFMSheet();
  const source = raw as Partial<FMCharacterSheet> | undefined;
  if (!source) return empty;
  return {
    ...empty,
    ...source,
    identity: { ...empty.identity, ...(source.identity ?? {}) },
    personal: { ...empty.personal, ...(source.personal ?? {}) },
    progression: { ...empty.progression, ...(source.progression ?? {}) },
    houseRules: { ...empty.houseRules, ...(source.houseRules ?? {}), birthVow: { ...empty.houseRules.birthVow, ...(source.houseRules?.birthVow ?? {}) }, actionDeclaration: { ...empty.houseRules.actionDeclaration, ...(source.houseRules?.actionDeclaration ?? {}) }, rest: { ...empty.houseRules.rest, ...(source.houseRules?.rest ?? {}) }, downtime: { ...empty.houseRules.downtime, ...(source.houseRules?.downtime ?? {}), freeBuildOptions: Array.isArray(source.houseRules?.downtime?.freeBuildOptions) ? source.houseRules.downtime.freeBuildOptions : [] } },
    origin: { ...empty.origin, ...(source.origin ?? {}) },
    technique: { ...empty.technique, ...(source.technique ?? {}) },
    attributes: { base: { ...empty.attributes.base, ...(source.attributes?.base ?? {}) }, permanentBonuses: { ...empty.attributes.permanentBonuses, ...(source.attributes?.permanentBonuses ?? {}) } },
    bonuses: { ...empty.bonuses, ...(source.bonuses ?? {}) },
    resources: { health: { ...empty.resources.health, ...(source.resources?.health ?? {}) }, energy: { ...empty.resources.energy, ...(source.resources?.energy ?? {}) } },
    skills: Array.isArray(source.skills) ? source.skills : [],
    spells: Array.isArray(source.spells) ? source.spells : [],
    equipment: Array.isArray(source.equipment) ? source.equipment : [],
    attacks: Array.isArray(source.attacks) ? source.attacks : [],
    defenses: Array.isArray(source.defenses) ? source.defenses : [],
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    combatants: Array.isArray(source.combatants) ? source.combatants : [],
    diary: Array.isArray(source.diary) ? source.diary : [],
    aptitudes: Array.isArray(source.aptitudes) ? source.aptitudes : [],
    training: Array.isArray(source.training) ? source.training : [],
    allies: Array.isArray(source.allies) ? source.allies : [],
    cursedTools: Array.isArray(source.cursedTools) ? source.cursedTools : [],
    domainExpansion: source.domainExpansion ?? null,
  };
}

function ReadCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return <section className="rounded-2xl border border-violet-300/10 bg-[#120c1d]/80 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)] sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="text-amber-300">{icon}</span><h2 className="font-display text-lg text-stone-100">{title}</h2></div>{children}</section>;
}

export default function SharedCharacter() {
  const [, params] = useRoute("/ficha/:token");
  const token = params?.token ?? "";
  const sharedQuery = trpc.shared.get.useQuery({ token }, { enabled: Boolean(token), retry: false });
  const refetchSharedCharacter = sharedQuery.refetch;

  useEffect(() => {
    if (!token) return;
    const socket = io({ path: "/api/live", transports: ["websocket", "polling"], withCredentials: true, auth: getLiveSocketAuth() });
    socket.on("connect", () => socket.emit("watch-share", token));
    socket.on("character-updated", () => { void refetchSharedCharacter(); });
    return () => { socket.disconnect(); };
  }, [token, refetchSharedCharacter]);

  const sheet = useMemo(() => hydrateSharedSheet(sharedQuery.data?.sheet), [sharedQuery.data?.sheet]);
  const derived = getDerivedValues(sheet);

  if (sharedQuery.isLoading) return <div className="grid min-h-screen place-items-center bg-[#09060f] text-amber-300"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (sharedQuery.isError || !sharedQuery.data) return <main className="grid min-h-screen place-items-center bg-[#09060f] px-5 text-center text-stone-100"><div><BookOpen className="mx-auto h-10 w-10 text-amber-300" /><h1 className="mt-5 font-display text-3xl">Ficha não encontrada</h1><p className="mt-3 max-w-md text-sm leading-6 text-stone-400">Este link pode ter sido removido ou não está disponível.</p></div></main>;

  return <main className="min-h-screen bg-[#09060f] px-4 py-7 text-stone-100 sm:px-6 sm:py-10"><div className="mx-auto max-w-6xl"><header className="mb-7 rounded-2xl border border-amber-300/15 bg-[radial-gradient(circle_at_88%_10%,rgba(151,93,199,.18),transparent_36%),#120c1d] p-6 sm:p-8"><div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[.2em] text-amber-300/70"><MoonStar className="h-4 w-4" />Arquivo compartilhado · somente leitura</div><div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-display text-4xl text-stone-100 sm:text-5xl">{sheet.identity.name || sharedQuery.data.name}</h1><p className="mt-2 text-sm text-stone-400">{sheet.identity.player || "Jogador não informado"}{sheet.identity.grade ? ` · ${sheet.identity.grade}` : ""}{sheet.origin.name ? ` · ${sheet.origin.name}` : ""}</p></div><p className="text-xs leading-5 text-stone-500">Esta página se atualiza quando o proprietário salva alterações.</p></div></header>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><ReadCard title="Pontos de Vida" icon={<Flame className="h-4 w-4" />}><p className="font-display text-3xl text-amber-200">{sheet.resources.health.current}/{derived.healthMaximum}</p></ReadCard><ReadCard title={getResourceLabel(sheet.progression.specialization, sheet.progression.nonSorcerer)} icon={<Sparkles className="h-4 w-4" />}><p className="font-display text-3xl text-amber-200">{sheet.resources.energy.current}/{derived.energyMaximum}</p></ReadCard><ReadCard title="Defesa" icon={<Shield className="h-4 w-4" />}><p className="font-display text-3xl text-amber-200">{derived.defense}</p></ReadCard><ReadCard title="Iniciativa" icon={<Swords className="h-4 w-4" />}><p className="font-display text-3xl text-amber-200">{derived.initiative >= 0 ? "+" : ""}{derived.initiative}</p></ReadCard></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]"><ReadCard title="Atributos"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fmAttributeKeys.map(attribute => <div key={attribute} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><p className="text-xs uppercase tracking-[.14em] text-stone-500">{FM_ATTRIBUTE_LABELS[attribute]}</p><p className="mt-1 font-display text-2xl text-amber-200">{derived.attributes[attribute]}</p></div>)}</div></ReadCard><ReadCard title="Técnica amaldiçoada" icon={<Sparkles className="h-4 w-4" />}><p className="font-display text-xl text-amber-200">{sheet.technique.name || "Não informada"}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-400">{sheet.technique.basicFunction || "Sem funcionamento básico registrado."}</p></ReadCard></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2"><ReadCard title="Magias/Maldições" icon={<Sparkles className="h-4 w-4" />}><div className="space-y-3">{sheet.spells.length ? sheet.spells.map(spell => <div key={spell.id} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-stone-200">{spell.name}</p><span className="text-xs text-amber-200">Nível {spell.level} · {spell.active ? "ativo" : "inativo"}</span></div><p className="mt-1 text-xs text-stone-500">{spell.reach} · {spell.durationType} · {spell.effect || "Sem efeito registrado"}</p></div>) : <p className="text-sm text-stone-500">Nenhum feitiço registrado.</p>}</div></ReadCard><ReadCard title="Combate" icon={<Swords className="h-4 w-4" />}><div className="space-y-3">{sheet.attacks.length ? sheet.attacks.map(attack => <div key={attack.id} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><p className="font-medium text-stone-200">{attack.name}</p><p className="mt-1 text-xs text-stone-500">{attack.mode === "melee" ? "Corpo a corpo" : attack.mode === "ranged" ? "À distância" : "Amaldiçoado"} · {attack.damage || "Dano não informado"} · {attack.reach || "Alcance não informado"}</p></div>) : <p className="text-sm text-stone-500">Nenhum ataque registrado.</p>}</div></ReadCard><ReadCard title="Perícias" icon={<BookOpen className="h-4 w-4" />}><div className="flex flex-wrap gap-2">{sheet.skills.length ? sheet.skills.map(skill => <span key={skill.id} className="rounded-lg border border-violet-300/10 bg-black/20 px-3 py-2 text-sm text-stone-300">{skill.name}</span>) : <p className="text-sm text-stone-500">Nenhuma perícia registrada.</p>}</div></ReadCard><ReadCard title="Equipamento" icon={<Shield className="h-4 w-4" />}><div className="flex flex-wrap gap-2">{sheet.equipment.length ? sheet.equipment.map(item => <span key={item.id} className="rounded-lg border border-violet-300/10 bg-black/20 px-3 py-2 text-sm text-stone-300">{item.name}</span>) : <p className="text-sm text-stone-500">Nenhum equipamento registrado.</p>}</div></ReadCard></div>
    {sheet.aptitudes.length || sheet.domainExpansion || sheet.allies.length || sheet.cursedTools.length ? <div className="mt-4 grid gap-4 xl:grid-cols-2"><ReadCard title="Aptidões e treinamentos" icon={<Sparkles className="h-4 w-4" />}><div className="space-y-3">{sheet.aptitudes.length ? sheet.aptitudes.map(aptitude => <div key={aptitude.id} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-stone-200">{aptitude.name}</p><span className="text-xs text-amber-200">Nível {aptitude.requiredLevel} · {aptitude.approved ? "aprovada" : "em revisão"}</span></div><p className="mt-1 text-xs text-stone-500">{aptitude.effect}</p></div>) : <p className="text-sm text-stone-500">Nenhuma aptidão registrada.</p>}{sheet.training.length ? <p className="text-xs text-stone-500">Trilhas: {sheet.training.map(track => `${track.trackId} ${track.stage}/4`).join(" · ")}</p> : null}</div></ReadCard><ReadCard title="Domínio e expansão" icon={<Shield className="h-4 w-4" />}>{sheet.domainExpansion ? <div className="space-y-2"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-amber-200">{sheet.domainExpansion.name || "Expansão sem nome"}</p><span className="text-xs text-stone-500">{sheet.domainExpansion.type} · custo {sheet.domainExpansion.energyCost}</span></div><p className="text-sm leading-6 text-stone-400">{sheet.domainExpansion.effect || "Efeito não informado."}</p><p className="text-xs text-stone-500">Contrajogo: {sheet.domainExpansion.counterplay || "não informado"} · {sheet.domainExpansion.approved ? "aprovado" : "em revisão"}</p></div> : <p className="text-sm text-stone-500">Nenhum domínio registrado.</p>}</ReadCard><ReadCard title="Aliados" icon={<BookOpen className="h-4 w-4" />}><div className="space-y-2">{sheet.allies.length ? sheet.allies.map(ally => <div key={ally.id} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><p className="font-medium text-stone-200">{ally.name} <span className="text-xs font-normal text-stone-500">· {ally.role}</span></p><p className="mt-1 text-xs text-stone-500">PV {ally.healthCurrent}/{ally.healthMaximum} · Defesa {ally.defense} · {ally.bond}</p></div>) : <p className="text-sm text-stone-500">Nenhum aliado registrado.</p>}</div></ReadCard><ReadCard title="Ferramentas amaldiçoadas" icon={<Shield className="h-4 w-4" />}><div className="space-y-2">{sheet.cursedTools.length ? sheet.cursedTools.map(tool => <div key={tool.id} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-stone-200">{tool.name}</p><span className="text-xs text-stone-500">{tool.grade} · custo {tool.costTier}</span></div><p className="mt-1 text-xs text-stone-500">{tool.effect || "Efeito não informado"} · {tool.approved ? "aprovada" : "em revisão"}</p></div>) : <p className="text-sm text-stone-500">Nenhuma ferramenta registrada.</p>}</div></ReadCard></div> : null}
    <ReadCard title="Diário de sessão" icon={<BookOpen className="h-4 w-4" />}><div className="space-y-3">{sheet.diary.length ? sheet.diary.slice(0, 20).map(entry => <div key={entry.id} className="rounded-xl border border-violet-300/10 bg-black/20 p-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium text-stone-200">{entry.title}</p><span className="text-xs text-stone-600">{new Date(entry.at).toLocaleString("pt-BR")}</span></div><p className="mt-1 text-sm leading-6 text-stone-400">{entry.detail}</p></div>) : <p className="text-sm text-stone-500">Nenhum registro na sessão.</p>}</div></ReadCard>
  </div></main>;
}
