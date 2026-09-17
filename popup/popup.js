function sendCommand(command) {
    try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0] || !tabs[0].id) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: command }).catch(() => {});
        });
    } catch (error) {}
}

function openShortcuts() {
    chrome.tabs.create({
        url: 'chrome://extensions/shortcuts',
        active: true
    });
}

document.getElementById('delete-object-button').addEventListener('click', () => {
    sendCommand('Deletar objeto');
});

document.getElementById('copy-listing-button').addEventListener('click', () => {
    sendCommand('Copiar listagem');
});

document.getElementById('copy-field-ids-button').addEventListener('click', () => {
    sendCommand('Copiar JSON por referência');
});

document.getElementById('copy-filtered-ids-button').addEventListener('click', () => {
    sendCommand('Copiar IDs filtrado');
});

document.getElementById('execute-script-button').addEventListener('click', () => {
    sendCommand('Executor de scripts');
});

document.getElementById('remove-objects-button').addEventListener('click', () => {
    sendCommand('Remover objetos');
});

document.getElementById('compare-history-button').addEventListener('click', () => {
    sendCommand('Comparar histórico');
});

document.getElementById('revert-objects-button').addEventListener('click', () => {
    sendCommand('Reverter objetos');
});

document.getElementById('shortcuts-button').addEventListener('click', openShortcuts);
