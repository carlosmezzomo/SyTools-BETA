# Changelog

Todas as mudanças notáveis do SyTools serão documentadas neste arquivo.

---

## [0.1.2-beta] - 2026-09-17

### Arquitetura

- **Refatoração modular completa** — O monólito `commandHandler.js` (~5950 linhas) foi substituído por módulos especializados:
  - `core/ui.js` — Componentes visuais reutilizáveis (modais, barra de progresso, diálogos)
  - `core/sydle-api.js` — Camada de integração com a API Sydle ONE
  - `core/storage.js` — Gerenciamento de storage (localStorage + chrome.storage)
  - `core/filtros.js` — Sistema de filtros avançados compartilhado entre ferramentas
  - `core/diff.js` — Algoritmo LCS e renderização de diff visual
  - `tools/listagem.js` — Copiar Listagem / Copiar JSON por Referência / Copiar IDs
  - `tools/objetos.js` — Remover Objetos / Reverter Objetos
  - `tools/comparar-historico.js` — Comparar Histórico (diff visual)
  - `executor/executor.js` — IDE/Executor de Scripts + Painel de Classes
  - `commands.js` — Mapeamento centralizado de comandos

### Novos recursos

- **Painel de Classes** — Explorar e editar classes do Sydle ONE direto no navegador
  - Busca por nome ou ID (24 hex)
  - Classes favoritas salvas por ambiente
  - Editor de método integrado com highlight, gutter e checagem de sintaxe
  - Publicação via fluxo draft → publish com detecção de conflito
- **Sandbox de checagem de sintaxe** — Verificação JS/TS integrada ao editor (`sandbox/syntax-check.html`)
- **Monitoramento de execução em background** — Acompanha scripts longos via Service Worker
  - Polling com `chrome.alarms` a cada minuto
  - Notificações nativas do Chrome ao finalizar
  - Persistência de resultados pendentes entre sessões
  - Integração com notificações Sydle ONE via API
- **Formatação automática de código** — Prettier integrado ao editor (JS/TS)

### Novas bibliotecas

- `lib/typescript.min.js` — TypeScript 5.4 (checagem de tipos)
- `lib/prettier/standalone.js` + `babel.js` + `estree.js` — Formatação automática

### Novas permissões

- `alarms` — Monitoramento de execuções em background
- `notifications` — Notificações nativas do Chrome
- `tabs` — Gerenciamento de abas para resultados

### Novo domínio

- `*.tjce.jus.br` — Tribunal de Justiça do Ceará

### Melhorias

- Privacidade: documentado uso de `chrome.storage.local` além de `localStorage`
- README formatado com espaçamento entre seções e tabela de atalhos alinhada
- Seção de agradecimentos adicionada ao README

---

## [0.1.1-beta] - Release inicial

- Deletar Objeto Ativo (Alt+Q)
- Copiar Listagem com filtros avançados
- Copiar JSON por Referência entre classes
- Copiar IDs Filtrado com múltiplos formatos de saída
- Executor de Scripts (IDE integrada ao navegador)
- Comparar Histórico com diff visual (Alt+H)
- Reverter Objetos em massa
- Remover Objetos em massa
- Listar Objetos da Classe (navegação instantânea)
- Download e Backup de configurações via JSON
- Compatibilidade multi-ambiente com detecção automática de namespace
