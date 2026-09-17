function showDeleteConfirmModal(objectId, classId, onConfirm) {
    let className = getCachedClassName(classId);
    let safeName = String(className).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let subtitle = className ? 'classe "' + safeName + '" &nbsp;&middot;&nbsp; classId: ' + classId : "classId: " + classId;

    let html =
        getSytoolsModalCss() +
        `
        <div class="sf-container">
            <div class="sf-header">
                <h2>Deletar Objeto</h2>
                <span style="white-space:normal;">${subtitle}</span>
            </div>
            <div class="sf-section">
                <label class="sf-label">Objeto selecionado</label>
                <div class="sf-info-box">
                    <div id="sytools-del-identifier" style="font-weight:700;font-size:16px;margin-bottom:10px;color:#1C3C2E;opacity:0.5;">Carregando identificador...</div>
                    <div style="font-family:'Cascadia Code',monospace;font-size:13px;line-height:1.7;word-break:break-all;">
                        _id: ${objectId}<br>_classId: ${classId}
                    </div>
                </div>
                <div class="sf-warning">⚠️ Esta ação é irreversível. O objeto será removido permanentemente.</div>
            </div>
        </div>`;

    Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: "Remover",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#c9302c",
        cancelButtonColor: "#888",
        reverseButtons: true,
        width: "640px",
        padding: "0",
        focusConfirm: true,
        didOpen: () => {
            let slot = document.getElementById("sytools-del-identifier");
            fetchObjectIdentifiers(objectId, classId).then((identifiers) => {
                if (!slot || !slot.parentNode) return;
                if (!identifiers.length) {
                    slot.parentNode.removeChild(slot);
                    return;
                }
                slot.style.opacity = "1";
                slot.textContent = identifiers.join(" \u00b7 ");
            });
        }
    }).then((result) => {
        if (result.isConfirmed) onConfirm();
    });
}

function showDangerConfirmModal(title, subtitle, detailHtml, confirmLabel, onConfirm) {
    let html =
        getSytoolsModalCss() +
        `
        <div class="sf-container">
            <div class="sf-header">
                <h2>Remover Objetos</h2>
                ${subtitle ? '<span>' + subtitle + "</span>" : ""}
            </div>
            <div class="sf-section">
                <div class="sf-info-box" style="text-align:center;font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:16px;">${title}</div>
                <div class="sf-info-box">${detailHtml}</div>
                <div class="sf-warning">⚠️ Esta ação é irreversível.</div>
            </div>
        </div>`;

    Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: confirmLabel || "Remover",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#c9302c",
        cancelButtonColor: "#888",
        reverseButtons: true,
        width: "640px",
        padding: "0",
        focusConfirm: true
    }).then((result) => {
        if (result.isConfirmed) onConfirm();
    });
}

const _sytoolsPanelStack = [];
const _SYTOOLS_PANEL_TOP = 90;
const _SYTOOLS_PANEL_GAP = 28;
const _SYTOOLS_PANEL_HEIGHT = 68;
const _SYTOOLS_TAB_HEIGHT = 54;
const _SYTOOLS_TAB_GAP = 16;

function _sytoolsRelayoutPanels() {
    let panelIdx = 0;
    let tabIdx = 0;
    for (let entry of _sytoolsPanelStack) {
        if (entry.collapsed) {
            entry.tabEl.style.top = _SYTOOLS_PANEL_TOP + tabIdx * (_SYTOOLS_TAB_HEIGHT + _SYTOOLS_TAB_GAP) + "px";
            tabIdx++;
        } else {
            entry.el.style.top = _SYTOOLS_PANEL_TOP + panelIdx * (_SYTOOLS_PANEL_HEIGHT + _SYTOOLS_PANEL_GAP) + "px";
            panelIdx++;
        }
    }
}

let _sytoolsPanelSeq = 0;

function showToast(icon, title) {
    _showDomToast(icon, title);
}

