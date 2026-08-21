# INFINITE WORLDS
# FEITICEIROS & MALDIÇÕES
# CONSOLIDAÇÃO TOTAL DO ECOSSISTEMA
# FICHA + MOTOR DE REGRAS + APTIDÕES + TÉCNICAS + FEITIÇOS + HOMEBREW
# GUIA + FONTES + COMPARTILHAMENTO + REVISÃO + VERSIONAMENTO + COMUNIDADE

============================================================
OBJETIVO GERAL
============================================================

Este trabalho é uma CONSOLIDAÇÃO do projeto existente.

NÃO é uma reconstrução.

Utilizar como BASE PRINCIPAL:

INFINITE WORLDS — CONSOLIDAÇÃO COMPLETA

Incorporar ao projeto atual os recursos definidos nos prompts anteriores,
incluindo o SISTEMA COMPLETO DE TÉCNICAS AMALDIÇOADAS, o SISTEMA DE
APTIDÕES E NÍVEIS DE APTIDÃO, o sistema de Homebrew, compartilhamento,
revisão, votação, fontes, histórico e versionamento.

Adicionar somente aquilo que:

- ainda não existe;
- existe parcialmente;
- está incompleto;
- está implementado incorretamente;
- precisa ser integrado;
- precisa ser ampliado.

NÃO duplicar funcionalidades.

NÃO criar sistemas paralelos.

NÃO criar duas versões da mesma regra.

============================================================
REGRA ABSOLUTA DE CONSOLIDAÇÃO
============================================================

ANTES DE ALTERAR QUALQUER PARTE DO PROJETO:

1. Auditar.
2. Identificar o que já existe.
3. Identificar o que está funcionando.
4. Identificar o que está incompleto.
5. Identificar o que está duplicado.
6. Identificar dependências.
7. Verificar banco de dados.
8. Verificar APIs.
9. Verificar componentes.
10. Verificar persistência.
11. Verificar compartilhamento.
12. Verificar revisão.
13. Verificar histórico.
14. Verificar versionamento.
15. Verificar segurança.
16. Verificar compatibilidade com fichas antigas.
17. Planejar a alteração.
18. Implementar.
19. Testar.
20. Validar.

NÃO começar recriando funcionalidades que já existem.

============================================================
PROIBIÇÕES
============================================================

NÃO:

- reiniciar o projeto;
- recriar a arquitetura;
- substituir sistemas funcionais sem necessidade;
- remover funcionalidades;
- remover dados;
- quebrar fichas antigas;
- apagar histórico;
- apagar versões;
- criar sistemas paralelos;
- duplicar APIs;
- duplicar componentes;
- duplicar regras;
- duplicar tabelas;
- inventar regras do livro;
- apresentar Homebrew como regra oficial;
- considerar uma interface pronta como funcionalidade concluída.

============================================================
REGRA DE CONFLITO
============================================================

Quando duas versões da mesma funcionalidade forem encontradas:

1. manter a mais completa;
2. manter a mais detalhada;
3. manter a mais compatível com a arquitetura atual;
4. manter a mais fiel às regras oficiais;
5. migrar os dados quando necessário;
6. remover duplicação somente após validar que nada será perdido.

============================================================
REGRA DE FONTE
============================================================

O sistema deve diferenciar:

- Oficial;
- Livro;
- Homebrew;
- Comunidade;
- Adaptado;
- Próprio.

NUNCA apresentar conteúdo Homebrew como regra oficial.

NUNCA inventar:

- dano;
- custo;
- alcance;
- duração;
- CD;
- requisito;
- condição;
- progressão;
- limite;
- efeito.

Quando uma regra não puder ser confirmada:

→ marcar como "Regra não verificada".

NÃO inventar um valor para preencher a lacuna.

============================================================
VERSÃO DAS REGRAS
============================================================

O motor deve possuir controle de versão das regras.

Suportar, quando aplicável:

