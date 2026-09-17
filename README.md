# SyTools - Kit de Ferramentas para Sydle ONE

> **BETA** — Versão em fase de testes. Funcionalidades podem mudar sem aviso prévio.

Extensão de produtividade para Google Chrome/Microsoft Edge que adiciona ferramentas diretamente na interface da plataforma Sydle ONE.

## Sobre

O **SyTools** é uma extensão baseada no **Manifest V3** que automatiza tarefas repetitivas de manipulação de objetos, exportação de dados e execução de scripts no Sydle ONE, reduzindo significativamente o tempo gasto em operações manuais.

**Versão:** 0.1.2-beta

**Domínios suportados:** `*.sydle.one` | `sydle.sefaz.pi.gov.br` | `*.tcepa.tc.br` | `*.tjce.jus.br`

## Funcionalidades

### Deletar Objeto Ativo (Alt+Q)

Remove o objeto atualmente aberto na tela, com diálogo de confirmação.

### Copiar Listagem (JSONs)

Exporta objetos da listagem ativa como JSON com filtros avançados:

- Filtros por usuário de criação/alteração
- Filtros por data (criação, última alteração)
- Filtros por campos de referência (com nomes resolvidos automaticamente)
- Filtros por texto (query_string)
- Filtros booleanos (com/sem endDate, com/sem externalCode)
- Entrada manual opcional (array de IDs ou JSON)
- Contagem dinâmica de objetos em tempo real ao combinar filtros

### Copiar JSON por Referência

Coleta IDs de um campo de referência e busca os objetos correspondentes em outra classe:

1. **Filtrar objetos** — seleciona quais objetos participam da coleta
2. **Campo de referência** — seleciona qual campo terá os IDs extraídos
3. **Classe de destino** — busca os IDs na classe alvo com filtros adicionais

### Copiar IDs Filtrado

Busca avançada com filtros e múltiplos formatos de saída:

- Array JSON, um por linha, separado por vírgula, com aspas, ou resumo consolidado

### Executor de Scripts

IDE completa integrada ao navegador:

- Editor com syntax highlighting e numeração de linhas
- CTRL+F / Replace com highlight de matches
- Tab/Shift+Tab para indentar/desindentar (com suporte a Ctrl+Z)
- Busca de objetos por classe com resolução de nomes
- Gerenciamento de IDs salvos (favoritos, agrupamento por classe)
- Backup e restore completo de scripts, pastas e configurações
- Configuração de toggle para comportamento de clique (inserir no editor vs copiar)
- Bloqueio de execução até configurar o Objeto Executor
- Criação automática do executor com nome personalizado (SyTools Executor - [Nome])

### Painel de Classes (aba dentro do Executor de Scripts)

Explora e edita classes do Sydle ONE sem sair do navegador:

- Busca de classe por nome ou por ID (24 hex) direto na metaclasse genérica
- Lista de classes favoritas, salvas por ambiente
- Exibe campos e métodos (editáveis e nativos), com opção de ocultar itens
- Editor de método integrado (highlight, gutter, checagem de sintaxe)
- Salvar publica via fluxo draft → publish, editando o método por substituição de string (nunca reenvia a classe inteira)
- Detecção de conflito: se outra sessão publicou por cima enquanto o editor estava aberto, avisa e exige confirmação antes de sobrescrever

### Comparar Histórico (Alt+H)

Visualiza alterações entre revisões de um objeto com diff visual:

- Algoritmo LCS (Longest Common Subsequence) para diff de scripts
- Unified diff: mostra apenas blocos alterados com contexto
- Resolução de nomes de referências via API
- Objetos embutidos expandidos campo a campo
- Scripts exibidos completos quando não houve alteração
- Revisões numeradas (#1 = mais antiga, #N = mais recente)
- Cores GitHub (vermelho = removido, verde = adicionado)
- Mensagem quando executor não está configurado
- **Botão "Reverter"** — reverte o objeto ativo para a revisão selecionada (com confirmação)

### Reverter Objetos

Reversão em massa de objetos para uma revisão anterior:

- Seleção por filtros combinados (mesmo sistema de filtros dos demais comandos)
- Seleção por lista de IDs (colar array, IDs por linha ou separados por vírgula)
- Versão anterior (-1) ou versão específica (número da revisão)
- Processamento em batch com progresso visual
- Relatório de sucesso/erros ao finalizar
- Contagem dinâmica de objetos conforme filtros são combinados

### Remover Objetos

Exclusão em massa com filtros de segurança:

- Por campo específico, usuário de criação ou todos os objetos

### Listar Objetos da Classe

Abre diretamente a listagem de objetos da classe do objeto ativo, sem modal ou input. Navegação instantânea.

### Download e Backup

Permite o usuário transferir o localStorage através de um arquivo JSON:

- Download inclui scripts salvos, IDs salvos, pastas e configurações
- Upload restaura tudo automaticamente no novo ambiente
- Compatível entre diferentes ambientes Sydle ONE

## Compatibilidade Multi-Ambiente

O SyTools funciona em qualquer ambiente Sydle ONE independente da configuração de autenticação:

- Detecta automaticamente o namespace
- Compatível com ambientes que usam SSO corporativo ou login tradicional

## Instalação

1. Clone ou baixe este repositório
2. Abra o seu navegador e procure pelas extensões
3. Ative o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **Carregar sem compactação**
5. Selecione a pasta raiz deste projeto
6. A extensão **SyTools** aparecerá na barra de ferramentas

## Atalhos de Teclado

Configuráveis em `chrome://extensions/shortcuts`

| Funcionalidade             | Atalho padrão | Descrição                                            |
| -------------------------- | ------------- | ---------------------------------------------------- |
| Deletar Objeto             | `Alt+Q`       | Remove o objeto ativo com confirmação                |
| Comparar Histórico         | `Alt+H`       | Diff visual com revisão anterior                     |
| Listar Objetos da Classe   | —             | Abre a listagem de objetos da classe do objeto atual |
| Copiar Listagem            | —             | Exporta JSONs da listagem ativa                      |
| Copiar JSON por Referência | —             | Coleta IDs por referência entre classes              |
| Copiar IDs Filtrado        | —             | Busca IDs com filtros avançados                      |
| Executor de Scripts        | —             | IDE integrada para scripts                           |
| Reverter Objetos           | —             | Reversão em massa para revisão anterior              |
| Remover Objetos            | —             | Remoção em massa com filtros                         |

## Tecnologias

- **Chrome Manifest V3** — Arquitetura moderna de extensões
- **SweetAlert2** — Diálogos interativos
- **jQuery / jQuery UI** — Componentes de interface
- **JavaScript** — Lógica de negócio e integração com API Sydle ONE

## Dúvidas e Sugestões

Qualquer eventual dúvida, meu Teams está disponível para retirar dúvidas e aceitas sugestões

## Privacidade

A extensão **não coleta, armazena ou transmite dados pessoais** para servidores externos. Todos os dados (scripts, IDs, configurações) são armazenados localmente no navegador via `localStorage` e `chrome.storage.local`. A extensão só opera em domínios Sydle ONE.

## Autor

**Carlos Mezzomo**

## Agradecimentos

Aos colegas que confiaram e acreditaram neste projeto desde o início:

- **Israel Teixeira**
- **Gustavo Paiva**

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).
