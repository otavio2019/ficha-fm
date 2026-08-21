import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FMObservationEntityType } from "@shared/fmTypes";
import { FilePenLine, Loader2, Plus, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

export type EditableObservationProps = {
  entityType: FMObservationEntityType;
  entityId: string;
  value?: string;
  canEdit: boolean;
  onSave: (value: string) => void | Promise<void>;
  label?: string;
  placeholder?: string;
  className?: string;
};

/** Campo único para notas curtas de entidades. A persistência pertence ao callback da entidade. */
export function EditableObservation({ entityType, entityId, value = "", canEdit, onSave, label = "Observações", placeholder = "Adicione uma observação…", className = "" }: EditableObservationProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!editing) setDraft(value); }, [editing, value]);
  const cancel = () => { setDraft(value); setEditing(false); };
  const save = async () => { setSaving(true); try { await onSave(draft.trim()); setEditing(false); toast.success("Observação atualizada."); } catch { toast.error("Não foi possível salvar a observação."); } finally { setSaving(false); } };
  return <section data-observation-entity={`${entityType}:${entityId}`} className={`rounded-xl border border-violet-300/12 bg-black/20 p-3 ${className}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300/70">{label}</p>{!editing && value ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-300">{value}</p> : !editing ? <p className="mt-1 text-xs leading-5 text-stone-500">Nenhuma observação registrada.</p> : null}</div>{canEdit && !editing ? <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)} className="border-violet-300/20 text-violet-100">{value ? <FilePenLine className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}{value ? "Editar" : "Adicionar observação"}</Button> : null}</div>{editing ? <div className="mt-3 space-y-3"><Textarea autoFocus value={draft} onChange={event => setDraft(event.target.value)} placeholder={placeholder} className="min-h-24 border-violet-300/20 bg-[#0b0711] text-stone-100 placeholder:text-stone-600" /><div className="flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={saving} onClick={cancel} className="border-violet-300/20 text-stone-300"><X className="mr-1.5 h-3.5 w-3.5" />Cancelar</Button><Button type="button" size="sm" disabled={saving} onClick={() => void save()} className="bg-amber-300 text-[#190d07] hover:bg-amber-200">{saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Salvar</Button></div></div> : null}</section>;
}