- Feiticeiros & Maldições 2.5.2;
- Feiticeiros & Maldições 3.0;
- Homebrew.

NÃO misturar regras de versões diferentes automaticamente.

Cada ficha deve possuir uma versão de regras.

Exemplo:

Ficha
↓
Sistema de Regras
↓
Versão
↓
Motor correspondente

Quando houver diferença entre versões:

→ utilizar a regra da versão selecionada pela ficha.

============================================================
FASE 0 — AUDITORIA COMPLETA
============================================================

Auditar:

- Banco de Dados;
- Schemas;
- APIs;
- Tipos;
- Componentes;
- Hooks;
- Serviços;
- Persistência;
- Autenticação;
- Autorização;
- Fichas;
- Atributos;
- Aptidões;
- Níveis de Aptidão;
- Técnicas;
- Feitiços;
- Técnicas Máximas;
- Votos;
- Invocações;
- Domínios;
- Equipamentos;
- Treinamentos;
- Homebrews;
- Fontes;
- Modificadores;
- Motor de Regras;
- Compartilhamento;
- Votação;
- Comentários;
- Revisões;
- Histórico;
- Versionamento;
- Segurança;
- Responsividade;
- Testes.

Classificar:

□ Não existe
□ Frontend apenas
□ Backend apenas
□ Parcial
□ Implementado
□ Implementado incorretamente
□ Implementado e validado

------------------------------------------------------------
RESULTADO ESPERADO
------------------------------------------------------------

Gerar diagnóstico contendo:

- módulo;
- status;
- problemas;
- dependências;
- prioridade;
- impacto;
- arquivos envolvidos;
- banco envolvido;
- APIs envolvidas;
- riscos.

============================================================
FASE 1 — MOTOR CENTRAL DE REGRAS
============================================================

Centralizar todos os cálculos.

NÃO espalhar regras pela interface.

Centralizar:

- HP;
- Vida;
- Energia;
- Energia Reversa;
- Defesa;
- Defesa Maciça;
- Ataques;
- Resistências;
- RD;
- Buffs;
- Debuffs;
- Condições;
- Aptidões;
- Técnicas;
- Feitiços;
- Equipamentos;
- Votos;
- Treinamentos;
- modificadores.

Fluxo:

Fonte
↓
Regra
↓
Modificador
↓
Motor
↓
Resultado
↓
Histórico

Todo cálculo deve possuir:

- valor base;
- modificadores;
- valor final;
- origem;
- justificativa;
- fonte;
- histórico.

============================================================
FASE 2 — SISTEMA DE MODIFICADORES
============================================================

Todo bônus e penalidade deve ser rastreável.

Estrutura:

Modifier
↓
Origem
↓
Regra
↓
Aplicação
↓
Resultado

Registrar:

- id;
- atributo;
- valor;
- operação;
- origem;
- sourceId;
- sourceType;
- descrição;
- duração;
- condição;
- status.

VALIDAÇÃO:

□ Todo bônus possui origem.
□ Toda penalidade possui origem.
□ Toda origem possui identificador.
□ Todo valor pode ser auditado.

============================================================
FASE 3 — SISTEMA DE FONTES
============================================================

Toda regra e conteúdo deve possuir origem quando aplicável.

Tipos:

- Oficial;
- Livro;
- Homebrew;
- Comunidade;
- Adaptado;
- Próprio.

Registrar:

- nome;
- autor;
- tipo;
- referência;
- URL;
- versão;
- data;
- status.

============================================================
FASE 4 — SISTEMA DE APTIDÕES
============================================================

IMPLEMENTAR AS APTIDÕES COMO UM SISTEMA DE PROGRESSÃO,
E NÃO COMO UMA LISTA DE HABILIDADES LIVREMENTE COMPRÁVEIS.

Cada Aptidão possui um NÍVEL DE APTIDÃO.

Níveis:

0 → 1 → 2 → 3 → 4 → 5

Nível 0:
Ausência ou domínio mínimo daquela área.

