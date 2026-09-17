async function cmdExecuteScript() {
    await hydrateSytoolsStore();
    let existing = document.getElementById("sytools-executor-overlay");
    if (existing) {
        existing.style.display = "flex";
        return;
    }

    let _tk = getValidSydleToken();
    let token = _tk.token;
    let tokenStorage = _tk.storage;
    let baseUrl = window.location.origin;
    let cfg = getExecutorConfig();

    if (cfg.objetoId && token) {
        try {
            let checkResp = await fetch(baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + NATIVE_RUNNABLE_CLASS_ID + "/_get/" + cfg.objetoId + "?accessToken=" + token, {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }
            });
            if (!checkResp.ok) {
                cfg.objetoId = "";
                saveExecutorConfig({ objetoId: "" });
            }
        } catch (e) {
            cfg.objetoId = "";
            saveExecutorConfig({ objetoId: "" });
        }
    }

    let _getIconUrl = (name) => (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL("icons/" + name) : "");
    let iconAddFile = _getIconUrl("add-file.png");
    let iconAddFolder = _getIconUrl("add-folder.png");
    let iconDelete = _getIconUrl("delete.png");
    let iconPlay = _getIconUrl("play-button.png");
    let iconEdit = _getIconUrl("edit.png");

    const SAVED_IDS_KEY = "sytools_saved_ids";
    function getSavedIds() {
        try {
            return JSON.parse(sytoolsGetRaw(SAVED_IDS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }
    function setSavedIds(ids) {
        sytoolsSetRaw(SAVED_IDS_KEY, JSON.stringify(ids));
    }

    let css = `<style>
        .se-root { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: left; display: flex; gap: 0; height: 92vh; }
        .se-sidebar {
            width: 240px; min-width: 210px; background: #1e1e1e; border-radius: 10px 0 0 10px;
            display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;
        }

        .se-envbar {
            display: flex; align-items: center; gap: 6px; padding: 0 10px;
            height: 38px; box-sizing: border-box; flex-shrink: 0;
            background: #252526; border-bottom: 1px solid #333;
            border-radius: 10px 0 0 0;
        }
        .se-sidebar-actions {
            display: flex; align-items: center; justify-content: flex-end; gap: 6px;
            padding: 8px 10px 2px; flex-shrink: 0;
        }
        .se-sidebar-action {
            cursor: pointer; padding: 3px 5px; line-height: 1;
            display: flex; align-items: center; border-radius: 4px;
        }
        .se-env-select {
            flex: 1; width: 100%; min-width: 0; background: #2d2d2d; color: #ddd; border: 1px solid #3f3f3f;
            border-radius: 5px; padding: 5px 6px; font-size: 12px; font-weight: 600;
            font-family: inherit; outline: none; cursor: pointer;
        }
        .se-env-select:hover { border-color: #555; }
        .se-env-select:focus { border-color: #1C3C2E; }

        .se-env-select.se-env-outro { border-color: #b8860b; color: #f0c674; }
        .se-sidebar-list { flex: 1; overflow-y: auto; padding: 6px 0; }
        .se-sidebar-item {
            display: flex; align-items: center; gap: 10px; padding: 8px 16px; cursor: pointer;
            color: #ccc; font-size: 13px; border-left: 3px solid transparent; user-select: none;
        }
        .se-sidebar-item:hover { background: #2a2d2e; color: #fff; }
        .se-sidebar-item.se-active { background: #37373d; color: #fff; border-left-color: #1C3C2E; }
        .se-sidebar-item.se-new-item {
            background: #1C3C2E; color: #fff; font-style: normal; font-weight: 600;
            border-left-color: transparent; border-radius: 6px; margin: 4px 8px; padding: 10px 14px;
        }
        .se-sidebar-item.se-new-item:hover { background: #2a5a42; }
        .se-sidebar-item.se-new-item .se-file-icon { color: #fff; background: transparent; }
        .se-sidebar-folder {
            padding: 8px 12px; cursor: pointer; color: #aaa; font-size: 13px; font-weight: 600;
            display: flex; align-items: center; gap: 8px; user-select: none;
        }
        .se-sidebar-folder:hover { background: #2a2d2e; color: #fff; }
        .se-sidebar-folder .se-folder-arrow { font-size: 10px; transition: transform 0.15s; width: 12px; text-align: center; }
        .se-sidebar-folder .se-folder-arrow.se-open { transform: rotate(90deg); }
        .se-sidebar-folder .se-folder-icon { font-size: 14px; }
        .se-sidebar-folder-items { padding-left: 18px; }
        .se-sidebar-folder-items.se-collapsed { display: none; }
        .se-sidebar-item.se-drag-over { border-top: 2px solid #1C3C2E; }
        .se-sidebar-folder.se-drag-over-folder { background: #2a3a30; outline: 1.5px dashed #1C3C2E; }
        .se-sidebar-item .se-file-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 26px; height: 18px; border-radius: 3px; font-size: 9px; font-weight: 800;
            letter-spacing: -0.3px; flex-shrink: 0;
        }
        .se-sidebar-item .se-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .se-inline-rename {
            flex: 1; min-width: 0; box-sizing: border-box; padding: 1px 4px;
            background: #313131; color: #ccc; border: 1px solid #007fd4; border-radius: 2px;
            outline: none; font-family: inherit; font-size: 13px; font-weight: 400;
        }
        .se-inline-rename.se-inline-invalid { border-color: #be1100; }
        .se-inline-error {
            margin: 0 16px 4px 16px; padding: 3px 7px; font-size: 11px; line-height: 1.4;
            color: #f48771; background: #5a1d1d; border: 1px solid #be1100; border-top: none;
        }
        .se-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .se-topbar { display: flex; align-items: center; background: #252526; border-radius: 0 10px 0 0; }
        .se-tab {
            padding: 10px 20px; font-size: 13px; font-weight: 600; color: #888; cursor: pointer;
            border-bottom: 2px solid transparent; background: transparent;
        }
        .se-tab:hover { color: #ccc; }
        .se-tab.se-tab-active { color: #fff; border-bottom-color: #1C3C2E; background: #1e1e1e; }
        .se-tab-content { display: none; flex: 1; flex-direction: column; overflow: hidden; min-height: 0; }
        .se-tab-content.se-tab-visible { display: flex; }
        .se-editor-panel { flex: 1; display: flex; flex-direction: column; background: #1e1e1e; padding: 0; min-height: 0; }
        .se-editor-toolbar { display: flex; gap: 8px; align-items: stretch; background: #252526; flex-shrink: 0; }

        .se-editor-tabs { display: flex; align-items: stretch; flex: 1; min-width: 0; overflow-x: auto; min-height: 35px; }
        .se-editor-tabs::-webkit-scrollbar { height: 3px; }
        .se-editor-tabs::-webkit-scrollbar-thumb { background: #4a4a4a; }
        .se-etab {
            display: flex; align-items: center; gap: 7px; padding: 0 8px 0 11px;
            font-size: 13px; color: #969696; background: #2d2d2d;
            border-right: 1px solid #252526; border-top: 1px solid transparent;
            cursor: pointer; white-space: nowrap; max-width: 240px; flex-shrink: 0; user-select: none;
        }
        .se-etab:hover { background: #333334; }
        .se-etab.se-etab-active { background: #1e1e1e; color: #fff; border-top-color: #1C3C2E; }
        .se-etab-name { overflow: hidden; text-overflow: ellipsis; }
        .se-etab .se-file-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 22px; height: 15px; border-radius: 3px; font-size: 8px; font-weight: 800;
            letter-spacing: -0.3px; flex-shrink: 0;
        }
        .se-etab-close {
            width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px; line-height: 1; color: inherit; opacity: 0;
        }
        .se-etab:hover .se-etab-close, .se-etab-active .se-etab-close { opacity: 0.75; }
        .se-etab-close:hover { background: rgba(255, 255, 255, 0.13); opacity: 1; }

        .se-etab-dirty { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .se-etab-dirty::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .se-etab:hover .se-etab-dirty { display: none; }
        .se-etab-empty { display: flex; align-items: center; padding: 0 14px; font-size: 12px; color: #6b6b6b; font-style: italic; }
        .se-name-input {
            padding: 6px 12px; border: 1.5px solid #444; border-radius: 6px; font-size: 13px;
            background: #1e1e1e; color: #d4d4d4; flex: 1;
        }
        .se-name-input:focus { border-color: #1C3C2E; outline: none; }
        .se-btn {
            padding: 6px 14px; border: 1.5px solid #555; border-radius: 6px; background: #333;
            color: #ddd; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
        }
        .se-btn:hover { background: #444; }
        .se-btn-save { background: #1C3C2E; color: #fff; border-color: #1C3C2E; }
        .se-btn-save:hover { background: #2a5a42; }
        .se-btn-danger { background: #e74c3c; color: #fff; border-color: #e74c3c; }
        .se-btn-danger:hover { background: #c0392b; }
        .se-btn-run { background: #27ae60; color: #fff; border-color: #27ae60; font-size: 13px; }
        .se-btn-run:hover { background: #219a52; }
        .se-btn-run:disabled { background: #555; border-color: #555; cursor: not-allowed; color: #888; }
        .se-editor-area { flex: 1; position: relative; overflow: hidden; display: flex; min-height: 0; }
        .se-gutter {
            width: 48px; flex-shrink: 0; background: #1e1e1e; border-right: 1px solid #333;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 13px; line-height: 1.6; padding: 14px 0; color: #555;
            text-align: right; overflow: hidden; user-select: none; box-sizing: border-box;
            white-space: pre;
        }
        .se-gutter-inner { padding-right: 12px; white-space: pre; }
        .se-gutter-erro { color: #f14c4c; font-weight: 700; }
        .se-highlight-wrap { flex: 1; position: relative; overflow: hidden; min-height: 0; }

        .se-autocomplete {
            position: absolute; z-index: 6; min-width: 220px; max-width: 380px; max-height: 220px;
            overflow-y: auto; background: #252526; border: 1px solid #454545; border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4); font-size: 12.5px;
        }
        .se-autocomplete-item { display: flex; flex-direction: column; gap: 1px; padding: 5px 10px; cursor: pointer; }
        .se-autocomplete-item:hover, .se-autocomplete-item.se-ac-active { background: #094771; }
        .se-autocomplete-item-texto { color: #d4d4d4; font-family: 'Cascadia Code', 'Consolas', monospace; }
        .se-autocomplete-item-texto b { color: #6b9bd1; font-weight: 700; }
        .se-autocomplete-item-detalhe { color: #999; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .se-highlight-pre, .se-editor-ta, .se-error-layer, .se-indent-guides {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 13px; line-height: 1.6; padding: 14px 16px; margin: 0;
            tab-size: 4; white-space: pre; overflow: auto; box-sizing: border-box;
            border: none; outline: none;
            font-variant-ligatures: none; font-kerning: none;
            font-feature-settings: "liga" 0, "clig" 0, "calt" 0;
            letter-spacing: normal; word-spacing: normal;
        }
        .se-highlight-pre { pointer-events: none; z-index: 1; color: #d4d4d4; background: transparent; }
        .se-editor-ta { z-index: 2; color: transparent; caret-color: #d4d4d4; background: transparent; resize: none; }

        .se-indent-guides {
            color: transparent; background: transparent;
            pointer-events: none; z-index: 0; overflow: hidden;
        }
        .se-indent-guides::-webkit-scrollbar { width: 0; height: 0; }

        .se-indent-guide { border-left: 1px solid rgba(255,255,255,0.08); }

        .se-find-highlight-layer {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 13px; line-height: 1.6; padding: 14px 16px; margin: 0;
            tab-size: 4; white-space: pre; overflow: auto; box-sizing: border-box;
            border: none; font-variant-ligatures: none; font-kerning: none;
            font-feature-settings: "liga" 0, "clig" 0, "calt" 0;
            letter-spacing: normal; word-spacing: normal;
            color: transparent; background: transparent;
            pointer-events: none; z-index: 0.5; overflow: hidden;
        }
        .se-find-highlight-layer::-webkit-scrollbar { width: 0; height: 0; }
        .se-find-match { background: rgba(255, 200, 0, 0.35); border-radius: 2px; }
        .se-find-match-atual { background: rgba(255, 150, 0, 0.65); }

        .se-error-layer {
            color: transparent; background: transparent;
            pointer-events: none; z-index: 3;
            overflow: hidden;
        }

        .se-highlight-pre::-webkit-scrollbar, .se-error-layer::-webkit-scrollbar { width: 0; height: 0; }

        .se-error-ruler {
            position: absolute; top: 0; right: 0; width: 12px; height: 100%;
            z-index: 4; background: rgba(0, 0, 0, 0.18);
        }
        .se-error-ruler-tick {
            position: absolute; right: 1px; width: 10px; height: 3px;
            background: #f14c4c; border-radius: 1px; cursor: pointer;
        }
        .se-error-ruler-tick:hover { background: #ff7b72; height: 5px; }

        .se-error-underline {
            background-repeat: repeat-x; background-position: left bottom;
            background-size: 6px 3px;
            background-image: url("data:image/svg+xml;charset=utf8,<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='M0 2.5 L1.5 1 L3 2.5 L4.5 1 L6 2.5' stroke='%23f14c4c' fill='none' stroke-width='1'/></svg>");
        }
        .se-editor-ta::selection { background: rgba(38, 79, 120, 0.6); }
        .se-hl-cm { color: #6a9955; font-style: italic; }
        .se-hl-st { color: #ce9178; }
        .se-hl-kw { color: #569cd6; }
        .se-hl-nm { color: #b5cea8; }

        .se-run-bar { display: flex; gap: 8px; align-items: center; padding: 6px 16px; background: #252526; flex-shrink: 0; }
        .se-panel-tabs { display: flex; align-items: stretch; gap: 2px; flex-shrink: 0; }
        .se-ptab {
            display: flex; align-items: center; gap: 6px; padding: 5px 12px;
            font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
            color: #8a8a8a; cursor: pointer; border-radius: 5px; user-select: none;
            border-bottom: 2px solid transparent;
        }
        .se-ptab:hover { color: #ccc; background: #2f2f30; }
        .se-ptab.se-ptab-active { color: #fff; border-bottom-color: #1C3C2E; background: #2f2f30; }
        .se-ptab-badge {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
            font-size: 10px; font-weight: 700; background: #3a3a3a; color: #bbb;
        }
        .se-ptab-badge.se-ptab-badge-erro { background: #5a1d1d; color: #f48771; }

        .se-panel-body { display: flex; flex-direction: column; height: 160px; min-height: 40px; flex-shrink: 0; }
        .se-panel-hidden { display: none !important; }

        .se-problems {
            flex: 1; min-height: 0; overflow-y: auto; background: #1e1e1e; padding: 6px 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12.5px;
        }
        .se-problem {
            display: flex; align-items: baseline; gap: 8px; padding: 3px 16px;
            color: #ccc; cursor: pointer; line-height: 1.6; white-space: nowrap;
        }
        .se-problem:hover { background: #2a2d2e; }
        .se-problem-icon { color: #f14c4c; font-weight: 700; flex-shrink: 0; }
        .se-problem-msg { overflow: hidden; text-overflow: ellipsis; }

        .se-problem-pos { color: #6b9bd1; font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 11.5px; flex-shrink: 0; }

        .se-problem-msg { flex: 1; }
        .se-problem-fix {
            flex-shrink: 0; padding: 1px 8px; border-radius: 4px; border: 1px solid #2a5a42;
            background: #1C3C2E; color: #9fd8b8; font-size: 11px; font-weight: 600; cursor: pointer;
        }
        .se-problem-fix:hover { background: #2a5a42; color: #fff; }
        .se-problems-empty { padding: 10px 16px; color: #6b6b6b; font-size: 12.5px; font-style: italic; }
        .se-status { font-size: 12px; padding: 3px 10px; border-radius: 6px; font-weight: 600; }
        .se-status-idle { background: #333; color: #888; }
        .se-status-running { background: #4a3f00; color: #f39c12; }
        .se-status-done { background: #1a3a2a; color: #27ae60; }
        .se-status-error { background: #3a1a1a; color: #e74c3c; }
        .se-output-bar { display: flex; gap: 8px; align-items: center; padding: 6px 16px; background: #252526; border-top: 1px solid #333; }
        .se-resizer {
            height: 6px; background: #333; cursor: ns-resize; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center; user-select: none;
        }
        .se-resizer:hover, .se-resizer.se-resizing { background: #1C3C2E; }
        .se-resizer::after { content: ''; width: 40px; height: 2px; background: #666; border-radius: 1px; }
        .se-output {
            flex: 1; min-height: 0; padding: 12px 16px; background: #1e1e1e; color: #d4d4d4;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 12px; line-height: 1.5; white-space: pre-wrap; overflow-y: auto;
            border-radius: 0 0 10px 0;
        }
        .se-config-panel { padding: 24px; background: #1e1e1e; flex: 1; border-radius: 0 0 10px 0; overflow-y: auto; }
        .se-config-panel h3 { color: #d4d4d4; font-weight: 500; }
        .se-config-group { margin-bottom: 20px; }
        .se-config-label { display: block; font-size: 14px; font-weight: 500; color: #d4d4d4; margin-bottom: 6px; }
        .se-config-input {
            width: 100%; padding: 10px 14px; border: 1.5px solid #444; border-radius: 8px;
            font-size: 14px; background: #252526; color: #d4d4d4; box-sizing: border-box;
            font-family: 'Cascadia Code', 'Consolas', monospace; line-height: 1.4;
        }
        .se-config-input:focus { border-color: #1C3C2E; outline: none; }
        .se-config-hint { font-size: 12px; color: #d4d4d4; margin-top: 4px; }

        .se-btn-config {
            padding: 10px 18px; border: 1.5px solid #555; border-radius: 8px; background: #333;
            color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
            box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1.4; vertical-align: middle;
        }
        .se-btn-config:hover { background: #444; }
        .se-btn-config.se-btn-save { background: #1C3C2E; border-color: #1C3C2E; }
        .se-btn-config.se-btn-save:hover { background: #2a5a42; }

        .se-shortcuts-list { display: flex; flex-direction: column; gap: 8px; }

        .se-shortcut-row { display: grid; grid-template-columns: 230px 200px 80px 46px; gap: 10px; align-items: center; }
        .se-shortcut-label { color: #d4d4d4; font-size: 13px; }
        .se-shortcut-row .se-config-input { width: auto; }

        .se-shortcut-save { padding: 10px 4px; width: 100%; box-sizing: border-box; text-align: center; }
        .se-shortcut-reset { padding: 10px 4px; width: 100%; box-sizing: border-box; text-align: center; }
        @media (max-width: 640px) {
            .se-shortcut-row { grid-template-columns: 1fr; }
        }
        .se-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
        .se-toggle input { opacity: 0; width: 0; height: 0; }
        .se-toggle-slider {
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background: #555; border-radius: 22px; transition: background 0.2s;
        }
        .se-toggle-slider::before {
            content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px;
            background: #fff; border-radius: 50%; transition: transform 0.2s;
        }
        .se-toggle input:checked + .se-toggle-slider { background: #1C3C2E; }
        .se-toggle input:checked + .se-toggle-slider::before { transform: translateX(18px); }
        .se-confirm-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1070;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
        }
        .se-confirm-box {
            background: #252526; border-radius: 12px; padding: 28px 32px; min-width: 360px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5); text-align: center;
            font-family: -apple-system, sans-serif; color: #d4d4d4;
        }
        .se-confirm-box h3 { margin: 0 0 8px; font-size: 17px; color: #fff; }
        .se-confirm-box p { margin: 0 0 20px; font-size: 14px; color: #aaa; }
        .se-confirm-btns { display: flex; gap: 10px; justify-content: center; }
        .se-confirm-btns button {
            padding: 8px 22px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none;
        }
        .se-confirm-stay { background: #1C3C2E; color: #fff; }
        .se-confirm-stay:hover { background: #2a5a42; }
        .se-confirm-leave { background: #e74c3c; color: #fff; }
        .se-confirm-leave:hover { background: #c0392b; }
        .se-out-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1080;
            background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        }
        .se-out-modal {
            width: 85vw; max-width: 1100px; height: 75vh; background: #1e1e1e; border-radius: 12px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden;
        }
        .se-out-modal-header {
            display: flex; align-items: center; padding: 14px 20px; background: #252526;
            border-bottom: 1px solid #333;
        }
        .se-out-modal-header h3 { margin: 0; font-size: 15px; color: #ddd; flex: 1; }
        .se-out-modal-body {
            flex: 1; padding: 20px; overflow-y: auto;
            font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
            font-size: 13px; line-height: 1.6; color: #d4d4d4; white-space: pre-wrap;
        }
        .se-out-k { color: #9cdcfe; }
        .se-out-s { color: #ce9178; }
        .se-out-n { color: #b5cea8; }
        .se-out-b { color: #569cd6; font-weight: 700; }
        .se-out-null { color: #666; font-style: italic; }
        .se-out-brace { color: #888; }
        .se-ids-panel { flex: 1; display: flex; flex-direction: column; background: #1e1e1e; border-radius: 0 0 10px 0; overflow: hidden; }
        .se-ids-toolbar { display: flex; gap: 8px; align-items: center; padding: 12px 16px; background: #252526; border-bottom: 1px solid #333; flex-wrap: wrap; }

        .se-ids-subtabs { display: flex; gap: 2px; padding: 8px 16px 0; background: #252526; border-bottom: 1px solid #333; }
        .se-ids-subtab {
            padding: 7px 14px; font-size: 12px; color: #999; cursor: pointer;
            border-bottom: 2px solid transparent; user-select: none;
        }
        .se-ids-subtab:hover { color: #ccc; }
        .se-ids-subtab-active { color: #fff; border-bottom-color: #1C3C2E; font-weight: 600; }
        .se-ids-list { flex: 1; overflow-y: auto; padding: 6px 0; }
        .se-ids-group-header {
            padding: 10px 16px 6px; font-size: 11px; font-weight: 700; color: #fff;
            text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #2a2a2a;
            display: flex; align-items: center; gap: 8px;
        }
        .se-ids-group-header span { flex: 1; }
        .se-ids-item {
            display: flex; align-items: center; gap: 8px; padding: 7px 16px 7px 28px; cursor: pointer;
            font-size: 12px; color: #ccc;
        }
        .se-ids-item:hover { background: #2a2d2e; }
        .se-ids-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .se-ids-item-id {
            font-family: 'Cascadia Code', monospace; font-size: 11px; color: #888;
            background: #1e1e1e; padding: 2px 8px; border-radius: 4px; user-select: all;
        }
        .se-ids-item-del { color: #e74c3c; cursor: pointer; font-size: 14px; padding: 0 4px; opacity: 0.5; }
        .se-ids-item-del:hover { opacity: 1; }
        .se-ids-empty { padding: 30px; text-align: center; color: #555; font-size: 13px; }
        .se-find-bar {
            display: none; flex-direction: column; padding: 6px 16px; background: #252526;
            border-bottom: 1px solid #444;
        }
        .se-find-bar.se-find-visible { display: flex; }
        .se-find-bar input { flex: 1; padding: 5px 10px; border: 1px solid #555; border-radius: 4px; background: #1e1e1e; color: #d4d4d4; font-size: 13px; outline: none; }
        .se-find-bar input:focus { border-color: #1C3C2E; }
        .se-find-bar .se-find-info { font-size: 11px; color: #888; white-space: nowrap; }
        .se-find-bar button { padding: 4px 10px; border: none; border-radius: 4px; background: #333; color: #ccc; cursor: pointer; font-size: 12px; }
        .se-find-bar button:hover { background: #444; }
        .se-sidebar-action:hover { color: #fff !important; background: #37373d; border-radius: 4px; }

        .se-cls-sidebar-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
        .se-classes-fav-list { flex: 1; overflow-y: auto; padding: 4px 0; }
        .se-cls-fav-item {
            display: flex; align-items: center; gap: 8px; padding: 9px 14px; cursor: pointer;
            font-size: 13px; color: #ccc; border-left: 3px solid transparent;
        }
        .se-cls-fav-item:hover { background: #2a2d2e; color: #fff; }
        .se-cls-fav-item.se-active { background: #37373d; color: #fff; border-left-color: #1C3C2E; }
        .se-cls-fav-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .se-cls-fav-del { color: #e74c3c; opacity: 0.5; font-size: 13px; padding: 0 3px; }
        .se-cls-fav-del:hover { opacity: 1; }
        .se-cls-search-item {
            padding: 8px 14px; cursor: pointer; font-size: 12.5px; color: #ccc; border-bottom: 1px solid #2a2a2a;
        }
        .se-cls-search-item:hover { background: #2a2d2e; }
        .se-cls-search-item small { display: block; color: #888; font-family: 'Cascadia Code', monospace; font-size: 10.5px; margin-top: 2px; }
        .se-classes-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; position: relative; }
        .se-cls-header {
            padding: 14px 20px; background: #252526; border-bottom: 1px solid #333;
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        }
        .se-cls-header h3 { margin: 0; font-size: 16px; color: #fff; flex: 1; min-width: 0; }
        .se-cls-header small { color: #888; font-family: 'Cascadia Code', monospace; font-size: 11px; }
        .se-cls-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
        .se-cls-section-title {
            display: flex; align-items: center; gap: 10px; margin: 18px 0 8px; font-size: 12px;
            font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #999;
        }
        .se-cls-section-title:first-child { margin-top: 0; }
        .se-cls-item {
            display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 6px;
            font-size: 12.8px; color: #ccc;
        }
        .se-cls-item:hover { background: #2a2d2e; }
        .se-cls-item-fav { cursor: pointer; font-size: 14px; flex-shrink: 0; user-select: none; }
        .se-cls-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .se-cls-item-name .se-cls-item-ident { color: #888; font-family: 'Cascadia Code', monospace; font-size: 10.5px; }
        .se-cls-item-tag {
            font-family: 'Cascadia Code', monospace; font-size: 10px; padding: 1px 6px; border-radius: 3px;
            background: #2d2d2d; color: #888;
        }
        .se-cls-empty-hint { padding: 8px 10px; font-size: 12px; color: #666; font-style: italic; }

        .se-snip-panel { flex: 1; display: flex; overflow: hidden; background: #1e1e1e; border-radius: 0 0 10px 0; }

        .se-snip-item {
            display: flex; align-items: center; gap: 8px; padding: 8px 14px; cursor: pointer;
            font-size: 12.8px; color: #ccc; border-left: 3px solid transparent;
        }
        .se-snip-item:hover { background: #2a2d2e; color: #fff; }
        .se-snip-item.se-active { background: #37373d; color: #fff; border-left-color: #1C3C2E; }
        .se-snip-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Cascadia Code', monospace; }
        .se-snip-item-del { color: #e74c3c; opacity: 0.5; font-size: 13px; padding: 0 3px; }
        .se-snip-item-del:hover { opacity: 1; }
        .se-snip-editor { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .se-snip-editor-bar { display: flex; gap: 8px; align-items: center; padding: 12px 16px; background: #252526; border-bottom: 1px solid #333; }

        .se-cls-method-editor { position: absolute; inset: 0; background: #1e1e1e; display: flex; flex-direction: column; z-index: 5; }
        .se-cls-method-bar {
            display: flex; align-items: center; gap: 10px; padding: 12px 18px; background: #252526;
            border-bottom: 1px solid #333; flex-wrap: wrap;
        }
        .se-cls-method-bar h4 { margin: 0; font-size: 14.5px; color: #fff; flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }

        .se-cls-method-bar h4 .se-etab-dirty { display: flex; }
        .se-cls-conflict {
            padding: 10px 18px; background: #4a3410; border-bottom: 1px solid #6b4e1a; color: #f0c674; font-size: 12.5px;
        }
    </style>`;

    let scripts = getSavedScripts();
    let KEYWORDS =
        /^(var|let|const|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|typeof|instanceof|in|of|async|await|class|extends|import|export|default|true|false|null|undefined|this|void|delete|yield)$/;

    function getFolders() {
        try {
            return JSON.parse(sytoolsGetRaw("sytools_folders")) || [];
        } catch (e) {
            return [];
        }
    }
    function saveFolders(f) {
        sytoolsSetRaw("sytools_folders", JSON.stringify(f));
    }
    function getCollapsedFolders() {
        try {
            return JSON.parse(sytoolsGetRaw("sytools_collapsed_folders")) || [];
        } catch (e) {
            return [];
        }
    }
    function saveCollapsedFolders(c) {
        sytoolsSetRaw("sytools_collapsed_folders", JSON.stringify(c));
    }

    function buildSidebarItems(scripts, activeIdx, filter) {
        let folders = getFolders();
        let collapsed = getCollapsedFolders();
        let folderMap = {};
        for (let f of folders) {
            if (!folderMap[f]) folderMap[f] = [];
        }
        let unfoldered = [];

        for (let i = 0; i < scripts.length; i++) {
            let s = scripts[i];
            if (filter && !(s.name || "").toLowerCase().includes(filter)) continue;
            if (s.folder && folderMap.hasOwnProperty(s.folder)) {
                folderMap[s.folder].push(i);
            } else {
                unfoldered.push(i);
            }
        }

        let html = "";

        for (let folder of folders) {
            let items = folderMap[folder] || [];
            let folderMatchesFilter = !filter || folder.toLowerCase().includes(filter) || items.length > 0;
            if (!folderMatchesFilter) continue;
            let isCollapsed = filter ? false : collapsed.indexOf(folder) !== -1;
            html +=
                '<div class="se-sidebar-folder" data-folder="' +
                escHtml(folder) +
                '" draggable="false">' +
                '<span class="se-folder-arrow ' +
                (isCollapsed ? "" : "se-open") +
                '">▶</span>' +
                '<span class="se-folder-icon">📁</span>' +
                '<span class="se-folder-name" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                escHtml(folder) +
                "</span>" +
                "</div>";
            html += '<div class="se-sidebar-folder-items' + (isCollapsed ? " se-collapsed" : "") + '" data-folder-items="' + escHtml(folder) + '">';
            for (let i of items) {
                let s = scripts[i];
                let ext = getExtIcon(s.name);
                let active = i === activeIdx ? " se-active" : "";
                html +=
                    '<div class="se-sidebar-item' +
                    active +
                    '" data-idx="' +
                    i +
                    '" title="' +
                    escHtml(s.name) +
                    '" draggable="true">' +
                    '<span class="se-file-icon" style="background:' +
                    ext.color +
                    ";color:" +
                    (ext.textColor || "#fff") +
                    ';">' +
                    ext.icon +
                    "</span>" +
                    '<span class="se-file-name">' +
                    escHtml(s.name) +
                    "</span></div>";
            }
            html += "</div>";
        }

        for (let i of unfoldered) {
            let s = scripts[i];
            let ext = getExtIcon(s.name);
            let active = i === activeIdx ? " se-active" : "";
            html +=
                '<div class="se-sidebar-item' +
                active +
                '" data-idx="' +
                i +
                '" title="' +
                escHtml(s.name) +
                '" draggable="true">' +
                '<span class="se-file-icon" style="background:' +
                ext.color +
                ";color:" +
                (ext.textColor || "#fff") +
                ';">' +
                ext.icon +
                "</span>" +
                '<span class="se-file-name">' +
                escHtml(s.name) +
                "</span></div>";
        }
        return html;
    }

    function escHtml(s) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function highlightCode(code) {
        let out = "";
        let i = 0;
        let len = code.length;
        while (i < len) {
            if (code[i] === "/" && code[i + 1] === "/") {
                let end = code.indexOf("\n", i);
                if (end === -1) end = len;
                out += '<span class="se-hl-cm">' + escHtml(code.substring(i, end)) + "</span>";
                i = end;
            } else if (code[i] === "/" && code[i + 1] === "*") {
                let end = code.indexOf("*/", i + 2);
                if (end === -1) end = len;
                else end += 2;
                out += '<span class="se-hl-cm">' + escHtml(code.substring(i, end)) + "</span>";
                i = end;
            } else if (code[i] === '"' || code[i] === "'" || code[i] === "`") {
                let q = code[i];
                let j = i + 1;

                while (j < len && code[j] !== q && (q === "`" || code[j] !== "\n")) {
                    if (code[j] === "\\") j++;
                    j++;
                }
                if (j < len && code[j] === q) j++;
                out += '<span class="se-hl-st">' + escHtml(code.substring(i, j)) + "</span>";
                i = j;
            } else if (/[0-9]/.test(code[i]) && (i === 0 || /[^a-zA-Z_$]/.test(code[i - 1]))) {
                let j = i;
                while (j < len && /[0-9.]/.test(code[j])) j++;
                out += '<span class="se-hl-nm">' + escHtml(code.substring(i, j)) + "</span>";
                i = j;
            } else if (/[a-zA-Z_$]/.test(code[i])) {
                let j = i;
                while (j < len && /[a-zA-Z0-9_$]/.test(code[j])) j++;
                let word = code.substring(i, j);
                if (KEYWORDS.test(word)) out += '<span class="se-hl-kw">' + escHtml(word) + "</span>";
                else out += escHtml(word);
                i = j;
            } else {
                out += escHtml(code[i]);
                i++;
            }
        }
        return out + "\n";
    }

    function colorizeJson(obj, indent) {
        indent = indent || 0;
        let pad = "  ".repeat(indent);
        let pad1 = "  ".repeat(indent + 1);
        if (obj === null) return '<span class="se-out-null">null</span>';
        if (obj === undefined) return '<span class="se-out-null">undefined</span>';
        if (typeof obj === "boolean") return '<span class="se-out-b">' + obj + "</span>";
        if (typeof obj === "number") return '<span class="se-out-n">' + obj + "</span>";
        if (typeof obj === "string") {
            let trimmed = obj.trim();
            if ((trimmed.charAt(0) === "{" && trimmed.charAt(trimmed.length - 1) === "}") || (trimmed.charAt(0) === "[" && trimmed.charAt(trimmed.length - 1) === "]")) {
                try {
                    let inner = JSON.parse(obj);
                    return colorizeJson(inner, indent);
                } catch (_) {}
            }
            return '<span class="se-out-s">"' + escHtml(obj) + '"</span>';
        }
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '<span class="se-out-brace">[]</span>';
            let items = obj.map((v) => pad1 + colorizeJson(v, indent + 1));
            return '<span class="se-out-brace">[</span>\n' + items.join(",\n") + "\n" + pad + '<span class="se-out-brace">]</span>';
        }
        if (typeof obj === "object") {
            let keys = Object.keys(obj);
            if (keys.length === 0) return '<span class="se-out-brace">{}</span>';
            let items = keys.map((k) => pad1 + '<span class="se-out-k">"' + escHtml(k) + '"</span>: ' + colorizeJson(obj[k], indent + 1));
            return '<span class="se-out-brace">{</span>\n' + items.join(",\n") + "\n" + pad + '<span class="se-out-brace">}</span>';
        }
        return escHtml(String(obj));
    }

    let html =
        css +
        `
        <div class="se-root">
            <div class="se-sidebar">
                <div class="se-envbar" id="se-envbar">
                    <select class="se-env-select" id="se-env-select" title="Ambiente das coleções de scripts e IDs"></select>
                </div>
                <div class="se-sidebar-actions">
                    <span class="se-sidebar-action" id="se-act-new-file" title="Novo Script"><img src="${iconAddFile}" style="width:18px;height:18px;"></span>
                    <span class="se-sidebar-action" id="se-act-new-folder" title="Nova Pasta"><img src="${iconAddFolder}" style="width:18px;height:18px;"></span>
                    <span class="se-sidebar-action" id="se-act-rename-env" title="Renomear ambiente"><img src="${iconEdit}" style="width:16px;height:16px;"></span>
                </div>
                <div style="padding:4px 8px;">
                    <input class="se-name-input" id="se-sidebar-search" placeholder="Buscar script..." style="width:100%;box-sizing:border-box;padding:5px 10px;font-size:12px;" autocomplete="off">
                </div>
                <div class="se-sidebar-list" id="se-sidebar-list">
                    ${buildSidebarItems(scripts, -1)}
                </div>
                <!-- Sidebar da aba Classes: mesmo espaco da sidebar de scripts,
                     alternada por display none/flex quando a aba muda (ver
                     mostrarAba). Nao e uma segunda sidebar ao lado - ocupa o
                     mesmo lugar, so troca o conteudo. -->
                <div class="se-cls-sidebar-area" id="se-cls-sidebar-area" style="display:none;">
                    <div style="display:flex;gap:6px;padding:8px;">
                        <input class="se-name-input" id="se-cls-search" placeholder="Nome ou ID da classe..." style="flex:1;" autocomplete="off">
                        <button type="button" class="se-btn se-btn-save" id="se-cls-add" style="padding:0 12px;">+</button>
                    </div>
                    <div id="se-cls-search-results" class="se-classes-fav-list" style="display:none;"></div>
                    <div class="se-classes-fav-list" id="se-cls-fav-list">
                        <div class="se-ids-empty">Nenhuma classe favorita ainda. Busque pelo nome acima.</div>
                    </div>
                </div>
                <!-- Aba Snippets: a lista ocupa a lateral (mesmo lugar da lista de
                     scripts), em vez de abrir uma segunda coluna dentro do painel. -->
                <div class="se-cls-sidebar-area" id="se-snip-sidebar-area" style="display:none;">
                    <div style="display:flex;gap:6px;padding:8px;">
                        <input class="se-name-input" id="se-snip-filtro" placeholder="Filtrar snippet..." style="flex:1;" autocomplete="off">
                        <button type="button" class="se-btn se-btn-save" id="se-snip-novo-lateral" title="Novo snippet" style="padding:0 12px;">+</button>
                    </div>
                    <div class="se-classes-fav-list" id="se-snip-list">
                        <div class="se-ids-empty">Nenhum snippet ainda.</div>
                    </div>
                </div>
            </div>
            <div class="se-main">
                <div class="se-topbar">
                    <div class="se-tab se-tab-active" data-tab="editor">Editor</div>
                    <div class="se-tab" data-tab="finder">Buscar ID</div>
                    <div class="se-tab" data-tab="ids">Meus IDs</div>
                    <div class="se-tab" data-tab="logs">Logs de Execução</div>
                    <div class="se-tab" data-tab="classes">Classes</div>
                    <div class="se-tab" data-tab="snippets">Snippets</div>
                    <div class="se-tab" data-tab="config">Configurações</div>
                </div>
                <div class="se-tab-content se-tab-visible" id="se-tab-editor">
                    <div class="se-editor-panel">
                        <div class="se-editor-toolbar">
                            <div class="se-editor-tabs" id="se-editor-tabs"></div>
                            <!-- Estado do script ativo. Ficaram ocultos porque a barra
                                 de abas assumiu o papel visual, mas seguem sendo o
                                 ponto unico de nome e de salvar/excluir usado pelo
                                 Ctrl+S, pela tecla Delete e pelo menu de contexto. -->
                            <input class="se-name-input" id="se-script-name" value="" autocomplete="off" style="display:none">
                            <button type="button" id="se-btn-save" style="display:none"></button>
                            <button type="button" id="se-btn-delete" style="display:none"></button>
                        </div>
                        <div class="se-find-bar" id="se-find-bar">
                            <div style="display:flex;gap:6px;align-items:center;flex:1;">
                                <input id="se-find-input" placeholder="Buscar..." style="flex:1;">
                                <span class="se-find-info" id="se-find-info"></span>
                                <button type="button" id="se-find-prev" title="Anterior">↑</button>
                                <button type="button" id="se-find-next" title="Próximo">↓</button>
                                <button type="button" id="se-find-toggle-replace" title="Expandir substituição" style="font-size:10px;">⇅</button>
                                <button type="button" id="se-find-close" title="Fechar">✕</button>
                            </div>
                            <div id="se-replace-row" style="display:none;gap:6px;align-items:center;margin-top:4px;">
                                <input id="se-replace-input" placeholder="Substituir por..." style="flex:1;">
                                <button type="button" id="se-replace-one" title="Substituir" style="font-size:11px;">AB</button>
                                <button type="button" id="se-replace-all" title="Substituir todos" style="font-size:11px;">AB⟳</button>
                            </div>
                        </div>
                        <div class="se-editor-area">
                            <div class="se-gutter" id="se-gutter"><div class="se-gutter-inner" id="se-gutter-inner">1</div></div>
                            <div class="se-highlight-wrap" id="se-highlight-wrap">
                                <pre class="se-indent-guides" id="se-indent-guides"></pre>
                                <pre class="se-highlight-pre" id="se-highlight-pre"></pre>
                                <pre class="se-error-layer" id="se-error-layer"></pre>
                                <textarea class="se-editor-ta" id="se-editor" placeholder="// Cole ou escreva seu script aqui..." spellcheck="false"></textarea>
                                <div class="se-error-ruler" id="se-error-ruler"></div>
                                <div class="se-autocomplete" id="se-autocomplete" hidden></div>
                            </div>
                        </div>
                        <div class="se-run-bar">
                            <div class="se-panel-tabs">
                                <div class="se-ptab se-ptab-active" data-panel="problems">Problems <span class="se-ptab-badge" id="se-problems-badge">0</span></div>
                                <div class="se-ptab" data-panel="terminal">Terminal</div>
                            </div>
                            <span style="flex:1"></span>
                            <button type="button" class="se-btn" id="se-btn-expand-output" style="display:none">Expandir</button>
                            <button type="button" class="se-btn" id="se-btn-copy-output" style="display:none">Copiar</button>
                            <button type="button" class="se-btn" id="se-btn-format" title="Formatar código (Prettier)">Formatar</button>
                            <span class="se-status se-status-idle" id="se-status">Parado</span>
                            <button type="button" class="se-btn se-btn-run" id="se-btn-run">Executar</button>
                        </div>
                    </div>
                    <div class="se-resizer" id="se-resizer"></div>
                    <div class="se-panel-body">
                        <div class="se-problems" id="se-problems"></div>
                        <div class="se-output se-panel-hidden" id="se-output">Aguardando execu\u00e7\u00e3o...</div>
                    </div>
                </div>
                <div class="se-tab-content" id="se-tab-finder">
                    <div style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
                        <div style="display:flex;gap:8px;padding:14px 16px;background:#252526;border-bottom:1px solid #333;align-items:center;flex-wrap:wrap;">
                            <input class="se-name-input" id="se-finder-class" placeholder="Classe (nome ou ID)" style="width:260px;flex:none;" autocomplete="off">
                            <input class="se-name-input" id="se-finder-query" placeholder="Filtrar por nome, código, ID..." style="flex:1;" autocomplete="off">
                            <button type="button" class="se-btn se-btn-save" id="se-finder-go">Buscar</button>
                            <button type="button" class="se-btn" id="se-finder-clear" style="color:#e74c3c;border-color:#e74c3c;">Limpar</button>
                        </div>
                        <div id="se-finder-class-results" style="display:none;max-height:180px;overflow-y:auto;background:#252526;border-bottom:1px solid #444;"></div>
                        <div id="se-finder-results" style="flex:1;overflow-y:auto;padding:0;background:#1e1e1e;">
                            <div class="se-ids-empty">Busque uma classe pelo nome ou ID para listar seus objetos</div>
                        </div>
                        <div id="se-finder-status" style="padding:6px 16px;font-size:11px;color:#666;background:#252526;border-top:1px solid #333;"></div>
                    </div>
                </div>
                <div class="se-tab-content" id="se-tab-ids">
                    <div class="se-ids-panel">
                        <div class="se-ids-toolbar">
                            <input class="se-name-input" id="se-ids-name" placeholder="Nome do item" style="flex:1;" autocomplete="off">
                            <input class="se-name-input" id="se-ids-id" placeholder="ID (24 chars)" style="width:220px;flex:none;font-family:'Cascadia Code',monospace;font-size:12px;" autocomplete="off">
                            <input class="se-name-input" id="se-ids-group" placeholder="Classe / Grupo" style="width:180px;flex:none;" autocomplete="off">
                            <button type="button" class="se-btn se-btn-save" id="se-ids-add">Salvar</button>
                            <button type="button" class="se-btn" id="se-ids-add-class" title="Buscar e salvar uma classe pelo nome, sem precisar do ID">+ Classe</button>
                        </div>
                        <div id="se-ids-class-search" style="display:none;padding:10px 16px;background:#252526;border-bottom:1px solid #333;">
                            <input class="se-name-input" id="se-ids-class-search-input" placeholder="Buscar classe por nome ou ID..." style="width:100%;" autocomplete="off">
                            <div id="se-ids-class-search-results" style="max-height:180px;overflow-y:auto;margin-top:6px;"></div>
                        </div>
                        <div class="se-ids-subtabs" id="se-ids-subtabs">
                            <div class="se-ids-subtab se-ids-subtab-active" data-kind="object">Objetos</div>
                            <div class="se-ids-subtab" data-kind="class">Classes</div>
                        </div>
                        <div class="se-ids-list" id="se-ids-list"></div>
                    </div>
                </div>
                <div class="se-tab-content" id="se-tab-logs">
                    <div style="flex:1;overflow-y:auto;padding:16px;background:#1e1e1e;">
                        <table style="width:100%;border-collapse:collapse;font-size:12.5px;color:#ccc;">
                            <thead>
                                <tr style="text-align:left;border-bottom:1px solid #333;">
                                    <th style="padding:8px 10px;font-weight:600;color:#999;">Script</th>
                                    <th style="padding:8px 10px;font-weight:600;color:#999;">Data</th>
                                    <th style="padding:8px 10px;font-weight:600;color:#999;">In\u00edcio</th>
                                    <th style="padding:8px 10px;font-weight:600;color:#999;">T\u00e9rmino</th>
                                    <th style="padding:8px 10px;font-weight:600;color:#999;">Status</th>
                                    <th style="padding:8px 10px;font-weight:600;color:#999;">Resultado</th>
                                    <th style="padding:8px 10px;font-weight:600;color:#999;">Script</th>
                                </tr>
                            </thead>
                            <tbody id="se-logs-tbody"></tbody>
                        </table>
                        <div class="se-ids-empty" id="se-logs-empty" style="display:none;">Nenhuma execu\u00e7\u00e3o registrada ainda.</div>
                    </div>
                </div>
                <div class="se-tab-content" id="se-tab-classes">
                    <div class="se-classes-main" id="se-cls-main">
                        <div class="se-ids-empty" style="margin:auto;">Escolha uma classe favorita na lateral para ver campos e métodos.</div>
                    </div>
                </div>
                <div class="se-tab-content" id="se-tab-snippets">
                    <div class="se-snip-panel">
                        <div class="se-snip-editor">
                            <div class="se-snip-editor-bar">
                                <input class="se-name-input" id="se-snip-name" placeholder="Nome do snippet (o que você vai digitar pra chamar)" style="flex:1;" autocomplete="off">
                                <button type="button" class="se-btn se-btn-save" id="se-snip-save">Salvar</button>
                                <button type="button" class="se-btn" id="se-snip-new" style="color:#e74c3c;border-color:#e74c3c;">Novo</button>
                            </div>
                            <div class="se-config-hint" style="padding:0 16px 10px;">Use <code>\${cursor}</code> no código para marcar onde o cursor deve ficar depois de inserir o snippet.</div>
                            <div class="se-find-bar" id="se-snip-find-bar">
                                <div style="display:flex;align-items:center;gap:8px;flex:1;">
                                    <input type="text" id="se-snip-find-input" placeholder="Buscar...">
                                    <span class="se-find-info" id="se-snip-find-info"></span>
                                    <button type="button" id="se-snip-find-prev" title="Anterior">▲</button>
                                    <button type="button" id="se-snip-find-next" title="Próximo">▼</button>
                                    <button type="button" id="se-snip-find-toggle-replace" title="Expandir substituição" style="font-size:10px;">⇅</button>
                                    <button type="button" id="se-snip-find-close" title="Fechar (Esc)">✕</button>
                                </div>
                                <div id="se-snip-replace-row" style="display:none;gap:6px;align-items:center;margin-top:4px;">
                                    <input id="se-snip-replace-input" placeholder="Substituir por..." style="flex:1;">
                                    <button type="button" id="se-snip-replace-one" title="Substituir" style="font-size:11px;">AB</button>
                                    <button type="button" id="se-snip-replace-all" title="Substituir todos" style="font-size:11px;">AB⟳</button>
                                </div>
                            </div>
                            <div class="se-editor-area">
                                <div class="se-gutter" id="se-snip-gutter"><div class="se-gutter-inner" id="se-snip-gutter-inner">1</div></div>
                                <div class="se-highlight-wrap" id="se-snip-highlight-wrap">
                                    <pre class="se-indent-guides" id="se-snip-indent-guides"></pre>
                                    <pre class="se-find-highlight-layer" id="se-snip-find-highlight"></pre>
                                    <pre class="se-highlight-pre" id="se-snip-highlight-pre"></pre>
                                    <pre class="se-error-layer" id="se-snip-error-layer"></pre>
                                    <textarea class="se-editor-ta se-snip-code" id="se-snip-code" placeholder="// código do snippet aqui..." spellcheck="false"></textarea>
                                    <div class="se-error-ruler" id="se-snip-error-ruler"></div>
                                    <div class="se-autocomplete" id="se-snip-autocomplete" hidden></div>
                                </div>
                            </div>
                            <div class="se-panel-body" style="height:120px;">
                                <div class="se-run-bar" style="padding:6px 16px;">
                                    <div class="se-panel-tabs">
                                        <div class="se-ptab se-ptab-active">Problems <span class="se-ptab-badge" id="se-snip-problems-badge">0</span></div>
                                    </div>
                                </div>
                                <div class="se-problems" id="se-snip-problems"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="se-tab-content" id="se-tab-config">
                    <div class="se-config-panel">
                        <h3 style="margin:0 0 20px;font-size:17px;">Configura\u00e7\u00f5es do Executor</h3>
                        <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
                            <div class="se-config-group" style="flex:1;min-width:220px;margin:0;">
                                <label class="se-config-label">Classe (fixa - Execut\u00e1vel nativa)</label>
                                <input class="se-config-input" id="se-cfg-classe" value="${NATIVE_RUNNABLE_CLASS_ID}" readonly style="opacity:0.6;cursor:not-allowed;">
                            </div>
                            <div class="se-config-group" style="flex:1;min-width:220px;margin:0;">
                                <label class="se-config-label">Objeto ID</label>
                                <input class="se-config-input" id="se-cfg-objeto" value="${cfg.objetoId}" placeholder="Clique em 'Criar Objeto Executor' ou cole um ID existente">
                            </div>
                            <button type="button" class="se-btn-config se-btn-save" id="se-create-exec-obj">+ Criar Objeto Executor</button>
                        </div>
                        <div class="se-config-hint">Classe Execut\u00e1vel nativa do Sydle ONE (n\u00e3o edit\u00e1vel) \u00b7 Objeto Execut\u00e1vel onde o script \u00e9 gravado e o m\u00e9todo 'run' \u00e9 chamado</div>
                        <div id="se-exec-class-status" style="font-size:13px;color:#d4d4d4;margin-top:6px;"></div>
                        <div class="se-config-group" style="margin-top:20px;">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <label class="se-toggle">
                                    <input type="checkbox" id="se-cfg-click-insert" ${cfg.clickInsertEditor ? "checked" : ""}>
                                    <span class="se-toggle-slider"></span>
                                </label>
                                <span style="color:#d4d4d4;font-size:14px;">Clicar no ID insere no editor</span>
                            </div>
                            <div class="se-config-hint">ON: clicar em um resultado insere o ID direto no editor. OFF: apenas copia o ID para a \u00e1rea de transfer\u00eancia.</div>
                        </div>
                        <div class="se-config-group">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <label class="se-toggle">
                                    <input type="checkbox" id="se-cfg-insert-formatted" ${cfg.insertFormatted ? "checked" : ""}>
                                    <span class="se-toggle-slider"></span>
                                </label>
                                <span style="color:#d4d4d4;font-size:14px;">Inserir ID formatado (classId + objectId)</span>
                            </div>
                            <div class="se-config-hint">ON: um item Objeto de "Meus IDs" insere as duas linhas prontas (var classId / var objectId). Itens Classe continuam inserindo so o ID. OFF: sempre insere so o ID. Depende de "Clicar no ID insere no editor" estar ligado.</div>
                        </div>
                        <div class="se-config-group">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <label class="se-toggle">
                                    <input type="checkbox" id="se-cfg-autocomplete" ${cfg.autocompleteEnabled ? "checked" : ""}>
                                    <span class="se-toggle-slider"></span>
                                </label>
                                <span style="color:#d4d4d4;font-size:14px;">Autocomplete de _utils / _context</span>
                            </div>
                            <div class="se-config-hint">ON: sugere _utils, _input, _output, _context e os m\u00e9todos/objetos deles enquanto voc\u00ea digita. Tab ou Enter aceita a sugest\u00e3o.</div>
                        </div>
                        <div class="se-config-group">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <label class="se-toggle">
                                    <input type="checkbox" id="se-cfg-diff-publish" ${cfg.diffAntesPublicar ? "checked" : ""}>
                                    <span class="se-toggle-slider"></span>
                                </label>
                                <span style="color:#d4d4d4;font-size:14px;">Mostrar diff antes de publicar m\u00e9todo (Classes) <span style="color:#888;font-size:12px;">\u2014 em teste</span></span>
                            </div>
                            <div class="se-config-hint">ON: ao clicar em "Salvar e publicar" no editor de m\u00e9todo da aba Classes, mostra o que vai mudar antes de confirmar.</div>
                        </div>
                        <div style="margin-top:24px;">
                            <button type="button" class="se-btn-config se-btn-save" id="se-btn-save-config">Salvar Configura\u00e7\u00f5es</button>
                        </div>
                        <hr style="border:none;border-top:1px solid #333;margin:28px 0 20px;">
                        <h3 style="margin:0 0 8px;font-size:17px;">Atalhos de teclado</h3>
                        <div class="se-config-hint" style="margin-bottom:14px;">Clique num campo e pressione a combinação desejada, depois clique em Salvar na mesma linha. Delete (excluir item selecionado) não é customizável.</div>
                        <div class="se-shortcuts-list">
                            ${SHORTCUTS_DEFS.map(
                                (d) => `
                            <div class="se-shortcut-row" data-shortcut-id="${d.id}">
                                <span class="se-shortcut-label">${escHtml(d.rotulo)}</span>
                                <input class="se-config-input se-shortcut-input" data-shortcut-id="${d.id}" value="${atalhoParaExibicao(cfg.shortcuts[d.id])}" readonly placeholder="Clique e pressione a combinação">
                                <button type="button" class="se-btn-config se-btn-save se-shortcut-save" data-shortcut-id="${d.id}">Salvar</button>
                                <button type="button" class="se-btn-config se-shortcut-reset" data-shortcut-id="${d.id}" title="Restaurar padrão: ${escHtml(atalhoParaExibicao(d.padrao))}">↺</button>
                            </div>`
                            ).join("")}
                        </div>
                        <hr style="border:none;border-top:1px solid #333;margin:28px 0 20px;">
                        <h3 style="margin:0 0 16px;font-size:17px;">Sessão / Token</h3>
                        <div class="se-config-hint" style="margin-bottom:16px;">Copia o token de acesso da sessão ativa (o mesmo usado nas chamadas à API do Sydle).</div>
                        <div style="display:flex;gap:12px;flex-wrap:wrap;">
                            <button type="button" class="se-btn-config se-btn-save" id="se-copy-token">⎘ Copiar Token</button>
                        </div>
                        <div id="se-copy-token-status" style="margin-top:12px;font-size:13px;color:#d4d4d4;"></div>
                        <hr style="border:none;border-top:1px solid #333;margin:28px 0 20px;">
                        <h3 style="margin:0 0 16px;font-size:17px;">Backup / Restore</h3>
                        <div class="se-config-hint" style="margin-bottom:16px;">Exporta e importa todos os dados do executor: scripts salvos, IDs salvos e configura\u00e7\u00f5es. Use para fazer backup ou migrar para outro computador.</div>
                        <div style="display:flex;gap:12px;flex-wrap:wrap;">
                            <button type="button" class="se-btn-config se-btn-save" id="se-backup-download">\u2B07 Download Backup</button>
                            <button type="button" class="se-btn-config se-btn-save" id="se-backup-upload" style="background:#2d5a3d;">\u2B06 Upload Backup</button>
                            <input type="file" id="se-backup-file-input" accept=".json" style="display:none;">
                        </div>
                        <div id="se-backup-status" style="margin-top:12px;font-size:13px;color:#d4d4d4;"></div>
                    </div>
                </div>
            </div>
        </div>`;

    let overlay = document.createElement("div");
    overlay.id = "sytools-executor-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:1050;" + "background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;";
    let modal = document.createElement("div");
    modal.style.cssText = "width:95vw;max-width:1500px;height:94vh;background:#1e1e1e;border-radius:12px;" + "box-shadow:0 8px 40px rgba(0,0,0,0.6);overflow:hidden;";
    modal.innerHTML = html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    {
        let closeExecutor = () => {
            overlay.remove();
        };
        {
            let editor = document.getElementById("se-editor");
            let highlightPre = document.getElementById("se-highlight-pre");
            let indentGuides = document.getElementById("se-indent-guides");
            let gutterInner = document.getElementById("se-gutter-inner");
            let gutter = document.getElementById("se-gutter");
            let output = document.getElementById("se-output");
            let statusEl = document.getElementById("se-status");
            let nameInput = document.getElementById("se-script-name");
            let btnSave = document.getElementById("se-btn-save");
            let btnDelete = document.getElementById("se-btn-delete");
            let btnRun = document.getElementById("se-btn-run");
            let btnCopyOutput = document.getElementById("se-btn-copy-output");
            let btnExpandOutput = document.getElementById("se-btn-expand-output");
            let btnFormat = document.getElementById("se-btn-format");
            let sidebarList = document.getElementById("se-sidebar-list");
            let errorLayer = document.getElementById("se-error-layer");
            let errorRuler = document.getElementById("se-error-ruler");
            let editorTabs = document.getElementById("se-editor-tabs");
            let panelBody = modal.querySelector(".se-panel-body");
            let panelTabs = modal.querySelector(".se-panel-tabs");
            let problemsEl = document.getElementById("se-problems");
            let problemsBadge = document.getElementById("se-problems-badge");
            let openTabs = [];
            let activeTab = -1;
            let isRunning = false;
            let currentIdx = "_new_";

            if (!cfg.objetoId) {
                btnRun.disabled = true;
                btnRun.title = "Configure o executor em Configurações primeiro";
            }
            let lastSavedCode = "";
            let lastSavedName = "";
            let lastResultRaw = "";
            let lastResultParsed = null;

            function isDirty() {
                return editor.value !== lastSavedCode || nameInput.value.trim() !== lastSavedName;
            }

            function markClean() {
                lastSavedCode = editor.value;
                lastSavedName = nameInput.value.trim();

                if (activeTab >= 0 && openTabs[activeTab]) {
                    openTabs[activeTab].code = editor.value;
                    openTabs[activeTab].name = nameInput.value;
                    openTabs[activeTab].savedCode = lastSavedCode;
                    openTabs[activeTab].savedName = lastSavedName;
                    openTabs[activeTab].idx = currentIdx;
                    renderTabs();

                    persistirAbas();
                }
            }

            function updateGutter() {
                let lines = editor.value.split("\n").length;
                let comErro = {};
                if (typeof syntaxProblems !== "undefined") {
                    syntaxProblems.forEach(function (d) {
                        if (d && d.line) comErro[d.line] = true;
                    });
                }
                let nums = [];
                for (let n = 1; n <= lines; n++) {
                    nums.push(comErro[n] ? '<span class="se-gutter-erro">' + n + "</span>" : String(n));
                }
                gutterInner.innerHTML = nums.join("\n");
            }

            function nivelIndentacao(linha) {
                let m = /^[ \t]*/.exec(linha)[0];
                let niveis = 0;
                let col = 0;
                for (let i = 0; i < m.length; i++) {
                    col += m[i] === "\t" ? 4 - (col % 4) : 1;
                    if (col % 4 === 0) niveis++;
                }
                return niveis;
            }

            function renderIndentGuides(code) {
                let linhas = code.split("\n");
                let niveisPorLinha = linhas.map(nivelIndentacao);

                let niveisEfetivos = niveisPorLinha.slice();
                for (let i = 0; i < linhas.length; i++) {
                    if (linhas[i].trim() !== "") continue;
                    let antes = 0;
                    for (let a = i - 1; a >= 0; a--) {
                        if (linhas[a].trim() !== "") {
                            antes = niveisPorLinha[a];
                            break;
                        }
                    }
                    let depois = 0;
                    for (let d = i + 1; d < linhas.length; d++) {
                        if (linhas[d].trim() !== "") {
                            depois = niveisPorLinha[d];
                            break;
                        }
                    }
                    niveisEfetivos[i] = Math.min(antes, depois);
                }

                let saida = niveisEfetivos.map(function (niveis) {
                    if (niveis === 0) return "";
                    let out = "";
                    for (let n = 0; n < niveis; n++) {
                        out += '<span class="se-indent-guide">    </span>';
                    }
                    return out;
                });
                indentGuides.innerHTML = saida.join("\n");
            }

            function syncHighlight() {
                highlightPre.innerHTML = highlightCode(editor.value);
                renderIndentGuides(editor.value);
                updateGutter();
                renderSyntaxDiagnostic();

                syncScroll();
            }

            function syncScroll() {
                highlightPre.scrollTop = editor.scrollTop;
                highlightPre.scrollLeft = editor.scrollLeft;
                indentGuides.scrollTop = editor.scrollTop;
                indentGuides.scrollLeft = editor.scrollLeft;
                gutter.scrollTop = editor.scrollTop;
                errorLayer.scrollTop = editor.scrollTop;
                errorLayer.scrollLeft = editor.scrollLeft;

                requestAnimationFrame(function () {
                    errorLayer.scrollTop = editor.scrollTop;
                    errorLayer.scrollLeft = editor.scrollLeft;
                });
            }

            let syntaxProblems = [];
            let syntaxDiagnostic = null;

            let syntaxCode = null;
            let syntaxLines = [];

            function editorMetrics(alvo) {
                let el = alvo || editor;
                let cache = el._sytoolsMetrics;
                if (cache && cache.confiavel) return cache;

                let cs = window.getComputedStyle(el);
                let probe = document.createElement("div");
                probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;top:-9999px;left:-9999px;padding:0;margin:0;border:0;";
                probe.style.fontFamily = cs.fontFamily;
                probe.style.fontSize = cs.fontSize;
                probe.style.lineHeight = cs.lineHeight;
                probe.textContent = "0".repeat(50) + "\n" + "0".repeat(50);
                document.body.appendChild(probe);
                let rect = probe.getBoundingClientRect();
                let charWidth = rect.width / 50;
                let lineHeight = rect.height / 2;
                probe.remove();

                el._sytoolsMetrics = {
                    charWidth: charWidth > 0 ? charWidth : 7.8,

                    lineHeight: lineHeight >= 6 ? lineHeight : 20.8,
                    padTop: parseFloat(cs.paddingTop) || 14,
                    padLeft: parseFloat(cs.paddingLeft) || 16,

                    confiavel: el.clientHeight > 0 && charWidth > 0 && lineHeight >= 6
                };
                return el._sytoolsMetrics;
            }

            function invalidarMetricas() {
                delete editor._sytoolsMetrics;
                renderSyntaxDiagnostic();
            }

            function onEditorResize() {
                if (!document.body.contains(overlay)) {
                    window.removeEventListener("resize", onEditorResize);
                    return;
                }
                invalidarMetricas();
            }
            window.addEventListener("resize", onEditorResize);

            if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
                document.fonts.ready.then(function () {
                    if (document.body.contains(overlay)) invalidarMetricas();
                });
            }

            function renderSyntaxDiagnostic() {
                errorLayer.innerHTML = "";
                errorRuler.innerHTML = "";
                if (!syntaxProblems.length) {

                    syncScroll();
                    return;
                }

                let valorAtual = editor.value;
                let lines = valorAtual.split("\n");

                let analiseAtual = syntaxCode === null || syntaxCode === valorAtual;

                syntaxProblems.forEach(function (d, i) {
                    if (!d || !d.line) return;
                    let tick = document.createElement("div");
                    tick.className = "se-error-ruler-tick";
                    tick.style.top = Math.min(99, ((d.line - 1) / Math.max(1, lines.length)) * 100) + "%";
                    tick.title = "Linha " + d.line + ": " + d.message;
                    tick.dataset.problem = String(i);
                    errorRuler.appendChild(tick);
                });

                let porLinha = {};
                syntaxProblems.forEach(function (d) {
                    if (!d || !d.line) return;
                    let text = lines[d.line - 1];
                    if (text === undefined) return;

                    if (!analiseAtual && syntaxLines.length && text !== syntaxLines[d.line - 1]) return;

                    let ini;
                    let fim;
                    if (typeof d.column === "number") {
                        ini = Math.max(0, Math.min(d.column, text.length));
                        fim = Math.min(text.length, ini + Math.max(1, d.length || 1));
                    } else {

                        ini = text.length - text.replace(/^\s+/, "").length;
                        fim = text.length;
                    }
                    if (!porLinha[d.line]) porLinha[d.line] = [];
                    porLinha[d.line].push({ ini: ini, fim: fim, msg: d.message });
                });

                let alguma = false;
                let saida = lines.map(function (text, idx) {

                    text = text.replace(/\r$/, "");
                    let marcas = porLinha[idx + 1];
                    if (!marcas || !marcas.length) {

                        return escHtml(text) || "&nbsp;";
                    }
                    alguma = true;

                    marcas.sort(function (a, b) { return a.ini - b.ini; });
                    let html = "";
                    let cursor = 0;
                    for (let k = 0; k < marcas.length; k++) {
                        let r = marcas[k];

                        if (r.ini < cursor) r.ini = cursor;
                        if (r.ini > text.length) r.ini = text.length;
                        html += escHtml(text.slice(cursor, r.ini));

                        let trecho = text.slice(r.ini, Math.max(r.fim, r.ini + 1));

                        let inventado = trecho === "";
                        if (inventado) trecho = " ";

                        html +=
                            '<span class="se-error-underline" title="' +
                            escHtml("Linha " + (idx + 1) + ": " + r.msg).replace(/"/g, "&quot;") +
                            '">' + escHtml(trecho) + "</span>";
                        cursor = inventado ? r.ini : r.ini + trecho.length;
                    }
                    html += escHtml(text.slice(cursor));
                    return html;
                }).join("\n");

                errorLayer.innerHTML = alguma ? saida : "";

                errorLayer.style.transform = "";
                syncScroll();
            }

            function irParaErro(d) {
                if (!d || !d.line) return;
                let linhas = editor.value.split("\n");
                let alvo = Math.min(d.line, linhas.length) - 1;
                let offset = 0;
                for (let i = 0; i < alvo; i++) offset += linhas[i].length + 1;
                offset += Math.min(d.column || 0, linhas[alvo] ? linhas[alvo].length : 0);

                editor.focus();
                editor.setSelectionRange(offset, offset + (d.length || 1));

                let m = editorMetrics();
                editor.scrollTop = Math.max(0, alvo * m.lineHeight - editor.clientHeight / 2);
                syncScroll();
            }

            function showPanel(nome) {
                panelTabs.querySelectorAll(".se-ptab").forEach(function (t) {
                    t.classList.toggle("se-ptab-active", t.dataset.panel === nome);
                });
                problemsEl.classList.toggle("se-panel-hidden", nome !== "problems");
                output.classList.toggle("se-panel-hidden", nome !== "terminal");

                let mostrarAcoesSaida = nome === "terminal" && !!lastResultRaw;
                btnCopyOutput.style.display = mostrarAcoesSaida ? "" : "none";
                btnExpandOutput.style.display = mostrarAcoesSaida ? "" : "none";
            }

            panelTabs.addEventListener("click", function (e) {
                let t = e.target.closest(".se-ptab");
                if (t) showPanel(t.dataset.panel);
            });

            function renderProblems() {
                problemsBadge.textContent = String(syntaxProblems.length);
                problemsBadge.classList.toggle("se-ptab-badge-erro", syntaxProblems.length > 0);

                if (!syntaxProblems.length) {
                    problemsEl.innerHTML = '<div class="se-problems-empty">Nenhum problema detectado.</div>';
                    return;
                }

                problemsEl.innerHTML = syntaxProblems.map(function (d, i) {
                    let pos = d.line
                        ? "Ln " + d.line + (typeof d.column === "number" ? ", Col " + (d.column + 1) : "")
                        : "sem posição";
                    let dica = d.detail && d.detail !== d.message ? d.detail : d.message;

                    let fix =
                        d.quickFixToken && d.line
                            ? '<span class="se-problem-fix" data-fix="' + i + '" title="Inserir &quot;' + escHtml(d.quickFixToken).replace(/"/g, "&quot;") + '&quot; aqui">+ ' + escHtml(d.quickFixToken) + "</span>"
                            : "";
                    return '<div class="se-problem" data-problem="' + i + '"' +
                        ' title="' + escHtml(String(dica)).replace(/"/g, "&quot;") + '"' +
                        (d.line ? "" : ' style="cursor:default"') + ">" +
                        '<span class="se-problem-icon">&#10007;</span>' +
                        '<span class="se-problem-pos">' + escHtml(pos) + "</span>" +
                        '<span class="se-problem-msg">' + escHtml(String(d.message)) + "</span>" +
                        fix +
                        "</div>";
                }).join("");
            }

            function aplicarQuickFix(d) {
                if (!d || !d.quickFixToken || !d.line) return;
                let linhas = editor.value.split("\n");
                let alvo = Math.min(d.line, linhas.length) - 1;
                let offset = 0;
                for (let i = 0; i < alvo; i++) offset += linhas[i].length + 1;
                offset += Math.min(d.column || 0, linhas[alvo] ? linhas[alvo].length : 0);
                editorReplaceRange(offset, offset, d.quickFixToken);
                editor.selectionStart = editor.selectionEnd = offset + d.quickFixToken.length;

                scheduleSyntaxCheck();
            }

            problemsEl.addEventListener("click", function (e) {
                let fixEl = e.target.closest(".se-problem-fix");
                if (fixEl) {

                    e.stopPropagation();
                    aplicarQuickFix(syntaxProblems[Number(fixEl.dataset.fix)]);
                    return;
                }
                let item = e.target.closest(".se-problem");
                if (!item) return;
                irParaErro(syntaxProblems[Number(item.dataset.problem)]);
            });

            errorRuler.addEventListener("click", function (e) {
                let tick = e.target.closest(".se-error-ruler-tick");
                if (!tick) return;
                irParaErro(syntaxProblems[Number(tick.dataset.problem)]);
            });

            function updateRunEnabled() {
                if (isRunning) return;
                let reason = cfg.objetoId ? "" : "Configure o executor em Configurações primeiro";
                btnRun.disabled = !!reason;
                btnRun.title = reason;
            }

            let lintFrame = null;
            let lintFrameReady = false;
            let lintFrameFailed = false;
            let lintSeq = 0;
            let lintPending = {};
            let lintToken = 0;

            let formatSeq = 0;
            let formatPending = {};

            function ensureLintFrame() {
                if (lintFrame || lintFrameFailed) return;
                try {
                    lintFrame = document.createElement("iframe");
                    lintFrame.setAttribute("aria-hidden", "true");
                    lintFrame.setAttribute("tabindex", "-1");
                    lintFrame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";
                    lintFrame.src = chrome.runtime.getURL("sandbox/syntax-check.html");

                    modal.appendChild(lintFrame);
                } catch (e) {
                    lintFrameFailed = true;
                    return;
                }
                setTimeout(() => {
                    if (!lintFrameReady) {
                        lintFrameFailed = true;
                        console.warn("[SyTools] Verificação gramatical indisponível (sandbox não carregou). Seguindo apenas com a varredura local.");
                    }
                }, 2500);
            }

            function onLintMessage(event) {
                if (!document.body.contains(overlay)) {
                    window.removeEventListener("message", onLintMessage);
                    return;
                }
                let data = event.data;
                if (!data || typeof data !== "object") return;
                if (data.__sytools === "lint-ready") {
                    lintFrameReady = true;
                    return;
                }
                if (data.__sytools === "lint-result") {
                    let cb = lintPending[data.id];
                    if (!cb) return;
                    delete lintPending[data.id];
                    cb(data.result);
                    return;
                }
                if (data.__sytools === "format-result") {
                    let cb = formatPending[data.id];
                    if (!cb) return;
                    delete formatPending[data.id];
                    cb({ ok: data.ok, code: data.code, erro: data.erro });
                    return;
                }
            }
            window.addEventListener("message", onLintMessage);

            function requestGrammarCheck(code, callback) {
                ensureLintFrame();
                if (lintFrameFailed || !lintFrame) {
                    callback(null);
                    return;
                }
                if (!lintFrameReady) {
                    setTimeout(() => requestGrammarCheck(code, callback), 150);
                    return;
                }
                let id = ++lintSeq;
                lintPending[id] = callback;
                try {
                    lintFrame.contentWindow.postMessage({ __sytools: "lint", id: id, code: code }, "*");
                } catch (e) {
                    delete lintPending[id];
                    callback(null);
                    return;
                }
                setTimeout(() => {
                    if (lintPending[id]) {
                        delete lintPending[id];
                        callback(null);
                    }
                }, 5000);
            }

            function requestFormat(code, callback) {
                ensureLintFrame();
                if (lintFrameFailed || !lintFrame) {
                    callback({ ok: false, erro: "Verificação gramatical indisponível nesta sessão." });
                    return;
                }
                if (!lintFrameReady) {
                    setTimeout(() => requestFormat(code, callback), 150);
                    return;
                }
                let id = ++formatSeq;
                formatPending[id] = callback;
                try {
                    lintFrame.contentWindow.postMessage({ __sytools: "format", id: id, code: code }, "*");
                } catch (e) {
                    delete formatPending[id];
                    callback({ ok: false, erro: "Falha ao enviar código para formatação." });
                    return;
                }
                setTimeout(() => {
                    if (formatPending[id]) {
                        delete formatPending[id];
                        callback({ ok: false, erro: "Tempo esgotado ao formatar." });
                    }
                }, 8000);
            }

            function applyDiagnostic(d, codigoAnalisado) {
                syntaxProblems = Array.isArray(d) ? d.filter(Boolean) : d && !d.blocked ? [d] : [];
                syntaxDiagnostic = syntaxProblems[0] || null;

                syntaxCode = typeof codigoAnalisado === "string" ? codigoAnalisado : editor.value;
                syntaxLines = syntaxCode.split("\n");
                updateGutter();
                renderSyntaxDiagnostic();
                renderProblems();
            }

            function runSyntaxCheck() {
                let token = ++lintToken;
                let code = editor.value;

                requestGrammarCheck(code, (lista) => {

                    if (token !== lintToken) return;

                    if (!Array.isArray(lista)) {
                        applyDiagnostic(sytoolsAnalyzeSyntax(code), code);
                        return;
                    }
                    applyDiagnostic(lista, code);
                });
            }

            let syntaxCheckTimer = null;
            function scheduleSyntaxCheck() {
                if (syntaxCheckTimer) clearTimeout(syntaxCheckTimer);

                syntaxCheckTimer = setTimeout(runSyntaxCheck, 150);
            }

            let abaSujaAntes = false;
            editor.addEventListener("input", () => {
                syncHighlight();
                scheduleSyntaxCheck();
                acAgendarCheck();

                let agora = isDirty();
                if (agora !== abaSujaAntes) {
                    abaSujaAntes = agora;
                    if (activeTab >= 0 && openTabs[activeTab]) {
                        openTabs[activeTab].code = editor.value;
                        renderTabs();
                    }
                }
            });
            editor.addEventListener("scroll", () => {
                syncScroll();
                if (!acEl.hidden) acFechar();
            });
            syncHighlight();

            function editorReplaceSelection(text) {
                editor.focus();
                document.execCommand("insertText", false, text);
                syncHighlight();
            }

            function editorReplaceRange(from, to, text) {
                editor.focus();
                editor.selectionStart = from;
                editor.selectionEnd = to;
                document.execCommand("insertText", false, text);
                syncHighlight();
            }

            const PARES_ABERTURA = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
            const PARES_FECHAMENTO = { ")": "(", "]": "[", "}": "{", '"': '"', "'": "'", "`": "`" };
            const ASPAS = { '"': true, "'": true, "`": true };

            function pareceFimDePalavra(charAntes) {
                return !!charAntes && /[a-zA-Z0-9_$]/.test(charAntes);
            }

            function tentarAutoFechar(e) {
                let ch = e.key;
                let start = editor.selectionStart;
                let end = editor.selectionEnd;
                let val = editor.value;

                if (start !== end && PARES_ABERTURA[ch]) {
                    e.preventDefault();
                    let selecionado = val.slice(start, end);
                    editorReplaceRange(start, end, ch + selecionado + PARES_ABERTURA[ch]);
                    editor.selectionStart = start + 1;
                    editor.selectionEnd = start + 1 + selecionado.length;
                    return true;
                }

                if (start !== end) return false;

                if (PARES_FECHAMENTO[ch] && val[start] === ch) {
                    e.preventDefault();
                    editor.selectionStart = editor.selectionEnd = start + 1;
                    return true;
                }

                if (PARES_ABERTURA[ch]) {
                    if (ASPAS[ch] && pareceFimDePalavra(val[start - 1])) return false;

                    if (ASPAS[ch] && val[start] !== undefined && /[a-zA-Z0-9_$]/.test(val[start])) return false;
                    e.preventDefault();
                    editorReplaceSelection(ch + PARES_ABERTURA[ch]);
                    editor.selectionStart = editor.selectionEnd = start + 1;
                    return true;
                }

                return false;
            }

            function tentarApagarPar(e) {
                if (e.key !== "Backspace") return false;
                let start = editor.selectionStart;
                let end = editor.selectionEnd;
                if (start !== end || start === 0) return false;
                let val = editor.value;
                let antes = val[start - 1];
                let depois = val[start];
                if (PARES_ABERTURA[antes] && PARES_ABERTURA[antes] === depois) {
                    e.preventDefault();
                    editorReplaceRange(start - 1, start + 1, "");
                    editor.selectionStart = editor.selectionEnd = start - 1;
                    return true;
                }
                return false;
            }

            function alternarComentario() {
                let start = editor.selectionStart;
                let end = editor.selectionEnd;
                let val = editor.value;
                let lineStart = val.lastIndexOf("\n", start - 1) + 1;
                let lineEndBusca = val.indexOf("\n", Math.max(end - 1, lineStart));
                let lineEnd = lineEndBusca === -1 ? val.length : lineEndBusca;
                let bloco = val.slice(lineStart, lineEnd);
                let linhas = bloco.split("\n");

                let linhasComConteudo = linhas.filter((l) => l.trim() !== "");
                let todasComentadas = linhasComConteudo.length > 0 && linhasComConteudo.every((l) => /^\s*\/\//.test(l));

                let novoBloco;
                if (todasComentadas) {
                    novoBloco = linhas.map((l) => l.replace(/^(\s*)\/\/ ?/, "$1")).join("\n");
                } else {
                    novoBloco = linhas.map((l) => (l.trim() === "" ? l : l.replace(/^(\s*)/, "$1// "))).join("\n");
                }

                let diffPrimeiraLinha = (linhas[0] || "").length - (novoBloco.split("\n")[0] || "").length;
                editorReplaceRange(lineStart, lineEnd, novoBloco);

                editor.selectionStart = Math.max(lineStart, start - diffPrimeiraLinha);
                editor.selectionEnd = lineStart + novoBloco.length;
            }

            function selecionarProximaOcorrencia() {
                let start = editor.selectionStart;
                let end = editor.selectionEnd;
                let val = editor.value;

                if (start === end) {

                    let ini = start;
                    let fim = start;
                    while (ini > 0 && /[a-zA-Z0-9_$]/.test(val[ini - 1])) ini--;
                    while (fim < val.length && /[a-zA-Z0-9_$]/.test(val[fim])) fim++;
                    if (ini === fim) return;
                    editor.selectionStart = ini;
                    editor.selectionEnd = fim;
                    editor.focus();
                    return;
                }

                let termo = val.slice(start, end);
                if (!termo) return;
                let proximo = val.indexOf(termo, end);

                if (proximo === -1) proximo = val.indexOf(termo);
                if (proximo === -1 || proximo === start) return;
                editor.selectionStart = proximo;
                editor.selectionEnd = proximo + termo.length;
                editor.focus();

                let m = editorMetrics();
                let linhaAlvo = val.slice(0, proximo).split("\n").length - 1;
                let alvoY = linhaAlvo * m.lineHeight;
                if (alvoY < editor.scrollTop || alvoY > editor.scrollTop + editor.clientHeight - m.lineHeight) {
                    editor.scrollTop = Math.max(0, alvoY - editor.clientHeight / 2);
                    syncScroll();
                }
            }

            let acEl = document.getElementById("se-autocomplete");
            let acItens = [];
            let acIndex = 0;
            let acInicio = 0;
            let acFim = 0;

            function acFechar() {
                acEl.hidden = true;
                acItens = [];
            }

            function acContexto() {
                let pos = editor.selectionStart;
                if (pos !== editor.selectionEnd) return null;
                let val = editor.value;
                let antes = val.slice(Math.max(0, pos - 60), pos);

                let m = /(_utils\.([a-zA-Z0-9_$]+)\.)([a-zA-Z0-9_$]*)$/.exec(antes);
                if (m) {
                    let filhos = SYDLE_AUTOCOMPLETE.utilsFilhos[m[2]];
                    if (!filhos) return null;
                    return { prefixo: m[3], lista: filhos.map((t) => ({ texto: t, detalhe: "_utils." + m[2] + "." + t })) };
                }

                m = /(_utils\.)([a-zA-Z0-9_$]*)$/.exec(antes);
                if (m) {
                    return { prefixo: m[2], lista: SYDLE_AUTOCOMPLETE.utils };
                }

                m = /(_context\.)([a-zA-Z0-9_$]*)$/.exec(antes);
                if (m) {
                    return { prefixo: m[2], lista: SYDLE_AUTOCOMPLETE.context.map((t) => ({ texto: t, detalhe: "_context." + t })) };
                }

                m = /(^|[^a-zA-Z0-9_$])(_[a-zA-Z0-9_$]*)$/.exec(antes);
                if (m && m[2].length >= 1) {
                    return { prefixo: m[2], lista: SYDLE_AUTOCOMPLETE.globals };
                }

                m = /(^|[^a-zA-Z0-9_$])([a-zA-Z][a-zA-Z0-9_$]*)$/.exec(antes);
                if (m && m[2].length >= 2) {
                    let lista = snippetsParaAutocomplete(m[2]);
                    if (lista.length) return { prefixo: m[2], lista: lista };
                }

                return null;
            }

            function snippetsParaAutocomplete(prefixo) {
                let prefixoLower = prefixo.toLowerCase();
                return getSnippets()
                    .filter((s) => s.nome.toLowerCase().indexOf(prefixoLower) === 0)
                    .map((s) => ({ texto: s.nome, detalhe: "snippet", _snippet: true, _codigo: s.codigo }));
            }

            function acRenderizar() {
                acEl.innerHTML = acItens
                    .map(function (it, i) {
                        let t = escHtml(it.texto);
                        let marcado = it._prefixoLen ? "<b>" + t.slice(0, it._prefixoLen) + "</b>" + t.slice(it._prefixoLen) : t;
                        return (
                            '<div class="se-autocomplete-item' + (i === acIndex ? " se-ac-active" : "") + '" data-ac="' + i + '">' +
                            '<span class="se-autocomplete-item-texto">' + marcado + "</span>" +
                            (it.detalhe ? '<span class="se-autocomplete-item-detalhe">' + escHtml(it.detalhe) + "</span>" : "") +
                            "</div>"
                        );
                    })
                    .join("");
                let ativo = acEl.querySelector(".se-ac-active");
                if (ativo) ativo.scrollIntoView({ block: "nearest" });
            }

            function acPosicionar() {
                let m = editorMetrics();
                let val = editor.value;
                let linha = val.slice(0, acInicio).split("\n").length - 1;
                let inicioLinha = val.lastIndexOf("\n", acInicio - 1) + 1;
                let coluna = acInicio - inicioLinha;
                let linhaTopoNaTela = linha * m.lineHeight - editor.scrollTop + m.padTop;
                let left = coluna * m.charWidth - editor.scrollLeft + m.padLeft;

                let alturaPopup = acEl.offsetHeight || 220;
                let espacoAbaixo = editor.clientHeight - (linhaTopoNaTela + m.lineHeight);
                let abrirParaCima = espacoAbaixo < alturaPopup && linhaTopoNaTela > alturaPopup;

                if (abrirParaCima) {
                    acEl.style.top = "";
                    acEl.style.bottom = editor.clientHeight - linhaTopoNaTela + "px";
                } else {
                    acEl.style.bottom = "";
                    acEl.style.top = Math.max(0, linhaTopoNaTela + m.lineHeight) + "px";
                }
                acEl.style.left = Math.max(0, left) + "px";
            }

            let acCheckTimer = null;
            function acAgendarCheck() {
                if (acCheckTimer) clearTimeout(acCheckTimer);
                acCheckTimer = setTimeout(acVerificar, 80);
            }

            function acVerificar() {
                if (!cfg.autocompleteEnabled) {
                    acFechar();
                    return;
                }
                let ctx = acContexto();
                if (!ctx || !ctx.lista.length) {
                    acFechar();
                    return;
                }
                let prefixoLower = ctx.prefixo.toLowerCase();
                let filtrados = ctx.lista.filter((it) => it.texto.toLowerCase().indexOf(prefixoLower) === 0);
                if (!filtrados.length) {
                    acFechar();
                    return;
                }
                acItens = filtrados.slice(0, 30).map((it) => Object.assign({ _prefixoLen: ctx.prefixo.length }, it));
                acIndex = 0;
                acFim = editor.selectionStart;
                acInicio = acFim - ctx.prefixo.length;
                acEl.hidden = false;
                acRenderizar();
                acPosicionar();
            }

            function acAplicar(i) {
                let it = acItens[i];
                if (!it) return;
                let { texto, cursorOffset } = resolverInsercaoAutocomplete(it);
                editorReplaceRange(acInicio, acFim, texto);
                editor.selectionStart = editor.selectionEnd = acInicio + cursorOffset;
                acFechar();
                editor.focus();
            }

            acEl.addEventListener("mousedown", (e) => {

                let item = e.target.closest(".se-autocomplete-item");
                if (!item) return;
                e.preventDefault();
                acAplicar(Number(item.dataset.ac));
            });

            editor.addEventListener("blur", acFechar);

            editor.addEventListener("keydown", (e) => {

                if (!acEl.hidden && acItens.length) {
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        acIndex = (acIndex + 1) % acItens.length;
                        acRenderizar();
                        return;
                    }
                    if (e.key === "ArrowUp") {
                        e.preventDefault();
                        acIndex = (acIndex - 1 + acItens.length) % acItens.length;
                        acRenderizar();
                        return;
                    }
                    if (e.key === "Tab" || e.key === "Enter") {
                        e.preventDefault();
                        acAplicar(acIndex);
                        return;
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                        acFechar();
                        return;
                    }
                }
                if (atalhoBateComEvento(cfg.shortcuts.comentar, e)) {
                    e.preventDefault();
                    alternarComentario();
                    return;
                }
                if (atalhoBateComEvento(cfg.shortcuts.proximaOcorrencia, e)) {
                    e.preventDefault();
                    selecionarProximaOcorrencia();
                    return;
                }
                if (!e.ctrlKey && !e.metaKey && !e.altKey && (PARES_ABERTURA[e.key] || PARES_FECHAMENTO[e.key])) {
                    if (tentarAutoFechar(e)) return;
                }
                if (!e.ctrlKey && !e.metaKey && !e.altKey && tentarApagarPar(e)) return;
                if (e.key === "Tab") {
                    e.preventDefault();
                    let start = editor.selectionStart;
                    let end = editor.selectionEnd;
                    let val = editor.value;
                    if (start === end) {
                        editorReplaceSelection("    ");
                    } else {
                        let lineStart = val.lastIndexOf("\n", start - 1) + 1;
                        let block = val.substring(lineStart, end);
                        if (e.shiftKey) {
                            let newBlock = block.replace(/^(    |   |  | |\t)/gm, "");
                            let removed = block.length - newBlock.length;
                            let firstLine = block.substring(0, block.indexOf("\n") === -1 ? block.length : block.indexOf("\n"));
                            let firstLineNew = firstLine.replace(/^(    |   |  | |\t)/, "");
                            let firstLineRemoved = firstLine.length - firstLineNew.length;
                            editorReplaceRange(lineStart, end, newBlock);
                            editor.selectionStart = Math.max(lineStart, start - firstLineRemoved);
                            editor.selectionEnd = lineStart + newBlock.length;
                        } else {
                            let newBlock = block.replace(/^/gm, "    ");
                            let addedLines = (block.match(/\n/g) || []).length + 1;
                            let totalAdded = addedLines * 4;
                            editorReplaceRange(lineStart, end, newBlock);
                            editor.selectionStart = start + 4;
                            editor.selectionEnd = lineStart + newBlock.length;
                        }
                    }
                }

            });

            function openFindBar() {
                let findBar = document.getElementById("se-find-bar");
                findBar.classList.add("se-find-visible");
                let findInput = document.getElementById("se-find-input");
                let sel = editor.value.substring(editor.selectionStart, editor.selectionEnd);
                if (sel) findInput.value = sel;
                findInput.focus();
                findInput.select();
            }

            let globalShortcutHandler = (e) => {
                if (!document.body.contains(overlay)) {
                    document.removeEventListener("keydown", globalShortcutHandler, true);
                    return;
                }

                if (e.target && e.target.classList && e.target.classList.contains("se-inline-rename")) return;

                if (e.target && e.target.closest && e.target.closest(".se-cls-method-editor")) return;

                let capturandoAtalho = e.target && e.target.classList && e.target.classList.contains("se-shortcut-input");
                let sc = cfg.shortcuts;

                if (!capturandoAtalho && atalhoBateComEvento(sc.renomear, e) && !isInlineEditing() && currentSidebarTarget()) {
                    e.preventDefault();
                    e.stopPropagation();
                    beginRenameSelected();
                    return;
                }

                if (e.key === "Delete" && !isInlineEditing()) {
                    let alvo = e.target;
                    let digitando = alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT" || alvo.isContentEditable);
                    if (!digitando && currentSidebarTarget()) {
                        e.preventDefault();
                        e.stopPropagation();
                        excluirSelecaoDoPainel();
                        return;
                    }
                }
                if (!capturandoAtalho && atalhoBateComEvento(sc.salvar, e)) {
                    e.preventDefault();
                    e.stopPropagation();
                    btnSave.click();
                    return;
                }
                if (!capturandoAtalho && atalhoBateComEvento(sc.executar, e)) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (syntaxCheckTimer) {
                        clearTimeout(syntaxCheckTimer);
                        syntaxCheckTimer = null;
                        runSyntaxCheck();
                    }
                    if (syntaxDiagnostic) {
                        let extras = syntaxProblems.length > 1 ? " (+" + (syntaxProblems.length - 1) + " em Problems)" : "";
                        showToast("warning", "Linha " + syntaxDiagnostic.line + ": " + syntaxDiagnostic.message + extras);
                    }
                    if (!btnRun.disabled) btnRun.click();
                    return;
                }
                if (!capturandoAtalho && atalhoBateComEvento(sc.buscar, e)) {
                    e.preventDefault();
                    e.stopPropagation();
                    openFindBar();
                    return;
                }
                if (!capturandoAtalho && atalhoBateComEvento(sc.formatar, e)) {
                    e.preventDefault();
                    e.stopPropagation();
                    btnFormat.click();
                    return;
                }
                if (e.key === "Escape") {
                    let findBar = document.getElementById("se-find-bar");
                    if (findBar && findBar.classList.contains("se-find-visible")) {
                        findBar.classList.remove("se-find-visible");
                        editor.focus();
                        return;
                    }
                    if (document.querySelector(".se-confirm-overlay") || document.querySelector(".se-out-modal-overlay")) return;
                    if (document.querySelector(".swal2-container")) return;
                    e.preventDefault();
                    e.stopPropagation();
                    tryClose();
                }
            };
            document.addEventListener("keydown", globalShortcutHandler, true);

            {
                let findBar = document.getElementById("se-find-bar");
                let findInput = document.getElementById("se-find-input");
                let findInfo = document.getElementById("se-find-info");
                let findMatchIdx = 0;
                let findMatches = [];

                function doFind() {
                    let term = findInput.value;
                    findMatches = [];
                    if (!term) {
                        findInfo.textContent = "";
                        return;
                    }
                    let code = editor.value;
                    let lower = code.toLowerCase();
                    let tLower = term.toLowerCase();
                    let pos = 0;
                    while (true) {
                        let idx = lower.indexOf(tLower, pos);
                        if (idx === -1) break;
                        findMatches.push(idx);
                        pos = idx + 1;
                    }
                    if (findMatches.length === 0) {
                        findInfo.textContent = "0 resultados";
                        return;
                    }
                    findMatchIdx = 0;
                    let cur = editor.selectionStart;
                    for (let i = 0; i < findMatches.length; i++) {
                        if (findMatches[i] >= cur) {
                            findMatchIdx = i;
                            break;
                        }
                    }
                    goToMatch();
                }

                function goToMatch(focusEditor) {
                    if (findMatches.length === 0) return;
                    let pos = findMatches[findMatchIdx];
                    let term = findInput.value;
                    editor.selectionStart = pos;
                    editor.selectionEnd = pos + term.length;
                    let linesBefore = editor.value.substring(0, pos).split("\n").length;
                    let lineH = 20.8;
                    editor.scrollTop = Math.max(0, (linesBefore - 5) * lineH);
                    findInfo.textContent = findMatchIdx + 1 + " de " + findMatches.length;
                    if (focusEditor) editor.focus();
                }

                findInput.addEventListener("input", doFind);
                findInput.addEventListener("keydown", (e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                        e.preventDefault();
                        if (e.shiftKey) findPrev();
                        else findNext();
                    }
                    if (e.key === "Escape") {
                        findBar.classList.remove("se-find-visible");
                        editor.focus();
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                        e.preventDefault();
                    }
                });
                function findNext() {
                    if (findMatches.length === 0) return;
                    findMatchIdx = (findMatchIdx + 1) % findMatches.length;
                    goToMatch(true);
                }
                function findPrev() {
                    if (findMatches.length === 0) return;
                    findMatchIdx = (findMatchIdx - 1 + findMatches.length) % findMatches.length;
                    goToMatch(true);
                }
                document.getElementById("se-find-next").addEventListener("click", findNext);
                document.getElementById("se-find-prev").addEventListener("click", findPrev);
                document.getElementById("se-find-close").addEventListener("click", () => {
                    findBar.classList.remove("se-find-visible");
                    editor.focus();
                });

                let replaceRow = document.getElementById("se-replace-row");
                document.getElementById("se-find-toggle-replace").addEventListener("click", () => {
                    let vis = replaceRow.style.display !== "none";
                    replaceRow.style.display = vis ? "none" : "flex";
                    if (!vis) document.getElementById("se-replace-input").focus();
                });

                document.getElementById("se-replace-one").addEventListener("click", () => {
                    if (findMatches.length === 0) return;
                    let term = findInput.value;
                    let repl = document.getElementById("se-replace-input").value;
                    let pos = findMatches[findMatchIdx];
                    editorReplaceRange(pos, pos + term.length, repl);
                    doFind();
                });

                document.getElementById("se-replace-all").addEventListener("click", () => {
                    let term = findInput.value;
                    if (!term) return;
                    let repl = document.getElementById("se-replace-input").value;
                    let count = 0;
                    let code = editor.value;
                    let lower = code.toLowerCase();
                    let tLower = term.toLowerCase();
                    let result = "";
                    let lastEnd = 0;
                    let pos = 0;
                    while (true) {
                        let idx = lower.indexOf(tLower, pos);
                        if (idx === -1) break;
                        result += code.substring(lastEnd, idx) + repl;
                        lastEnd = idx + term.length;
                        pos = idx + 1;
                        count++;
                    }
                    result += code.substring(lastEnd);
                    editorReplaceRange(0, editor.value.length, result);
                    doFind();
                    findInfo.textContent = count + " substituídos";
                });

                document.getElementById("se-replace-input").addEventListener("keydown", (e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                        e.preventDefault();
                        document.getElementById("se-replace-one").click();
                    }
                    if (e.key === "Escape") {
                        findBar.classList.remove("se-find-visible");
                        editor.focus();
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                        e.preventDefault();
                    }
                });
            }

            function showConfirmModal(title, message, onStay, onLeave, opts) {
                let o = opts || {};
                let stayLabel = o.stayLabel || "Voltar";
                let leaveLabel = o.leaveLabel || "Sair sem salvar";
                let leaveColor = o.leaveColor || "#e74c3c";
                let ov = document.createElement("div");
                ov.className = "se-confirm-overlay";
                ov.innerHTML =
                    '<div class="se-confirm-box"><h3>' +
                    title +
                    "</h3><p>" +
                    message +
                    "</p>" +
                    '<div class="se-confirm-btns"><button class="se-confirm-stay">' +
                    stayLabel +
                    "</button>" +
                    '<button class="se-confirm-leave" style="background:' +
                    leaveColor +
                    ';">' +
                    leaveLabel +
                    "</button></div></div>";
                document.body.appendChild(ov);
                ov.querySelector(".se-confirm-stay").addEventListener("click", () => {
                    ov.remove();
                    if (onStay) onStay();
                });
                ov.querySelector(".se-confirm-leave").addEventListener("click", () => {
                    ov.remove();
                    if (onLeave) onLeave();
                });
                ov.addEventListener("click", (e) => {
                    if (e.target === ov) {
                        ov.remove();
                        if (onStay) onStay();
                    }
                });
            }

            function showInputModal(title, label, placeholder, onConfirm, opts) {
                opts = opts || {};
                let ov = document.createElement("div");
                ov.className = "se-confirm-overlay";
                ov.innerHTML =
                    '<div class="se-confirm-box"><h3>' +
                    title +
                    "</h3>" +
                    '<p style="margin-bottom:12px;">' +
                    label +
                    "</p>" +
                    '<input class="se-name-input" id="se-input-modal-val" placeholder="' +
                    (placeholder || "") +
                    '" value="' +
                    escHtml(String(opts.value == null ? "" : opts.value)) +
                    '" style="width:100%;box-sizing:border-box;margin-bottom:18px;">' +
                    '<div class="se-confirm-btns"><button class="se-confirm-stay">Cancelar</button>' +
                    '<button class="se-confirm-leave" style="background:#1C3C2E;">' +
                    (opts.confirmLabel || "Criar") +
                    "</button></div></div>";
                document.body.appendChild(ov);
                let inp = ov.querySelector("#se-input-modal-val");
                setTimeout(() => {
                    inp.focus();
                    inp.select();
                }, 50);
                inp.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        ov.remove();
                        onConfirm(inp.value);
                    }
                });
                ov.querySelector(".se-confirm-stay").addEventListener("click", () => {
                    ov.remove();
                });
                ov.querySelector(".se-confirm-leave").addEventListener("click", () => {
                    ov.remove();
                    onConfirm(inp.value);
                });
                ov.addEventListener("click", (e) => {
                    if (e.target === ov) ov.remove();
                });
            }

            function abasComAlteracao() {
                capturarAbaAtiva();
                return openTabs.filter(tabEstaSuja);
            }

            function tryClose() {
                let sujas = abasComAlteracao();
                if (!sujas.length) {
                    closeExecutor();
                    return;
                }
                let nomes = sujas.map((t) => String(t.name).trim() || "sem nome");
                showConfirmModal(
                    sujas.length === 1 ? "Alterações não salvas" : sujas.length + " abas com alterações não salvas",
                    "Sair sem salvar? " + nomes.join(", "),
                    null,
                    () => {
                        closeExecutor();
                    },
                    { stayLabel: "Voltar", leaveLabel: "Sair sem salvar", leaveColor: "#e74c3c" }
                );
            }

            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    tryClose();
                }
            });

            function refreshSidebar(activeIdx) {
                let filter = (document.getElementById("se-sidebar-search") || {}).value || "";
                sidebarList.innerHTML = buildSidebarItems(getSavedScripts(), typeof activeIdx === "number" ? activeIdx : -1, filter.trim().toLowerCase());

                if (typeof renderEnvSelect === "function") renderEnvSelect();
            }

            let sidebarSelection = null;

            function currentSidebarTarget() {
                if (sidebarSelection && sidebarSelection.kind === "script" && getSavedScripts()[sidebarSelection.idx]) return sidebarSelection;
                if (sidebarSelection && sidebarSelection.kind === "folder" && getFolders().indexOf(sidebarSelection.folder) !== -1) return sidebarSelection;
                sidebarSelection = null;
                if (typeof currentIdx === "number" && getSavedScripts()[currentIdx]) return { kind: "script", idx: currentIdx };
                return null;
            }

            function isInlineEditing() {
                return !!sidebarList.querySelector(".se-inline-rename");
            }

            function startInlineEdit(row, labelEl, initialValue, selectBase, validate, onCommit) {
                if (isInlineEditing()) return;

                let input = document.createElement("input");
                input.type = "text";
                input.className = "se-inline-rename";
                input.spellcheck = false;
                input.value = initialValue;

                let wasDraggable = row.draggable;
                row.draggable = false;
                if (labelEl) {
                    labelEl.style.display = "none";
                    row.insertBefore(input, labelEl);
                } else {
                    row.appendChild(input);
                }

                let errorEl = null;
                let finished = false;

                function showError(msg) {
                    input.classList.add("se-inline-invalid");
                    if (!errorEl) {
                        errorEl = document.createElement("div");
                        errorEl.className = "se-inline-error";
                        row.insertAdjacentElement("afterend", errorEl);
                    }
                    errorEl.textContent = msg;
                }

                function clearError() {
                    input.classList.remove("se-inline-invalid");
                    if (errorEl) {
                        errorEl.remove();
                        errorEl = null;
                    }
                }

                function teardown() {
                    finished = true;
                    clearError();
                    row.draggable = wasDraggable;
                    input.remove();
                    if (labelEl) labelEl.style.display = "";
                }

                function cancel() {
                    if (finished) return;
                    teardown();
                    refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                }

                function commit() {
                    if (finished) return;
                    let value = input.value.trim();
                    if (!value || value === initialValue.trim()) {
                        cancel();
                        return;
                    }
                    let err = validate(value);
                    if (err) {
                        showError(err);
                        return;
                    }
                    teardown();
                    onCommit(value);
                }

                input.addEventListener("input", () => {
                    let value = input.value.trim();
                    if (!value) {
                        clearError();
                        return;
                    }
                    let err = validate(value);
                    if (err) showError(err);
                    else clearError();
                });

                input.addEventListener("keydown", (e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancel();
                    }
                });

                ["click", "dblclick", "mousedown", "contextmenu"].forEach((evt) => {
                    input.addEventListener(evt, (e) => e.stopPropagation());
                });

                input.addEventListener("blur", () => {
                    if (finished) return;
                    let value = input.value.trim();
                    if (!value || validate(value)) cancel();
                    else commit();
                });

                input.focus();
                let sel = splitScriptName(initialValue);
                if (selectBase && sel.ext) input.setSelectionRange(0, sel.base.length);
                else input.select();
            }

            function beginRenameScript(idx) {
                let row = sidebarList.querySelector('.se-sidebar-item[data-idx="' + idx + '"]');
                if (!row) return;
                let scripts = getSavedScripts();
                let script = scripts[idx];
                if (!script) return;

                startInlineEdit(
                    row,
                    row.querySelector(".se-file-name"),
                    script.name,
                    true,
                    (value) => {
                        let clash = scripts.some((s, i) => i !== idx && (s.folder || "") === (script.folder || "") && (s.name || "").toLowerCase() === value.toLowerCase());
                        return clash ? 'Ja existe um script chamado "' + value + '" nesta pasta.' : null;
                    },
                    (value) => {
                        let sc = getSavedScripts();
                        if (!sc[idx]) return;
                        sc[idx].name = value;
                        sc[idx].updatedAt = Date.now();
                        saveSavedScripts(sc);

                        if (currentIdx === idx) {
                            nameInput.value = value;
                            lastSavedName = value;
                        }
                        refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                        showToast("success", 'Renomeado para "' + value + '"');
                    }
                );
            }

            function beginRenameFolder(folderName) {
                let row = sidebarList.querySelector('.se-sidebar-folder[data-folder="' + folderName + '"]');
                if (!row) return;

                startInlineEdit(
                    row,
                    row.querySelector(".se-folder-name"),
                    folderName,
                    false,
                    (value) => {
                        let clash = getFolders().some((f) => f !== folderName && f.toLowerCase() === value.toLowerCase());
                        return clash ? 'Ja existe uma pasta chamada "' + value + '".' : null;
                    },
                    (value) => {
                        saveFolders(getFolders().map((f) => (f === folderName ? value : f)));
                        let sc = getSavedScripts();
                        for (let s of sc) {
                            if (s.folder === folderName) s.folder = value;
                        }
                        saveSavedScripts(sc);
                        saveCollapsedFolders(getCollapsedFolders().map((f) => (f === folderName ? value : f)));
                        if (sidebarSelection && sidebarSelection.kind === "folder") sidebarSelection = { kind: "folder", folder: value };
                        refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                        showToast("success", 'Pasta renomeada para "' + value + '"');
                    }
                );
            }

            function beginCreateScript(folder) {
                if (isInlineEditing()) return;

                let row = document.createElement("div");
                row.className = "se-sidebar-item";
                let ext = getExtIcon("novo.js");
                row.innerHTML = '<span class="se-file-icon" style="background:' + ext.color + ";color:" + (ext.textColor || "#fff") + ';">' + ext.icon + "</span>";

                let container = folder ? sidebarList.querySelector('[data-folder-items="' + folder + '"]') : sidebarList;
                if (!container) container = sidebarList;
                if (folder) {
                    container.classList.remove("se-collapsed");
                    let arrow = sidebarList.querySelector('.se-sidebar-folder[data-folder="' + folder + '"] .se-folder-arrow');
                    if (arrow) arrow.classList.add("se-open");
                }
                container.insertBefore(row, container.firstChild);

                startInlineEdit(
                    row,
                    null,
                    "",
                    false,
                    (value) => {
                        let clash = getSavedScripts().some((s) => (s.folder || "") === (folder || "") && (s.name || "").toLowerCase() === value.toLowerCase());
                        return clash ? 'Ja existe um script chamado "' + value + '" nesta pasta.' : null;
                    },
                    (value) => {
                        let sc = getSavedScripts();
                        let entry = { name: value, code: "", createdAt: Date.now(), updatedAt: Date.now() };
                        if (folder) entry.folder = folder;
                        sc.push(entry);
                        saveSavedScripts(sc);
                        loadScript(sc.length - 1);
                        sidebarSelection = { kind: "script", idx: sc.length - 1 };
                        editor.focus();
                        showToast("success", 'Script "' + value + '" criado');
                    }
                );
            }

            function beginCreateFolder() {
                if (isInlineEditing()) return;

                let row = document.createElement("div");
                row.className = "se-sidebar-folder";
                row.innerHTML = '<span class="se-folder-arrow se-open">▶</span><span class="se-folder-icon">📁</span>';
                sidebarList.insertBefore(row, sidebarList.firstChild);

                startInlineEdit(
                    row,
                    null,
                    "",
                    false,
                    (value) => {
                        let clash = getFolders().some((f) => f.toLowerCase() === value.toLowerCase());
                        return clash ? 'Ja existe uma pasta chamada "' + value + '".' : null;
                    },
                    (value) => {
                        let flds = getFolders();
                        flds.push(value);
                        saveFolders(flds);
                        sidebarSelection = { kind: "folder", folder: value };
                        refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                        showToast("success", 'Pasta "' + value + '" criada');
                    }
                );
            }

            function beginRenameSelected() {
                let target = currentSidebarTarget();
                if (!target) return;
                if (target.kind === "folder") beginRenameFolder(target.folder);
                else beginRenameScript(target.idx);
            }

            function _formatLogDateTime(ts) {
                if (!ts) return { data: "-", hora: "-" };
                let d = new Date(ts);
                let data = d.toLocaleDateString("pt-BR");
                let hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                return { data, hora };
            }

            function renderExecutionLogs() {
                let tbody = document.getElementById("se-logs-tbody");
                let emptyEl = document.getElementById("se-logs-empty");
                if (!tbody) return;
                let logs = getExecutionLogs();

                if (!logs.length) {
                    tbody.innerHTML = "";
                    if (emptyEl) emptyEl.style.display = "";
                    return;
                }
                if (emptyEl) emptyEl.style.display = "none";

                let statusLabel = { ok: "✔ Concluído", timeout: "⏱ Timeout", erro: "✖ Erro" };
                let statusColor = { ok: "#3fb950", timeout: "#e2a03f", erro: "#e74c3c" };

                tbody.innerHTML = logs
                    .map((log, idx) => {
                        let inicio = _formatLogDateTime(log.startedAt);
                        let fim = _formatLogDateTime(log.finishedAt);
                        return (
                            '<tr style="border-bottom:1px solid #2a2a2a;">' +
                            '<td style="padding:8px 10px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                            escHtml(log.name) +
                            "</td>" +
                            '<td style="padding:8px 10px;white-space:nowrap;">' +
                            inicio.data +
                            "</td>" +
                            '<td style="padding:8px 10px;white-space:nowrap;">' +
                            inicio.hora +
                            "</td>" +
                            '<td style="padding:8px 10px;white-space:nowrap;">' +
                            fim.hora +
                            "</td>" +
                            '<td style="padding:8px 10px;white-space:nowrap;color:' +
                            (statusColor[log.status] || "#999") +
                            ';">' +
                            (statusLabel[log.status] || log.status) +
                            "</td>" +
                            '<td style="padding:8px 10px;">' +
                            (log.resultado
                                ? '<button type="button" class="se-btn se-log-view-result" data-idx="' + idx + '" style="padding:4px 10px;font-size:11.5px;">Abrir</button>'
                                : '<span style="color:#555;">—</span>') +
                            "</td>" +
                            '<td style="padding:8px 10px;">' +
                            '<button type="button" class="se-btn se-log-view-script" data-idx="' +
                            idx +
                            '" style="padding:4px 10px;font-size:11.5px;">Ver</button>' +
                            "</td>" +
                            "</tr>"
                        );
                    })
                    .join("");
            }

            function showReadOnlyScriptModal(name, code) {
                let ov = document.createElement("div");
                ov.className = "se-out-modal-overlay";
                let modalCss =
                    "<style>" +
                    ".se-out-modal-overlay { position:fixed;top:0;left:0;width:100%;height:100%;z-index:1080;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center; }" +
                    ".se-out-modal { width:85vw;max-width:1100px;height:75vh;background:#1e1e1e;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column;overflow:hidden; }" +
                    ".se-out-modal-header { display:flex;align-items:center;padding:14px 20px;background:#252526;border-bottom:1px solid #333; }" +
                    ".se-out-modal-header h3 { margin:0;font-size:15px;color:#ddd;flex:1; }" +
                    '.se-out-modal-body { flex:1;padding:20px;overflow-y:auto;font-family:"Cascadia Code","Fira Code","Consolas",monospace;font-size:13px;line-height:1.6;color:#d4d4d4;white-space:pre-wrap; }' +

                    ".se-hl-cm { color: #6a9955; font-style: italic; }" +
                    ".se-hl-st { color: #ce9178; }" +
                    ".se-hl-kw { color: #569cd6; }" +
                    ".se-hl-nm { color: #b5cea8; }" +
                    ".se-btn { padding:6px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;background:#2d2d2d;color:#ccc; }" +
                    ".se-btn:hover { background:#3a3a3a; }" +
                    ".se-btn-danger { background:#c0392b;color:#fff; }" +
                    ".se-btn-danger:hover { background:#e74c3c; }" +
                    "</style>";
                ov.innerHTML =
                    modalCss +
                    '<div class="se-out-modal">' +
                    '<div class="se-out-modal-header"><h3>' +
                    escHtml(name) +
                    "</h3>" +
                    '<button type="button" class="se-btn" id="se-log-script-copy" style="margin-right:8px;">Copiar</button>' +
                    '<button type="button" class="se-btn se-btn-danger" id="se-log-script-close" style="padding:4px 14px;">Fechar</button></div>' +
                    '<div class="se-out-modal-body">' +
                    highlightCode(code) +
                    "</div></div>";
                document.body.appendChild(ov);
                ov.querySelector("#se-log-script-close").addEventListener("click", () => ov.remove());
                ov.querySelector("#se-log-script-copy").addEventListener("click", () => {
                    navigator.clipboard.writeText(code).then(() => showToast("success", "Script copiado!"));
                });
                ov.addEventListener("click", (e) => {
                    if (e.target === ov) ov.remove();
                });
                ov.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") ov.remove();
                });
            }

            document.getElementById("se-logs-tbody").addEventListener("click", (e) => {
                let idx = e.target.dataset.idx;
                if (idx === undefined) return;
                let logs = getExecutionLogs();
                let log = logs[parseInt(idx)];
                if (!log) return;

                if (e.target.classList.contains("se-log-view-result")) {
                    if (!log.resultado) return;
                    lastResultRaw = log.resultado;
                    try {
                        lastResultParsed = JSON.parse(log.resultado);
                    } catch (e2) {
                        lastResultParsed = null;
                    }
                    openOutputModal();
                } else if (e.target.classList.contains("se-log-view-script")) {
                    showReadOnlyScriptModal(log.name, log.code || "(script não disponível)");
                }
            });

            renderExecutionLogs();

            function requestCreateScript() {
                let target = currentSidebarTarget();
                let folder = null;
                if (target && target.kind === "folder") folder = target.folder;
                if (isDirty()) {
                    showConfirmModal("Alterações não salvas", "Deseja trocar de script sem salvar?", null, () => {
                        beginCreateScript(folder);
                    });
                } else {
                    beginCreateScript(folder);
                }
            }

            document.getElementById("se-act-new-file").addEventListener("click", requestCreateScript);
            document.getElementById("se-act-new-folder").addEventListener("click", beginCreateFolder);

            let envSelect = document.getElementById("se-env-select");

            let envSelectTravado = false;

            document.getElementById("se-envbar").addEventListener("mousedown", (e) => {
                if (!envSelectTravado) return;
                e.preventDefault();
                showToast("warning", "Troca de ambiente bloqueada enquanto a aba Classes estiver aberta. Vá em outra aba para trocar.");
            });

            function renderEnvSelect() {
                let atual = sytoolsEnvId();
                let selecionado = sytoolsSelectedEnv();
                let opcoes = "";
                for (let env of sytoolsKnownEnvs()) {
                    let qtd = 0;
                    try {
                        qtd = (JSON.parse(sytoolsGetRaw(EXECUTOR_STORAGE_KEY, env.id)) || []).length;
                    } catch (e) {}
                    let rotulo = env.label + (env.id === atual ? " (atual)" : "") + " · " + qtd;
                    opcoes += '<option value="' + escHtml(env.id) + '" title="' + escHtml(env.id) + '"' + (env.id === selecionado ? " selected" : "") + ">" + escHtml(rotulo) + "</option>";
                }
                envSelect.innerHTML = opcoes;
                envSelect.classList.toggle("se-env-outro", selecionado !== atual);

                envSelect.title = envSelectTravado
                    ? "Troca de ambiente bloqueada na aba Classes (ela sempre usa o ambiente atual: " + atual + ")"
                    : selecionado === atual
                    ? "Ambiente atual: " + selecionado
                    : "Visualizando " + selecionado + " · a execução acontece em " + atual;
            }

            function renomearAmbiente() {
                let alvo = sytoolsSelectedEnv();
                showInputModal(
                    "Renomear ambiente",
                    '<span style="color:#888;font-size:12px;">' + escHtml(alvo) + "</span><br>Nome exibido (deixe vazio para voltar ao automático):",
                    sytoolsEnvLabelAuto(alvo),
                    (nome) => {
                        sytoolsRenameEnv(alvo, nome);
                        renderEnvSelect();
                        showToast("success", "Ambiente agora aparece como " + sytoolsEnvLabel(alvo));
                    },
                    { value: sytoolsEnvLabel(alvo), confirmLabel: "Renomear" }
                );
            }

            function aplicarTrocaDeAmbiente(alvo) {
                sytoolsSetSelectedEnv(alvo);

                openTabs = [];
                activeTab = -1;
                editor.value = "";
                nameInput.value = "";
                currentIdx = "_new_";
                sidebarSelection = null;
                lastSavedCode = "";
                lastSavedName = "";
                renderSavedIds();
                renderEnvSelect();

                restaurarAbas();
                if (alvo !== sytoolsEnvId()) showToast("info", "Visualizando " + sytoolsEnvLabel(alvo) + ". A execução continua em " + sytoolsEnvLabel(sytoolsEnvId()) + ".");
            }

            envSelect.addEventListener("change", () => {

                if (envSelectTravado) {
                    envSelect.value = sytoolsSelectedEnv();
                    showToast("warning", "Troca de ambiente bloqueada enquanto a aba Classes estiver aberta. Vá em outra aba para trocar.");
                    return;
                }
                let alvo = envSelect.value;
                if (alvo === sytoolsSelectedEnv()) return;
                if (isDirty()) {
                    showConfirmModal(
                        "Alterações não salvas",
                        "Trocar de ambiente sem salvar o script atual?",
                        () => {
                            envSelect.value = sytoolsSelectedEnv();
                        },
                        () => aplicarTrocaDeAmbiente(alvo)
                    );
                    return;
                }
                aplicarTrocaDeAmbiente(alvo);
            });

            document.getElementById("se-act-rename-env").addEventListener("click", renomearAmbiente);

            renderEnvSelect();

            let sidebarSearchInput = document.getElementById("se-sidebar-search");
            sidebarSearchInput.addEventListener("input", () => {
                refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
            });

            sidebarList.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                let existingMenu = document.querySelector(".se-ctx-menu");
                if (existingMenu) existingMenu.remove();

                let itemEl = e.target.closest(".se-sidebar-item[data-idx]");
                let folderEl = e.target.closest(".se-sidebar-folder");
                if (folderEl && folderEl.dataset.folder) sidebarSelection = { kind: "folder", folder: folderEl.dataset.folder };
                else if (itemEl && itemEl.dataset.idx && itemEl.dataset.idx !== "_new_") sidebarSelection = { kind: "script", idx: parseInt(itemEl.dataset.idx) };
                let menu = document.createElement("div");
                menu.className = "se-ctx-menu";
                menu.style.cssText =
                    "position:fixed;top:" +
                    e.clientY +
                    "px;left:" +
                    e.clientX +
                    "px;z-index:1090;" +
                    "background:#252526;border:1px solid #444;border-radius:6px;padding:4px 0;min-width:160px;" +
                    "box-shadow:0 4px 16px rgba(0,0,0,0.5);font-family:-apple-system,sans-serif;font-size:13px;color:#ccc;";

                let ctxIconStyle = "width:14px;height:14px;vertical-align:middle;margin-right:8px;";
                let items = [];
                items.push({ html: '<img src="' + iconAddFile + '" style="' + ctxIconStyle + '">Novo Script', action: "new_file" });
                items.push({ html: '<img src="' + iconAddFolder + '" style="' + ctxIconStyle + '">Nova Pasta', action: "new_folder" });
                let ctxHintStyle = "margin-left:auto;padding-left:18px;color:#777;font-size:11px;";
                if (itemEl && itemEl.dataset.idx && itemEl.dataset.idx !== "_new_") {
                    items.push({ sep: true });
                    items.push({ html: '<img src="' + iconPlay + '" style="' + ctxIconStyle + '">Executar Script', action: "exec_script", idx: itemEl.dataset.idx });
                    items.push({ sep: true });
                    items.push({ html: '<img src="' + iconEdit + '" style="' + ctxIconStyle + '">Renomear<span style="' + ctxHintStyle + '">F2</span>', action: "rename_script", idx: itemEl.dataset.idx });
                    items.push({ html: '<img src="' + iconDelete + '" style="' + ctxIconStyle + '">Excluir Script<span style="' + ctxHintStyle + '">Del</span>', action: "delete_script", idx: itemEl.dataset.idx });
                }
                if (folderEl) {
                    items.push({ sep: true });
                    items.push({ html: '<img src="' + iconEdit + '" style="' + ctxIconStyle + '">Renomear Pasta<span style="' + ctxHintStyle + '">F2</span>', action: "rename_folder", folder: folderEl.dataset.folder });
                    items.push({ html: '<img src="' + iconDelete + '" style="' + ctxIconStyle + '">Excluir Pasta<span style="' + ctxHintStyle + '">Del</span>', action: "delete_folder", folder: folderEl.dataset.folder });
                }

                for (let it of items) {
                    if (it.sep) {
                        let sep = document.createElement("div");
                        sep.style.cssText = "height:1px;background:#444;margin:4px 0;";
                        menu.appendChild(sep);
                    } else {
                        let opt = document.createElement("div");
                        opt.innerHTML = it.html;
                        opt.style.cssText = "padding:6px 16px;cursor:pointer;display:flex;align-items:center;";
                        opt.addEventListener("mouseenter", () => {
                            opt.style.background = "#37373d";
                        });
                        opt.addEventListener("mouseleave", () => {
                            opt.style.background = "transparent";
                        });
                        opt.addEventListener("click", () => {
                            menu.remove();
                            if (it.action === "new_file") {
                                requestCreateScript();
                            } else if (it.action === "new_folder") {
                                beginCreateFolder();
                            } else if (it.action === "rename_script") {
                                beginRenameScript(parseInt(it.idx));
                            } else if (it.action === "rename_folder") {
                                beginRenameFolder(it.folder);
                            } else if (it.action === "exec_script") {
                                let sc = getSavedScripts();
                                let targetScript = sc[parseInt(it.idx)];
                                if (targetScript) {
                                    editor.value = targetScript.code;
                                    nameInput.value = targetScript.name;
                                    currentIdx = parseInt(it.idx);
                                    markClean();
                                    refreshSidebar(currentIdx);
                                    syncHighlight();
                                    executarScript();
                                }
                            } else if (it.action === "delete_script") {
                                excluirScript(it.idx);
                            } else if (it.action === "delete_folder") {
                                excluirPasta(it.folder);
                            }
                        });
                        menu.appendChild(opt);
                    }
                }
                document.body.appendChild(menu);
                let closeMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener("click", closeMenu);
                    }
                };
                setTimeout(() => document.addEventListener("click", closeMenu), 10);
            });

            const LAST_SCRIPT_IDX_KEY = "sytools_executor_last_idx";
            const OPEN_TABS_KEY = "sytools_open_tabs";

            function persistirAbas() {
                let indices = [];
                let ativo = -1;
                for (let i = 0; i < openTabs.length; i++) {
                    if (typeof openTabs[i].idx !== "number") continue;
                    if (i === activeTab) ativo = indices.length;
                    indices.push(openTabs[i].idx);
                }
                sytoolsSetRaw(OPEN_TABS_KEY, JSON.stringify({ tabs: indices, active: ativo }));
            }

            function restaurarAbas() {
                openTabs = [];
                activeTab = -1;

                let salvos = getSavedScripts();
                let estado = null;
                try {
                    estado = JSON.parse(sytoolsGetRaw(OPEN_TABS_KEY));
                } catch (e) {}

                let indices = estado && Object.prototype.toString.call(estado.tabs) === "[object Array]" ? estado.tabs : null;
                if (!indices) {

                    let ultimo = sytoolsGetRaw(LAST_SCRIPT_IDX_KEY);
                    let n = ultimo === null ? NaN : parseInt(ultimo);
                    indices = !isNaN(n) && salvos[n] ? [n] : [];
                }

                for (let idx of indices) {
                    let s = salvos[idx];

                    if (!s || posicaoDaAba(idx) >= 0) continue;
                    openTabs.push({ idx: idx, name: s.name, code: s.code, savedName: String(s.name).trim(), savedCode: s.code });
                }

                if (!openTabs.length) {
                    limparEditorSemAba();
                    return;
                }
                let alvo = estado && typeof estado.active === "number" && openTabs[estado.active] ? estado.active : openTabs.length - 1;
                ativarAba(alvo, false);
            }

            function tabEstaSuja(t) {
                return t.code !== t.savedCode || String(t.name).trim() !== t.savedName;
            }

            function posicaoDaAba(idx) {
                for (let i = 0; i < openTabs.length; i++) {
                    if (openTabs[i].idx === idx) return i;
                }
                return -1;
            }

            function capturarAbaAtiva() {
                if (activeTab < 0 || !openTabs[activeTab]) return;
                openTabs[activeTab].code = editor.value;
                openTabs[activeTab].name = nameInput.value;
            }

            function renderTabs() {
                if (!openTabs.length) {
                    editorTabs.innerHTML = '<div class="se-etab-empty">Nenhum script aberto</div>';
                    return;
                }
                let html = "";
                for (let i = 0; i < openTabs.length; i++) {
                    let t = openTabs[i];
                    let nome = String(t.name || "").trim() || "sem nome";
                    let ext = getExtIcon(nome);
                    html +=
                        '<div class="se-etab' +
                        (i === activeTab ? " se-etab-active" : "") +
                        '" data-pos="' +
                        i +
                        '" title="' +
                        escHtml(nome) +
                        '">' +
                        '<span class="se-file-icon" style="background:' +
                        ext.color +
                        ";color:" +
                        (ext.textColor || "#fff") +
                        ';">' +
                        ext.icon +
                        "</span>" +
                        '<span class="se-etab-name">' +
                        escHtml(nome) +
                        "</span>" +
                        (tabEstaSuja(t) ? '<span class="se-etab-dirty" title="Alterações não salvas"></span>' : "") +
                        '<span class="se-etab-close" data-close="' +
                        i +
                        '" title="Fechar">×</span>' +
                        "</div>";
                }
                editorTabs.innerHTML = html;
            }

            function ativarAba(pos, capturar) {
                if (pos < 0 || !openTabs[pos]) return;
                if (capturar !== false) capturarAbaAtiva();
                activeTab = pos;
                let t = openTabs[pos];
                editor.value = t.code;

                editor.selectionStart = editor.selectionEnd = 0;
                editor.scrollTop = 0;
                nameInput.value = t.name;
                lastSavedCode = t.savedCode;
                lastSavedName = t.savedName;
                currentIdx = t.idx;
                renderTabs();
                refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                syncHighlight();
                runSyntaxCheck();
                if (typeof t.idx === "number") sytoolsSetRaw(LAST_SCRIPT_IDX_KEY, String(t.idx));
                persistirAbas();
            }

            function limparEditorSemAba() {
                activeTab = -1;
                currentIdx = "_new_";
                editor.value = "";
                nameInput.value = "";
                lastSavedCode = "";
                lastSavedName = "";
                renderTabs();
                refreshSidebar(-1);
                syncHighlight();
                runSyntaxCheck();
                sytoolsRemoveRaw(LAST_SCRIPT_IDX_KEY);
                persistirAbas();
            }

            function loadScript(idx) {
                if (idx === "_new_") {
                    let jaAberta = posicaoDaAba("_new_");
                    if (jaAberta >= 0) {
                        ativarAba(jaAberta);
                        return;
                    }
                    capturarAbaAtiva();
                    openTabs.push({ idx: "_new_", name: "", code: "", savedName: "", savedCode: "" });
                    ativarAba(openTabs.length - 1, false);
                    return;
                }

                let alvo = parseInt(idx);
                let s = getSavedScripts()[alvo];
                if (!s) return;

                let jaAberta = posicaoDaAba(alvo);
                if (jaAberta >= 0) {
                    ativarAba(jaAberta);
                    return;
                }
                capturarAbaAtiva();
                openTabs.push({ idx: alvo, name: s.name, code: s.code, savedName: String(s.name).trim(), savedCode: s.code });
                ativarAba(openTabs.length - 1, false);
            }

            function fecharAba(pos, forcar) {
                let t = openTabs[pos];
                if (!t) return;

                if (pos === activeTab) capturarAbaAtiva();
                if (!forcar && tabEstaSuja(t)) {
                    showConfirmModal(
                        "Alterações não salvas",
                        'Fechar "' + (String(t.name).trim() || "sem nome") + '" sem salvar?',
                        null,
                        () => fecharAba(pos, true),
                        { stayLabel: "Voltar", leaveLabel: "Fechar sem salvar", leaveColor: "#e74c3c" }
                    );
                    return;
                }
                let eraAtiva = pos === activeTab;
                openTabs.splice(pos, 1);
                if (!openTabs.length) {
                    limparEditorSemAba();
                    return;
                }
                if (eraAtiva) {
                    ativarAba(Math.min(pos, openTabs.length - 1), false);
                    return;
                }
                if (activeTab > pos) activeTab--;
                renderTabs();
                persistirAbas();
            }

            editorTabs.addEventListener("click", (e) => {
                let fechar = e.target.closest("[data-close]");
                if (fechar) {
                    e.stopPropagation();
                    fecharAba(parseInt(fechar.dataset.close));
                    return;
                }
                let aba = e.target.closest(".se-etab[data-pos]");
                if (aba) ativarAba(parseInt(aba.dataset.pos));
            });

            editorTabs.addEventListener("mousedown", (e) => {
                if (e.button !== 1) return;
                let aba = e.target.closest(".se-etab[data-pos]");
                if (!aba) return;
                e.preventDefault();
                fecharAba(parseInt(aba.dataset.pos));
            });

            restaurarAbas();
            showPanel("problems");
            renderProblems();
            runSyntaxCheck();

            sidebarList.addEventListener("click", (e) => {
                let folderEl = e.target.closest(".se-sidebar-folder");
                if (folderEl) {
                    let folderName = folderEl.dataset.folder;
                    if (folderName) sidebarSelection = { kind: "folder", folder: folderName };
                    let itemsDiv = sidebarList.querySelector('[data-folder-items="' + folderName + '"]');
                    let arrow = folderEl.querySelector(".se-folder-arrow");
                    if (itemsDiv) {
                        itemsDiv.classList.toggle("se-collapsed");
                        if (arrow) arrow.classList.toggle("se-open");
                        let collapsed = getCollapsedFolders();
                        if (itemsDiv.classList.contains("se-collapsed")) {
                            if (collapsed.indexOf(folderName) === -1) collapsed.push(folderName);
                        } else {
                            collapsed = collapsed.filter((f) => f !== folderName);
                        }
                        saveCollapsedFolders(collapsed);
                    }
                    return;
                }

                let item = e.target.closest(".se-sidebar-item");
                if (!item) return;

                let targetIdx = item.dataset.idx;
                if (targetIdx !== undefined && targetIdx !== "_new_") sidebarSelection = { kind: "script", idx: parseInt(targetIdx) };

                loadScript(targetIdx);

                mostrarAba("editor");
            });

            sidebarList.addEventListener("dragstart", (e) => {
                let item = e.target.closest(".se-sidebar-item[data-idx]");
                if (!item || item.dataset.idx === "_new_") {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.setData("text/plain", item.dataset.idx);
                e.dataTransfer.effectAllowed = "move";
            });

            sidebarList.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                sidebarList.querySelectorAll(".se-drag-over, .se-drag-over-folder").forEach((el) => {
                    el.classList.remove("se-drag-over", "se-drag-over-folder");
                });
                let folder = e.target.closest(".se-sidebar-folder");
                let folderItems = e.target.closest(".se-sidebar-folder-items");
                if (folder) folder.classList.add("se-drag-over-folder");
                else if (folderItems) {
                    let parentFolder = folderItems.previousElementSibling;
                    if (parentFolder) parentFolder.classList.add("se-drag-over-folder");
                }
            });

            sidebarList.addEventListener("dragleave", (e) => {
                let folder = e.target.closest(".se-sidebar-folder");
                if (folder) folder.classList.remove("se-drag-over-folder");
            });

            sidebarList.addEventListener("drop", (e) => {
                e.preventDefault();
                sidebarList.querySelectorAll(".se-drag-over, .se-drag-over-folder").forEach((el) => {
                    el.classList.remove("se-drag-over", "se-drag-over-folder");
                });

                let draggedIdx = parseInt(e.dataTransfer.getData("text/plain"));
                if (isNaN(draggedIdx)) return;

                let sc = getSavedScripts();
                if (!sc[draggedIdx]) return;

                let folder = e.target.closest(".se-sidebar-folder");
                let folderItems = e.target.closest(".se-sidebar-folder-items");
                let targetFolder = null;

                if (folder) targetFolder = folder.dataset.folder;
                else if (folderItems) targetFolder = folderItems.dataset.folderItems;

                if (targetFolder) {
                    sc[draggedIdx].folder = targetFolder;
                } else {
                    delete sc[draggedIdx].folder;
                }
                saveSavedScripts(sc);
                refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                showToast("info", '"' + sc[draggedIdx].name + '" movido' + (targetFolder ? ' para "' + targetFolder + '"' : " para raiz"));
            });

            function mostrarAba(nomeTab) {
                modal.querySelectorAll(".se-tab").forEach((t) => t.classList.toggle("se-tab-active", t.dataset.tab === nomeTab));
                modal.querySelectorAll(".se-tab-content").forEach((c) => c.classList.toggle("se-tab-visible", c.id === "se-tab-" + nomeTab));
                if (nomeTab === "ids") renderSavedIds();
                if (nomeTab === "classes") renderClassFavList();
                if (nomeTab === "snippets") renderSnippetList();

                let ehClasses = nomeTab === "classes";
                let ehSnippets = nomeTab === "snippets";
                let listaPropria = ehClasses || ehSnippets;
                document.getElementById("se-sidebar-search").parentElement.style.display = listaPropria ? "none" : "";
                document.getElementById("se-sidebar-list").style.display = listaPropria ? "none" : "";
                document.getElementById("se-cls-sidebar-area").style.display = ehClasses ? "flex" : "none";
                document.getElementById("se-snip-sidebar-area").style.display = ehSnippets ? "flex" : "none";

                document.getElementById("se-act-new-file").style.display = listaPropria ? "none" : "";
                document.getElementById("se-act-new-folder").style.display = listaPropria ? "none" : "";

                envSelectTravado = ehClasses;

                if (ehClasses && sytoolsSelectedEnv() !== sytoolsEnvId()) sytoolsSetSelectedEnv(sytoolsEnvId());
                renderEnvSelect();
                let envSelectEl = document.getElementById("se-env-select");
                if (envSelectEl) envSelectEl.title = ehClasses ? "Troca de ambiente bloqueada na aba Classes (ela sempre usa o ambiente atual: " + sytoolsEnvId() + ")" : "";
            }

            modal.querySelectorAll(".se-tab").forEach((tab) => {
                tab.addEventListener("click", () => mostrarAba(tab.dataset.tab));
            });

            function criarMiniEditor(els, opts) {
                opts = opts || {};
                let ta = els.ta;
                let salvo = "";

                function isDirty() {
                    return ta.value !== salvo;
                }
                function markClean() {
                    salvo = ta.value;
                    if (opts.onDirtyChange) opts.onDirtyChange(false);
                }
                function atualizarDirty() {
                    if (opts.onDirtyChange) opts.onDirtyChange(isDirty());
                }

                let problems = [];
                let checkToken = 0;
                let checkTimer = null;
                let codigoAnalisado = null;
                let linhasAnalisadas = [];

                function renderProblems() {
                    if (els.problemsBadgeEl) {
                        els.problemsBadgeEl.textContent = String(problems.length);
                        els.problemsBadgeEl.classList.toggle("se-ptab-badge-erro", problems.length > 0);
                    }
                    if (!els.problemsEl) return;
                    if (!problems.length) {
                        els.problemsEl.innerHTML = '<div class="se-problems-empty">Nenhum problema detectado.</div>';
                        return;
                    }
                    els.problemsEl.innerHTML = problems
                        .map(function (d, i) {
                            let pos = d.line ? "Ln " + d.line + (typeof d.column === "number" ? ", Col " + (d.column + 1) : "") : "sem posição";
                            let fix =
                                d.quickFixToken && d.line
                                    ? '<span class="se-problem-fix" data-fix="' + i + '" title="Inserir &quot;' + escHtml(d.quickFixToken).replace(/"/g, "&quot;") + '&quot; aqui">+ ' + escHtml(d.quickFixToken) + "</span>"
                                    : "";
                            return (
                                '<div class="se-problem" data-problem="' +
                                i +
                                '" title="' +
                                escHtml(String(d.message)).replace(/"/g, "&quot;") +
                                '"' +
                                (d.line ? "" : ' style="cursor:default"') +
                                ">" +
                                '<span class="se-problem-icon">&#10007;</span>' +
                                '<span class="se-problem-pos">' +
                                escHtml(pos) +
                                "</span>" +
                                '<span class="se-problem-msg">' +
                                escHtml(String(d.message)) +
                                "</span>" +
                                fix +
                                "</div>"
                            );
                        })
                        .join("");
                }

                function irParaErro(d) {
                    if (!d || !d.line) return;
                    let linhas = ta.value.split("\n");
                    let alvo = Math.min(d.line, linhas.length) - 1;
                    let offset = 0;
                    for (let i = 0; i < alvo; i++) offset += linhas[i].length + 1;
                    offset += Math.min(d.column || 0, linhas[alvo] ? linhas[alvo].length : 0);

                    ta.focus();
                    ta.setSelectionRange(offset, offset + (d.length || 1));
                    let m = editorMetrics(ta);
                    ta.scrollTop = Math.max(0, alvo * m.lineHeight - ta.clientHeight / 2);
                    syncScroll();
                }

                function aplicarQuickFix(d) {
                    if (!d || !d.quickFixToken || !d.line) return;
                    let linhas = ta.value.split("\n");
                    let alvo = Math.min(d.line, linhas.length) - 1;
                    let offset = 0;
                    for (let i = 0; i < alvo; i++) offset += linhas[i].length + 1;
                    offset += Math.min(d.column || 0, linhas[alvo] ? linhas[alvo].length : 0);
                    replaceRange(offset, offset, d.quickFixToken);
                    ta.selectionStart = ta.selectionEnd = offset + d.quickFixToken.length;

                    scheduleCheck();
                }

                if (els.problemsEl) {
                    els.problemsEl.addEventListener("click", function (e) {
                        let fixEl = e.target.closest(".se-problem-fix");
                        if (fixEl) {

                            e.stopPropagation();
                            aplicarQuickFix(problems[Number(fixEl.dataset.fix)]);
                            return;
                        }
                        let item = e.target.closest(".se-problem");
                        if (!item) return;
                        irParaErro(problems[Number(item.dataset.problem)]);
                    });
                }

                if (els.errorRulerEl) {
                    els.errorRulerEl.addEventListener("click", function (e) {
                        let tick = e.target.closest(".se-error-ruler-tick");
                        if (!tick) return;
                        irParaErro(problems[Number(tick.dataset.problem)]);
                    });
                }
                function scheduleCheck() {
                    if (checkTimer) clearTimeout(checkTimer);
                    checkTimer = setTimeout(runCheck, 150);
                }
                function runCheck() {
                    let token = ++checkToken;
                    let code = ta.value;
                    requestGrammarCheck(code, (lista) => {
                        if (token !== checkToken) return;
                        let d;
                        if (Array.isArray(lista)) d = lista.filter(Boolean);
                        else {
                            let local = sytoolsAnalyzeSyntax(code);
                            d = local ? [local] : [];
                        }
                        problems = d;

                        codigoAnalisado = code;
                        linhasAnalisadas = code.split("\n");
                        renderProblems();
                        updateGutterErros();
                        renderSyntaxDiagnostic();
                        if (opts.onProblemsChange) opts.onProblemsChange(problems);
                    });
                }

                function renderSyntaxDiagnostic() {
                    if (els.errorLayerEl) els.errorLayerEl.innerHTML = "";
                    if (els.errorRulerEl) els.errorRulerEl.innerHTML = "";
                    if (!els.errorLayerEl && !els.errorRulerEl) return;
                    if (!problems.length) {

                        syncScroll();
                        return;
                    }

                    let valorAtual = ta.value;
                    let lines = valorAtual.split("\n");

                    let analiseAtual = codigoAnalisado === null || codigoAnalisado === valorAtual;

                    if (els.errorRulerEl) {
                        problems.forEach(function (d, i) {
                            if (!d || !d.line) return;
                            let tick = document.createElement("div");
                            tick.className = "se-error-ruler-tick";
                            tick.style.top = Math.min(99, ((d.line - 1) / Math.max(1, lines.length)) * 100) + "%";
                            tick.title = "Linha " + d.line + ": " + d.message;
                            tick.dataset.problem = String(i);
                            els.errorRulerEl.appendChild(tick);
                        });
                    }
                    if (!els.errorLayerEl) return;

                    let porLinha = {};
                    problems.forEach(function (d) {
                        if (!d || !d.line) return;
                        let text = lines[d.line - 1];
                        if (text === undefined) return;
                        if (!analiseAtual && linhasAnalisadas.length && text !== linhasAnalisadas[d.line - 1]) return;

                        let ini;
                        let fim;
                        if (typeof d.column === "number") {
                            ini = Math.max(0, Math.min(d.column, text.length));
                            fim = Math.min(text.length, ini + Math.max(1, d.length || 1));
                        } else {

                            ini = text.length - text.replace(/^\s+/, "").length;
                            fim = text.length;
                        }
                        if (!porLinha[d.line]) porLinha[d.line] = [];
                        porLinha[d.line].push({ ini: ini, fim: fim, msg: d.message });
                    });

                    let alguma = false;
                    let saida = lines
                        .map(function (text, idx) {

                            text = text.replace(/\r$/, "");
                            let marcas = porLinha[idx + 1];
                            if (!marcas || !marcas.length) {

                                return escHtml(text) || "&nbsp;";
                            }
                            alguma = true;

                            marcas.sort(function (a, b) {
                                return a.ini - b.ini;
                            });
                            let html = "";
                            let cursor = 0;
                            for (let k = 0; k < marcas.length; k++) {
                                let r = marcas[k];

                                if (r.ini < cursor) r.ini = cursor;
                                if (r.ini > text.length) r.ini = text.length;
                                html += escHtml(text.slice(cursor, r.ini));

                                let trecho = text.slice(r.ini, Math.max(r.fim, r.ini + 1));

                                let inventado = trecho === "";
                                if (inventado) trecho = " ";

                                html +=
                                    '<span class="se-error-underline" title="' +
                                    escHtml("Linha " + (idx + 1) + ": " + r.msg).replace(/"/g, "&quot;") +
                                    '">' +
                                    escHtml(trecho) +
                                    "</span>";
                                cursor = inventado ? r.ini : r.ini + trecho.length;
                            }
                            html += escHtml(text.slice(cursor));
                            return html;
                        })
                        .join("\n");

                    els.errorLayerEl.innerHTML = alguma ? saida : "";
                    els.errorLayerEl.style.transform = "";
                    syncScroll();
                }
                function updateGutterErros() {
                    if (!els.gutterInnerEl) return;
                    let comErro = {};
                    problems.forEach((d) => {
                        if (d && d.line) comErro[d.line] = true;
                    });
                    let linhas = ta.value.split("\n");
                    let nums = [];
                    for (let n = 1; n <= linhas.length; n++) {
                        nums.push(comErro[n] ? '<span class="se-gutter-erro">' + n + "</span>" : String(n));
                    }
                    els.gutterInnerEl.innerHTML = nums.join("\n");
                }

                function reforcarLinhasVazias(html) {
                    return html
                        .replace(/\n$/, "")
                        .split("\n")
                        .map((linha) => linha || "&nbsp;")
                        .join("\n");
                }

                function renderIndentGuides(code) {
                    if (!els.indentGuidesEl) return;
                    let linhas = code.split("\n");
                    let niveisPorLinha = linhas.map(nivelIndentacao);

                    let niveisEfetivos = niveisPorLinha.slice();
                    for (let i = 0; i < linhas.length; i++) {
                        if (linhas[i].trim() !== "") continue;
                        let antes = 0;
                        for (let a = i - 1; a >= 0; a--) {
                            if (linhas[a].trim() !== "") {
                                antes = niveisPorLinha[a];
                                break;
                            }
                        }
                        let depois = 0;
                        for (let d = i + 1; d < linhas.length; d++) {
                            if (linhas[d].trim() !== "") {
                                depois = niveisPorLinha[d];
                                break;
                            }
                        }
                        niveisEfetivos[i] = Math.min(antes, depois);
                    }

                    let saida = niveisEfetivos.map(function (niveis) {
                        if (niveis === 0) return "";
                        let out = "";
                        for (let n = 0; n < niveis; n++) out += '<span class="se-indent-guide">    </span>';
                        return out;
                    });
                    els.indentGuidesEl.innerHTML = saida.join("\n");
                }

                function sync() {
                    if (els.highlightPre) els.highlightPre.innerHTML = reforcarLinhasVazias(highlightCode(ta.value));
                    updateGutterErros();
                    renderIndentGuides(ta.value);

                    renderSyntaxDiagnostic();
                }
                function syncScroll() {
                    if (els.highlightPre) {
                        els.highlightPre.scrollTop = ta.scrollTop;
                        els.highlightPre.scrollLeft = ta.scrollLeft;
                    }
                    if (els.indentGuidesEl) {
                        els.indentGuidesEl.scrollTop = ta.scrollTop;
                        els.indentGuidesEl.scrollLeft = ta.scrollLeft;
                    }
                    if (els.findHighlightEl) {
                        els.findHighlightEl.scrollTop = ta.scrollTop;
                        els.findHighlightEl.scrollLeft = ta.scrollLeft;
                    }
                    if (els.errorLayerEl) {
                        els.errorLayerEl.scrollTop = ta.scrollTop;
                        els.errorLayerEl.scrollLeft = ta.scrollLeft;
                    }
                    if (els.gutterEl) els.gutterEl.scrollTop = ta.scrollTop;
                }

                let acEl = els.autocompleteEl;
                let acItens = [];
                let acIndex = 0;
                let acInicio = 0;
                let acFim = 0;

                function acFechar() {
                    if (!acEl) return;
                    acEl.hidden = true;
                    acItens = [];
                }

                function acContexto() {
                    let pos = ta.selectionStart;
                    if (pos !== ta.selectionEnd) return null;
                    let val = ta.value;
                    let antes = val.slice(Math.max(0, pos - 60), pos);

                    let m = /(_utils\.([a-zA-Z0-9_$]+)\.)([a-zA-Z0-9_$]*)$/.exec(antes);
                    if (m) {
                        let filhos = SYDLE_AUTOCOMPLETE.utilsFilhos[m[2]];
                        if (!filhos) return null;
                        return { prefixo: m[3], lista: filhos.map((t) => ({ texto: t, detalhe: "_utils." + m[2] + "." + t })) };
                    }

                    m = /(_utils\.)([a-zA-Z0-9_$]*)$/.exec(antes);
                    if (m) return { prefixo: m[2], lista: SYDLE_AUTOCOMPLETE.utils };

                    m = /(_context\.)([a-zA-Z0-9_$]*)$/.exec(antes);
                    if (m) return { prefixo: m[2], lista: SYDLE_AUTOCOMPLETE.context.map((t) => ({ texto: t, detalhe: "_context." + t })) };

                    m = /(^|[^a-zA-Z0-9_$])(_[a-zA-Z0-9_$]*)$/.exec(antes);
                    if (m && m[2].length >= 1) return { prefixo: m[2], lista: SYDLE_AUTOCOMPLETE.globals };

                    m = /(^|[^a-zA-Z0-9_$])([a-zA-Z][a-zA-Z0-9_$]*)$/.exec(antes);
                    if (m && m[2].length >= 2) {
                        let lista = snippetsParaAutocomplete(m[2]);
                        if (lista.length) return { prefixo: m[2], lista: lista };
                    }

                    return null;
                }

                function acRenderizar() {
                    acEl.innerHTML = acItens
                        .map(function (it, i) {
                            let t = escHtml(it.texto);
                            let marcado = it._prefixoLen ? "<b>" + t.slice(0, it._prefixoLen) + "</b>" + t.slice(it._prefixoLen) : t;
                            return (
                                '<div class="se-autocomplete-item' + (i === acIndex ? " se-ac-active" : "") + '" data-ac="' + i + '">' +
                                '<span class="se-autocomplete-item-texto">' + marcado + "</span>" +
                                (it.detalhe ? '<span class="se-autocomplete-item-detalhe">' + escHtml(it.detalhe) + "</span>" : "") +
                                "</div>"
                            );
                        })
                        .join("");
                    let ativo = acEl.querySelector(".se-ac-active");
                    if (ativo) ativo.scrollIntoView({ block: "nearest" });
                }

                function acPosicionar() {
                    let m = editorMetrics(ta);
                    let val = ta.value;
                    let linha = val.slice(0, acInicio).split("\n").length - 1;
                    let inicioLinha = val.lastIndexOf("\n", acInicio - 1) + 1;
                    let coluna = acInicio - inicioLinha;
                    let linhaTopoNaTela = linha * m.lineHeight - ta.scrollTop + m.padTop;
                    let left = coluna * m.charWidth - ta.scrollLeft + m.padLeft;

                    let alturaPopup = acEl.offsetHeight || 220;
                    let espacoAbaixo = ta.clientHeight - (linhaTopoNaTela + m.lineHeight);
                    let abrirParaCima = espacoAbaixo < alturaPopup && linhaTopoNaTela > alturaPopup;

                    if (abrirParaCima) {
                        acEl.style.top = "";
                        acEl.style.bottom = ta.clientHeight - linhaTopoNaTela + "px";
                    } else {
                        acEl.style.bottom = "";
                        acEl.style.top = Math.max(0, linhaTopoNaTela + m.lineHeight) + "px";
                    }
                    acEl.style.left = Math.max(0, left) + "px";
                }

                let acCheckTimer = null;
                function acAgendarCheck() {
                    if (acCheckTimer) clearTimeout(acCheckTimer);
                    acCheckTimer = setTimeout(acVerificar, 80);
                }

                function acVerificar() {
                    if (!acEl || !cfg.autocompleteEnabled) {
                        acFechar();
                        return;
                    }
                    let ctx = acContexto();
                    if (!ctx || !ctx.lista.length) {
                        acFechar();
                        return;
                    }
                    let prefixoLower = ctx.prefixo.toLowerCase();
                    let filtrados = ctx.lista.filter((it) => it.texto.toLowerCase().indexOf(prefixoLower) === 0);
                    if (!filtrados.length) {
                        acFechar();
                        return;
                    }
                    acItens = filtrados.slice(0, 30).map((it) => Object.assign({ _prefixoLen: ctx.prefixo.length }, it));
                    acIndex = 0;
                    acFim = ta.selectionStart;
                    acInicio = acFim - ctx.prefixo.length;
                    acEl.hidden = false;
                    acRenderizar();
                    acPosicionar();
                }

                function acAplicar(i) {
                    let it = acItens[i];
                    if (!it) return;
                    let { texto, cursorOffset } = resolverInsercaoAutocomplete(it);
                    replaceRange(acInicio, acFim, texto);
                    ta.selectionStart = ta.selectionEnd = acInicio + cursorOffset;
                    acFechar();
                    ta.focus();
                }

                if (acEl) {
                    acEl.addEventListener("mousedown", (e) => {
                        let item = e.target.closest(".se-autocomplete-item");
                        if (!item) return;
                        e.preventDefault();
                        acAplicar(Number(item.dataset.ac));
                    });
                }

                function replaceSelection(text) {
                    ta.focus();
                    document.execCommand("insertText", false, text);
                    sync();
                }
                function replaceRange(from, to, text) {
                    ta.focus();
                    ta.selectionStart = from;
                    ta.selectionEnd = to;
                    document.execCommand("insertText", false, text);
                    sync();
                }
                function tentarAutoFechar(e) {
                    let ch = e.key;
                    let start = ta.selectionStart;
                    let end = ta.selectionEnd;
                    let val = ta.value;
                    if (start !== end && PARES_ABERTURA[ch]) {
                        e.preventDefault();
                        let selecionado = val.slice(start, end);
                        replaceRange(start, end, ch + selecionado + PARES_ABERTURA[ch]);
                        ta.selectionStart = start + 1;
                        ta.selectionEnd = start + 1 + selecionado.length;
                        return true;
                    }
                    if (start !== end) return false;
                    if (PARES_FECHAMENTO[ch] && val[start] === ch) {
                        e.preventDefault();
                        ta.selectionStart = ta.selectionEnd = start + 1;
                        return true;
                    }
                    if (PARES_ABERTURA[ch]) {
                        if (ASPAS[ch] && pareceFimDePalavra(val[start - 1])) return false;
                        if (ASPAS[ch] && val[start] !== undefined && /[a-zA-Z0-9_$]/.test(val[start])) return false;
                        e.preventDefault();
                        replaceSelection(ch + PARES_ABERTURA[ch]);
                        ta.selectionStart = ta.selectionEnd = start + 1;
                        return true;
                    }
                    return false;
                }
                function tentarApagarPar(e) {
                    if (e.key !== "Backspace") return false;
                    let start = ta.selectionStart;
                    let end = ta.selectionEnd;
                    if (start !== end || start === 0) return false;
                    let val = ta.value;
                    let antes = val[start - 1];
                    let depois = val[start];
                    if (PARES_ABERTURA[antes] && PARES_ABERTURA[antes] === depois) {
                        e.preventDefault();
                        replaceRange(start - 1, start + 1, "");
                        ta.selectionStart = ta.selectionEnd = start - 1;
                        return true;
                    }
                    return false;
                }
                function alternarComentario() {
                    let start = ta.selectionStart;
                    let end = ta.selectionEnd;
                    let val = ta.value;
                    let lineStart = val.lastIndexOf("\n", start - 1) + 1;
                    let lineEndBusca = val.indexOf("\n", Math.max(end - 1, lineStart));
                    let lineEnd = lineEndBusca === -1 ? val.length : lineEndBusca;
                    let bloco = val.slice(lineStart, lineEnd);
                    let linhas = bloco.split("\n");
                    let linhasComConteudo = linhas.filter((l) => l.trim() !== "");
                    let todasComentadas = linhasComConteudo.length > 0 && linhasComConteudo.every((l) => /^\s*\/\//.test(l));
                    let novoBloco;
                    if (todasComentadas) {
                        novoBloco = linhas.map((l) => l.replace(/^(\s*)\/\/ ?/, "$1")).join("\n");
                    } else {
                        novoBloco = linhas.map((l) => (l.trim() === "" ? l : l.replace(/^(\s*)/, "$1// "))).join("\n");
                    }
                    let diffPrimeiraLinha = (linhas[0] || "").length - (novoBloco.split("\n")[0] || "").length;
                    replaceRange(lineStart, lineEnd, novoBloco);
                    ta.selectionStart = Math.max(lineStart, start - diffPrimeiraLinha);
                    ta.selectionEnd = lineStart + novoBloco.length;
                }
                function selecionarProximaOcorrencia() {
                    let start = ta.selectionStart;
                    let end = ta.selectionEnd;
                    let val = ta.value;
                    if (start === end) {
                        let ini = start;
                        let fim = start;
                        while (ini > 0 && /[a-zA-Z0-9_$]/.test(val[ini - 1])) ini--;
                        while (fim < val.length && /[a-zA-Z0-9_$]/.test(val[fim])) fim++;
                        if (ini === fim) return;
                        ta.selectionStart = ini;
                        ta.selectionEnd = fim;
                        return;
                    }
                    let termo = val.slice(start, end);
                    let idx = val.indexOf(termo, end);
                    if (idx === -1) idx = val.indexOf(termo);
                    if (idx === -1) return;
                    ta.selectionStart = idx;
                    ta.selectionEnd = idx + termo.length;
                    ta.focus();
                }

                let findBar = els.findBar;
                let findInput = els.findInput;
                let findInfo = els.findInfo;
                let findMatches = [];
                let findIdx = 0;

                function renderFindHighlights() {
                    if (!els.findHighlightEl) return;
                    if (!findMatches.length) {
                        els.findHighlightEl.innerHTML = "";
                        return;
                    }
                    let val = ta.value;
                    let termLen = findInput.value.length;
                    let out = "";
                    let cursor = 0;
                    findMatches.forEach((idx, i) => {
                        out += escHtml(val.slice(cursor, idx));
                        let cls = i === findIdx ? "se-find-match se-find-match-atual" : "se-find-match";
                        out += '<span class="' + cls + '">' + escHtml(val.slice(idx, idx + termLen)) + "</span>";
                        cursor = idx + termLen;
                    });
                    out += escHtml(val.slice(cursor));
                    els.findHighlightEl.innerHTML = reforcarLinhasVazias(out + "\n");
                }

                function doFind() {
                    if (!findInput) return;
                    let term = findInput.value;
                    findMatches = [];
                    if (!term) {
                        if (findInfo) findInfo.textContent = "";
                        renderFindHighlights();
                        return;
                    }
                    let lower = ta.value.toLowerCase();
                    let tLower = term.toLowerCase();
                    let pos = 0;
                    while (true) {
                        let idx = lower.indexOf(tLower, pos);
                        if (idx === -1) break;
                        findMatches.push(idx);
                        pos = idx + 1;
                    }
                    if (!findMatches.length) {
                        if (findInfo) findInfo.textContent = "0 resultados";
                        renderFindHighlights();
                        return;
                    }
                    findIdx = 0;
                    let cur = ta.selectionStart;
                    for (let i = 0; i < findMatches.length; i++) {
                        if (findMatches[i] >= cur) {
                            findIdx = i;
                            break;
                        }
                    }
                    goToMatch();
                }

                function goToMatch(focusEditor) {
                    if (!findMatches.length) return;
                    let idx = findMatches[findIdx];
                    let term = findInput.value;
                    ta.selectionStart = idx;
                    ta.selectionEnd = idx + term.length;
                    let linhas = ta.value.slice(0, idx).split("\n");
                    let linha = linhas.length - 1;
                    let linhaAltura = 13 * 1.6;
                    ta.scrollTop = Math.max(0, linha * linhaAltura - ta.clientHeight / 2);
                    syncScroll();
                    if (findInfo) findInfo.textContent = findIdx + 1 + " de " + findMatches.length;
                    renderFindHighlights();
                    if (focusEditor) ta.focus();
                }
                function openFindBar() {
                    if (!findBar) return;
                    findBar.classList.add("se-find-visible");
                    let sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                    if (sel) findInput.value = sel;
                    findInput.focus();
                    findInput.select();
                    doFind();
                }
                function closeFindBar() {
                    if (!findBar) return;
                    findBar.classList.remove("se-find-visible");
                    findMatches = [];
                    renderFindHighlights();
                    ta.focus();
                }
                if (findInput) {
                    findInput.addEventListener("input", doFind);
                    findInput.addEventListener("keydown", (e) => {

                        e.stopPropagation();
                        if (e.key === "Enter") {
                            e.preventDefault();
                            if (!findMatches.length) return;
                            findIdx = e.shiftKey ? (findIdx - 1 + findMatches.length) % findMatches.length : (findIdx + 1) % findMatches.length;
                            goToMatch(true);
                        } else if (e.key === "Escape") {
                            e.preventDefault();
                            closeFindBar();
                        }
                    });
                }
                if (els.findNextBtn) {
                    els.findNextBtn.addEventListener("click", () => {
                        if (!findMatches.length) return;
                        findIdx = (findIdx + 1) % findMatches.length;
                        goToMatch(true);
                    });
                }
                if (els.findPrevBtn) {
                    els.findPrevBtn.addEventListener("click", () => {
                        if (!findMatches.length) return;
                        findIdx = (findIdx - 1 + findMatches.length) % findMatches.length;
                        goToMatch(true);
                    });
                }
                if (els.findCloseBtn) els.findCloseBtn.addEventListener("click", closeFindBar);

                if (els.replaceToggleBtn && els.replaceRow) {
                    els.replaceToggleBtn.addEventListener("click", () => {
                        let visivel = els.replaceRow.style.display !== "none";
                        els.replaceRow.style.display = visivel ? "none" : "flex";
                        if (!visivel && els.replaceInput) els.replaceInput.focus();
                    });
                }
                if (els.replaceOneBtn && els.replaceInput) {
                    els.replaceOneBtn.addEventListener("click", () => {
                        if (!findMatches.length) return;
                        let term = findInput.value;
                        let pos = findMatches[findIdx];
                        replaceRange(pos, pos + term.length, els.replaceInput.value);
                        doFind();
                    });
                }
                if (els.replaceAllBtn && els.replaceInput) {
                    els.replaceAllBtn.addEventListener("click", () => {
                        let term = findInput.value;
                        if (!term) return;
                        let repl = els.replaceInput.value;
                        let code = ta.value;
                        let lower = code.toLowerCase();
                        let tLower = term.toLowerCase();
                        let resultado = "";
                        let lastEnd = 0;
                        let pos = 0;
                        let count = 0;
                        while (true) {
                            let idx = lower.indexOf(tLower, pos);
                            if (idx === -1) break;
                            resultado += code.substring(lastEnd, idx) + repl;
                            lastEnd = idx + term.length;
                            pos = idx + 1;
                            count++;
                        }
                        resultado += code.substring(lastEnd);
                        replaceRange(0, ta.value.length, resultado);
                        doFind();
                        if (findInfo) findInfo.textContent = count + " substituídos";
                    });
                }
                if (els.replaceInput) {
                    els.replaceInput.addEventListener("keydown", (e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                            e.preventDefault();
                            if (els.replaceOneBtn) els.replaceOneBtn.click();
                        }
                        if (e.key === "Escape") {
                            e.preventDefault();
                            closeFindBar();
                        }
                    });
                }

                let formatando = false;
                function formatarAtual() {
                    if (formatando) return;
                    let code = ta.value;
                    if (!code.trim()) return;
                    formatando = true;
                    requestFormat(code, (r) => {
                        formatando = false;
                        if (!r || !r.ok) {
                            showToast("error", (r && r.erro) || "Não foi possível formatar o script.");
                            return;
                        }
                        if (r.code === code) return;
                        let inicio = ta.selectionStart;
                        ta.value = r.code;
                        ta.selectionStart = ta.selectionEnd = Math.min(inicio, r.code.length);
                        sync();
                        showToast("success", "Script formatado.");
                    });
                }

                ta.addEventListener("input", () => {
                    sync();
                    scheduleCheck();
                    atualizarDirty();
                    acAgendarCheck();

                    if (findBar && findBar.classList.contains("se-find-visible")) doFind();
                    if (opts.onInput) opts.onInput();
                });
                ta.addEventListener("scroll", () => {
                    syncScroll();
                    if (acEl && !acEl.hidden) acFechar();
                });
                ta.addEventListener("blur", acFechar);

                ta.addEventListener("keydown", (e) => {

                    if (acEl && !acEl.hidden && acItens.length) {
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            acIndex = (acIndex + 1) % acItens.length;
                            acRenderizar();
                            return;
                        }
                        if (e.key === "ArrowUp") {
                            e.preventDefault();
                            acIndex = (acIndex - 1 + acItens.length) % acItens.length;
                            acRenderizar();
                            return;
                        }
                        if (e.key === "Tab" || e.key === "Enter") {
                            e.preventDefault();
                            acAplicar(acIndex);
                            return;
                        }
                        if (e.key === "Escape") {
                            e.preventDefault();
                            acFechar();
                            return;
                        }
                    }
                    if (atalhoBateComEvento(cfg.shortcuts.comentar, e)) {
                        e.preventDefault();
                        alternarComentario();
                        return;
                    }
                    if (atalhoBateComEvento(cfg.shortcuts.proximaOcorrencia, e)) {
                        e.preventDefault();
                        selecionarProximaOcorrencia();
                        return;
                    }
                    if (atalhoBateComEvento(cfg.shortcuts.buscar, e)) {
                        e.preventDefault();
                        openFindBar();
                        return;
                    }
                    if (atalhoBateComEvento(cfg.shortcuts.formatar, e)) {
                        e.preventDefault();
                        formatarAtual();
                        return;
                    }
                    if (atalhoBateComEvento(cfg.shortcuts.salvar, e)) {
                        e.preventDefault();
                        if (opts.onSalvarAtalho) opts.onSalvarAtalho();
                        return;
                    }
                    if (!e.ctrlKey && !e.metaKey && !e.altKey && (PARES_ABERTURA[e.key] || PARES_FECHAMENTO[e.key])) {
                        if (tentarAutoFechar(e)) return;
                    }
                    if (!e.ctrlKey && !e.metaKey && !e.altKey && tentarApagarPar(e)) return;
                    if (e.key === "Tab") {
                        e.preventDefault();
                        let start = ta.selectionStart;
                        let end = ta.selectionEnd;
                        let val = ta.value;
                        if (start === end) {
                            replaceSelection("    ");
                        } else {
                            let lineStart = val.lastIndexOf("\n", start - 1) + 1;
                            let block = val.substring(lineStart, end);
                            if (e.shiftKey) {
                                let newBlock = block.replace(/^(    |   |  | |\t)/gm, "");
                                let firstLine = block.substring(0, block.indexOf("\n") === -1 ? block.length : block.indexOf("\n"));
                                let firstLineNew = firstLine.replace(/^(    |   |  | |\t)/, "");
                                let firstLineRemoved = firstLine.length - firstLineNew.length;
                                replaceRange(lineStart, end, newBlock);
                                ta.selectionStart = Math.max(lineStart, start - firstLineRemoved);
                                ta.selectionEnd = lineStart + newBlock.length;
                            } else {
                                let newBlock = block.replace(/^/gm, "    ");
                                replaceRange(lineStart, end, newBlock);
                                ta.selectionStart = start + 4;
                                ta.selectionEnd = lineStart + newBlock.length;
                            }
                        }
                    }
                });

                function invalidarMetricas() {
                    delete ta._sytoolsMetrics;
                    sync();
                    renderSyntaxDiagnostic();
                }
                function onResize() {

                    if (!ta.isConnected) {
                        window.removeEventListener("resize", onResize);
                        return;
                    }
                    invalidarMetricas();
                }
                window.addEventListener("resize", onResize);
                if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
                    document.fonts.ready.then(() => {
                        if (ta.isConnected) invalidarMetricas();
                    });
                }

                function destroy() {
                    if (checkTimer) clearTimeout(checkTimer);
                    if (acCheckTimer) clearTimeout(acCheckTimer);
                    checkToken++;
                    window.removeEventListener("resize", onResize);
                }

                return {
                    getValue: () => ta.value,
                    setValue: (texto) => {
                        ta.value = texto;
                        ta.selectionStart = ta.selectionEnd = 0;
                        ta.scrollTop = 0;
                        sync();
                        syncScroll();
                    },
                    focus: () => ta.focus(),
                    markClean,
                    isDirty,
                    runCheck,
                    renderProblems,
                    renderSyntaxDiagnostic,
                    renderIndentGuides,
                    irParaErro,
                    sync,
                    syncScroll,
                    openFindBar,
                    destroy
                };
            }

            {
                let clsSearchInput = document.getElementById("se-cls-search");
                let clsSearchResults = document.getElementById("se-cls-search-results");
                let clsAddBtn = document.getElementById("se-cls-add");
                let clsFavList = document.getElementById("se-cls-fav-list");
                let clsMain = document.getElementById("se-cls-main");
                let clsActiveId = null;
                let clsSearchPicked = null;
                let clsFieldsCache = {};
                let clsAutoAbriuUltima = false;

                let clsFecharEditorAtual = null;

                function renderClassFavList() {
                    let store = getClassPanelStore();

                    if (!clsAutoAbriuUltima && !clsActiveId && store.ultimaClasseId && store.favoritas.some((f) => f.classId === store.ultimaClasseId)) {
                        clsAutoAbriuUltima = true;
                        abrirClasseFavorita(store.ultimaClasseId);
                        return;
                    }
                    clsAutoAbriuUltima = true;
                    if (!store.favoritas.length) {
                        clsFavList.innerHTML = '<div class="se-ids-empty">Nenhuma classe favorita ainda. Busque pelo nome acima.</div>';
                        return;
                    }
                    clsFavList.innerHTML = store.favoritas
                        .map(
                            (f) => `
                        <div class="se-cls-fav-item ${f.classId === clsActiveId ? "se-active" : ""}" data-class-id="${f.classId}">
                            <span class="se-cls-fav-name" title="${escHtml(f.nome)}">${escHtml(f.nome)}</span>
                            <span class="se-cls-fav-del" data-class-id="${f.classId}" title="Remover dos favoritos">✕</span>
                        </div>`
                        )
                        .join("");

                    clsFavList.querySelectorAll(".se-cls-fav-item").forEach((el) => {
                        el.addEventListener("click", (e) => {
                            if (e.target.classList.contains("se-cls-fav-del")) return;
                            abrirClasseFavorita(el.dataset.classId);
                        });
                    });
                    clsFavList.querySelectorAll(".se-cls-fav-del").forEach((el) => {
                        el.addEventListener("click", (e) => {
                            e.stopPropagation();
                            let id = el.dataset.classId;
                            let fav = store.favoritas.find((f) => f.classId === id);
                            let nome = fav ? fav.nome : id;
                            showConfirmModal("Remover classe", 'Deseja remover "' + escHtml(nome) + '" dos favoritos?', null, () => {
                                classPanelRemoveFavorita(id);
                                delete clsFieldsCache[id];
                                if (clsActiveId === id) {
                                    clsActiveId = null;
                                    clsMain.innerHTML = '<div class="se-ids-empty" style="margin:auto;">Escolha uma classe favorita ao lado para ver campos e métodos.</div>';
                                }
                                renderClassFavList();
                            }, { leaveLabel: "Remover" });
                        });
                    });
                }

                let clsSearchTimer = null;

                function clsMostrarResultadoBusca(mostrar) {
                    clsSearchResults.style.display = mostrar ? "block" : "none";
                    clsFavList.style.display = mostrar ? "none" : "block";
                }

                clsSearchInput.addEventListener("input", () => {
                    clearTimeout(clsSearchTimer);
                    let termo = clsSearchInput.value.trim();
                    clsSearchPicked = null;
                    if (termo.length < 2) {
                        clsMostrarResultadoBusca(false);
                        clsSearchResults.innerHTML = "";
                        return;
                    }
                    clsSearchTimer = setTimeout(() => buscarClassePorNome(termo), 300);
                });

                async function buscarClassePorNome(termo) {
                    try {
                        let itens = await buscarClassesPorTermo(termo);
                        clsMostrarResultadoBusca(true);
                        if (!itens.length) {
                            clsSearchResults.innerHTML = '<div class="se-cls-empty-hint">Nenhuma classe encontrada.</div>';
                            return;
                        }
                        clsSearchResults.innerHTML = itens
                            .map((it) => `<div class="se-cls-search-item" data-id="${it.classId}" data-nome="${escHtml(it.nome)}">${escHtml(it.nome)}<small>${it.classId}</small></div>`)
                            .join("");
                        ligarCliqueResultadoBusca();
                    } catch (e) {
                        clsMostrarResultadoBusca(true);
                        clsSearchResults.innerHTML = '<div class="se-cls-empty-hint">Erro ao buscar: ' + escHtml(e.message) + "</div>";
                    }
                }

                function ligarCliqueResultadoBusca() {
                    clsSearchResults.querySelectorAll(".se-cls-search-item").forEach((el) => {
                        el.addEventListener("click", () => {
                            clsSearchPicked = { classId: el.dataset.id, nome: el.dataset.nome };
                            clsSearchInput.value = el.dataset.nome;
                            clsMostrarResultadoBusca(false);
                        });
                    });
                }

                clsAddBtn.addEventListener("click", () => {
                    if (!clsSearchPicked) {
                        showToast("warning", "Busque e escolha uma classe na lista primeiro");
                        return;
                    }
                    classPanelAddFavorita(clsSearchPicked.classId, clsSearchPicked.nome);
                    showToast("success", '"' + clsSearchPicked.nome + '" adicionada aos favoritos');
                    clsSearchInput.value = "";
                    clsSearchPicked = null;
                    clsMostrarResultadoBusca(false);
                    renderClassFavList();
                });

                async function abrirClasseFavorita(classId) {
                    clsActiveId = classId;
                    let s = getClassPanelStore();
                    s.ultimaClasseId = classId;
                    setClassPanelStore(s);
                    renderClassFavList();
                    clsMain.innerHTML = '<div class="se-ids-empty" style="margin:auto;">Carregando campos e métodos...</div>';
                    try {
                        let [meta, metodos] = clsFieldsCache[classId]
                            ? [clsFieldsCache[classId].meta, clsFieldsCache[classId].metodos]
                            : await Promise.all([classPanelFetchFields(classId), classPanelFetchMethods(classId)]);
                        clsFieldsCache[classId] = { meta, metodos };
                        renderClasseDetalhe(classId, meta, metodos);
                    } catch (e) {
                        clsMain.innerHTML = '<div class="se-ids-empty" style="margin:auto;color:#e74c3c;">Erro ao carregar: ' + escHtml(e.message) + "</div>";
                    }
                }

                function renderClasseDetalhe(classId, meta, metodos) {
                    let store = getClassPanelStore();
                    let favoritosIds = store.metodosFavoritos[classId] || [];

                    let metodosEditaveis = metodos.filter((m) => m.editavel);

                    function linhaMetodo(m) {
                        let favorito = favoritosIds.includes(m.identifier);
                        let starColor = favorito ? "#f1c40f" : "#555";
                        let starTitle = favorito ? "Remover dos favoritos" : "Favoritar";
                        return `
                        <div class="se-cls-item" data-ident="${escHtml(m.identifier)}">
                            <span class="se-cls-item-fav" data-ident="${escHtml(m.identifier)}" title="${starTitle}" style="color:${starColor};">&#9733;</span>
                            <span class="se-cls-item-name" title="${escHtml(m.identifier)}">${escHtml(m.nome)} <span class="se-cls-item-ident">/ ${escHtml(m.identifier)}</span></span>
                            <span class="se-cls-item-tag">${(m.executionContext || []).join(", ") || "—"}</span>
                            <button type="button" class="se-btn" style="padding:4px 10px;font-size:11.5px;" data-method-id="${m._id}" data-method-nome="${escHtml(m.nome)}">Script</button>
                        </div>`;
                    }

                    let metodosFavoritados = metodosEditaveis.filter((m) => favoritosIds.includes(m.identifier));
                    let metodosResto = metodosEditaveis.filter((m) => !favoritosIds.includes(m.identifier));

                    let jaSalva = getSavedIds().some((x) => x.id === classId);
                    clsMain.innerHTML = `
                        <div class="se-cls-header">
                            <h3>${escHtml(meta.nome)}</h3>
                            <small>${classId}</small>
                            <button type="button" class="se-btn" id="se-cls-save-id" ${jaSalva ? "disabled" : ""} style="margin-left:auto;padding:5px 12px;font-size:11.5px;">${jaSalva ? "Já está em Meus IDs" : "Salvar em Meus IDs"}</button>
                        </div>
                        <div class="se-cls-body">
                            ${
                                metodosFavoritados.length
                                    ? `<div class="se-cls-section-title" style="color:#f1c40f;"><span>Favoritos (${metodosFavoritados.length})</span></div>
                                       ${metodosFavoritados.map(linhaMetodo).join("")}`
                                    : ""
                            }
                            <div class="se-cls-section-title">
                                <span>Métodos editáveis (${metodosEditaveis.length})</span>
                            </div>
                            ${metodosEditaveis.length ? metodosResto.map(linhaMetodo).join("") : '<div class="se-cls-empty-hint">Nenhum método customizado nesta classe.</div>'}
                        </div>`;

                    clsMain.querySelectorAll(".se-cls-item-fav").forEach((el) => {
                        el.addEventListener("click", () => {
                            classPanelToggleMetodoFavorito(classId, el.dataset.ident);
                            renderClasseDetalhe(classId, meta, metodos);
                        });
                    });
                    clsMain.querySelectorAll("[data-method-id]").forEach((el) => {
                        el.addEventListener("click", () => abrirEditorDeMetodo(classId, el.dataset.methodId, el.dataset.methodNome));
                    });

                    let salvarIdBtn = clsMain.querySelector("#se-cls-save-id");
                    if (salvarIdBtn) {
                        salvarIdBtn.addEventListener("click", () => {
                            let ids = getSavedIds();
                            if (ids.some((x) => x.id === classId)) {
                                showToast("info", "ID já salvo");
                                return;
                            }
                            ids.push({ name: meta.nome, id: classId, group: "Classes", classId: "", kind: "class", favorite: false, addedAt: Date.now() });
                            setSavedIds(ids);
                            showToast("success", '"' + meta.nome + '" salvo em Meus IDs');
                            renderClasseDetalhe(classId, meta, metodos);
                        });
                    }
                }

                async function abrirEditorDeMetodo(classId, methodId, methodNome) {

                    if (clsFecharEditorAtual) {
                        clsFecharEditorAtual(false, () => abrirEditorDeMetodo(classId, methodId, methodNome));
                        return;
                    }
                    let overlay = document.createElement("div");
                    overlay.className = "se-cls-method-editor";
                    overlay.innerHTML = `
                        <div class="se-cls-method-bar">
                            <h4>
                                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(methodNome)}</span>
                                <span class="se-etab-dirty" id="se-cls-method-dirty" title="Alterações não salvas" style="display:none;"></span>
                            </h4>
                            <span style="font-size:11px;color:#888;">Rascunho local — só grava no Sydle ao clicar em Salvar</span>
                            <button type="button" class="se-btn" id="se-cls-method-cancel">Fechar</button>
                            <button type="button" class="se-btn se-btn-save" id="se-cls-method-save">Salvar e publicar</button>
                        </div>
                        <div id="se-cls-method-conflict" style="display:none;"></div>
                        <div class="se-find-bar" id="se-cls-find-bar">
                            <div style="display:flex;align-items:center;gap:8px;flex:1;">
                                <input type="text" id="se-cls-find-input" placeholder="Buscar...">
                                <span class="se-find-info" id="se-cls-find-info"></span>
                                <button type="button" id="se-cls-find-prev" title="Anterior">▲</button>
                                <button type="button" id="se-cls-find-next" title="Próximo">▼</button>
                                <button type="button" id="se-cls-find-toggle-replace" title="Expandir substituição" style="font-size:10px;">⇅</button>
                                <button type="button" id="se-cls-find-close" title="Fechar (Esc)">✕</button>
                            </div>
                            <div id="se-cls-replace-row" style="display:none;gap:6px;align-items:center;margin-top:4px;">
                                <input id="se-cls-replace-input" placeholder="Substituir por..." style="flex:1;">
                                <button type="button" id="se-cls-replace-one" title="Substituir" style="font-size:11px;">AB</button>
                                <button type="button" id="se-cls-replace-all" title="Substituir todos" style="font-size:11px;">AB⟳</button>
                            </div>
                        </div>
                        <div class="se-editor-area">
                            <div class="se-gutter" id="se-cls-gutter"><div class="se-gutter-inner" id="se-cls-gutter-inner">1</div></div>
                            <div class="se-highlight-wrap" id="se-cls-highlight-wrap">
                                <pre class="se-indent-guides" id="se-cls-indent-guides"></pre>
                                <pre class="se-find-highlight-layer" id="se-cls-find-highlight"></pre>
                                <pre class="se-highlight-pre" id="se-cls-highlight-pre"></pre>
                                <pre class="se-error-layer" id="se-cls-error-layer"></pre>
                                <textarea class="se-editor-ta" id="se-cls-method-ta" placeholder="Carregando script..." spellcheck="false"></textarea>
                                <div class="se-error-ruler" id="se-cls-error-ruler"></div>
                                <div class="se-autocomplete" id="se-cls-autocomplete" hidden></div>
                            </div>
                        </div>
                        <div class="se-panel-body" style="height:140px;">
                            <div class="se-run-bar" style="padding:6px 16px;">
                                <div class="se-panel-tabs">
                                    <div class="se-ptab se-ptab-active">Problems <span class="se-ptab-badge" id="se-cls-problems-badge">0</span></div>
                                </div>
                            </div>
                            <div class="se-problems" id="se-cls-problems"></div>
                        </div>`;
                    clsMain.appendChild(overlay);

                    let ta = overlay.querySelector("#se-cls-method-ta");
                    let saveBtn = overlay.querySelector("#se-cls-method-save");
                    let conflictBox = overlay.querySelector("#se-cls-method-conflict");
                    let dirtyDot = overlay.querySelector("#se-cls-method-dirty");
                    ta.disabled = true;
                    saveBtn.disabled = true;

                    let mini = criarMiniEditor(
                        {
                            ta,
                            highlightPre: overlay.querySelector("#se-cls-highlight-pre"),
                            indentGuidesEl: overlay.querySelector("#se-cls-indent-guides"),
                            findHighlightEl: overlay.querySelector("#se-cls-find-highlight"),
                            errorLayerEl: overlay.querySelector("#se-cls-error-layer"),
                            errorRulerEl: overlay.querySelector("#se-cls-error-ruler"),
                            replaceRow: overlay.querySelector("#se-cls-replace-row"),
                            replaceInput: overlay.querySelector("#se-cls-replace-input"),
                            replaceToggleBtn: overlay.querySelector("#se-cls-find-toggle-replace"),
                            replaceOneBtn: overlay.querySelector("#se-cls-replace-one"),
                            replaceAllBtn: overlay.querySelector("#se-cls-replace-all"),
                            gutterInnerEl: overlay.querySelector("#se-cls-gutter-inner"),
                            gutterEl: overlay.querySelector("#se-cls-gutter"),
                            autocompleteEl: overlay.querySelector("#se-cls-autocomplete"),
                            findBar: overlay.querySelector("#se-cls-find-bar"),
                            findInput: overlay.querySelector("#se-cls-find-input"),
                            findInfo: overlay.querySelector("#se-cls-find-info"),
                            findNextBtn: overlay.querySelector("#se-cls-find-next"),
                            findPrevBtn: overlay.querySelector("#se-cls-find-prev"),
                            findCloseBtn: overlay.querySelector("#se-cls-find-close"),
                            problemsEl: overlay.querySelector("#se-cls-problems"),
                            problemsBadgeEl: overlay.querySelector("#se-cls-problems-badge")
                        },
                        {
                            onDirtyChange: (dirty) => {
                                dirtyDot.style.display = dirty ? "" : "none";
                            },
                            onSalvarAtalho: () => {
                                if (!saveBtn.disabled) saveBtn.click();
                            }
                        }
                    );

                    let estado = null;
                    try {
                        estado = await classPanelOpenMethodForEdit(classId, methodId);
                        mini.setValue(estado.scriptOriginal);
                        mini.markClean();
                        ta.disabled = false;
                        saveBtn.disabled = false;
                        mini.renderProblems();
                        mini.runCheck();
                        mini.focus();
                    } catch (e) {
                        mini.setValue("Erro ao carregar script: " + e.message);
                        mini.renderProblems();
                        showToast("error", "Erro ao abrir método: " + e.message);
                    }

                    function clsFecharEditor(forcar, aoFechar) {
                        let fechar = () => {
                            mini.destroy();
                            overlay.remove();
                            if (clsFecharEditorAtual === clsFecharEditor) clsFecharEditorAtual = null;
                            if (aoFechar) aoFechar();
                        };
                        if (!forcar && mini.isDirty()) {
                            showConfirmModal(
                                "Alterações não salvas",
                                "Sair sem salvar as alterações deste método?",
                                null,
                                fechar,
                                { stayLabel: "Voltar", leaveLabel: "Sair sem salvar", leaveColor: "#e74c3c" }
                            );
                            return;
                        }
                        fechar();
                    }
                    clsFecharEditorAtual = clsFecharEditor;
                    overlay.querySelector("#se-cls-method-cancel").addEventListener("click", () => clsFecharEditor(false));

                    function clsMostrarDiffEConfirmar() {
                        return new Promise((resolve) => {
                            let diff = _cmpBuildScriptDiff("script", estado.scriptOriginal, mini.getValue());
                            if (!diff.changed) {
                                resolve(true);
                                return;
                            }
                            let ov = document.createElement("div");
                            ov.className = "se-out-modal-overlay";
                            ov.innerHTML =
                                '<div class="se-out-modal" style="width:90vw;max-width:1000px;">' +
                                '<div class="se-out-modal-header"><h3>Confirmar publicação — ' +
                                escHtml(methodNome) +
                                "</h3>" +
                                '<button type="button" class="se-btn" id="se-cls-diff-cancel" style="margin-right:8px;">Cancelar</button>' +
                                '<button type="button" class="se-btn se-btn-save" id="se-cls-diff-confirm">Confirmar e publicar</button></div>' +
                                '<div class="se-out-modal-body" style="padding:0;">' +
                                '<table style="width:100%;border-collapse:collapse;">' +
                                diff.html +
                                "</table></div></div>";
                            document.body.appendChild(ov);
                            let fechar = (resultado) => {
                                ov.remove();
                                resolve(resultado);
                            };
                            ov.querySelector("#se-cls-diff-cancel").addEventListener("click", () => fechar(false));
                            ov.querySelector("#se-cls-diff-confirm").addEventListener("click", () => fechar(true));
                            ov.addEventListener("click", (e) => {
                                if (e.target === ov) fechar(false);
                            });
                            ov.addEventListener("keydown", (e) => {
                                if (e.key === "Escape") fechar(false);
                            });
                        });
                    }

                    saveBtn.addEventListener("click", async () => {
                        if (!estado) return;
                        if (cfg.diffAntesPublicar) {
                            let confirmou = await clsMostrarDiffEConfirmar();
                            if (!confirmou) return;
                        }
                        saveBtn.disabled = true;
                        saveBtn.textContent = "Salvando...";
                        try {
                            let res = await classPanelSaveMethod(classId, methodId, estado.hashOriginal, mini.getValue());
                            if (res.conflito) {
                                conflictBox.style.display = "block";
                                conflictBox.className = "se-cls-conflict";
                                conflictBox.innerHTML =
                                    "⚠️ Este método foi publicado por outra sessão/pessoa depois que você abriu o editor. " +
                                    "Salvar agora vai sobrescrever essa mudança. Copie seu texto, revise com calma e clique em Salvar de novo para confirmar mesmo assim.";

                                estado.hashOriginal = _classPanelHash(res.scriptPublicadoAgora);
                                estado.scriptOriginal = res.scriptPublicadoAgora;
                                saveBtn.disabled = false;
                                saveBtn.textContent = "Salvar mesmo assim";
                                return;
                            }
                            showToast("success", "Método publicado (revisão " + res.revisao + ")");
                            delete clsFieldsCache[classId];
                            mini.markClean();
                            clsFecharEditor(true);
                        } catch (e) {
                            showToast("error", "Erro ao salvar: " + e.message);
                            saveBtn.disabled = false;
                            saveBtn.textContent = "Salvar e publicar";
                        }
                    });
                }
            }

            document.getElementById("se-btn-save-config").addEventListener("click", () => {
                let objetoId = document.getElementById("se-cfg-objeto").value.trim();
                if (!objetoId) {
                    showToast("warning", "Preencha o Objeto ID");
                    return;
                }
                let clickInsert = document.getElementById("se-cfg-click-insert").checked;
                let insertFormatted = document.getElementById("se-cfg-insert-formatted").checked;
                let autocomplete = document.getElementById("se-cfg-autocomplete").checked;
                let diffAntesPublicar = document.getElementById("se-cfg-diff-publish").checked;
                saveExecutorConfig({
                    objetoId,
                    clickInsertEditor: clickInsert,
                    insertFormatted,
                    formatShortcut: cfg.formatShortcut,
                    autocompleteEnabled: autocomplete,
                    diffAntesPublicar,
                    shortcuts: cfg.shortcuts
                });
                cfg = {
                    classeId: NATIVE_RUNNABLE_CLASS_ID,
                    objetoId,
                    clickInsertEditor: clickInsert,
                    insertFormatted,
                    formatShortcut: cfg.formatShortcut,
                    autocompleteEnabled: autocomplete,
                    diffAntesPublicar,
                    shortcuts: cfg.shortcuts
                };
                if (!autocomplete) acFechar();
                updateRunEnabled();
                showToast("success", "Configurações salvas!");
            });

            let shortcutsPendentes = Object.assign({}, cfg.shortcuts);

            function salvarAtalho(id, texto) {
                shortcutsPendentes[id] = texto;
                cfg.shortcuts[id] = texto;
                if (id === "formatar") cfg.formatShortcut = texto;
                saveExecutorConfig({
                    objetoId: cfg.objetoId,
                    clickInsertEditor: cfg.clickInsertEditor,
                    insertFormatted: cfg.insertFormatted,
                    autocompleteEnabled: cfg.autocompleteEnabled,
                    diffAntesPublicar: cfg.diffAntesPublicar,
                    shortcuts: cfg.shortcuts
                });
            }

            document.querySelectorAll(".se-shortcut-input").forEach((input) => {
                input.addEventListener("keydown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === "Escape") {
                        input.blur();
                        return;
                    }
                    let texto = atalhoParaTexto(e);
                    if (!texto) return;
                    let id = input.dataset.shortcutId;
                    shortcutsPendentes[id] = texto;
                    input.value = atalhoParaExibicao(texto);
                });
            });

            document.querySelectorAll(".se-shortcut-save").forEach((btn) => {
                btn.addEventListener("click", () => {
                    let id = btn.dataset.shortcutId;
                    let def = SHORTCUTS_DEFS.find((d) => d.id === id);
                    salvarAtalho(id, shortcutsPendentes[id]);
                    showToast("success", 'Atalho de "' + (def ? def.rotulo : id) + '" salvo!');
                });
            });

            document.querySelectorAll(".se-shortcut-reset").forEach((btn) => {
                btn.addEventListener("click", () => {
                    let id = btn.dataset.shortcutId;
                    let def = SHORTCUTS_DEFS.find((d) => d.id === id);
                    if (!def) return;
                    let input = document.querySelector('.se-shortcut-input[data-shortcut-id="' + id + '"]');
                    input.value = atalhoParaExibicao(def.padrao);
                    salvarAtalho(id, def.padrao);
                    showToast("success", 'Atalho de "' + def.rotulo + '" restaurado.');
                });
            });

            btnSave.addEventListener("click", () => {
                if (activeTab < 0) {
                    showToast("warning", "Nenhum script aberto");
                    return;
                }
                let name = nameInput.value.trim();
                if (!name) {

                    showInputModal("Salvar script", "Nome do arquivo:", "afastamento.js", (informado) => {
                        let limpo = String(informado || "").trim();
                        if (!limpo) return;
                        nameInput.value = limpo;
                        btnSave.click();
                    }, { confirmLabel: "Salvar" });
                    return;
                }
                let code = editor.value;
                let sc = getSavedScripts();
                if (currentIdx !== "_new_" && typeof currentIdx === "number") {
                    sc[currentIdx].name = name;
                    sc[currentIdx].code = code;
                    sc[currentIdx].updatedAt = Date.now();
                } else {
                    sc.push({ name, code, createdAt: Date.now(), updatedAt: Date.now() });
                    currentIdx = sc.length - 1;
                }
                saveSavedScripts(sc);
                markClean();
                refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                showToast("success", 'Script "' + name + '" salvo!');
            });

            function excluirScript(idx) {
                let sc = getSavedScripts();
                let alvo = parseInt(idx);
                if (isNaN(alvo) || !sc[alvo]) return;
                let nome = sc[alvo].name;

                showConfirmModal(
                    "Excluir script",
                    'Deseja excluir "' + nome + '" permanentemente?',
                    null,
                    () => {
                        sc.splice(alvo, 1);
                        saveSavedScripts(sc);

                        let posAberta = posicaoDaAba(alvo);

                        for (let t of openTabs) {
                            if (typeof t.idx === "number" && t.idx > alvo) t.idx--;
                        }
                        if (typeof currentIdx === "number" && currentIdx > alvo) currentIdx--;
                        if (posAberta >= 0) fecharAba(posAberta, true);

                        refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                        if (sidebarSelection && sidebarSelection.kind === "script") sidebarSelection = null;
                        showToast("info", '"' + nome + '" excluído');
                    },
                    { stayLabel: "Voltar", leaveLabel: "Excluir", leaveColor: "#e74c3c" }
                );
            }

            function excluirPasta(nome) {
                showConfirmModal(
                    "Excluir pasta",
                    'Deseja excluir a pasta "' + nome + '"? Os scripts não serão apagados.',
                    null,
                    () => {
                        saveFolders(getFolders().filter((f) => f !== nome));
                        let sc = getSavedScripts();
                        for (let s of sc) {
                            if (s.folder === nome) delete s.folder;
                        }
                        saveSavedScripts(sc);
                        if (sidebarSelection && sidebarSelection.kind === "folder") sidebarSelection = null;
                        refreshSidebar(typeof currentIdx === "number" ? currentIdx : -1);
                    },
                    { stayLabel: "Voltar", leaveLabel: "Excluir", leaveColor: "#e74c3c" }
                );
            }

            function excluirSelecaoDoPainel() {
                let alvo = currentSidebarTarget();
                if (!alvo) return;
                if (alvo.kind === "folder") excluirPasta(alvo.folder);
                else excluirScript(alvo.idx);
            }

            btnDelete.addEventListener("click", () => {
                if (typeof currentIdx === "number") excluirScript(currentIdx);
            });

            btnCopyOutput.addEventListener("click", () => {
                let text = lastResultRaw || output.textContent;
                navigator.clipboard.writeText(text).then(() => showToast("success", "Output copiado!"));
            });

            function openOutputModal() {
                let ov = document.createElement("div");
                ov.className = "se-out-modal-overlay";
                let content = "";
                if (lastResultParsed) {
                    content = colorizeJson(lastResultParsed);
                } else {
                    content = escHtml(lastResultRaw || output.textContent);
                }
                let modalCss =
                    "<style>" +
                    ".se-out-modal-overlay { position:fixed;top:0;left:0;width:100%;height:100%;z-index:1080;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center; }" +
                    ".se-out-modal { width:85vw;max-width:1100px;height:75vh;background:#1e1e1e;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column;overflow:hidden; }" +
                    ".se-out-modal-header { display:flex;align-items:center;padding:14px 20px;background:#252526;border-bottom:1px solid #333; }" +
                    ".se-out-modal-header h3 { margin:0;font-size:15px;color:#ddd;flex:1; }" +
                    '.se-out-modal-body { flex:1;padding:20px;overflow-y:auto;font-family:"Cascadia Code","Fira Code","Consolas",monospace;font-size:13px;line-height:1.6;color:#d4d4d4;white-space:pre-wrap; }' +
                    ".se-out-k { color:#9cdcfe; }" +
                    ".se-out-s { color:#ce9178; }" +
                    ".se-out-n { color:#b5cea8; }" +
                    ".se-out-b { color:#569cd6;font-weight:700; }" +
                    ".se-out-null { color:#666;font-style:italic; }" +
                    ".se-out-brace { color:#888; }" +
                    ".se-btn { padding:6px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;background:#2d2d2d;color:#ccc; }" +
                    ".se-btn:hover { background:#3a3a3a; }" +
                    ".se-btn-danger { background:#c0392b;color:#fff; }" +
                    ".se-btn-danger:hover { background:#e74c3c; }" +
                    "</style>";
                ov.innerHTML =
                    modalCss +
                    '<div class="se-out-modal">' +
                    '<div class="se-out-modal-header"><h3>Resultado da Execução</h3>' +
                    '<button type="button" class="se-btn" id="se-out-modal-copy" style="margin-right:8px;">Copiar</button>' +
                    '<button type="button" class="se-btn se-btn-danger" id="se-out-modal-close" style="padding:4px 14px;">Fechar</button></div>' +
                    '<div class="se-out-modal-body">' +
                    content +
                    "</div></div>";
                document.body.appendChild(ov);
                ov.querySelector("#se-out-modal-close").addEventListener("click", () => ov.remove());
                ov.querySelector("#se-out-modal-copy").addEventListener("click", () => {
                    let raw = lastResultRaw || output.textContent;
                    navigator.clipboard.writeText(raw).then(() => showToast("success", "Copiado!"));
                });
                ov.addEventListener("click", (e) => {
                    if (e.target === ov) ov.remove();
                });
                ov.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") {
                        e.stopPropagation();
                        ov.remove();
                    }
                });
            }

            btnExpandOutput.addEventListener("click", openOutputModal);

            function setStatus(type, text) {
                statusEl.className = "se-status se-status-" + type;
                statusEl.textContent = text;
            }

            async function executarScript() {
                let _tkRetry = getValidSydleToken();
                token = _tkRetry.token;
                if (!token) {
                    showToast("error", "Token não encontrado. Faça login na plataforma e tente novamente.");
                    return;
                }
                if (!cfg.objetoId) {
                    showToast("error", 'Configure o executor primeiro! Vá em Configurações e clique em "Criar Objeto Executor".');
                    return;
                }
                let script = editor.value.trim();
                if (!script) {
                    showToast("warning", "Escreva um script primeiro");
                    return;
                }
                if (isRunning) return;
                isRunning = true;

                showPanel("terminal");
                btnRun.disabled = true;
                btnCopyOutput.style.display = "none";
                btnExpandOutput.style.display = "none";
                output.innerHTML = "";
                lastResultRaw = "";
                lastResultParsed = null;

                let objetoId = cfg.objetoId;
                let apiBase = baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + NATIVE_RUNNABLE_CLASS_ID;
                let reportApiBase = baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + EXECUTION_REPORT_CLASS_ID;
                let headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };

                let progressPanel = { update() {}, finish() {}, collapse() {}, expand() {} };
                let execStartedAt = Date.now();
                let execScriptName = nameInput.value.trim() || "(sem nome)";
                let execScriptCode = script;

                let notifRecipient = getNotifRecipient(_tkRetry.userObj);
                let notificationId = null;

                let notificationPromise = notifRecipient
                    ? criarNotificacaoSydle(baseUrl, headers, {
                          recipient: notifRecipient,
                          subject: "Executando: " + execScriptName,
                          contentText: "Script em execução no SyTools Executor.",
                          redirectObject: { _id: objetoId, _classId: NATIVE_RUNNABLE_CLASS_ID }
                      })
                    : Promise.resolve(null);

                try {
                    setStatus("running", "Gravando script...");
                    output.innerHTML = '<span class="se-out-b">[1/4]</span> Buscando objeto...';

                    let getResp = await fetch(apiBase + "/_get/" + objetoId, { method: "GET", headers });
                    if (!getResp.ok) throw new Error("Falha ao buscar objeto: HTTP " + getResp.status);
                    let obj = await getResp.json();

                    output.innerHTML += '\n<span class="se-out-b">[2/4]</span> Gravando script no objeto...';
                    if (!obj.form) obj.form = { _class: { _id: "63ecefb88b2dca658b072085", _classId: "000000000000000000000000" } };
                    if (!obj.form._class) obj.form._class = { _id: "63ecefb88b2dca658b072085", _classId: "000000000000000000000000" };
                    obj.form.script = script;
                    let updateResp = await fetch(apiBase + "/_update", { method: "POST", headers, body: JSON.stringify(obj) });
                    if (!updateResp.ok) throw new Error("Falha ao gravar script: HTTP " + updateResp.status);
                    await updateResp.json();

                    let dispatchedAtIso = new Date(Date.now() - 2000).toISOString();

                    setStatus("running", "Executando...");
                    output.innerHTML += '\n<span class="se-out-b">[3/4]</span> Executando m\u00e9todo run...';

                    let execResult = null;
                    let execFailed = false;
                    let execErrorMsg = "";
                    try {
                        let execResp = await fetch(apiBase + "/run", { method: "POST", headers, body: JSON.stringify({ _id: objetoId }) });
                        if (!execResp.ok) {
                            let errBody = "";
                            try {
                                errBody = await execResp.text();
                            } catch (e) {}
                            execFailed = true;
                            execErrorMsg = "HTTP " + execResp.status + (errBody ? " - " + errBody.substring(0, 300) : "");
                        } else {
                            execResult = await execResp.json();
                        }
                    } catch (e) {
                        execFailed = true;
                        execErrorMsg = e && e.message ? e.message : String(e);
                    }

                    if (execFailed) {
                        output.innerHTML +=
                            '\n<span class="se-out-null">Chamada /run n\u00e3o retornou (' +
                            escHtml(execErrorMsg) +
                            "). Isso costuma ser timeout de proxy em scripts longos \u2014 o script pode continuar rodando no servidor. Monitorando o relat\u00f3rio de execu\u00e7\u00e3o...</span>";
                        progressPanel.update("Servidor demorando, monitorando...");
                    } else {
                        progressPanel.update("Lendo resultado...");
                    }

                    output.innerHTML += '\n<span class="se-out-b">[4/4]</span> Lendo resultado...\n';
                    setStatus("running", "Lendo resultado...");

                    let resultado = null;
                    if (execResult && execResult.response) {
                        resultado = typeof execResult.response === "string" ? execResult.response : JSON.stringify(execResult.response, null, 2);
                    }

                    async function findMyExecutionReport() {
                        let searchResp = await fetch(reportApiBase + "/_search", {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                size: 10,
                                query: {
                                    bool: {
                                        must: [
                                            { term: { "runnable._id": objetoId } },
                                            { range: { startDate: { gte: dispatchedAtIso } } }
                                        ]
                                    }
                                },
                                sort: [{ startDate: "desc" }]
                            })
                        });
                        if (!searchResp.ok) return null;
                        let searchJson = await searchResp.json();
                        let hits = (searchJson.hits && searchJson.hits.hits) || [];
                        for (let i = 0; i < hits.length; i++) {
                            let candidate = hits[i]._source || hits[i];
                            let candidateScript = candidate.input && candidate.input.script;
                            if (candidateScript === script) return candidate;
                        }
                        return null;
                    }

                    notificationId = await notificationPromise;

                    let monitorId = "mon-" + objetoId + "-" + Date.now();
                    if (!resultado) {
                        try {
                            chrome.runtime.sendMessage({
                                action: "sytools-start-monitor",
                                payload: {
                                    monitorId,
                                    reportApiBase,
                                    token,
                                    objetoId,
                                    dispatchedAtIso,
                                    scriptText: script,
                                    scriptLabel: cfg.nome || "Script Sydle",
                                    tabUrl: window.location.href,
                                    notificationId,
                                    notificationApiBase: baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + SYDLE_NOTIFICATION_CLASS_ID,
                                    execScriptName
                                }
                            });
                        } catch (e) {}
                    }

                    let monitorFinishedRemotely = null;
                    let onMonitorMessage = (message) => {
                        if (!message || !message.monitorId || message.monitorId !== monitorId) return;
                        if (message.action === "sytools-monitor-finished") {
                            monitorFinishedRemotely = { ok: true, resultadoRaw: message.resultadoRaw };
                        } else if (message.action === "sytools-monitor-timeout") {
                            monitorFinishedRemotely = { ok: false };
                        }
                    };
                    chrome.runtime.onMessage.addListener(onMonitorMessage);

                    if (!resultado) {
                        let maxAttempts = 120;
                        let interval = 30000;
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            await new Promise((r) => setTimeout(r, interval));
                            if (monitorFinishedRemotely) {
                                if (monitorFinishedRemotely.ok) resultado = monitorFinishedRemotely.resultadoRaw;
                                break;
                            }
                            output.innerHTML += '\n  <span class="se-out-null">Tentativa ' + attempt + "/" + maxAttempts + "...</span>";
                            progressPanel.update("Aguardando servidor...");
                            let report = null;
                            try {
                                report = await findMyExecutionReport();
                            } catch (e) {}
                            if (!report) {
                                output.innerHTML += ' <span class="se-out-null">relat\u00f3rio ainda n\u00e3o encontrado</span>';
                                continue;
                            }
                            if (report.status === "RUNNING") {
                                output.innerHTML += ' <span class="se-out-null">ainda executando (relat\u00f3rio ' + report._id + ")</span>";
                                continue;
                            }

                            let reportResult = report.output && report.output.result;
                            if (reportResult && String(reportResult).trim()) {
                                resultado = typeof reportResult === "string" ? reportResult : JSON.stringify(reportResult, null, 2);
                            } else {
                                resultado = JSON.stringify({ status: report.status, aviso: "Execu\u00e7\u00e3o finalizada sem output.result" }, null, 2);
                            }
                            break;
                        }
                    }

                    chrome.runtime.onMessage.removeListener(onMonitorMessage);
                    try {
                        chrome.runtime.sendMessage({ action: "sytools-stop-monitor", monitorId });
                    } catch (e) {}

                    if (resultado) {
                        setStatus("done", "Conclu\u00eddo");
                        lastResultRaw = resultado;
                        try {
                            let parsed = JSON.parse(resultado);
                            if (parsed && typeof parsed.result === "string") {
                                try {
                                    parsed.result = JSON.parse(parsed.result);
                                } catch (_) {}
                            }
                            lastResultParsed = parsed;
                            let displayText = parsed.resultado || resultado;
                            if (typeof displayText === "object") displayText = JSON.stringify(displayText, null, 2);
                            if (String(displayText).length > 500) {
                                output.innerHTML = colorizeJson(lastResultParsed) + '\n\n<span class="se-out-b">Clique em "Expandir" para ver em tela cheia</span>';
                            } else {
                                output.innerHTML = colorizeJson(lastResultParsed);
                            }

                            let counts = _extractProgressCounts(parsed && parsed.resumo) || _extractProgressCounts(parsed);
                            let detail = counts
                                ? Object.keys(counts)
                                      .map((k) => k + ": " + counts[k])
                                      .join(" \u2022 ")
                                : "Resultado dispon\u00edvel";
                            progressPanel.finish(true, "Execu\u00e7\u00e3o conclu\u00edda", detail);
                            atualizarNotificacaoSydle(baseUrl, headers, notificationId, {
                                subject: "Conclu\u00eddo: " + execScriptName,
                                contentText: detail,
                                showProgress: false,
                                indeterminate: false,
                                progressValue: 100,
                                oneEvent: true
                            });
                        } catch (e) {
                            output.innerHTML = '<span class="se-out-s">' + escHtml(resultado) + "</span>";
                            progressPanel.finish(true, "Execu\u00e7\u00e3o conclu\u00edda", "Resultado dispon\u00edvel");
                            atualizarNotificacaoSydle(baseUrl, headers, notificationId, {
                                subject: "Conclu\u00eddo: " + execScriptName,
                                contentText: "Resultado dispon\u00edvel no SyTools Executor.",
                                showProgress: false,
                                indeterminate: false,
                                progressValue: 100,
                                oneEvent: true
                            });
                        }
                        addExecutionLog({
                            name: execScriptName,
                            code: execScriptCode,
                            startedAt: execStartedAt,
                            finishedAt: Date.now(),
                            status: "ok",
                            resultado: resultado
                        });
                        renderExecutionLogs();
                    } else {
                        setStatus("error", "Timeout");
                        output.innerHTML += '\n\n<span style="color:#e74c3c;font-weight:700;">Resultado n\u00e3o obtido ap\u00f3s tentativas.</span>';
                        progressPanel.finish(false, "Sem resposta ainda", "O script pode continuar rodando no servidor \u2014 confira o objeto executor diretamente.");
                        addExecutionLog({
                            name: execScriptName,
                            code: execScriptCode,
                            startedAt: execStartedAt,
                            finishedAt: Date.now(),
                            status: "timeout",
                            resultado: null
                        });
                        renderExecutionLogs();
                    }
                    btnCopyOutput.style.display = "";
                    btnExpandOutput.style.display = "";
                } catch (err) {
                    setStatus("error", "Erro");
                    output.innerHTML = '<span style="color:#e74c3c;font-weight:700;">ERRO: ' + escHtml(err.message || String(err)) + "</span>";
                    btnCopyOutput.style.display = "";
                    progressPanel.finish(false, "Erro na execu\u00e7\u00e3o", err.message || String(err));
                    addExecutionLog({
                        name: execScriptName,
                        code: execScriptCode,
                        startedAt: execStartedAt,
                        finishedAt: Date.now(),
                        status: "erro",
                        resultado: null,
                        erro: err.message || String(err)
                    });
                    renderExecutionLogs();
                } finally {
                    isRunning = false;
                    updateRunEnabled();
                }
            }

            let formatando = false;
            function formatarScriptAtual() {
                if (formatando) return;
                let code = editor.value;
                if (!code.trim()) return;
                formatando = true;
                let textoOriginal = btnFormat.textContent;
                btnFormat.disabled = true;
                btnFormat.textContent = "Formatando...";
                requestFormat(code, (r) => {
                    formatando = false;
                    btnFormat.disabled = false;
                    btnFormat.textContent = textoOriginal;
                    if (!r || !r.ok) {
                        showToast("error", (r && r.erro) || "Não foi possível formatar o script.");
                        return;
                    }
                    if (r.code === code) return;
                    let inicio = editor.selectionStart;
                    editor.value = r.code;

                    editor.selectionStart = editor.selectionEnd = Math.min(inicio, r.code.length);
                    syncHighlight();
                    let agora = isDirty();
                    if (agora !== abaSujaAntes) {
                        abaSujaAntes = agora;
                        if (activeTab >= 0 && openTabs[activeTab]) {
                            openTabs[activeTab].code = editor.value;
                            renderTabs();
                        }
                    }
                    showToast("success", "Script formatado.");
                });
            }
            btnFormat.addEventListener("click", formatarScriptAtual);

            btnRun.addEventListener("click", executarScript);

            if (window.__sytoolsPendingOpenResult) {
                let pendingMonitorId = window.__sytoolsPendingOpenResult;
                window.__sytoolsPendingOpenResult = null;
                chrome.runtime
                    .sendMessage({ action: "sytools-consume-pending-result", monitorId: pendingMonitorId })
                    .then((resp) => {
                        let result = resp && resp.result;
                        if (!result) return;
                        if (result.ok && result.resultadoRaw) {
                            lastResultRaw = result.resultadoRaw;
                            showPanel("terminal");
                            try {
                                let parsed = JSON.parse(result.resultadoRaw);
                                if (parsed && typeof parsed.result === "string") {
                                    try {
                                        parsed.result = JSON.parse(parsed.result);
                                    } catch (_) {}
                                }
                                lastResultParsed = parsed;
                                let displayText = parsed.resultado || result.resultadoRaw;
                                if (typeof displayText === "object") displayText = JSON.stringify(displayText, null, 2);
                                if (String(displayText).length > 500) {
                                    output.innerHTML = colorizeJson(lastResultParsed) + '\n\n<span class="se-out-b">Clique em "Expandir" para ver em tela cheia</span>';
                                } else {
                                    output.innerHTML = colorizeJson(lastResultParsed);
                                }
                            } catch (e) {
                                output.innerHTML = '<span class="se-out-s">' + escHtml(result.resultadoRaw) + "</span>";
                            }
                            btnCopyOutput.style.display = "";
                            btnExpandOutput.style.display = "";
                            setStatus("done", "Concluído");
                            openOutputModal();
                            addExecutionLog({
                                name: result.scriptLabel || "(script via notificação)",
                                code: null,
                                startedAt: result.finishedAt || null,
                                finishedAt: result.finishedAt || Date.now(),
                                status: "ok",
                                resultado: result.resultadoRaw
                            });
                            renderExecutionLogs();
                        } else if (!result.ok) {
                            output.innerHTML = '<span style="color:#e74c3c;font-weight:700;">Sem resposta em 60 minutos para "' + escHtml(result.scriptLabel || "") + '". Confira o objeto executor diretamente.</span>';
                            setStatus("error", "Timeout");
                            addExecutionLog({
                                name: result.scriptLabel || "(script via notificação)",
                                code: null,
                                startedAt: null,
                                finishedAt: result.finishedAt || Date.now(),
                                status: "timeout",
                                resultado: null
                            });
                            renderExecutionLogs();
                        }
                    })
                    .catch(() => {});
            }

            let resizer = document.getElementById("se-resizer");
            let editorPanel = modal.querySelector(".se-editor-panel");
            {
                let startY = 0;
                let startEditorH = 0;
                let startOutputH = 0;
                resizer.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    startY = e.clientY;
                    startEditorH = editorPanel.getBoundingClientRect().height;
                    startOutputH = panelBody.getBoundingClientRect().height;
                    resizer.classList.add("se-resizing");
                    document.addEventListener("mousemove", onMouseMove);
                    document.addEventListener("mouseup", onMouseUp);
                });
                function onMouseMove(e) {
                    let delta = e.clientY - startY;
                    let newEditorH = Math.max(120, startEditorH + delta);
                    let newOutputH = Math.max(40, startOutputH - delta);
                    editorPanel.style.flex = "none";
                    editorPanel.style.height = newEditorH + "px";

                    panelBody.style.height = newOutputH + "px";
                }
                function onMouseUp() {
                    resizer.classList.remove("se-resizing");
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                }
            }

            let finderClassInput = document.getElementById("se-finder-class");
            let finderQueryInput = document.getElementById("se-finder-query");
            let finderGoBtn = document.getElementById("se-finder-go");
            let finderResults = document.getElementById("se-finder-results");
            let finderStatus = document.getElementById("se-finder-status");
            let finderClassResults = document.getElementById("se-finder-class-results");
            let finderSelectedClassId = null;
            let finderSelectedClassName = "";
            let finderSearchAfter = null;
            let finderTotalHits = 0;
            let finderCurrentFilter = "";
            let finderLoading = false;
            let apiHeaders = { "Content-Type": "application/json", Authorization: "Bearer " + token };

            let classSearchTimeout = null;
            finderClassInput.addEventListener("input", () => {
                clearTimeout(classSearchTimeout);
                classSearchTimeout = setTimeout(() => searchClasses(), 300);
            });
            finderClassInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    searchClasses();
                }
                e.stopPropagation();
            });
            finderQueryInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    startFinderSearch();
                }
                e.stopPropagation();
            });
            finderGoBtn.addEventListener("click", () => startFinderSearch());

            let finderClearBtn = document.getElementById("se-finder-clear");
            finderClearBtn.addEventListener("click", () => {
                finderClassInput.value = "";
                finderQueryInput.value = "";
                finderSelectedClassId = null;
                finderSelectedClassName = "";
                finderSearchAfter = null;
                finderTotalHits = 0;
                finderCurrentFilter = "";
                finderResults.innerHTML = '<div class="se-ids-empty">Busque uma classe pelo nome ou ID para listar seus objetos</div>';
                finderStatus.textContent = "";
                finderClassResults.style.display = "none";
                finderClassInput.focus();
            });

            let localClassTree = null;
            try {
                localClassTree = JSON.parse(localStorage.getItem("classTree"));
            } catch (e) {}

            async function searchClasses() {
                let q = finderClassInput.value.trim();
                if (!q) {
                    finderClassResults.style.display = "none";
                    return;
                }
                if (/^[a-f0-9]{24}$/i.test(q)) {
                    finderSelectedClassId = q;
                    finderSelectedClassName = q;
                    finderClassResults.style.display = "none";
                    startFinderSearch();
                    return;
                }

                let localMatches = [];
                if (localClassTree && localClassTree.length) {
                    let qLower = q.toLowerCase();
                    for (let pkg of localClassTree) {
                        if (!pkg.packageClasses) continue;
                        for (let c of pkg.packageClasses) {
                            let cName = c.name || "";
                            let cIdent = c.identifier || "";
                            if (cName.toLowerCase().includes(qLower) || cIdent.toLowerCase().includes(qLower)) {
                                let displayName = cName && cIdent && cName !== cIdent ? cName + " / " + cIdent : cName || cIdent || c._id;
                                localMatches.push({ id: c._id, displayName: displayName });
                            }
                        }
                    }
                }

                if (localMatches.length > 0) {
                    let rowsHtml = "";
                    for (let m of localMatches.slice(0, 15)) {
                        rowsHtml +=
                            '<div class="se-ids-item" data-class-id="' +
                            m.id +
                            '" data-class-name="' +
                            escHtml(m.displayName) +
                            '" style="padding-left:16px;">' +
                            '<span class="se-ids-item-name" style="color:#d4d4d4;">' +
                            escHtml(m.displayName) +
                            "</span>" +
                            '<span class="se-ids-item-id">' +
                            m.id +
                            "</span></div>";
                    }
                    finderClassResults.innerHTML = rowsHtml;
                    finderClassResults.style.display = "block";
                    finderClassResults.querySelectorAll(".se-ids-item").forEach((row) => {
                        row.addEventListener("click", () => {
                            finderSelectedClassId = row.dataset.classId;
                            finderSelectedClassName = row.dataset.className;
                            finderClassInput.value = finderSelectedClassName;
                            finderClassResults.style.display = "none";
                            startFinderSearch();
                        });
                    });
                    return;
                }

                try {
                    let resp = await fetch(baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/000000000000000000000000/_search", {
                        method: "POST",
                        headers: apiHeaders,
                        body: JSON.stringify({
                            query: {
                                bool: {
                                    should: [
                                        { wildcard: { "identifier.keyword": "*" + q + "*" } },
                                        { wildcard: { "name.keyword": "*" + q + "*" } },
                                        { wildcard: { "name._current.keyword": "*" + q + "*" } },
                                        { query_string: { query: "*" + q + "*", default_operator: "AND" } }
                                    ],
                                    minimum_should_match: 1
                                }
                            },
                            size: 15,
                            _source: ["_id", "identifier", "name"]
                        })
                    });
                    if (!resp.ok) return;
                    let data = await resp.json();
                    let hits = data.hits && data.hits.hits ? data.hits.hits : [];
                    if (hits.length === 0) {
                        finderClassResults.innerHTML = '<div style="padding:10px 16px;color:#666;font-size:12px;">Nenhuma classe encontrada</div>';
                        finderClassResults.style.display = "block";
                        return;
                    }
                    let rowsHtml = "";
                    hits.forEach((h) => {
                        let src = h._source || {};
                        let id = src._id || h._id;
                        let sName = src.name || "";
                        if (sName && typeof sName === "object") sName = sName._current || sName.pt_BR || Object.values(sName).find((v) => typeof v === "string") || "";
                        let sIdent = src.identifier || "";
                        let displayName = sName && sIdent && sName !== sIdent ? sName + " / " + sIdent : sName || sIdent || id;
                        rowsHtml +=
                            '<div class="se-ids-item" data-class-id="' +
                            id +
                            '" data-class-name="' +
                            escHtml(displayName) +
                            '" style="padding-left:16px;">' +
                            '<span class="se-ids-item-name" style="color:#d4d4d4;">' +
                            escHtml(displayName) +
                            "</span>" +
                            '<span class="se-ids-item-id">' +
                            id +
                            "</span></div>";
                    });
                    finderClassResults.innerHTML = rowsHtml;
                    finderClassResults.style.display = "block";
                    finderClassResults.querySelectorAll(".se-ids-item").forEach((row) => {
                        row.addEventListener("click", () => {
                            finderSelectedClassId = row.dataset.classId;
                            finderSelectedClassName = row.dataset.className;
                            finderClassInput.value = finderSelectedClassName;
                            finderClassResults.style.display = "none";
                            startFinderSearch();
                        });
                    });
                } catch (err) {

                }
            }

            async function startFinderSearch() {
                if (!finderSelectedClassId && /^[a-f0-9]{24}$/i.test(finderClassInput.value.trim())) {
                    finderSelectedClassId = finderClassInput.value.trim();
                }
                if (!finderSelectedClassId) {
                    finderResults.innerHTML = '<div class="se-ids-empty">Selecione uma classe primeiro</div>';
                    return;
                }
                finderSearchAfter = null;
                finderCurrentFilter = finderQueryInput.value.trim();
                finderResults.innerHTML = "";
                finderStatus.textContent = "Buscando...";
                await loadFinderPage();
            }

            async function loadFinderPage() {
                if (finderLoading) return;
                finderLoading = true;
                try {
                    let body = {
                        size: 100,
                        _source: ["_id", "identifier", "name", "fullName", "displayName", "externalCode", "code", "description", "person", "staffMember", "employee", "beneficiary", "title", "label", "registration"],
                        sort: ["_id_doc_value"]
                    };
                    if (finderSearchAfter) body.search_after = finderSearchAfter;
                    if (finderCurrentFilter) {
                        if (/^[a-f0-9]{24}$/i.test(finderCurrentFilter)) {
                            body.query = { term: { _id: finderCurrentFilter } };
                        } else {
                            let words = finderCurrentFilter.split(/\s+/).filter((w) => w.length > 0);
                            let qsQuery = words.map((w) => "*" + w + "*").join(" AND ");
                            body.query = { query_string: { query: qsQuery, default_operator: "AND", analyze_wildcard: true } };
                        }
                    } else {
                        body.query = { match_all: {} };
                    }

                    let resp = await fetch(baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + finderSelectedClassId + "/_search", {
                        method: "POST",
                        headers: apiHeaders,
                        body: JSON.stringify(body)
                    });
                    if (!resp.ok) throw new Error("HTTP " + resp.status);
                    let data = await resp.json();
                    let hits = data.hits && data.hits.hits ? data.hits.hits : [];
                    finderTotalHits = data.hits && data.hits.total ? data.hits.total : 0;

                    if (hits.length > 0) {
                        finderSearchAfter = hits[hits.length - 1].sort;
                    }

                    let allObjRefs = [];
                    hits.forEach((h) => {
                        let src = h._source || {};
                        let id = h._id || src._id;
                        allObjRefs.push({ _id: id, _classId: finderSelectedClassId });
                    });

                    let cardNames = {};
                    for (let ci = 0; ci < allObjRefs.length; ci += 50) {
                        let batch = allObjRefs.slice(ci, ci + 50);
                        try {
                            let cResp = await fetch(baseUrl + "/api/1/" + getSydleApiNamespace() + "/_system/_workspace/getCards?accessToken=" + token, {
                                method: "POST",
                                headers: apiHeaders,
                                body: JSON.stringify({
                                    classId: "000000000000000000000000",
                                    objectsReferences: batch,
                                    small: true,
                                    storage: "published",
                                    tags: false,
                                    timezoneId: "America/Sao_Paulo"
                                })
                            });
                            if (!cResp.ok) continue;
                            let cData = await cResp.json();
                            if (cData.cards) {
                                for (let card of cData.cards) {
                                    if (card._id && card.ids && card.ids.length > 0) cardNames[card._id] = card.ids[0];
                                }
                            }
                        } catch (e) {}
                    }

                    hits.forEach((h) => {
                        let src = h._source || {};
                        let id = h._id || src._id;
                        let label = cardNames[id] || _extractReadableName(src) || id;

                        let row = document.createElement("div");
                        row.className = "se-ids-item";
                        row.style.paddingLeft = "16px";
                        row.dataset.id = id;
                        row.dataset.label = String(label);
                        row.dataset.classId = finderSelectedClassId;
                        row.dataset.className = finderSelectedClassName || finderSelectedClassId;
                        row.innerHTML =
                            '<span class="se-ids-item-name">' +
                            escHtml(String(label).substring(0, 80)) +
                            "</span>" +
                            '<span class="se-ids-item-id">' +
                            id +
                            "</span>" +
                            '<button type="button" class="se-finder-save" title="Salvar ID" style="padding:3px 8px;background:transparent;color:#aaa;border:1px solid #555;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;margin-right:4px;">Salvar</button>' +
                            '<button type="button" class="se-finder-copy" style="padding:3px 8px;background:#1C3C2E;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;">Copiar</button>';
                        row.querySelector(".se-finder-copy").addEventListener("click", (e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(id).then(() => {
                                e.target.textContent = "OK!";
                                e.target.style.background = "#27ae60";
                                setTimeout(() => {
                                    e.target.textContent = "Copiar";
                                    e.target.style.background = "#1C3C2E";
                                }, 1200);
                            });
                        });
                        row.querySelector(".se-finder-save").addEventListener("click", (e) => {
                            e.stopPropagation();
                            let botao = e.currentTarget;

                            if (getSavedIds().some((x) => x.id === id)) {
                                showToast("info", "ID já salvo");
                                return;
                            }
                            showInputModal(
                                "Salvar ID",
                                '<span style="color:#888;font-size:12px;font-family:\'Cascadia Code\',monospace;">' + escHtml(id) + "</span><br>Nome para identificar este objeto:",
                                "Nome do item",
                                (informado) => {
                                    let saveName = String(informado || "").trim() || label || id;
                                    let ids = getSavedIds();
                                    if (ids.some((x) => x.id === id)) {
                                        showToast("info", "ID já salvo");
                                        return;
                                    }
                                    ids.push({ name: saveName, id: id, group: finderSelectedClassName || finderSelectedClassId, classId: finderSelectedClassId, kind: "object", favorite: false, addedAt: Date.now() });
                                    setSavedIds(ids);
                                    renderSavedIds();
                                    botao.textContent = "Salvo!";
                                    botao.style.color = "#3fb950";
                                    botao.style.borderColor = "#3fb950";
                                    setTimeout(() => {
                                        botao.textContent = "Salvar";
                                        botao.style.color = "#aaa";
                                        botao.style.borderColor = "#555";
                                    }, 1500);
                                    showToast("success", '"' + saveName + '" salvo em ' + (finderSelectedClassName || finderSelectedClassId));
                                },
                                { value: label !== id ? label : "", confirmLabel: "Salvar" }
                            );
                        });
                        row.addEventListener("click", (e) => {
                            if (e.target.tagName === "BUTTON") return;
                            if (cfg.clickInsertEditor) {
                                mostrarAba("editor");
                                editor.focus();
                                editorReplaceSelection(id);
                                showToast("success", "ID inserido no editor");
                            } else {
                                navigator.clipboard.writeText(id).then(() => showToast("success", "ID copiado!"));
                            }
                        });
                        finderResults.appendChild(row);
                    });

                    let loaded = finderResults.querySelectorAll(".se-ids-item").length;
                    finderStatus.textContent = "Exibindo " + loaded + " de " + finderTotalHits + " | Classe: " + (finderSelectedClassName || finderSelectedClassId);

                    if (hits.length === 0 && loaded === 0) {
                        finderResults.innerHTML = '<div class="se-ids-empty">Nenhum objeto encontrado</div>';
                    }
                } catch (err) {
                    finderStatus.textContent = "Erro: " + err.message;
                } finally {
                    finderLoading = false;
                }
            }

            finderResults.addEventListener("scroll", () => {
                if (finderResults.scrollTop + finderResults.clientHeight >= finderResults.scrollHeight - 50) {
                    let loaded = finderResults.querySelectorAll(".se-ids-item").length;
                    if (loaded < finderTotalHits && !finderLoading) loadFinderPage();
                }
            });

            let idsListEl = document.getElementById("se-ids-list");
            let idsAddBtn = document.getElementById("se-ids-add");
            let idsNameInput = document.getElementById("se-ids-name");
            let idsIdInput = document.getElementById("se-ids-id");
            let idsGroupInput = document.getElementById("se-ids-group");

            let idsActiveKind = "object";
            document.querySelectorAll("#se-ids-subtabs .se-ids-subtab").forEach((tab) => {
                tab.addEventListener("click", () => {
                    idsActiveKind = tab.dataset.kind;
                    document.querySelectorAll("#se-ids-subtabs .se-ids-subtab").forEach((t) => t.classList.toggle("se-ids-subtab-active", t === tab));
                    renderSavedIds();
                });
            });

            let idsAddClassBtn = document.getElementById("se-ids-add-class");
            let idsClassSearchBox = document.getElementById("se-ids-class-search");
            let idsClassSearchInput = document.getElementById("se-ids-class-search-input");
            let idsClassSearchResults = document.getElementById("se-ids-class-search-results");
            let idsClassSearchTimer = null;

            idsAddClassBtn.addEventListener("click", () => {
                let abrindo = idsClassSearchBox.style.display === "none";
                idsClassSearchBox.style.display = abrindo ? "block" : "none";
                idsClassSearchResults.innerHTML = "";
                idsClassSearchInput.value = "";
                if (abrindo) idsClassSearchInput.focus();
            });

            idsClassSearchInput.addEventListener("input", () => {
                clearTimeout(idsClassSearchTimer);
                let termo = idsClassSearchInput.value.trim();
                if (termo.length < 2) {
                    idsClassSearchResults.innerHTML = "";
                    return;
                }
                idsClassSearchTimer = setTimeout(async () => {
                    idsClassSearchResults.innerHTML = '<div class="se-ids-empty">Buscando...</div>';
                    try {
                        let itens = await buscarClassesPorTermo(termo);
                        if (!itens.length) {
                            idsClassSearchResults.innerHTML = '<div class="se-ids-empty">Nenhuma classe encontrada.</div>';
                            return;
                        }
                        idsClassSearchResults.innerHTML = itens
                            .map(
                                (it) =>
                                    '<div class="se-ids-item" data-class-id="' +
                                    it.classId +
                                    '" data-nome="' +
                                    escHtml(it.nome) +
                                    '" style="padding-left:16px;">' +
                                    '<span class="se-ids-item-name">' +
                                    escHtml(it.nome) +
                                    "</span>" +
                                    '<span class="se-ids-item-id">' +
                                    it.classId +
                                    "</span></div>"
                            )
                            .join("");
                        idsClassSearchResults.querySelectorAll(".se-ids-item").forEach((row) => {
                            row.addEventListener("click", () => {
                                let classId = row.dataset.classId;
                                let nome = row.dataset.nome;
                                let ids = getSavedIds();
                                if (ids.some((x) => x.id === classId)) {
                                    showToast("info", "ID já salvo");
                                    return;
                                }
                                ids.push({ name: nome, id: classId, group: "Classes", classId: "", kind: "class", favorite: false, addedAt: Date.now() });
                                setSavedIds(ids);
                                showToast("success", '"' + nome + '" salvo em Meus IDs');
                                idsClassSearchBox.style.display = "none";
                                renderSavedIds();
                            });
                        });
                    } catch (e) {
                        idsClassSearchResults.innerHTML = '<div class="se-ids-empty">Erro ao buscar: ' + escHtml(e.message) + "</div>";
                    }
                }, 300);
            });

            idsAddBtn.addEventListener("click", async () => {
                let name = idsNameInput.value.trim();
                let id = idsIdInput.value.trim();
                let group = idsGroupInput.value.trim() || "Geral";
                if (!name || !id) {
                    showToast("warning", "Nome e ID são obrigatórios");
                    return;
                }
                let ids = getSavedIds();
                if (ids.some((x) => x.id === id)) {
                    showToast("info", "ID já salvo");
                    return;
                }

                idsAddBtn.disabled = true;
                idsAddBtn.textContent = "Verificando...";
                let kind = await detectarTipoDoId(id);
                idsAddBtn.disabled = false;
                idsAddBtn.textContent = "Salvar";

                ids = getSavedIds();
                if (ids.some((x) => x.id === id)) {
                    showToast("info", "ID já salvo");
                    return;
                }
                ids.push({ name, id, group, classId: "", kind, favorite: false, addedAt: Date.now() });
                setSavedIds(ids);
                idsNameInput.value = "";
                idsIdInput.value = "";
                renderSavedIds();
                showToast("success", '"' + name + '" salvo em ' + group);
            });

            function renderSavedIds() {
                let ids = getSavedIds();
                if (ids.length === 0) {
                    idsListEl.innerHTML = '<div class="se-ids-empty">Nenhum ID salvo.<br>Use o "Buscar ID" para encontrar objetos e salvá-los, ou adicione manualmente acima.</div>';
                    return;
                }

                let favs = [];
                let groups = {};
                ids.forEach((item, idx) => {
                    let entry = { ...item, originalIdx: idx };
                    if (item.favorite) favs.push(entry);
                    let kind = item.kind || "object";
                    if (kind !== idsActiveKind) return;
                    let g = item.group || "Geral";
                    if (!groups[g]) groups[g] = [];
                    groups[g].push(entry);
                });

                let html = "";

                if (favs.length > 0) {
                    html += '<div class="se-ids-group-header" style="background:#1a1a2e;border-left:3px solid #f1c40f;"><span style="color:#f1c40f;">Favoritos (' + favs.length + ")</span></div>";
                    favs.forEach((item) => {
                        html += _buildIdRow(item);
                    });
                }

                let sortedGroups = Object.keys(groups).sort();
                if (sortedGroups.length === 0) {
                    let rotulo = idsActiveKind === "class" ? "classe salva" : "objeto salvo";
                    html += '<div class="se-ids-empty">Nenhum ' + rotulo + " ainda.</div>";
                }
                sortedGroups.forEach((g) => {
                    let icon = g === "Geral" ? "" : "";
                    html += '<div class="se-ids-group-header"><span>' + icon + escHtml(g) + " (" + groups[g].length + ")</span></div>";
                    groups[g].forEach((item) => {
                        html += _buildIdRow(item);
                    });
                });

                idsListEl.innerHTML = html;
                _bindIdRowEvents();
            }

            function _buildIdRow(item) {
                let starColor = item.favorite ? "#f1c40f" : "#555";
                let starTitle = item.favorite ? "Remover dos favoritos" : "Favoritar";
                return (
                    '<div class="se-ids-item" data-idx="' +
                    item.originalIdx +
                    '" data-id="' +
                    item.id +
                    '">' +
                    '<span class="se-ids-fav" data-favidx="' +
                    item.originalIdx +
                    '" title="' +
                    starTitle +
                    '" style="cursor:pointer;font-size:14px;color:' +
                    starColor +
                    ';margin-right:6px;user-select:none;">&#9733;</span>' +
                    '<span class="se-ids-item-name">' +
                    escHtml(item.name) +
                    "</span>" +
                    '<span class="se-ids-item-id">' +
                    item.id +
                    "</span>" +
                    '<button type="button" class="se-finder-copy" style="padding:2px 8px;background:#1C3C2E;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;">Copiar</button>' +
                    '<span class="se-ids-item-del" data-delidx="' +
                    item.originalIdx +
                    '" title="Remover">x</span>' +
                    "</div>"
                );
            }

            function _bindIdRowEvents() {
                idsListEl.querySelectorAll(".se-ids-fav").forEach((star) => {
                    star.addEventListener("click", (e) => {
                        e.stopPropagation();
                        let idx = parseInt(star.dataset.favidx);
                        let ids = getSavedIds();
                        if (ids[idx]) {
                            ids[idx].favorite = !ids[idx].favorite;
                            setSavedIds(ids);
                            renderSavedIds();
                        }
                    });
                });
                idsListEl.querySelectorAll(".se-finder-copy").forEach((btn) => {
                    btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        let row = btn.closest(".se-ids-item");
                        navigator.clipboard.writeText(row.dataset.id).then(() => {
                            btn.textContent = "OK!";
                            btn.style.background = "#27ae60";
                            setTimeout(() => {
                                btn.textContent = "Copiar";
                                btn.style.background = "#1C3C2E";
                            }, 1200);
                        });
                    });
                });
                idsListEl.querySelectorAll(".se-ids-item-del").forEach((del) => {
                    del.addEventListener("click", (e) => {
                        e.stopPropagation();
                        let idx = parseInt(del.dataset.delidx);
                        let ids = getSavedIds();
                        ids.splice(idx, 1);
                        setSavedIds(ids);
                        renderSavedIds();
                        showToast("info", "ID removido");
                    });
                });
                idsListEl.querySelectorAll(".se-ids-item").forEach((row) => {
                    row.addEventListener("click", (e) => {
                        if (e.target.tagName === "BUTTON" || e.target.classList.contains("se-ids-item-del") || e.target.classList.contains("se-ids-fav")) return;
                        let id = row.dataset.id;
                        if (cfg.clickInsertEditor) {
                            modal.querySelectorAll(".se-tab").forEach((t) => t.classList.remove("se-tab-active"));
                            modal.querySelectorAll(".se-tab-content").forEach((c) => c.classList.remove("se-tab-visible"));
                            modal.querySelector('[data-tab="editor"]').classList.add("se-tab-active");
                            modal.querySelector("#se-tab-editor").classList.add("se-tab-visible");
                            editor.focus();

                            let item = getSavedIds()[parseInt(row.dataset.idx)];
                            let texto = id;
                            if (cfg.insertFormatted && item && item.kind !== "class" && item.classId) {
                                texto = 'var classId = "' + item.classId + '";\nvar objectId = "' + id + '";';
                            }
                            editorReplaceSelection(texto);
                            showToast("success", "ID inserido no editor");
                        } else {
                            navigator.clipboard.writeText(id).then(() => showToast("success", "ID copiado!"));
                        }
                    });
                });
            }
            renderSavedIds();

            let snipListEl = document.getElementById("se-snip-list");
            let snipNameInput = document.getElementById("se-snip-name");
            let snipCodeInput = document.getElementById("se-snip-code");
            let snipSaveBtn = document.getElementById("se-snip-save");
            let snipNewBtn = document.getElementById("se-snip-new");

            let snipEditingId = null;

            let snipMini = criarMiniEditor({
                ta: snipCodeInput,
                highlightPre: document.getElementById("se-snip-highlight-pre"),
                indentGuidesEl: document.getElementById("se-snip-indent-guides"),
                findHighlightEl: document.getElementById("se-snip-find-highlight"),
                errorLayerEl: document.getElementById("se-snip-error-layer"),
                errorRulerEl: document.getElementById("se-snip-error-ruler"),
                replaceRow: document.getElementById("se-snip-replace-row"),
                replaceInput: document.getElementById("se-snip-replace-input"),
                replaceToggleBtn: document.getElementById("se-snip-find-toggle-replace"),
                replaceOneBtn: document.getElementById("se-snip-replace-one"),
                replaceAllBtn: document.getElementById("se-snip-replace-all"),
                gutterInnerEl: document.getElementById("se-snip-gutter-inner"),
                gutterEl: document.getElementById("se-snip-gutter"),
                autocompleteEl: document.getElementById("se-snip-autocomplete"),
                findBar: document.getElementById("se-snip-find-bar"),
                findInput: document.getElementById("se-snip-find-input"),
                findInfo: document.getElementById("se-snip-find-info"),
                findNextBtn: document.getElementById("se-snip-find-next"),
                findPrevBtn: document.getElementById("se-snip-find-prev"),
                findCloseBtn: document.getElementById("se-snip-find-close"),
                problemsEl: document.getElementById("se-snip-problems"),
                problemsBadgeEl: document.getElementById("se-snip-problems-badge")
            });
            snipMini.sync();
            snipMini.renderProblems();

            let snipFiltroInput = document.getElementById("se-snip-filtro");
            let snipNovoLateralBtn = document.getElementById("se-snip-novo-lateral");
            if (snipNovoLateralBtn) {
                snipNovoLateralBtn.addEventListener("click", () => {
                    limparFormSnippet();
                    snipNameInput.focus();
                });
            }
            if (snipFiltroInput) snipFiltroInput.addEventListener("input", renderSnippetList);

            function renderSnippetList() {
                let termo = snipFiltroInput ? snipFiltroInput.value.trim().toLowerCase() : "";
                let list = getSnippets();
                if (termo) list = list.filter((s) => s.nome.toLowerCase().indexOf(termo) !== -1);
                if (!list.length) {
                    snipListEl.innerHTML = '<div class="se-ids-empty">' + (termo ? "Nenhum snippet com esse nome." : "Nenhum snippet ainda.") + "</div>";
                } else {
                    snipListEl.innerHTML = list
                        .map(
                            (s) => `
                        <div class="se-snip-item ${s.id === snipEditingId ? "se-active" : ""}" data-id="${s.id}">
                            <span class="se-snip-item-name" title="${escHtml(s.nome)}">${escHtml(s.nome)}</span>
                            <span class="se-snip-item-del" data-id="${s.id}" title="Excluir">✕</span>
                        </div>`
                        )
                        .join("");
                }
                snipListEl.querySelectorAll(".se-snip-item").forEach((el) => {
                    el.addEventListener("click", (e) => {
                        if (e.target.classList.contains("se-snip-item-del")) return;
                        abrirSnippetParaEdicao(el.dataset.id);
                    });
                });
                snipListEl.querySelectorAll(".se-snip-item-del").forEach((el) => {
                    el.addEventListener("click", (e) => {
                        e.stopPropagation();
                        let id = el.dataset.id;
                        let s = getSnippets().find((x) => x.id === id);
                        showConfirmModal("Excluir snippet", 'Deseja excluir "' + escHtml((s && s.nome) || id) + '"?', null, () => {
                            setSnippets(getSnippets().filter((x) => x.id !== id));
                            if (snipEditingId === id) limparFormSnippet();
                            renderSnippetList();
                        }, { leaveLabel: "Excluir" });
                    });
                });
            }

            function abrirSnippetParaEdicao(id) {
                let s = getSnippets().find((x) => x.id === id);
                if (!s) return;
                snipEditingId = id;
                snipNameInput.value = s.nome;
                snipMini.setValue(s.codigo);
                snipMini.markClean();
                snipMini.renderProblems();
                snipMini.runCheck();
                snipSaveBtn.textContent = "Salvar alterações";
                renderSnippetList();
            }

            function limparFormSnippet() {
                snipEditingId = null;
                snipNameInput.value = "";
                snipMini.setValue("");
                snipMini.markClean();
                snipMini.renderProblems();
                snipSaveBtn.textContent = "Salvar";
            }
            snipNewBtn.addEventListener("click", limparFormSnippet);

            snipSaveBtn.addEventListener("click", () => {
                let nome = snipNameInput.value.trim();
                let codigo = snipMini.getValue();
                if (!nome) {
                    showToast("warning", "Dê um nome ao snippet (é o que você vai digitar pra chamá-lo)");
                    return;
                }
                if (!codigo.trim()) {
                    showToast("warning", "Escreva o código do snippet");
                    return;
                }

                let list = getSnippets();
                if (list.some((s) => s.nome === nome && s.id !== snipEditingId)) {
                    showToast("warning", 'Já existe um snippet chamado "' + nome + '"');
                    return;
                }
                if (snipEditingId) {
                    let s = list.find((x) => x.id === snipEditingId);
                    s.nome = nome;
                    s.codigo = codigo;
                } else {
                    list.push({ id: "snip_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), nome, codigo, addedAt: Date.now() });
                }
                setSnippets(list);
                showToast("success", '"' + nome + '" salvo');
                limparFormSnippet();
                renderSnippetList();
            });

            function downloadJson(data, filename) {
                let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                let url = URL.createObjectURL(blob);
                let a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            let copyTokenStatus = document.getElementById("se-copy-token-status");

            document.getElementById("se-copy-token").addEventListener("click", async () => {
                let tk = getValidSydleToken();
                if (!tk || !tk.token) {
                    copyTokenStatus.style.color = "#e74c3c";
                    copyTokenStatus.textContent = "Nenhum token de sessão encontrado. Faça login no Explorer.";
                    showToast("error", "Nenhum token de sessão encontrado");
                    return;
                }
                await window.navigator.clipboard.writeText(tk.token);
                copyTokenStatus.style.color = "#27ae60";
                copyTokenStatus.textContent = "Token copiado (conta: " + (tk.key || "?") + ")";
                showToast("success", "Token copiado");
            });

            let backupStatus = document.getElementById("se-backup-status");

            document.getElementById("se-backup-download").addEventListener("click", () => {
                let ids = getSavedIds();
                let scripts = getSavedScripts();
                let config = getExecutorConfig();
                let folders = getFolders();
                let total = ids.length + scripts.length;
                if (total === 0) {
                    showToast("warning", "Nenhum dado salvo para exportar");
                    return;
                }
                let exportData = {
                    type: "sytools_full_backup",
                    version: 3,
                    exportedAt: new Date().toISOString(),
                    savedIds: ids,
                    savedScripts: scripts,
                    folders: folders,
                    config: config
                };
                downloadJson(exportData, "sytools-backup-" + new Date().toISOString().slice(0, 10) + ".json");
                backupStatus.style.color = "#27ae60";
                backupStatus.textContent = "Backup exportado: " + ids.length + " IDs + " + scripts.length + " scripts + " + folders.length + " pastas";
                showToast("success", "Backup exportado (" + total + " itens)");
            });

            document.getElementById("se-backup-upload").addEventListener("click", () => {
                document.getElementById("se-backup-file-input").click();
            });

            document.getElementById("se-backup-file-input").addEventListener("change", (e) => {
                let file = e.target.files[0];
                if (!file) return;
                let reader = new FileReader();
                reader.onload = function (ev) {
                    try {
                        let data = JSON.parse(ev.target.result);
                        if (data.type !== "sytools_full_backup") {
                            showToast("error", "Formato inválido. Use um backup gerado pelo executor.");
                            return;
                        }
                        let idsAdded = 0,
                            scriptsAdded = 0;

                        if (Array.isArray(data.savedIds)) {
                            let current = getSavedIds();
                            data.savedIds.forEach((item) => {
                                if (!item.id) return;
                                if (!current.some((x) => x.id === item.id)) {
                                    current.push({ name: item.name || item.id, id: item.id, group: item.group || "Importado", addedAt: item.addedAt || Date.now() });
                                    idsAdded++;
                                }
                            });
                            setSavedIds(current);
                            renderSavedIds();
                        }

                        if (Array.isArray(data.savedScripts)) {
                            let current = getSavedScripts();
                            data.savedScripts.forEach((item) => {
                                if (!item.name || !item.code) return;
                                if (!current.some((x) => x.name === item.name)) {
                                    current.push({ name: item.name, code: item.code, type: item.type || "js" });
                                    scriptsAdded++;
                                }
                            });
                            saveSavedScripts(current);
                            refreshSidebar();
                        }

                        if (data.config && data.config.objetoId) {
                            saveExecutorConfig({ objetoId: data.config.objetoId });
                            document.getElementById("se-cfg-objeto").value = data.config.objetoId;
                        }

                        if (Array.isArray(data.folders) && data.folders.length > 0) {
                            let currentFolders = getFolders();
                            data.folders.forEach((f) => {
                                if (f && currentFolders.indexOf(f) === -1) currentFolders.push(f);
                            });
                            saveFolders(currentFolders);
                            refreshSidebar();
                        }

                        backupStatus.style.color = "#27ae60";
                        backupStatus.textContent = "Importado: " + idsAdded + " IDs novos + " + scriptsAdded + " scripts novos";
                        showToast("success", "Backup restaurado! " + idsAdded + " IDs + " + scriptsAdded + " scripts importados");
                    } catch (err) {
                        showToast("error", "Erro ao ler backup: " + err.message);
                    }
                };
                reader.readAsText(file);
                e.target.value = "";
            });

            let execClassStatus = document.getElementById("se-exec-class-status");

            document.getElementById("se-create-exec-obj").addEventListener("click", async () => {
                execClassStatus.style.color = "#f39c12";
                execClassStatus.textContent = "Criando objeto executor na classe nativa...";

                try {
                    let _tkInfo = getValidSydleToken();
                    token = _tkInfo.token;
                    if (!token) throw new Error("Token não encontrado. Faça login na plataforma primeiro.");
                    let userName = "";
                    let accountId = "";
                    let userClassId = "000000000000000000000002";
                    if (_tkInfo.userObj) {
                        userName = _tkInfo.userObj.name || _tkInfo.userObj.login || "";
                        accountId = _tkInfo.userObj.code || _tkInfo.userObj._id || _tkInfo.userObj.id || "";
                        if (_tkInfo.userObj.accessToken && _tkInfo.userObj.accessToken.payload && _tkInfo.userObj.accessToken.payload._class && _tkInfo.userObj.accessToken.payload._class._id) {
                            userClassId = _tkInfo.userObj.accessToken.payload._class._id;
                        }
                    }

                    let execName = "SyTools Executor" + (userName ? " - " + userName : "");
                    execClassStatus.textContent = "Usuário: " + (userName || accountId) + " | Criando objeto...";

                    let objBody = {
                        name: execName,
                        type: { _id: SCRIPT_TYPE_ID, _classId: "63ea4341a4bf15419bc6bc76" },
                        form: {
                            _class: { _id: "63ecefb88b2dca658b072085", _classId: "000000000000000000000000" },
                            script: '// Pronto para uso\n_output = { status: "ok" };'
                        },
                        readUsers: [{ _id: accountId, _classId: userClassId }],
                        writeUsers: [{ _id: accountId, _classId: userClassId }],
                        daysUntilPurge: 1
                    };

                    let createResp = await fetch(baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + NATIVE_RUNNABLE_CLASS_ID + "/_create?accessToken=" + token, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(objBody)
                    });

                    if (!createResp.ok) {
                        let errText = await createResp.text();
                        throw new Error("HTTP " + createResp.status + ": " + errText.substring(0, 300));
                    }

                    let createdObj = await createResp.json();
                    let newObjId = createdObj._id;

                    document.getElementById("se-cfg-objeto").value = newObjId;
                    saveExecutorConfig({ objetoId: newObjId });
                    cfg = { classeId: NATIVE_RUNNABLE_CLASS_ID, objetoId: newObjId };
                    updateRunEnabled();

                    execClassStatus.style.color = "#27ae60";
                    execClassStatus.textContent = "Objeto criado! ID: " + newObjId + " (configurado automaticamente)";
                    showToast("success", "Objeto executor criado e configurado!");
                } catch (err) {
                    execClassStatus.style.color = "#e74c3c";
                    execClassStatus.textContent = "Erro: " + err.message;
                    showToast("error", "Erro ao criar objeto: " + err.message);
                }
            });
        }
    }
}
