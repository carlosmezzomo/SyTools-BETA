const COMMANDS_MAP = {
    "Deletar objeto": cmdDeleteObject,
    "Copiar listagem": cmdCopyListing,
    "Copiar JSON por referência": cmdCopyFieldIds,
    "Copiar IDs filtrado": cmdCopyFilteredIds,
    "Executor de scripts": cmdExecuteScript,
    "Remover objetos": cmdRemoveObjects,
    "Comparar histórico": cmdCompareHistory,
    "Listar objetos da classe": cmdListObjectsFromActive,
    "Reverter objetos": cmdRevertObjects,
    "sytools-open-result": cmdOpenPendingResult
};

async function cmdOpenPendingResult(monitorId) {
    window.__sytoolsPendingOpenResult = monitorId;
    await cmdExecuteScript();
}

function initializeCommands() {
    chrome.runtime.onMessage.addListener((message) => {
        if (!message.parameters) {
            COMMANDS_MAP[message.action]();
            return;
        }

        COMMANDS_MAP[message.action].apply(this, message.parameters);
    });
}
