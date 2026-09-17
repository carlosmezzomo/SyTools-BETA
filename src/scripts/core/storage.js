const EXECUTOR_STORAGE_KEY = "sytools_saved_scripts";
const EXECUTOR_CONFIG_KEY = "sytools_executor_config";

const SYTOOLS_ENV_KEYS = ["sytools_saved_scripts", "sytools_executor_config", "sytools_execution_logs", "sytools_saved_ids", "sytools_folders", "sytools_collapsed_folders", "sytools_executor_last_idx", "sytools_open_tabs", "sytools_class_panel"];
const SYTOOLS_ENV_INDEX_KEY = "sytools_environments";

const SYTOOLS_ENV_ORGS = [
    [/\btjce\b/i, "TJCE"],
    [/\btcepa\b|\btce-pa\b/i, "TCE-PA"],
    [/\bmpce\b/i, "MPCE"],
    [/\bsefaz\b/i, "SEFAZ-PI"]
];
const SYTOOLS_ENV_STAGES = [
    [/\bdev\b|desenv/i, "dev"],
    [/\bhml\b|homolog/i, "homolog"],
    [/\bqa\b/i, "QA"],
    [/\bsandbox\b/i, "sandbox"],
    [/\btest\w*\b/i, "teste"]
];
const SYTOOLS_ENV_LABELS_KEY = "sytools_env_labels";

const SYTOOLS_LEGACY_CLAIM_KEY = "sytools_legacy_claimed";

let _sytoolsStore = {};
let _sytoolsStoreHydrated = false;
let _sytoolsSelectedEnv = null;

function sytoolsStorageArea() {
    try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) return chrome.storage.local;
    } catch (e) {}
    return null;
}

function sytoolsEnvId() {
    try {
        return String(window.location.hostname || "desconhecido").toLowerCase();
    } catch (e) {
        return "desconhecido";
    }
}

function sytoolsEnvLabelAuto(envId) {
    let host = String(envId).toLowerCase();
    let org = null;
    for (let par of SYTOOLS_ENV_ORGS) {
        if (par[0].test(host)) {
            org = par[1];
            break;
        }
    }
    let estagio = null;
    for (let par of SYTOOLS_ENV_STAGES) {
        if (par[0].test(host)) {
            estagio = par[1];
            break;
        }
    }
    if (org) return estagio ? org + " (" + estagio + ")" : org;
    let primeiro = host.split(".")[0];
    return primeiro ? primeiro.toUpperCase() : host;
}

function sytoolsEnvCustomLabels() {
    try {
        return JSON.parse(_sytoolsStore[SYTOOLS_ENV_LABELS_KEY]) || {};
    } catch (e) {
        return {};
    }
}

function sytoolsEnvLabel(envId) {
    let custom = sytoolsEnvCustomLabels()[envId];
    if (custom) return String(custom);
    return sytoolsEnvLabelAuto(envId);
}

function sytoolsRenameEnv(envId, label) {
    let mapa = sytoolsEnvCustomLabels();
    let texto = String(label == null ? "" : label).trim();

    if (texto) mapa[envId] = texto;
    else delete mapa[envId];

    let valor = JSON.stringify(mapa);
    _sytoolsStore[SYTOOLS_ENV_LABELS_KEY] = valor;
    let area = sytoolsStorageArea();
    if (area) {
        try {
            let payload = {};
            payload[SYTOOLS_ENV_LABELS_KEY] = valor;
            area.set(payload);
        } catch (e) {}
    }
}

function sytoolsSelectedEnv() {
    return _sytoolsSelectedEnv || sytoolsEnvId();
}

function sytoolsSetSelectedEnv(envId) {
    _sytoolsSelectedEnv = envId || null;
}

function sytoolsEnvKey(base, envId) {
    return base + "::" + envId;
}