function _showDomToast(icon, title) {
    let colors = { success: "#27ae60", error: "#e74c3c", warning: "#f39c12", info: "#3498db" };
    let icons = { success: "\u2714", error: "\u2716", warning: "\u26A0", info: "\u2139" };
    let el = document.createElement("div");
    el.className = "sytools-toast-dom";
    el.style.cssText =
        "position:fixed;right:20px;z-index:999999;display:flex;align-items:center;gap:10px;" +
        "min-width:200px;max-width:360px;padding:12px 20px;border-radius:8px;font-family:-apple-system,sans-serif;" +
        "font-size:14px;font-weight:600;color:#fff;background:" +
        (colors[icon] || "#333") +
        ";box-shadow:0 4px 16px rgba(0,0,0,0.3);" +
        "opacity:0;transform:translateX(12px);transition:opacity 0.2s,transform 0.2s,top 0.2s;pointer-events:none;";
    el.innerHTML = '<span style="font-size:16px;">' + (icons[icon] || "") + "</span><span>" + title + "</span>";
    document.body.appendChild(el);

    let entry = { uid: "toast-" + ++_sytoolsPanelSeq, el, tabEl: null, collapsed: false };
    _sytoolsPanelStack.push(entry);
    _sytoolsRelayoutPanels();

    requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateX(0)";
    });
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateX(12px)";
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
            let idx = _sytoolsPanelStack.indexOf(entry);
            if (idx !== -1) _sytoolsPanelStack.splice(idx, 1);
            _sytoolsRelayoutPanels();
        }, 300);
    }, 2500);
}

function showQuickConfirm(title, detail, confirmLabel, onConfirm, opts) {
    let o = opts || {};
    let danger = o.danger !== false;
    let el = document.createElement("div");
    el.style.cssText =
        "position:fixed;right:20px;z-index:999999;min-width:280px;max-width:380px;" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;" +
        "color:#222;background:#fff;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.35);" +
        "border-left:4px solid " +
        (danger ? "#e74c3c" : "#3498db") +
        ";" +
        "opacity:0;transform:translateX(12px);transition:opacity 0.2s,transform 0.2s,top 0.2s;overflow:hidden;";

    el.innerHTML =
        '<div style="padding:14px 16px;">' +
        '<div style="font-weight:700;margin-bottom:4px;">' +
        title +
        "</div>" +
        (detail ? '<div style="font-size:12.5px;color:#666;margin-bottom:12px;line-height:1.4;">' + detail + "</div>" : '<div style="margin-bottom:12px;"></div>') +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button class="sytools-qc-cancel" style="padding:6px 14px;border:1.5px solid #ccc;background:transparent;color:#555;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Cancelar</button>' +
        '<button class="sytools-qc-confirm" style="padding:6px 14px;border:none;background:' +
        (danger ? "#e74c3c" : "#1C3C2E") +
        ';color:#fff;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">' +
        (confirmLabel || "Confirmar") +
        "</button>" +
        "</div></div>";

    document.body.appendChild(el);

    let entry = { uid: "confirm-" + ++_sytoolsPanelSeq, el, tabEl: null, collapsed: false };
    _sytoolsPanelStack.push(entry);
    _sytoolsRelayoutPanels();

    requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateX(0)";
    });

    function remove() {
        el.style.opacity = "0";
        el.style.transform = "translateX(12px)";
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
            let idx = _sytoolsPanelStack.indexOf(entry);
            if (idx !== -1) _sytoolsPanelStack.splice(idx, 1);
            _sytoolsRelayoutPanels();
        }, 200);
    }

    el.querySelector(".sytools-qc-cancel").addEventListener("click", remove);
    el.querySelector(".sytools-qc-confirm").addEventListener("click", () => {
        remove();
        onConfirm();
    });
}

function _extractProgressCounts(obj) {
    if (!obj || typeof obj !== "object") return null;
    let keys = ["ok", "criadas", "criados", "corrigidas", "atualizadas", "atualizados", "simulacao", "jaExiste", "jaEstavaCerto", "colaboradorNaoEncontrado", "erro", "erros", "totalParfunc", "totalConsignacoes"];
    let found = {};
    let any = false;
    for (let k of keys) {
        if (typeof obj[k] === "number") {
            found[k] = obj[k];
            any = true;
        }
    }
    return any ? found : null;
}

