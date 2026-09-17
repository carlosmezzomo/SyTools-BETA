chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0] || !tabs[0].id) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: command }).catch(() => {});
    });
});

const MONITOR_ALARM_PREFIX = "sytools-monitor-";
const MONITOR_MAX_MINUTES = 60;

function _extractProgressCountsBg(obj) {
    if (!obj || typeof obj !== "object") return null;
    const keys = [
        "ok", "criadas", "criados", "corrigidas", "atualizadas", "atualizados",
        "simulacao", "jaExiste", "jaEstavaCerto", "colaboradorNaoEncontrado",
        "erro", "erros", "totalParfunc", "totalConsignacoes"
    ];
    let found = {};
    let any = false;
    for (const k of keys) {
        if (typeof obj[k] === "number") {
            found[k] = obj[k];
            any = true;
        }
    }
    return any ? found : null;
}

async function _getMonitor(monitorId) {
    const store = await chrome.storage.session.get(monitorId);
    return store[monitorId] || null;
}

async function _setMonitor(monitorId, data) {
    await chrome.storage.session.set({ [monitorId]: data });
}

async function _clearMonitor(monitorId) {
    await chrome.storage.session.remove(monitorId);
    try {
        await chrome.alarms.clear(MONITOR_ALARM_PREFIX + monitorId);
    } catch (e) {}
}

async function startBackgroundMonitor(payload) {
    const { monitorId, reportApiBase, token, objetoId, dispatchedAtIso, scriptText, scriptLabel, tabUrl, notificationId, notificationApiBase, execScriptName } = payload;
    const startedAt = Date.now();
    await _setMonitor(monitorId, {
        reportApiBase, token, objetoId, dispatchedAtIso, scriptText, scriptLabel, tabUrl,
        notificationId, notificationApiBase, execScriptName,
        startedAt, done: false
    });
    chrome.alarms.create(MONITOR_ALARM_PREFIX + monitorId, { periodInMinutes: 1 });
}

async function _atualizarNotificacaoSydle(monitor, patch) {
    if (!monitor.notificationId || !monitor.notificationApiBase) return;
    try {
        const headers = { "Content-Type": "application/json", Authorization: "Bearer " + monitor.token };
        const operationsList = Object.keys(patch).map((k) => ({ op: "replace", path: "/" + k, value: patch[k] }));
        const body = { _id: monitor.notificationId, _operationsList: operationsList };
        await fetch(monitor.notificationApiBase + "/_patch", { method: "POST", headers, body: JSON.stringify(body) });
    } catch (e) {}
}

const RESULTS_STORAGE_KEY = "sytools_pending_results";

async function _savePendingResult(monitorId, data) {
    const store = await chrome.storage.local.get(RESULTS_STORAGE_KEY);
    const results = store[RESULTS_STORAGE_KEY] || {};
    results[monitorId] = data;
    await chrome.storage.local.set({ [RESULTS_STORAGE_KEY]: results });
}

async function getPendingResult(monitorId) {
    const store = await chrome.storage.local.get(RESULTS_STORAGE_KEY);
    return (store[RESULTS_STORAGE_KEY] || {})[monitorId] || null;
}

async function clearPendingResult(monitorId) {
    const store = await chrome.storage.local.get(RESULTS_STORAGE_KEY);
    const results = store[RESULTS_STORAGE_KEY] || {};
    delete results[monitorId];
    await chrome.storage.local.set({ [RESULTS_STORAGE_KEY]: results });
}

async function stopBackgroundMonitor(monitorId) {
    await _clearMonitor(monitorId);
}

async function checkMonitor(monitorId) {
    const monitor = await _getMonitor(monitorId);
    if (!monitor) {
        try {
            await chrome.alarms.clear(MONITOR_ALARM_PREFIX + monitorId);
        } catch (e) {}
        return;
    }
    if (monitor.done) {
        await _clearMonitor(monitorId);
        return;
    }

    const elapsedMinutes = (Date.now() - monitor.startedAt) / 60000;

    try {
        const headers = { "Content-Type": "application/json", Authorization: "Bearer " + monitor.token };

        const searchResp = await fetch(monitor.reportApiBase + "/_search", {
            method: "POST",
            headers,
            body: JSON.stringify({
                size: 10,
                query: {
                    bool: {
                        must: [
                            { term: { "runnable._id": monitor.objetoId } },
                            { range: { startDate: { gte: monitor.dispatchedAtIso } } }
                        ]
                    }
                },
                sort: [{ startDate: "desc" }]
            })
        });
        if (searchResp.ok) {
            const searchJson = await searchResp.json();
            const hits = (searchJson.hits && searchJson.hits.hits) || [];
            let report = null;
            for (const hit of hits) {
                const candidate = hit._source || hit;
                if (candidate.input && candidate.input.script === monitor.scriptText) {
                    report = candidate;
                    break;
                }
            }
            if (report && report.status !== "RUNNING") {
                const pollResult = report.output && report.output.result;
                const resultadoRaw = pollResult && String(pollResult).trim()
                    ? pollResult
                    : JSON.stringify({ status: report.status, aviso: "Execução finalizada sem output.result" });
                await _finishMonitor(monitorId, monitor, resultadoRaw);
                return;
            }
        }
    } catch (e) {

    }

    if (elapsedMinutes >= MONITOR_MAX_MINUTES) {
        await _timeoutMonitor(monitorId, monitor);
        return;
    }

    monitor.lastCheckAt = Date.now();
    await _setMonitor(monitorId, monitor);
}