function sytoolsKnownEnvs() {
    let indice = {};
    try {
        indice = JSON.parse(_sytoolsStore[SYTOOLS_ENV_INDEX_KEY]) || {};
    } catch (e) {
        indice = {};
    }

    let ids = {};
    for (let id in indice) ids[id] = true;

    ids[sytoolsEnvId()] = true;

    for (let key in _sytoolsStore) {
        let sep = key.indexOf("::");
        if (sep < 0) continue;
        if (SYTOOLS_ENV_KEYS.indexOf(key.slice(0, sep)) === -1) continue;
        let env = key.slice(sep + 2);
        if (env) ids[env] = true;
    }

    let lista = [];
    for (let id in ids) lista.push({ id: id, label: sytoolsEnvLabel(id) });
    lista.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return lista;
}

async function hydrateSytoolsStore() {
    if (_sytoolsStoreHydrated) return;
    let area = sytoolsStorageArea();
    if (!area) {
        _sytoolsStoreHydrated = true;
        return;
    }

    _sytoolsStore = await new Promise((resolve) => {
        try {
            area.get(null, (r) => resolve(r || {}));
        } catch (e) {
            resolve({});
        }
    });

    let env = sytoolsEnvId();
    let paraGravar = {};
    let paraRemover = [];

    let reivindicante = typeof _sytoolsStore[SYTOOLS_LEGACY_CLAIM_KEY] === "string" ? _sytoolsStore[SYTOOLS_LEGACY_CLAIM_KEY] : null;
    let podeAdotarGlobal = !reivindicante || reivindicante === env;
    let reivindicou = false;

    for (let base of SYTOOLS_ENV_KEYS) {
        let key = sytoolsEnvKey(base, env);

        let local = null;
        try {
            local = localStorage.getItem(base);
        } catch (e) {}
        let global = typeof _sytoolsStore[base] === "string" ? _sytoolsStore[base] : null;

        if (_sytoolsStore[key] !== undefined && _sytoolsStore[key] !== null) {

            let contaminado = !podeAdotarGlobal && global !== null && local === null && _sytoolsStore[key] === global;
            if (!contaminado) continue;
            delete _sytoolsStore[key];
            paraRemover.push(key);
        }

        if (local !== null) {
            _sytoolsStore[key] = local;
            paraGravar[key] = local;
            continue;
        }
        if (podeAdotarGlobal && global !== null) {
            _sytoolsStore[key] = global;
            paraGravar[key] = global;
            reivindicou = true;
        }
    }

    if (reivindicou && !reivindicante) {
        paraGravar[SYTOOLS_LEGACY_CLAIM_KEY] = env;
        _sytoolsStore[SYTOOLS_LEGACY_CLAIM_KEY] = env;
    }
    if (paraRemover.length) {
        try {
            area.remove(paraRemover);
        } catch (e) {}
    }

    let indice = {};
    try {
        indice = JSON.parse(_sytoolsStore[SYTOOLS_ENV_INDEX_KEY]) || {};
    } catch (e) {
        indice = {};
    }

    if (indice[env] === undefined) {
        indice[env] = 1;
        paraGravar[SYTOOLS_ENV_INDEX_KEY] = JSON.stringify(indice);
        _sytoolsStore[SYTOOLS_ENV_INDEX_KEY] = paraGravar[SYTOOLS_ENV_INDEX_KEY];
    }

    if (Object.keys(paraGravar).length) {
        try {
            area.set(paraGravar);
        } catch (e) {}
    }

    try {
        if (chrome.storage.onChanged && !chrome.storage.onChanged.hasListener(_sytoolsOnStorageChanged)) {
            chrome.storage.onChanged.addListener(_sytoolsOnStorageChanged);
        }
    } catch (e) {}

    await hydrateSnippets();

    _sytoolsStoreHydrated = true;
}

const SNIPPETS_KEY = "sytools_snippets";
let _snippetsCache = [];