function showProgressPanel() {
    let uid = "sytools-progress-" + ++_sytoolsPanelSeq;

    let el = document.createElement("div");
    el.style.cssText =
        "position:fixed;right:20px;z-index:999999;min-width:280px;max-width:360px;" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;" +
        "color:#fff;background:#3498db;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.35);" +
        "opacity:0;transform:translateX(12px);transition:opacity 0.2s,transform 0.2s,background 0.3s,top 0.2s;overflow:hidden;";

    el.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;">' +
        '<span class="sytools-progress-spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:sytools-spin 0.8s linear infinite;flex-shrink:0;"></span>' +
        '<div style="flex:1;min-width:0;">' +
        '<div class="sytools-progress-title" style="font-weight:700;">Executando...</div>' +
        '<div class="sytools-progress-detail" style="font-size:12.5px;opacity:0.9;margin-top:2px;">Aguardando servidor</div>' +
        "</div>" +
        '<button class="sytools-progress-collapse" title="Recolher (continua monitorando)" style="background:none;border:none;color:#fff;opacity:0.7;cursor:pointer;font-size:15px;line-height:1;padding:0 2px;flex-shrink:0;">›</button>' +
        "</div>";

    if (!document.getElementById("sytools-progress-style")) {
        let style = document.createElement("style");
        style.id = "sytools-progress-style";
        style.textContent = "@keyframes sytools-spin { to { transform: rotate(360deg); } }";
        document.head.appendChild(style);
    }

    document.body.appendChild(el);

    let entry = { uid, el, tabEl: null, collapsed: false };
    _sytoolsPanelStack.push(entry);
    _sytoolsRelayoutPanels();

    requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateX(0)";
    });

    let lastState = { success: null, title: "Executando...", detail: "Aguardando servidor" };

    function removeFromStack() {
        let idx = _sytoolsPanelStack.indexOf(entry);
        if (idx !== -1) _sytoolsPanelStack.splice(idx, 1);
        _sytoolsRelayoutPanels();
    }

    function showTab() {
        if (entry.tabEl) return;
        let tabEl = document.createElement("div");
        let bg = lastState.success === null ? "#3498db" : lastState.success ? "#27ae60" : "#e74c3c";
        tabEl.title = lastState.title;
        tabEl.style.cssText =
            "position:fixed;right:0;z-index:999999;width:14px;height:" +
            _SYTOOLS_TAB_HEIGHT +
            "px;border-radius:8px 0 0 8px;background:" +
            bg +
            ";box-shadow:-2px 2px 10px rgba(0,0,0,0.3);cursor:pointer;" +
            "display:flex;align-items:center;justify-content:center;transition:width 0.15s,top 0.2s;";
        tabEl.innerHTML = '<span style="color:#fff;font-size:11px;transform:rotate(180deg);writing-mode:vertical-rl;">‹</span>';
        tabEl.addEventListener("mouseenter", () => (tabEl.style.width = "20px"));
        tabEl.addEventListener("mouseleave", () => (tabEl.style.width = "14px"));
        tabEl.addEventListener("click", expand);
        document.body.appendChild(tabEl);
        entry.tabEl = tabEl;
    }

    function hideTab() {
        if (entry.tabEl && entry.tabEl.parentNode) entry.tabEl.parentNode.removeChild(entry.tabEl);
        entry.tabEl = null;
    }

    function collapse() {
        entry.collapsed = true;
        el.style.opacity = "0";
        el.style.transform = "translateX(12px)";
        setTimeout(() => {
            el.style.display = "none";
            showTab();
            _sytoolsRelayoutPanels();
        }, 200);
        _sytoolsRelayoutPanels();
    }

    function expand() {
        entry.collapsed = false;
        hideTab();
        el.style.display = "";
        _sytoolsRelayoutPanels();
        requestAnimationFrame(() => {
            el.style.opacity = "1";
            el.style.transform = "translateX(0)";
        });
    }

    el.querySelector(".sytools-progress-collapse").addEventListener("click", collapse);

    return {
        collapse,
        expand,
        update(detail) {
            lastState.detail = detail;
            let d = el.querySelector(".sytools-progress-detail");
            if (d) d.textContent = detail;
        },
        finish(success, title, detail, autoCloseMs) {
            lastState = { success, title, detail };
            let spinner = el.querySelector(".sytools-progress-spinner");
            let titleEl = el.querySelector(".sytools-progress-title");
            let detailEl = el.querySelector(".sytools-progress-detail");
            if (spinner) {
                spinner.style.animation = "none";
                spinner.style.border = "none";
                spinner.style.fontSize = "14px";
                spinner.style.lineHeight = "16px";
                spinner.innerHTML = success ? "✔" : "✖";
            }
            el.style.background = success ? "#27ae60" : "#e74c3c";
            if (titleEl) titleEl.textContent = title;
            if (detailEl) detailEl.textContent = detail || "";

            if (entry.collapsed) {

                expand();
            }

            setTimeout(() => {
                el.style.opacity = "0";
                el.style.transform = "translateX(12px)";
                setTimeout(() => {
                    if (el.parentNode) el.parentNode.removeChild(el);
                    hideTab();
                    removeFromStack();
                }, 300);
            }, typeof autoCloseMs === "number" ? autoCloseMs : 8000);
        },
        remove() {
            if (el.parentNode) el.parentNode.removeChild(el);
            hideTab();
            removeFromStack();
        }
    };
}