async function _finishMonitor(monitorId, monitor, resultadoRaw) {
    monitor.done = true;
    await _setMonitor(monitorId, monitor);

    let title = "Execução concluída";
    let message = monitor.scriptLabel || "Script finalizado.";
    try {
        const parsed = JSON.parse(resultadoRaw);
        const resumo = parsed && (parsed.resumo || parsed);
        const counts = _extractProgressCountsBg(resumo);
        if (counts) {
            message = Object.keys(counts).map((k) => k + ": " + counts[k]).join(" • ");
        }
    } catch (e) {}

    await _savePendingResult(monitorId, {
        ok: true,
        resultadoRaw,
        scriptLabel: monitor.scriptLabel,
        tabUrl: monitor.tabUrl,
        objetoId: monitor.objetoId,
        finishedAt: Date.now()
    });

    chrome.runtime.sendMessage({ action: "sytools-monitor-finished", monitorId, resultadoRaw }).catch(() => {});

    await _atualizarNotificacaoSydle(monitor, {
        subject: "Concluído: " + (monitor.execScriptName || monitor.scriptLabel || "Script"),
        contentText: message,
        showProgress: false,
        indeterminate: false,
        progressValue: 100,
        oneEvent: true
    });

    await _clearMonitor(monitorId);
}

async function _timeoutMonitor(monitorId, monitor) {
    monitor.done = true;
    await _setMonitor(monitorId, monitor);

    await _savePendingResult(monitorId, {
        ok: false,
        scriptLabel: monitor.scriptLabel,
        tabUrl: monitor.tabUrl,
        objetoId: monitor.objetoId,
        finishedAt: Date.now()
    });

    await _atualizarNotificacaoSydle(monitor, {
        subject: "Sem resposta: " + (monitor.execScriptName || monitor.scriptLabel || "Script"),
        contentText: "Não retornou resultado em 60 minutos. Confira o objeto executor diretamente.",
        showProgress: false,
        indeterminate: false,
        progressValue: 0,
        oneEvent: true
    });

    chrome.runtime.sendMessage({ action: "sytools-monitor-timeout", monitorId }).catch(() => {});

    await _clearMonitor(monitorId);
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name.startsWith(MONITOR_ALARM_PREFIX)) return;
    const monitorId = alarm.name.substring(MONITOR_ALARM_PREFIX.length);
    checkMonitor(monitorId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;

    if (message.action === "sytools-start-monitor") {
        startBackgroundMonitor(message.payload).then(() => sendResponse({ ok: true }));
        return true;
    }

    if (message.action === "sytools-stop-monitor") {
        stopBackgroundMonitor(message.monitorId).then(() => sendResponse({ ok: true }));
        return true;
    }

    if (message.action === "sytools-consume-pending-result") {
        getPendingResult(message.monitorId).then((result) => {
            if (result) clearPendingResult(message.monitorId);
            sendResponse({ result });
        });
        return true;
    }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
    let monitorId = null;
    if (notificationId.startsWith("sytools-done-")) monitorId = notificationId.substring("sytools-done-".length);
    else if (notificationId.startsWith("sytools-timeout-")) monitorId = notificationId.substring("sytools-timeout-".length);
    if (!monitorId) return;

    chrome.notifications.clear(notificationId);

    const result = await getPendingResult(monitorId);
    if (!result) return;

    const targetUrl = result.tabUrl;
    let targetTab = null;

    if (targetUrl) {
        try {
            const origin = new URL(targetUrl).origin;
            const tabs = await chrome.tabs.query({ url: origin + "/*" });
            if (tabs && tabs.length) targetTab = tabs[0];
        } catch (e) {}
    }

    if (!targetTab) {
        if (targetUrl) {
            targetTab = await chrome.tabs.create({ url: targetUrl });

            await new Promise((r) => setTimeout(r, 2500));
        } else {
            return;
        }
    } else {
        await chrome.tabs.update(targetTab.id, { active: true });
        await chrome.windows.update(targetTab.windowId, { focused: true });
    }

    chrome.tabs.sendMessage(targetTab.id, { action: "sytools-open-result", parameters: [monitorId] }).catch(() => {});
});