async function hydrateSnippets() {
    let area = sytoolsStorageArea();
    if (!area) {

        try {
            _snippetsCache = JSON.parse(localStorage.getItem(SNIPPETS_KEY)) || [];
        } catch (e) {
            _snippetsCache = [];
        }
        return;
    }

    let guardado = await new Promise((resolve) => {
        try {
            area.get(SNIPPETS_KEY, (r) => resolve(r && r[SNIPPETS_KEY]));
        } catch (e) {
            resolve(null);
        }
    });

    if (typeof guardado === "string") {
        try {
            _snippetsCache = JSON.parse(guardado) || [];
        } catch (e) {
            _snippetsCache = [];
        }
        return;
    }

    let herdado = [];
    try {
        herdado = JSON.parse(localStorage.getItem(SNIPPETS_KEY)) || [];
    } catch (e) {}
    _snippetsCache = Array.isArray(herdado) ? herdado : [];
    if (_snippetsCache.length) persistirSnippets();
}

function persistirSnippets() {
    let valor = JSON.stringify(_snippetsCache);
    let area = sytoolsStorageArea();
    if (area) {
        try {
            let payload = {};
            payload[SNIPPETS_KEY] = valor;
            area.set(payload);
        } catch (e) {}
    }

    try {
        localStorage.setItem(SNIPPETS_KEY, valor);
    } catch (e) {}
}

function getSnippets() {
    return _snippetsCache.slice();
}

function setSnippets(list) {
    _snippetsCache = Array.isArray(list) ? list : [];
    persistirSnippets();
}

function _sytoolsOnStorageChanged(changes, areaName) {
    if (areaName !== "local") return;
    for (let key in changes) {
        if (changes[key].newValue === undefined) delete _sytoolsStore[key];
        else _sytoolsStore[key] = changes[key].newValue;
    }
}

function sytoolsGetRaw(base, envId) {
    let area = sytoolsStorageArea();
    if (!area) {

        try {
            return localStorage.getItem(base);
        } catch (e) {
            return null;
        }
    }
    let key = sytoolsEnvKey(base, envId || sytoolsSelectedEnv());
    if (Object.prototype.hasOwnProperty.call(_sytoolsStore, key)) return _sytoolsStore[key];
    return null;
}

function sytoolsSetRaw(base, value, envId) {
    let env = envId || sytoolsSelectedEnv();

    if (env === sytoolsEnvId()) {
        try {
            localStorage.setItem(base, value);
        } catch (e) {}
    }
    let area = sytoolsStorageArea();
    if (!area) return;
    let key = sytoolsEnvKey(base, env);
    _sytoolsStore[key] = value;
    try {
        let payload = {};
        payload[key] = value;
        area.set(payload);
    } catch (e) {}
}

function sytoolsRemoveRaw(base, envId) {
    let env = envId || sytoolsSelectedEnv();
    if (env === sytoolsEnvId()) {
        try {
            localStorage.removeItem(base);
        } catch (e) {}
    }
    let area = sytoolsStorageArea();
    if (!area) return;
    let key = sytoolsEnvKey(base, env);
    delete _sytoolsStore[key];
    try {
        area.remove(key);
    } catch (e) {}
}