function getSytoolsModalCss() {
    return `
        <style>
            .swal2-popup { overflow-x: hidden !important; border-radius: 16px !important; padding: 0 !important; box-shadow: 0 20px 60px rgba(0,0,0,0.25) !important; }
            .swal2-html-container { overflow-x: hidden !important; margin: 0 !important; padding: 0 !important; }
            .swal2-actions { padding: 12px 44px 36px 44px !important; margin-top: 0 !important; gap: 16px !important; }
            .swal2-actions button { border-radius: 10px !important; font-weight: 600 !important; font-size: 15px !important; padding: 14px 36px !important; letter-spacing: 0.2px; }
            .swal2-confirm { box-shadow: 0 2px 8px rgba(28,60,46,0.25) !important; }
            .swal2-cancel { background: transparent !important; color: #555 !important; border: 1.5px solid #ccc !important; }
            .swal2-cancel:hover { background: #f5f5f5 !important; border-color: #999 !important; }
            .swal2-validation-message { margin: 0 44px 16px !important; border-radius: 10px !important; font-size: 14px !important; }

            .sf-container { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; text-align: left; overflow-x: hidden; padding: 0 44px 20px 44px; color: #1a1a1a; }
            .sf-header {
                background: #1C3C2E; color: #fff; padding: 32px 44px 28px; margin: 0 -44px 40px -44px;
                box-sizing: border-box; width: calc(100% + 88px);
                border-radius: 16px 16px 0 0; text-align: center;
            }
            .sf-header h2 { margin: 0 0 10px 0; font-size: 26px; font-weight: 700; letter-spacing: -0.3px; }
            .sf-header span { font-size: 13.5px; opacity: 0.75; letter-spacing: 0.1px; white-space: nowrap; }

            .sf-section { margin-bottom: 32px; }
            .sf-label { display: block; font-size: 13px; font-weight: 700; color: #555; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; }

            .sf-select, .sf-input {
                width: 100%; padding: 13px 16px; border: 1.5px solid #ddd; border-radius: 10px;
                font-size: 15px; background: #fafafa; outline: none; box-sizing: border-box;
                color: #222; appearance: auto; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
            }
            .sf-select:hover, .sf-input:hover { border-color: #bbb; background: #fff; }
            .sf-select:focus, .sf-input:focus { border-color: #1C3C2E; box-shadow: 0 0 0 3px rgba(28,60,46,0.08); background: #fff; }
            .sf-select option { padding: 10px 14px; font-size: 15px; }

            .sf-filters-box {
                border: 1.5px solid #e5e5e5; border-radius: 12px; padding: 20px;
                background: #fafafa;

                max-height: 38vh; overflow-y: auto; overflow-x: hidden;
            }
            .sf-filter-row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
            .sf-filter-row:last-child { margin-bottom: 0; }
            .sf-filter-row .sf-filter-fields { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; }

            .sf-filter-row .sf-filter-fields.sf-fields-date { flex-direction: row; flex-wrap: wrap; align-items: center; }
            .sf-filter-row .sf-fields-date .sf-filter-dateop { flex: 0 0 auto; }
            .sf-filter-row .sf-fields-date .sf-filter-type { flex: 1 1 100%; }
            .sf-filter-row .sf-fields-date .sf-filter-value { flex: 1 1 130px; min-width: 130px; }
            .sf-filter-row .sf-remove-btn {
                flex-shrink: 0; width: 34px; height: 34px; border: none; background: #fee2e2; color: #dc2626;
                border-radius: 8px; cursor: pointer; font-size: 18px; line-height: 34px; padding: 0; margin-top: 4px;
                transition: background 0.15s;
            }
            .sf-filter-row .sf-remove-btn:hover { background: #fecaca; }

            .sf-add-filter {
                display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px;
                border: 1.5px dashed #bbb; background: transparent; color: #666;
                border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600; margin-top: 16px;
                transition: all 0.15s;
            }
            .sf-add-filter:hover { border-color: #1C3C2E; color: #1C3C2E; background: #f0f7f4; }

            .sf-divider { height: 1px; background: #eee; margin: 32px 0; }

            .sf-bottom-row { display: flex; gap: 20px; }
            .sf-bottom-row > div { flex: 1; }
            .sf-hidden { display: none !important; }

            .sf-mode-box { border: 1.5px solid #e5e5e5; border-radius: 12px; padding: 20px; background: #fafafa; }
            .sf-mode-option { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; cursor: pointer; }
            .sf-mode-option:last-child { margin-bottom: 0; }
            .sf-mode-option input { margin-top: 4px; accent-color: #1C3C2E; width: 18px; height: 18px; }
            .sf-mode-option label { font-size: 15px; color: #333; cursor: pointer; flex: 1; }
            .sf-mode-option small { display: block; color: #888; font-size: 13px; margin-top: 3px; }

            .sf-filter-panel { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
            .sf-warning { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 10px; padding: 14px 20px; font-size: 14px; color: #92400e; margin-top: 20px; }

            .sf-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background: #f0f7f4; color: #1C3C2E; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 3px 5px 3px 0; border: 1px solid #d1e7dd; }
            .sf-chip-remove { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 16px; font-weight: 700; padding: 0 2px; line-height: 1; }
            .sf-chip-remove:hover { color: #ef4444; }

            .sf-step-indicator { display: flex; gap: 10px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #eee; }
            .sf-step {
                flex: 1; text-align: center; padding: 12px 10px; border-radius: 10px;
                font-size: 13px; font-weight: 700; background: #f3f3f3; color: #999;
                transition: all 0.15s; letter-spacing: 0.2px;
            }
            .sf-step.active { background: #1C3C2E; color: #fff; box-shadow: 0 2px 8px rgba(28,60,46,0.2); }
            .sf-step.done { background: #dcfce7; color: #15803d; }

            .sf-info-box {
                background: #f0f7f4; border: 1px solid #d1e7dd; border-radius: 10px;
                padding: 16px 22px; font-size: 14px; color: #1C3C2E; margin-bottom: 12px;
                font-weight: 500; line-height: 1.5;
            }

            .sf-ssel { position: relative; }
            .sf-ssel-native { position: absolute !important; opacity: 0 !important; pointer-events: none !important; width: 1px !important; height: 1px !important; }
            .sf-ssel-box {
                display: flex; align-items: center; justify-content: space-between; gap: 8px;
                width: 100%; padding: 13px 16px; border: 1.5px solid #ddd; border-radius: 10px;
                font-size: 15px; background: #fafafa; color: #222; cursor: pointer; box-sizing: border-box;
                transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
            }
            .sf-ssel-box:hover { border-color: #bbb; background: #fff; }
            .sf-ssel.open .sf-ssel-box { border-color: #1C3C2E; box-shadow: 0 0 0 3px rgba(28,60,46,0.08); background: #fff; }
            .sf-ssel-box-label.placeholder { color: #999; }
            .sf-ssel-box-arrow { color: #888; font-size: 11px; flex-shrink: 0; transition: transform 0.15s; }
            .sf-ssel.open .sf-ssel-box-arrow { transform: rotate(180deg); }
            .sf-ssel-panel {
                display: none; position: fixed; z-index: 20000;
                background: #fff; border: 1.5px solid #1C3C2E; border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.18); overflow: hidden;
            }
            .sf-ssel-panel.open { display: block; }
            .sf-ssel-search {
                width: 100%; padding: 11px 14px; border: none; border-bottom: 1px solid #eee;
                font-size: 14px; outline: none; box-sizing: border-box; background: #fcfcfc;
            }
            .sf-ssel-list { max-height: 240px; overflow-y: auto; }
            .sf-ssel-opt { padding: 10px 16px; font-size: 14px; color: #222; cursor: pointer; }
            .sf-ssel-opt:hover, .sf-ssel-opt.active { background: #f0f7f4; color: #1C3C2E; }
            .sf-ssel-opt.selected { font-weight: 700; }
            .sf-ssel-empty { padding: 14px 16px; font-size: 13px; color: #999; text-align: center; }
        </style>`;
}