Nível 5:
Máximo de desenvolvimento normal da Aptidão.

============================================================
APTIDÕES
============================================================

Suportar as Aptidões previstas pela versão de regras selecionada.

Exemplo para o sistema correspondente:

- Aura (AU);
- Controle e Leitura (CL);
- Barreira (BAR);
- Domínio (DOM);
- Energia Reversa (ER).

A estrutura deve ser extensível para novas Aptidões quando adicionadas
por conteúdo Homebrew ou versões futuras das regras.

============================================================
NÍVEL DE APTIDÃO
============================================================

O Nível de Aptidão deve estar armazenado diretamente na ficha.

Exemplo:

AU = 2
CL = 1
BAR = 3
DOM = 0
ER = 0

O sistema deve permitir:

- visualizar nível;
- visualizar progressão;
- visualizar requisitos;
- visualizar benefícios;
- visualizar histórico;
- visualizar aumentos disponíveis.

============================================================
PROGRESSÃO DE APTIDÕES
============================================================

O aumento de Aptidão deve estar ligado ao Nível do Personagem.

Para a versão de regras correspondente, nos níveis pares:

2
4
6
8
10
12
14
16
18
20

o personagem recebe a possibilidade de aumentar uma Aptidão elegível.

Nos níveis 10 e 20 aplicar também o aumento adicional previsto
pela regra da versão selecionada.

NÃO implementar essa regra de forma genérica se a versão selecionada
possuir uma progressão diferente.

O motor deve utilizar a tabela de progressão correspondente à versão
das regras da ficha.

============================================================
FLUXO DE AUMENTO
============================================================

Nível do Personagem
↓
Verificar progressão
↓
Verificar aumentos disponíveis
↓
Verificar Aptidões elegíveis
↓
Jogador escolhe Aptidão
↓
Aptidão +1
↓
Verificar limite
↓
Atualizar ficha
↓
Atualizar efeitos dependentes
↓
Registrar histórico
↓
Salvar no banco

============================================================
LIMITES
============================================================

Nenhuma Aptidão pode ultrapassar Nível 5 através da progressão normal.

Bloquear:

5 → 6

O sistema deve impedir automaticamente aumentos inválidos.

============================================================
REQUISITOS DE APTIDÃO
============================================================

Aptidões podem ser utilizadas como requisitos para:

- Feitiços;
- Técnicas;
- Votos;
- Domínios;
- Treinamentos;
- habilidades;
- outros conteúdos.

Exemplos:

ER 1
BAR 3
DOM 2
AU 4

Interpretar como:

"o personagem precisa possuir pelo menos esse nível."

Exemplo:

BAR 3

BAR 0 → NÃO PODE
BAR 1 → NÃO PODE
BAR 2 → NÃO PODE
BAR 3 → PODE
BAR 4 → PODE
BAR 5 → PODE

============================================================
APTIDÕES COM EFEITOS ESCALÁVEIS
============================================================

Quando uma regra determinar efeitos diferentes conforme o Nível
de Aptidão, o motor deve respeitar a tabela específica daquela regra.

Exemplo estrutural:

BAR 1
→ efeito correspondente

BAR 2
→ efeito correspondente

BAR 3
→ efeito correspondente

BAR 4
→ efeito correspondente

BAR 5
→ efeito correspondente

NÃO criar automaticamente bônus numéricos apenas porque a Aptidão
aumentou.

============================================================
HISTÓRICO DE APTIDÕES
============================================================

Registrar:

- personagem;
- Aptidão;
- nível anterior;
- novo nível;
- nível do personagem;
- origem;
- data;
- versão das regras;
- versão da ficha.

Exemplo:

Personagem Nível 6
CL 1 → CL 2
Origem: Progressão de Personagem

============================================================
VALIDAÇÃO DE APTIDÃO
============================================================

Ao aumentar:

