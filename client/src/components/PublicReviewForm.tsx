import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-stone-300"><span>{label}</span>{children}{hint ? <span className="text-xs font-normal leading-5 text-stone-500">{hint}</span> : null}</label>;
}

export function PublicReviewForm({ token, targetName }: { token: string; targetName: string }) {
  const [reviewerName, setReviewerName] = useState("");
  const [kind, setKind] = useState<"general" | "suggestion" | "comment">("suggestion");
  const [section, setSection] = useState("Avaliação geral");
  const [field, setField] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [suggestedValue, setSuggestedValue] = useState("");
  const [reason, setReason] = useState("");
  const submit = trpc.reviews.submit.useMutation();
  const onSubmit = async () => {
    try {
      await submit.mutateAsync({ token, reviewerName, kind, section, field, currentValue, suggestedValue, reason });
      toast.success("Avaliação enviada ao proprietário.");
      setField(""); setCurrentValue(""); setSuggestedValue(""); setReason("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar a avaliação."); }
  };
  return <section className="rounded-2xl border border-amber-300/20 bg-[#150d20] p-5 sm:p-6"><div className="flex gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><MessageSquarePlus className="h-4 w-4" /></span><div><p className="font-display text-xs uppercase tracking-[.2em] text-amber-300/70">Avaliação e revisão</p><h2 className="mt-1 font-display text-2xl text-stone-100">Sugerir alteração</h2><p className="mt-2 text-sm leading-6 text-stone-400">Envie uma avaliação sobre “{targetName}”. O proprietário recebe a sugestão e decide se aceita, recusa ou implementa; este formulário nunca edita o original.</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Seu nome"><Input value={reviewerName} onChange={event => setReviewerName(event.target.value)} placeholder="Como deseja ser identificado" /></Field><Field label="Tipo"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="suggestion">Sugestão de alteração</option><option value="general">Avaliação geral</option><option value="comment">Comentário</option></select></Field><Field label="Seção"><Input value={section} onChange={event => setSection(event.target.value)} placeholder="Ex.: Atributos, Técnica ou Equipamentos" /></Field>{kind === "suggestion" ? <Field label="Campo específico"><Input value={field} onChange={event => setField(event.target.value)} placeholder="Ex.: Força, Custo ou Contrajogo" /></Field> : null}<Field label="Valor atual" hint="Opcional; útil para apontar campos específicos."><Input value={currentValue} onChange={event => setCurrentValue(event.target.value)} placeholder="Ex.: 14" /></Field>{kind === "suggestion" ? <Field label="Valor ou alteração sugerida"><Input value={suggestedValue} onChange={event => setSuggestedValue(event.target.value)} placeholder="Ex.: 16 ou descrição da alteração" /></Field> : null}<Field label="Motivo / comentário"><Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Explique o motivo, o problema percebido ou a melhoria sugerida." /></Field></div><div className="mt-5 flex flex-col gap-3 border-t border-violet-300/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-stone-500">Aceitar não edita o conteúdo. Somente o proprietário pode fazer a alteração e depois marcá-la como implementada.</p><Button type="button" disabled={submit.isPending || !reviewerName.trim() || !section.trim() || (kind === "suggestion" && !field.trim()) || !reason.trim()} onClick={onSubmit} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">{submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enviar avaliação</Button></div></section>;
}