function createSearchableSelect(selectEl, placeholder) {
    if (!selectEl || selectEl.dataset.sselAttached) return;
    selectEl.dataset.sselAttached = "1";

    let wrap = document.createElement("div");
    wrap.className = "sf-ssel";

    selectEl.classList.add("sf-ssel-native");
    selectEl.parentNode.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);

    let box = document.createElement("div");
    box.className = "sf-ssel-box";
    box.tabIndex = 0;
    box.innerHTML = '<span class="sf-ssel-box-label"></span><span class="sf-ssel-box-arrow">▾</span>';
    wrap.appendChild(box);
    let boxLabel = box.querySelector(".sf-ssel-box-label");

    let panel = document.createElement("div");
    panel.className = "sf-ssel-panel";
    panel.innerHTML = '<input type="text" class="sf-ssel-search" placeholder="' + (placeholder || "Buscar...") + '"><div class="sf-ssel-list"></div>';
    document.body.appendChild(panel);
    let searchInput = panel.querySelector(".sf-ssel-search");
    let list = panel.querySelector(".sf-ssel-list");

    function positionPanel() {
        let r = box.getBoundingClientRect();
        panel.style.left = r.left + "px";
        panel.style.width = r.width + "px";
        let spaceBelow = window.innerHeight - r.bottom;
        let maxListHeight = 240;
        let neededHeight = 46 + maxListHeight;
        if (spaceBelow >= neededHeight + 8 || spaceBelow >= r.top) {
            panel.style.top = r.bottom + 4 + "px";
            panel.style.bottom = "";
        } else {
            panel.style.top = "";
            panel.style.bottom = window.innerHeight - r.top + 4 + "px";
        }
    }

    function optionEntries() {
        return Array.from(selectEl.options).map((o, i) => ({ idx: i, value: o.value, text: o.textContent }));
    }

    function syncLabel() {
        let opt = selectEl.options[selectEl.selectedIndex];
        let text = opt ? opt.textContent : "";
        let isPlaceholder = !opt || !opt.value;
        boxLabel.textContent = text || placeholder || "Selecione...";
        boxLabel.classList.toggle("placeholder", isPlaceholder);
    }

    function renderList(term) {
        let norm = _sfNormalizeText(term);
        let entries = optionEntries();
        let matches = norm ? entries.filter((e) => !e.value || _sfNormalizeText(e.text).includes(norm)) : entries;

        list.innerHTML = "";
        if (matches.length === 0) {
            list.innerHTML = '<div class="sf-ssel-empty">Nenhum resultado</div>';
            return;
        }
        for (let e of matches) {
            let row = document.createElement("div");
            row.className = "sf-ssel-opt" + (e.idx === selectEl.selectedIndex ? " selected" : "");
            row.textContent = e.text;
            row.dataset.idx = e.idx;
            row.addEventListener("click", () => {
                selectEl.selectedIndex = e.idx;
                selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                syncLabel();
                closePanel();
            });
            list.appendChild(row);
        }
    }

    function openPanel() {
        if (panel.classList.contains("open")) return;
        wrap.classList.add("open");
        positionPanel();
        panel.classList.add("open");
        searchInput.value = "";
        renderList("");
        searchInput.focus();
        document.addEventListener("mousedown", onOutsideClick, true);
        window.addEventListener("scroll", positionPanel, true);
        window.addEventListener("resize", positionPanel, true);
    }

    function closePanel() {
        wrap.classList.remove("open");
        panel.classList.remove("open");
        document.removeEventListener("mousedown", onOutsideClick, true);
        window.removeEventListener("scroll", positionPanel, true);
        window.removeEventListener("resize", positionPanel, true);
    }

    function onOutsideClick(e) {
        if (!wrap.contains(e.target) && !panel.contains(e.target)) closePanel();
    }

    box.addEventListener("click", () => (panel.classList.contains("open") ? closePanel() : openPanel()));
    box.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            openPanel();
        }
    });

    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closePanel();
            box.focus();
        } else if (e.key === "Enter") {
            e.preventDefault();
            renderList(searchInput.value);
        }
    });

    selectEl.addEventListener("change", syncLabel);
    new MutationObserver(syncLabel).observe(selectEl, { childList: true, subtree: true, characterData: true });

    function destroyPanel() {
        closePanel();
        if (panel.parentNode) panel.parentNode.removeChild(panel);
        wrapObserver.disconnect();
        bodyObserver.disconnect();
    }
    function checkAlive() {
        if (!document.body.contains(wrap)) destroyPanel();
    }
    let wrapObserver = new MutationObserver(checkAlive);
    if (wrap.parentNode) wrapObserver.observe(wrap.parentNode, { childList: true });
    let bodyObserver = new MutationObserver(checkAlive);
    bodyObserver.observe(document.body, { childList: true });

    syncLabel();
}