□ verificar nível do personagem;
□ verificar aumento disponível;
□ verificar Aptidão elegível;
□ verificar requisitos;
□ verificar limite;
□ atualizar ficha;
□ atualizar efeitos;
□ persistir;
□ registrar histórico.

============================================================
FASE 5 — SISTEMA DE TÉCNICAS AMALDIÇOADAS
============================================================

EXPANDIR o sistema existente.

NÃO recriar o criador de Técnicas se ele já existir.

Preservar:

- Técnicas;
- Biblioteca;
- Compartilhamento;
- Votos;
- Comentários;
- Revisões;
- Histórico;
- Versionamento;
- Compatibilidade.

Fluxo:

Técnica
↓
Conceito
↓
Funcionamento Básico
↓
Atributo
↓
Recursos
↓
Limitações
↓
Feitiço Nível 0
↓
Feitiços Iniciais
↓
Progressão
↓
Técnica Máxima
↓
Votos
↓
Balanceamento
↓
Revisão
↓
Publicação

============================================================
ESTRUTURA DA TÉCNICA
============================================================

Toda Técnica deve suportar:

- Nome;
- Conceito Geral;
- Descrição;
- Identidade Visual;
- Funcionamento Básico;
- Atributo Principal;
- Justificativa;
- Recursos;
- Marcas;
- Invocações;
- Equipamentos;
- Condições;
- Limitações;
- Benefícios;
- Desvantagens;
- Aptidões necessárias;
- Treinamentos;
- Feitiços;
- Técnica Máxima;
- Votos;
- Estratégias;
- Fraquezas;
- Fonte;
- Avaliações;
- Comentários;
- Sugestões;
- Histórico;
- Versionamento;
- Status.

============================================================
FUNCIONAMENTO BÁSICO
============================================================

O Funcionamento Básico é o núcleo da Técnica.

Deve definir:

- essência;
- lógica;
- regra central;
- identidade mecânica;
- identidade narrativa;
- recursos;
- limitações;
- condições;
- possibilidades;
- impossibilidades.

REGRA ABSOLUTA:

Todo Feitiço deve derivar diretamente do Funcionamento Básico.

Não criar Feitiços desconectados da Técnica.

============================================================
FASE 6 — FEITIÇO NÍVEL 0
============================================================

Toda Técnica pode possuir um Feitiço Nível 0.

Deve:

- representar a essência;
- facilitar a narrativa;
- possuir baixo impacto;
- introduzir a mecânica.

Não utilizar Nível 0 para efeitos que pertencem a níveis superiores.

============================================================
FASE 7 — FEITIÇOS INICIAIS
============================================================

Toda Técnica deve poder possuir 2 Feitiços iniciais.

Cada Feitiço deve possuir:

- Nome;
- Nível;
- Tipo;
- Conjuração;
- Alcance;
- Alvo;
- Área;
- Duração;
- Custo;
- Descrição;
- Efeitos;
- Dano;
- Bônus;
- Condições;
- Teste de Ataque;
- Teste de Resistência;
- CD;
- Limitações;
- Requisitos;
- Fonte.

Os Feitiços devem representar aplicações diferentes da mesma Técnica.

============================================================
FASE 8 — PROGRESSÃO DE FEITIÇOS
============================================================

Suportar:

- Nível 0;
- Nível 1;
- Nível 2;
- Nível 3;
- Nível 4;
- Nível 5;
- Técnica Máxima.

Fluxo:

Conceito
↓
Aplicação
↓
Especialização
↓
Domínio
↓
Aprimoramento
↓
Técnica Máxima

A progressão deve expandir possibilidades.

NÃO utilizar somente aumento de dano.

============================================================
FASE 9 — CRIAÇÃO COMPLETA DE TÉCNICAS
============================================================

O sistema deve permitir criar uma Técnica completa.

A criação deve contemplar:

