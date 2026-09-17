(function() {
    function injectStylesheet(file, parent) {
        let link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL(file);
        parent.appendChild(link);
    }

    injectStylesheet('lib/jquery-ui.min.css', document.getElementsByTagName('head')[0]);
    injectStylesheet('src/styles/styles.css', document.getElementsByTagName('head')[0]);

    if (typeof initializeCommands === 'function') {
        initializeCommands();
    } else {
        console.warn('[SyTools] initializeCommands not ready, retrying...');
        setTimeout(() => {
            if (typeof initializeCommands === 'function') initializeCommands();
            else console.error('[SyTools] initializeCommands not found');
        }, 500);
    }

    if (typeof loadClassTree === 'function') {
        loadClassTree();
    }
})();