function getSavedScripts() {
    try {
        return JSON.parse(sytoolsGetRaw(EXECUTOR_STORAGE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveSavedScripts(scripts) {
    sytoolsSetRaw(EXECUTOR_STORAGE_KEY, JSON.stringify(scripts));
}

const NATIVE_RUNNABLE_CLASS_ID = "63ea4feda4bf15419bcd2fc3";
const SCRIPT_TYPE_ID = "63ed104a8b2dca658b0fd4f9";

const EXECUTION_REPORT_CLASS_ID = "680bc947e526424137bc3eda";

const SYDLE_NOTIFICATION_CLASS_ID = "5f89d6ac9795af276dc0b18b";

async function criarNotificacaoSydle(baseUrl, headers, opts) {
    try {
        let apiBase = baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + SYDLE_NOTIFICATION_CLASS_ID;

        let indeterminate = opts.indeterminate !== false;
        let body = {
            recipient: opts.recipient,
            subject: opts.subject,
            contentText: opts.contentText,
            showProgress: true,
            indeterminate: indeterminate,
            progressValue: indeterminate ? null : opts.progressValue || 0,

            oneEvent: true,
            showToast: true,
            redirectObject: opts.redirectObject || null
        };
        let resp = await fetch(apiBase + "/_create", { method: "POST", headers, body: JSON.stringify(body) });
        if (!resp.ok) return null;
        let created = await resp.json();
        return created && created._id ? created._id : null;
    } catch (e) {
        return null;
    }
}

function getNotifRecipient(userObj) {
    if (!userObj) return null;
    let rId = userObj.code || userObj._id || userObj.id || "";
    if (!rId) return null;
    let classId = "000000000000000000000002";
    if (userObj.accessToken && userObj.accessToken.payload && userObj.accessToken.payload._class && userObj.accessToken.payload._class._id) {
        classId = userObj.accessToken.payload._class._id;
    }
    return { _id: rId, _classId: classId };
}

async function atualizarNotificacaoSydle(baseUrl, headers, notificationId, patch) {
    if (!notificationId) return;
    try {
        let apiBase = baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + SYDLE_NOTIFICATION_CLASS_ID;

        let operationsList = Object.keys(patch).map((k) => ({ op: "replace", path: "/" + k, value: patch[k] }));
        let body = { _id: notificationId, _operationsList: operationsList };
        await fetch(apiBase + "/_patch", { method: "POST", headers, body: JSON.stringify(body) });
    } catch (e) {}
}

const FORMAT_SHORTCUT_PADRAO = "shift+alt+f";

const SHORTCUTS_DEFS = [
    { id: "salvar", rotulo: "Salvar script", padrao: "ctrl+s" },
    { id: "executar", rotulo: "Executar script", padrao: "ctrl+enter" },
    { id: "buscar", rotulo: "Buscar / substituir", padrao: "ctrl+f" },
    { id: "comentar", rotulo: "Comentar / descomentar linha", padrao: "ctrl+/" },
    { id: "proximaOcorrencia", rotulo: "Selecionar próxima ocorrência", padrao: "ctrl+d" },
    { id: "renomear", rotulo: "Renomear item selecionado", padrao: "f2" },
    { id: "formatar", rotulo: "Formatar código (Prettier)", padrao: FORMAT_SHORTCUT_PADRAO }
];

function shortcutsPadrao() {
    let out = {};
    SHORTCUTS_DEFS.forEach((d) => (out[d.id] = d.padrao));
    return out;
}

const SYDLE_AUTOCOMPLETE = {
    globals: [
        { texto: "_utils", detalhe: "Utilitários do motor de scripts" },
        { texto: "_input", detalhe: "Dados de entrada do script (formato varia por contexto)" },
        { texto: "_output", detalhe: "Atribua aqui o resultado do script" },
        { texto: "_context", detalhe: "user, request, organization, objectPath, locale, _id, logText, logFile, logObject" },
        { texto: "_system", detalhe: "Objeto de sistema" }
    ],

    utils: [
        { texto: "getMethod", detalhe: "getMethod(_classId, id, nomeMetodo) — chama um método de classe/Runnable" },
        { texto: "log", detalhe: "log(objeto) — grava no log de execução" },
        { texto: "debug", detalhe: "debug(objeto)" },
        { texto: "addErrorMessage", detalhe: "addErrorMessage(message, code)" },
        { texto: "addWarningMessage", detalhe: "addWarningMessage(message, code)" },
        { texto: "addInfoMessage", detalhe: "addInfoMessage(message, code)" },
        { texto: "identityText", detalhe: "identityText(object, separator, multiple...)" },
        { texto: "stringifyAsJson", detalhe: "stringifyAsJson(objeto)" },
        { texto: "calculateNextDate", detalhe: "calculateNextDate(cronExpression)" },
        { texto: "storedAt", detalhe: "storedAt(...)" },
        { texto: "fileCreate", detalhe: "fileCreate(...)" },
        { texto: "fileCreateFromUrl", detalhe: "fileCreateFromUrl(...)" },
        { texto: "environment", detalhe: "string — nome do ambiente atual" },
        { texto: "appInfo", detalhe: "{ version }" },
        { texto: "acl", detalhe: "{ checkPerm, prepareSearch }" },
        { texto: "crypto", detalhe: "{ encode, decode, encrypt, decrypt, standardEncrypt, standardDecrypt, checkOriginalValue }" },
        { texto: "security", detalhe: "{ signature, pdfsignature, certificate, xmlsignature, crypto, token }" },
        { texto: "file", detalhe: "{ createWriter, pdf }" },
        { texto: "class", detalhe: "{ ClassService }" },
        { texto: "object", detalhe: "{ ObjectService, FileService, StreamService, ExhibitionService, DiffService, ClassFields... }" },
        { texto: "connector", detalhe: "{ web, createFormData }" },
        { texto: "indexing", detalhe: "{ reindex, reindexSync }" },
        { texto: "resource", detalhe: "{ isLocked, lock }" },
        { texto: "logging", detalhe: "{ Logger, LoggingEventBuilder, LoggingErrorEventBuilder, Marker }" },
        { texto: "organization", detalhe: "{ ExperimentalFeatures }" },
        { texto: "token", detalhe: "{ generate }" },
        { texto: "toggle", detalhe: "{ Toggle }" },
        { texto: "zip", detalhe: "{ ZipWriter, ZipReader, ZipFolder, ZipImport, JSFileHeader }" },
        { texto: "sybox", detalhe: "{ SyboxAPI, SyboxUtils, Creator, PeerDependency, SyboxRepoConfigs, VersioningInfoOutput }" },
        { texto: "sse", detalhe: "{ Subscriber, SubscriberBuilder, Event, EventBuilder }" },
        { texto: "ResponseHelper", detalhe: "ResponseHelper(...)" }
    ],

    utilsFilhos: {
        acl: ["checkPerm", "prepareSearch"],
        crypto: ["encode", "decode", "encrypt", "decrypt", "standardEncrypt", "standardDecrypt", "checkOriginalValue"],
        security: ["signature", "pdfsignature", "certificate", "xmlsignature", "crypto", "token"],
        file: ["createWriter", "pdf"],
        class: ["ClassService"],
        object: ["StreamService", "ObjectService", "ClassFields", "FileService", "DiffItem", "JSExhibitionOutput", "ExhibitionService", "ReplaceReferenceOutput", "DiffService", "JSValidationResult", "JSLogo", "JSExhibitionValue"],
        connector: ["web", "createFormData"],
        indexing: ["reindex", "reindexSync"],
        resource: ["isLocked", "lock"],
        logging: ["LoggingEventBuilder", "LoggingErrorEventBuilder", "Marker", "Logger"],
        organization: ["ExperimentalFeatures"],
        token: ["generate"],
        toggle: ["Toggle"],
        zip: ["ZipWriter", "JSFileHeader", "ZipFolder", "ZipReader", "ZipImport"],
        sybox: ["PeerDependency", "SyboxUtils", "SyboxAPI", "VersioningInfoOutput", "Creator", "SyboxRepoConfigs"],
        sse: ["SubscriberBuilder", "EventBuilder", "Subscriber", "Event"]
    },

    context: ["user", "request", "organization", "objectPath", "locale", "_id", "logText", "logFile", "logObject"]
};

function getExecutorConfig() {
    try {

        let c = JSON.parse(sytoolsGetRaw(EXECUTOR_CONFIG_KEY, sytoolsEnvId()));
        if (c && c.objetoId) {

            let shortcuts = Object.assign(shortcutsPadrao(), c.shortcuts || {});
            if (c.formatShortcut) shortcuts.formatar = c.formatShortcut;
            return {
                classeId: NATIVE_RUNNABLE_CLASS_ID,
                objetoId: c.objetoId,
                clickInsertEditor: c.clickInsertEditor !== false,

                insertFormatted: c.insertFormatted === true,
                formatShortcut: shortcuts.formatar,
                autocompleteEnabled: c.autocompleteEnabled !== false,

                diffAntesPublicar: c.diffAntesPublicar === true,
                shortcuts: shortcuts
            };
        }
    } catch (e) {}
    return {
        classeId: NATIVE_RUNNABLE_CLASS_ID,
        objetoId: "",
        clickInsertEditor: true,
        insertFormatted: false,
        formatShortcut: FORMAT_SHORTCUT_PADRAO,
        autocompleteEnabled: true,
        diffAntesPublicar: false,
        shortcuts: shortcutsPadrao()
    };
}

function teclaEventoParaNome(e) {
    let k = e.key;
    if (k === " ") return "space";
    if (k.length === 1) return k.toLowerCase();

    return k.toLowerCase();
}

function atalhoParaTexto(e) {

    let partes = [];
    if (e.ctrlKey) partes.push("ctrl");
    if (e.shiftKey) partes.push("shift");
    if (e.altKey) partes.push("alt");
    if (e.metaKey) partes.push("meta");
    let tecla = teclaEventoParaNome(e);

    if (["control", "alt", "shift", "meta"].indexOf(tecla) !== -1) return null;
    partes.push(tecla);
    return partes.join("+");
}

function atalhoParaExibicao(texto) {
    if (!texto) return "";
    return texto
        .split("+")
        .map((p) => (p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
        .join("+");
}

function atalhoBateComEvento(textoSalvo, e) {
    if (!textoSalvo) return false;
    let atual = atalhoParaTexto(e);
    return !!atual && atual === textoSalvo;
}

function saveExecutorConfig(cfg) {
    sytoolsSetRaw(EXECUTOR_CONFIG_KEY, JSON.stringify(cfg), sytoolsEnvId());
}

const EXECUTION_LOGS_KEY = "sytools_execution_logs";
const EXECUTION_LOGS_MAX = 10;

function getExecutionLogs() {
    try {
        return JSON.parse(sytoolsGetRaw(EXECUTION_LOGS_KEY, sytoolsEnvId())) || [];
    } catch (e) {
        return [];
    }
}

function addExecutionLog(entry) {
    let logs = getExecutionLogs();
    logs.unshift(entry);
    if (logs.length > EXECUTION_LOGS_MAX) logs = logs.slice(0, EXECUTION_LOGS_MAX);
    sytoolsSetRaw(EXECUTION_LOGS_KEY, JSON.stringify(logs), sytoolsEnvId());
    return logs;
}

const SYTOOLS_ABRE = { "(": ")", "[": "]", "{": "}" };
const SYTOOLS_FECHA = { ")": "(", "]": "[", "}": "{" };

const SYTOOLS_REGEX_APOS = ["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "case", "do", "else", "yield", "await", "throw"];

function sytoolsAnalyzeSyntax(code) {
    if (!code || !code.trim()) return null;

    let pilha = [];
    let linha = 1;
    let inicioLinha = 0;
    let quote = null;
    let quoteLinha = 0;
    let quoteCol = 0;
    let template = false;
    let templateLinha = 0;
    let templateCol = 0;
    let bloco = false;
    let blocoLinha = 0;
    let blocoCol = 0;
    let comentario = false;
    let regex = false;
    let tokenAnterior = "";

    for (let i = 0; i < code.length; i++) {
        let ch = code[i];
        let prox = code[i + 1];
        let col = i - inicioLinha;

        if (comentario) {
            if (ch === "\n") {
                comentario = false;
                linha++;
                inicioLinha = i + 1;
            }
            continue;
        }
        if (bloco) {
            if (ch === "*" && prox === "/") {
                bloco = false;
                i++;
            } else if (ch === "\n") {
                linha++;
                inicioLinha = i + 1;
            }
            continue;
        }
        if (quote) {

            if (ch === "\\") {
                i++;
                if (code[i] === "\n") {
                    linha++;
                    inicioLinha = i + 1;
                }
                continue;
            }
            if (ch === quote) {
                quote = null;
                continue;
            }
            if (ch === "\n") return { line: quoteLinha, column: quoteCol, length: Math.max(1, col - quoteCol), message: "String não terminada" };
            continue;
        }
        if (template) {
            if (ch === "\\") {
                i++;
                continue;
            }
            if (ch === "`") template = false;
            else if (ch === "\n") {
                linha++;
                inicioLinha = i + 1;
            }
            continue;
        }
        if (regex) {
            if (ch === "\\") {
                i++;
                continue;
            }
            if (ch === "/") regex = false;
            else if (ch === "\n") {
                regex = false;
                linha++;
                inicioLinha = i + 1;
            }
            continue;
        }

        if (ch === "\n") {
            linha++;
            inicioLinha = i + 1;
            continue;
        }
        if (ch === "/" && prox === "/") {
            comentario = true;
            i++;
            continue;
        }
        if (ch === "/" && prox === "*") {
            bloco = true;
            blocoLinha = linha;
            blocoCol = col;
            i++;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            quoteLinha = linha;
            quoteCol = col;
            continue;
        }
        if (ch === "`") {
            template = true;
            templateLinha = linha;
            templateCol = col;
            continue;
        }
        if (ch === "/") {
            let depoisDeValor = /[a-zA-Z0-9_$)\]]$/.test(tokenAnterior) && SYTOOLS_REGEX_APOS.indexOf(tokenAnterior) === -1;
            if (!depoisDeValor) {
                regex = true;
                continue;
            }
        }

        if (SYTOOLS_ABRE[ch]) {
            pilha.push({ ch: ch, linha: linha, col: col });
        } else if (SYTOOLS_FECHA[ch]) {
            if (!pilha.length) return { line: linha, column: col, length: 1, message: 'Fechamento "' + ch + '" sem abertura correspondente' };
            let topo = pilha.pop();
            if (topo.ch !== SYTOOLS_FECHA[ch]) {
                return { line: linha, column: col, length: 1, message: 'Esperado "' + SYTOOLS_ABRE[topo.ch] + '" para fechar a abertura da linha ' + topo.linha + ', encontrado "' + ch + '"' };
            }
        }

        if (/[a-zA-Z0-9_$]/.test(ch)) {
            let j = i;
            while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
            tokenAnterior = code.slice(i, j);
            i = j - 1;
        } else if (!/\s/.test(ch)) {
            tokenAnterior = ch;
        }
    }

    if (bloco) return { line: blocoLinha, column: blocoCol, length: 2, message: "Comentário de bloco não fechado" };
    if (template) return { line: templateLinha, column: templateCol, length: 1, message: "Template literal não terminado" };
    if (quote) return { line: quoteLinha, column: quoteCol, length: 1, message: "String não terminada" };
    if (pilha.length) {
        let aberto = pilha[pilha.length - 1];
        return { line: aberto.linha, column: aberto.col, length: 1, message: 'Abertura "' + aberto.ch + '" nunca é fechada' };
    }
    return null;
}

function splitScriptName(name) {
    let full = String(name == null ? "" : name);
    let dot = full.lastIndexOf(".");
    if (dot <= 0) return { base: full, ext: "" };
    return { base: full.slice(0, dot), ext: full.slice(dot) };
}

function getExtIcon(name) {
    if (!name) return { icon: "ðŸ“„", color: "#888" };
    let ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    let map = {
        js: { icon: "JS", color: "#f7df1e", textColor: "#000" },
        json: { icon: "{}", color: "#5b9bd5" },
        sql: { icon: "SQL", color: "#e38c00" },
        py: { icon: "PY", color: "#3776ab" },
        ts: { icon: "TS", color: "#3178c6" },
        md: { icon: "MD", color: "#083fa1" },
        txt: { icon: "TXT", color: "#888" },
        xml: { icon: "XML", color: "#e44d26" },
        css: { icon: "CSS", color: "#264de4" },
        html: { icon: "HTML", color: "#e44d26" },
        sh: { icon: "SH", color: "#4eaa25" }
    };
    return map[ext] || { icon: ext.toUpperCase() || "ðŸ“„", color: "#888" };
}