1. Nome;
2. Conceito;
3. Funcionamento Básico;
4. Limitações;
5. Recursos;
6. Atributo;
7. Feitiço Nível 0;
8. Feitiços Iniciais;
9. Feitiços de Nível 1;
10. Feitiços de Nível 2;
11. Feitiços de Nível 3;
12. Feitiços de Nível 4;
13. Feitiços de Nível 5;
14. Técnica Máxima;
15. Votos;
16. Estratégias;
17. Fraquezas;
18. Balanceamento;
19. Fonte.

============================================================
VALIDAÇÃO DA TÉCNICA
============================================================

Antes de publicar:

□ Funcionamento Básico
□ Atributo
□ Recursos
□ Limitações
□ Custos
□ Alcance
□ Área
□ Duração
□ Dano
□ Testes
□ CD
□ Condições
□ Requisitos
□ Aptidões
□ Progressão
□ Sinergias
□ Votos
□ Técnica Máxima
□ Fonte

============================================================
FASE 10 — BALANCEAMENTO
============================================================

Criar analisador automático.

Validar:

- dano;
- alcance;
- área;
- duração;
- custo;
- requisitos;
- condições;
- testes;
- CD;
- sinergias;
- combinações;
- escalabilidade;
- abusos.

Classificar:

🟢 BALANCEADA
🟡 PRECISA DE REVISÃO
🔴 FORA DAS REGRAS

Sempre mostrar:

- problema;
- regra afetada;
- valor atual;
- limite esperado;
- recomendação.

============================================================
FASE 11 — TÉCNICA MÁXIMA
============================================================

Toda Técnica poderá possuir uma Técnica Máxima.

Campos:

- Nome;
- Conceito;
- Requisitos;
- Conjuração;
- Alcance;
- Área;
- Duração;
- Custo;
- Efeito;
- Limitações;
- Consequências;
- Fonte.

A Técnica Máxima deve ser a evolução lógica da Técnica.

============================================================
FASE 12 — TREINAMENTOS
============================================================

Estrutura:

Treinamento
↓
Requisitos
↓
Progressão
↓
Benefícios

Registrar:

- nome;
- descrição;
- requisitos;
- progressão;
- benefícios;
- origem;
- fonte;
- histórico.

============================================================
FASE 13 — HOMEBREW
============================================================

Criar ecossistema completo.

Fluxo:

Categoria
↓
Fonte
↓
Conceito
↓
Estrutura
↓
Requisitos
↓
Efeitos
↓
Revisão
↓
Compartilhamento
↓
Publicação

Permitir:

- Técnicas;
- Feitiços;
- Aptidões;
- Treinamentos;
- Equipamentos;
- Invocações;
- Votos;
- Domínios;
- Poderes.

Todo Homebrew deve possuir identificação clara.

============================================================
FASE 14 — COMPARTILHAMENTO
============================================================

Permitir compartilhamento por link de:

- Fichas;
- Técnicas;
- Feitiços;
- Homebrews;
- outros conteúdos públicos.

Fluxo:

Criador
↓
Publica
↓
Link Público
↓
Visualizador
↓
Vota
↓
Comenta
↓
Sugere alteração
↓
Autor revisa
↓
Aceita/Rejeita
↓
Nova versão
↓
Histórico

Usuários externos NÃO podem editar diretamente.

============================================================
FASE 15 — SISTEMA DE REVISÃO
============================================================

Permitir:

- voto;
- avaliação;
- comentário;
- sugestão;
- relatório;
- recomendação de balanceamento.

Toda sugestão deve registrar:

- autor;
- data;
- campo;
- valor atual;
- valor sugerido;
- justificativa;
- status.

Status:

- Pendente;
- Aceita;
- Rejeitada;
- Incorporada;
- Cancelada.

============================================================
FASE 16 — REVISÃO DE FICHAS
============================================================

O mesmo sistema de revisão deve funcionar para fichas compartilhadas.

Fluxo:

Ficha
↓
Compartilhar
↓
Usuário visualiza
↓
Sugere alteração
↓
Autor recebe sugestão
↓
Aceita/Rejeita
↓
Nova versão
↓
Histórico

