import type { FMAttributeKey, FMEquipmentItem, FMSkill } from "./fmTypes";

export type FMSkillCatalogEntry = Pick<FMSkill, "name" | "attribute"> & { id: string; requiresTraining: boolean; complementary: boolean; description: string };

export const FM_SKILL_CATALOG: FMSkillCatalogEntry[] = [
  { id: "acrobatics", name: "Acrobacia", attribute: "dexterity", requiresTraining: false, complementary: false, description: "Agilidade, equilíbrio e escapar de agarrões." },
  { id: "athletics", name: "Atletismo", attribute: "strength", requiresTraining: false, complementary: false, description: "Força, escalada, salto e proezas físicas." },
  { id: "driving", name: "Direção", attribute: "wisdom", requiresTraining: false, complementary: true, description: "Condução e pilotagem segura de veículos." },
  { id: "deception", name: "Enganação", attribute: "presence", requiresTraining: false, complementary: false, description: "Blefar, disfarçar intenções e manipular informações." },
  { id: "sorcery", name: "Feitiçaria", attribute: "intelligence", requiresTraining: true, complementary: false, description: "Conhecimento e prática de energia e feitiços amaldiçoados." },
  { id: "stealth", name: "Furtividade", attribute: "dexterity", requiresTraining: false, complementary: false, description: "Esconder-se, mover-se discretamente e não deixar rastros." },
  { id: "history", name: "História", attribute: "intelligence", requiresTraining: false, complementary: false, description: "Memória de fatos, lugares, pessoas e eventos." },
  { id: "intimidation", name: "Intimidação", attribute: "presence", requiresTraining: false, complementary: false, description: "Coagir e impor presença ameaçadora." },
  { id: "insight", name: "Intuição", attribute: "wisdom", requiresTraining: false, complementary: false, description: "Ler intenções, emoções e comportamento." },
  { id: "investigation", name: "Investigação", attribute: "intelligence", requiresTraining: false, complementary: false, description: "Analisar pistas, cenas e evidências." },
  { id: "medicine", name: "Medicina", attribute: "wisdom", requiresTraining: true, complementary: false, description: "Tratar ferimentos, doenças e primeiros socorros." },
  { id: "occultism", name: "Ocultismo", attribute: "wisdom", requiresTraining: false, complementary: false, description: "Saber sobre fenômenos sobrenaturais e maldições." },
  { id: "craft", name: "Ofício", attribute: "intelligence", requiresTraining: true, complementary: false, description: "Fabricar, reparar e trabalhar com ferramentas." },
  { id: "perception", name: "Percepção", attribute: "wisdom", requiresTraining: false, complementary: false, description: "Notar ameaças, detalhes e presenças." },
  { id: "performance", name: "Performance", attribute: "presence", requiresTraining: false, complementary: false, description: "Atuar, entreter e se apresentar." },
  { id: "persuasion", name: "Persuasão", attribute: "presence", requiresTraining: false, complementary: false, description: "Convencer, negociar e inspirar cooperação." },
  { id: "sleight", name: "Prestidigitação", attribute: "dexterity", requiresTraining: true, complementary: false, description: "Manipulação manual precisa e arrombamento." },
  { id: "survival", name: "Sobrevivência", attribute: "wisdom", requiresTraining: false, complementary: true, description: "Orientação, rastreio e vida em ambientes hostis." },
  { id: "technology", name: "Tecnologia", attribute: "intelligence", requiresTraining: false, complementary: false, description: "Uso e compreensão de dispositivos modernos." },
  { id: "theology", name: "Teologia", attribute: "intelligence", requiresTraining: false, complementary: true, description: "Conhecimento de religiões, ritos e crenças." },
];

type EquipmentCatalogSeed = Omit<FMEquipmentItem, "id" | "equipped" | "notes"> & { id: string; summary: string };

export const FM_EQUIPMENT_CATALOG: EquipmentCatalogSeed[] = [
  { id: "dagger", name: "Adaga", category: "weapon", damage: "1d6", damageType: "Perfurante", range: "6/18 m", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Apunhaladora, arremessável, fineza, leve, marcial", summary: "Arma simples · grupo Faca" },
  { id: "staff", name: "Bastão", category: "weapon", damage: "1d6/1d8", damageType: "Impacto", range: "Corpo a corpo", defenseBonus: 0, weight: 2, spaces: 2, cost: 1, properties: "Amplo, dupla, marcial, versátil", summary: "Arma simples · grupo Bastão" },
  { id: "club", name: "Clava", category: "weapon", damage: "1d8/1d10", damageType: "Impacto", range: "Corpo a corpo", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Versátil", summary: "Arma simples · grupo Bastão" },
  { id: "short-sword", name: "Espada Curta", category: "weapon", damage: "1d6", damageType: "Cortante", range: "Corpo a corpo", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Fineza, leve, marcial", summary: "Arma simples · grupo Espada" },
  { id: "spear", name: "Lança", category: "weapon", damage: "1d6/1d8", damageType: "Perfurante", range: "6/18 m", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Arremessável, estendida, versátil", summary: "Arma simples · grupo Haste" },
  { id: "axe", name: "Machado", category: "weapon", damage: "1d8/1d10", damageType: "Cortante", range: "Corpo a corpo", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Versátil", summary: "Arma simples · grupo Machado" },
  { id: "shortbow", name: "Arco Curto", category: "weapon", damage: "1d6", damageType: "Perfurante", range: "24/48 m", defenseBonus: 0, weight: 2, spaces: 2, cost: 1, properties: "Duas mãos, mortal d10", summary: "Arma simples à distância · grupo Arco" },
  { id: "light-crossbow", name: "Besta Leve", category: "weapon", damage: "1d8", damageType: "Perfurante", range: "24/48 m", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Mortal d10, leve, recarga [1]", summary: "Arma simples à distância · grupo Arco" },
  { id: "javelin", name: "Azagaia", category: "weapon", damage: "1d6", damageType: "Perfurante", range: "12/24 m", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Leve", summary: "Arma simples de arremesso · grupo Dardo" },
  { id: "light-shield", name: "Escudo Leve", category: "shield", damage: "", damageType: "", range: "", defenseBonus: 1, weight: 2, spaces: 2, cost: 1, properties: "RD físico 1; pode impor penalidade de Destreza", summary: "Escudo básico" },
  { id: "common-uniform", name: "Uniforme Comum", category: "uniform", damage: "", damageType: "", range: "", defenseBonus: 0, weight: 0, spaces: 0, cost: 0, properties: "Sem revestimento", summary: "Uniforme inicial" },
  { id: "tool-kit", name: "Kit de Ferramentas", category: "tool", damage: "", damageType: "", range: "", defenseBonus: 0, weight: 1, spaces: 1, cost: 1, properties: "Escolha a área de ofício", summary: "Kit de ferramentas inicial" },
  { id: "talisman", name: "Talismã", category: "special", damage: "", damageType: "", range: "", defenseBonus: 0, weight: 0.5, spaces: 0.5, cost: 1, properties: "Consumível", summary: "Item especial consumível" },
];

export function getSkillCatalogEntry(id: string) { return FM_SKILL_CATALOG.find(entry => entry.id === id) ?? null; }
export function getEquipmentCatalogEntry(id: string) { return FM_EQUIPMENT_CATALOG.find(entry => entry.id === id) ?? null; }
