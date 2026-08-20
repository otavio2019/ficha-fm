# Arquitetura inicial — Ficha F&M

A aplicação será uma web app React com tRPC, autenticação Manus e banco MySQL/TiDB fornecidos pelo projeto. Cada ficha pertence a uma conta e guarda seu estado de jogo em JSON validado no backend, enquanto metadados que precisam de consulta eficiente — propriedade, nome, retrato, criação, atualização e token público — permanecem em tabelas próprias.

| Domínio | Responsabilidade | Estratégia |
|---|---|---|
| `shared/fmRules.ts` | Fórmulas, limites e rolagens puras de F&M. | Sem dependência de React; testado por Vitest. |
| `shared/fmTypes.ts` | Modelo da ficha, itens, perícias, feitiços, ataques e eventos de diário. | Valores seguros para evolução de ficha. |
| `drizzle/schema.ts` | Tabelas `fm_characters` e `fm_character_shares`. | Propriedade por usuário e token público único. |
| `server/db.ts` | Operações de biblioteca, leitura pública e compartilhamento. | Dados retornados sem transformação de regras. |
| `server/routers.ts` | Contratos protegidos de CRUD e contrato público somente leitura. | Autoriza sempre pelo `ownerId`. |
| `server/live.ts` | Salas por personagem e por token público. | Emite aviso de atualização após salvamento autorizado. |
| `client/src/pages/Home.tsx` | Biblioteca e editor por abas da ficha privada. | Salvamento com feedback de sincronização e controles acessíveis. |
| `client/src/pages/SharedCharacter.tsx` | Rota pública simplificada em modo somente leitura. | Atualiza dados quando receber evento da sala pública. |

O projeto usará os padrões de biblioteca, persistência, links públicos e atualização ao vivo validados na ficha GURPS 4E apenas como referência arquitetural. Nenhum atributo, fórmula, catálogo ou texto de GURPS será reutilizado.