Não permitir alteração direta por terceiros.

============================================================
FASE 17 — VOTOS
============================================================

Votos devem possuir estrutura própria.

Registrar:

- nome;
- tipo;
- requisitos;
- benefício;
- restrição;
- custo;
- duração;
- fonte;
- histórico.

O balanceamento deve verificar combinações potencialmente abusivas.

============================================================
FASE 18 — VERSIONAMENTO
============================================================

Toda alteração relevante gera nova versão.

Registrar:

- versão anterior;
- versão atual;
- autor;
- data;
- motivo;
- alterações.

Nunca apagar versões.

Permitir:

- visualizar histórico;
- comparar versões;
- restaurar versões;
- identificar alterações.

============================================================
FASE 19 — GUIA
============================================================

Transformar o Guia em documentação navegável.

Capítulos:

- Introdução;
- Criação de Personagem;
- Atributos;
- Aptidões;
- Progressão;
- Combate;
- Energia;
- Técnicas;
- Feitiços;
- Votos;
- Domínios;
- Equipamentos;
- Invocações;
- Treinamentos;
- Homebrew;
- Campanhas;
- Comunidade.

============================================================
FASE 20 — SEGURANÇA
============================================================

Garantir:

- autenticação;
- autorização;
- proteção de APIs;
- proteção de rotas;
- controle de acesso;
- validação;
- proteção de conteúdo;
- segurança de links públicos;
- proteção contra edição não autorizada.

============================================================
FASE 21 — COMPATIBILIDADE LEGADA
============================================================

Testar:

Ficha Antiga
↓
Carregar
↓
Visualizar
↓
Editar
↓
Salvar
↓
Recarregar

Garantir:

□ Dados preservados
□ Dados novos compatíveis
□ Sem corrupção
□ Sem perda
□ Sem alteração indevida de regras

============================================================
FASE 22 — RESPONSIVIDADE
============================================================

Validar:

□ Desktop
□ Notebook
□ Tablet
□ Mobile

Garantir:

- ausência de overflow;
- formulários funcionais;
- tabelas responsivas;
- menus funcionais;
- abas funcionais;
- modais funcionais;
- navegação consistente.

============================================================
FASE 23 — ORGANIZAÇÃO DA INTERFACE
============================================================

Manter o padrão visual atual.

NÃO criar uma interface completamente diferente sem necessidade.

Organizar informações em abas e seções.

Priorizar:

- Visão Geral;
- Ficha;
- Aptidões;
- Progressão;
- Técnicas;
- Feitiços;
- Equipamentos;
- Treinamentos;
- Histórico;
- Compartilhamento;
- Revisão;
- Fontes.

Evitar páginas excessivamente longas.

============================================================
FASE 24 — TESTES
============================================================

Executar:

- testes unitários;
- testes de integração;
- testes de persistência;
- testes de APIs;
- testes de Aptidões;
- testes de progressão;
- testes de Técnicas;
- testes de Feitiços;
- testes de balanceamento;
- testes de compartilhamento;
- testes de votação;
- testes de revisão;
- testes de versionamento;
- testes de segurança;
- typecheck;
- build.

============================================================
FASE 25 — VALIDAÇÃO FINAL
============================================================

A implementação somente estará concluída quando:

□ Frontend funcionar
□ Backend funcionar
□ Banco funcionar
□ Persistência funcionar
□ Motor de regras funcionar
□ Aptidões funcionarem
□ Progressão funcionar
□ Técnicas funcionarem
□ Feitiços funcionarem
□ Técnica Máxima funcionar
□ Votos funcionarem
□ Treinamentos funcionarem
□ Homebrews funcionarem
□ Fontes funcionarem
□ Compartilhamento funcionar
□ Votação funcionar
□ Revisão funcionar
□ Histórico funcionar
□ Versionamento funcionar
□ Segurança funcionar
□ Responsividade funcionar
□ Testes passarem
□ Typecheck passar
□ Build passar
□ Fichas antigas continuarem funcionando

