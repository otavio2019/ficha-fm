import { ensureFMSpecializationAbilityCatalog, listSeededFMSpecializationAbilities } from "../server/fmSpecializationAbilityCatalog.ts";

await ensureFMSpecializationAbilityCatalog();
const abilities = await listSeededFMSpecializationAbilities();
console.log(`Catálogo oficial de Especialização sincronizado: ${abilities.length} habilidade(s).`);
process.exit(0);