============================================================
RELATÓRIO FINAL
============================================================

Ao finalizar apresentar:

1. Auditoria realizada;
2. Problemas encontrados;
3. Problemas corrigidos;
4. Funcionalidades novas;
5. Funcionalidades reaproveitadas;
6. Funcionalidades modificadas;
7. Arquitetura final;
8. Banco de dados;
9. Motor de regras;
10. Sistema de Aptidões;
11. Sistema de Progressão;
12. Sistema de Técnicas;
13. Sistema de Feitiços;
14. Técnica Máxima;
15. Balanceamento;
16. Treinamentos;
17. Homebrew;
18. Fontes;
19. Compartilhamento;
20. Votação;
21. Revisão;
22. Histórico;
23. Versionamento;
24. Segurança;
25. Compatibilidade;
26. Responsividade;
27. Testes;
28. Typecheck;
29. Build;
30. Pendências.

============================================================
REGRA FINAL
============================================================

NÃO considerar uma funcionalidade concluída porque:

- aparece na interface;
- o botão existe;
- o formulário abre;
- o frontend funciona;
- o build passou.

Uma funcionalidade somente estará concluída quando:

INTERFACE
+
LÓGICA
+
API
+
BANCO
+
PERSISTÊNCIA
+
VALIDAÇÃO
+
SEGURANÇA
+
TESTES

estiverem funcionando em conjunto.

============================================================
PRIORIDADES ABSOLUTAS
============================================================

1. FIDELIDADE ÀS REGRAS
2. NÃO DUPLICAÇÃO
3. RASTREABILIDADE
4. COMPATIBILIDADE
5. PERSISTÊNCIA
6. SEGURANÇA
7. BALANCEAMENTO
8. USABILIDADE
9. ORGANIZAÇÃO
10. APARÊNCIA

============================================================
ORDEM OBRIGATÓRIA DE EXECUÇÃO
============================================================

AUDITORIA
↓
DIAGNÓSTICO
↓
CORREÇÕES CRÍTICAS
↓
MOTOR DE REGRAS
↓
APTIDÕES
↓
PROGRESSÃO
↓
TÉCNICAS
↓
FEITIÇOS
↓
TÉCNICA MÁXIMA
↓
BALANCEAMENTO
↓
TREINAMENTOS
↓
HOMEBREW
↓
COMPARTILHAMENTO
↓
VOTAÇÃO
↓
REVISÃO
↓
VERSIONAMENTO
↓
SEGURANÇA
↓
TESTES
↓
VALIDAÇÃO FINAL

A cada etapa:

1. verificar o que já existe;
2. reutilizar o que funciona;
3. alterar somente o necessário;
4. testar;
5. validar persistência;
6. validar compatibilidade;
7. continuar.

NÃO avançar ignorando erros da etapa anterior.

============================================================
RESULTADO ESPERADO
============================================================

Entregar um único ecossistema integrado:

INFINITE WORLDS
+
FEITICEIROS & MALDIÇÕES

contendo:

FICHA
+
MOTOR DE REGRAS
+
APTIDÕES
+
PROGRESSÃO
+
TÉCNICAS AMALDIÇOADAS
+
FEITIÇOS
+
TÉCNICAS MÁXIMAS
+
VOTOS
+
DOMÍNIOS
+
INVOCAÇÕES
+
EQUIPAMENTOS
+
TREINAMENTOS
+
HOMEBREW
+
FONTES
+
GUIA
+
COMPARTILHAMENTO
+
VOTAÇÃO
+
REVISÃO
+
HISTÓRICO
+
VERSIONAMENTO
+
BALANCEAMENTO
+
COMUNIDADE

Tudo deve funcionar como um único sistema.

Sem duplicação.

Sem perda de dados.

Sem sistemas paralelos.

Sem quebra de compatibilidade.

Sem inventar regras.

Com rastreabilidade completa das regras e alterações.