function cmdDeleteObject() {

    let objectInfo = getActiveObjectIdsNoCopy();

    if (!objectInfo.id || objectInfo.id === "000000000000000000000000" || !objectInfo.cid) {
        showToast("error", "Nenhum objeto selecionado para deletar.");
        return;
    }

    showDeleteConfirmModal(objectInfo.id, objectInfo.cid, () => {
        deleteObject(objectInfo.id, objectInfo.cid)
            .then(() => {
                showToast("success", "Objeto removido");
            })
            .catch((error) => {
                let msg = "Falha ao deletar o objeto.";
                if (error && error.responseJSON) msg = JSON.stringify(error.responseJSON);
                else if (error && error.statusText) msg = error.status + " " + error.statusText;
                else if (error && error.message) msg = error.message;
                showToast("error", "Erro ao deletar: " + msg);
            });
    });
}

function cmdRemoveObjects() {
    let classId = getListingClassId();
    if (!classId) {
        let objectInfo = getActiveObjectIdsNoCopy();
        if (objectInfo.cid) classId = objectInfo.cid;
    }
    if (!classId) {
        showToast("error", "Nenhuma classe detectada na página");
        return;
    }

    let notifRecipient = getNotifRecipient(getValidSydleToken().userObj);

    let loadingPanel = showProgressPanel();
    loadingPanel.update("Carregando dados da classe...");

    loadClassFilterData(classId)
        .then(({ sample, totalHits, creationUsers, updateUsers, refFieldsData, token, baseUrl, className, fieldNames }) => {
            loadingPanel.finish(true, "Dados carregados", "Abrindo formulário...", 3500);
            let filterOpts = buildFilterOptions(sample, creationUsers, updateUsers, refFieldsData, fieldNames);
            let optionsHtml = buildAdvancedFilterHtml(filterOpts);
            let filterOptsMap = {};
            for (let o of filterOpts) filterOptsMap[o.value] = o;

            let css = getSytoolsModalCss();

            let html =
                css +
                `
            <div class="sf-container">
                <div class="sf-header">
                    <h2>Remover Objetos</h2>
                    <span>${totalHits.toLocaleString("pt-BR")} objetos na classe "${className}" &nbsp;&middot;&nbsp; classId: ${classId}</span>
                </div>
                <div class="sf-section">
                    <label class="sf-label">Modo de remoção</label>
                    <div class="sf-mode-box">
                        <div class="sf-mode-option">
                            <input type="radio" name="ro-mode" id="ro-mode-filter" value="filter" checked>
                            <label for="ro-mode-filter">Filtrar por campo<small>Combine um ou mais filtros — só remove o que bater em TODOS ao mesmo tempo</small></label>
                        </div>
                        <div class="sf-mode-option">
                            <input type="radio" name="ro-mode" id="ro-mode-all" value="all">
                            <label for="ro-mode-all">Remover TODOS os objetos<small>Deleta todos os ${totalHits.toLocaleString("pt-BR")} objetos desta classe</small></label>
                        </div>
                        <div class="sf-mode-option">
                            <input type="radio" name="ro-mode" id="ro-mode-ids" value="ids">
                            <label for="ro-mode-ids">Colar lista de IDs<small>Cole IDs copiados do "Copiar IDs Filtrado" ou qualquer formato</small></label>
                        </div>
                    </div>
                    <div class="sf-filter-panel sf-hidden" id="ro-ids-panel">
                        <label class="sf-label">IDs dos objetos</label>
                        <textarea class="sf-input" id="ro-ids-input" rows="6" placeholder='Aceita qualquer formato:&#10;["id1","id2","id3"]&#10;id1&#10;id2&#10;id1, id2, id3&#10;id1;id2;id3' style="resize:vertical;min-height:100px;font-family:'Cascadia Code',monospace;font-size:12px;"></textarea>
                        <div style="font-size:11px;color:#666;margin-top:6px;">Formatos aceitos: array JS, um ID por linha, separado por vírgula ou ponto e vírgula.</div>
                    </div>
                    <div class="sf-filter-panel sf-hidden" id="ro-filter-panel">
                        <label class="sf-label">Filtros de busca</label>
                        <div class="sf-filters-box" id="ro-filters-box">
                            <div class="sf-filter-row" data-idx="0">
                                <div class="sf-filter-fields">
                                    <select class="sf-select sf-filter-type" data-idx="0">${optionsHtml}</select>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="sf-add-filter" id="ro-add-filter">+ Adicionar filtro</button>
                        <div id="ro-filter-count"></div>
                    </div>
                    <div class="sf-warning">⚠️ Esta ação é irreversível. Os objetos serão removidos permanentemente.</div>
                </div>
            </div>`;

            Swal.fire({
                html: html,
                showCancelButton: true,
                confirmButtonText: "Continuar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#1C3C2E",
                cancelButtonColor: "#888",
                reverseButtons: true,
                width: "800px",
                padding: "0",
                didOpen: () => {
                    let filterPanel = document.getElementById("ro-filter-panel");
                    let idsPanel = document.getElementById("ro-ids-panel");

                    function updateModePanels() {
                        let mode = document.querySelector('input[name="ro-mode"]:checked').value;
                        filterPanel.classList.toggle("sf-hidden", mode !== "filter");
                        idsPanel.classList.toggle("sf-hidden", mode !== "ids");
                    }

                    document.querySelectorAll('input[name="ro-mode"]').forEach((r) => {
                        r.addEventListener("change", updateModePanels);
                    });

                    updateModePanels();

                    attachFilterListeners("ro-filters-box", "ro-add-filter", filterOptsMap, { classId, token, baseUrl, countElId: "ro-filter-count" });
                },
                preConfirm: () => {
                    let mode = document.querySelector('input[name="ro-mode"]:checked').value;

                    if (mode === "all") {
                        return { query: { match_all: {} }, label: "TODOS os objetos", mode };
                    }

                    if (mode === "ids") {
                        let raw = document.getElementById("ro-ids-input").value.trim();
                        if (!raw) {
                            Swal.showValidationMessage("Cole os IDs dos objetos");
                            return false;
                        }
                        let parsedIds = parseIdsFromText(raw);
                        if (parsedIds.length === 0) {
                            Swal.showValidationMessage("Nenhum ID válido encontrado no texto");
                            return false;
                        }
                        return { query: null, label: parsedIds.length + " IDs colados manualmente", mode: "ids", idsList: parsedIds };
                    }

                    let { filters, hasError } = collectFilters("ro-filters-box");
                    if (hasError) {
                        Swal.showValidationMessage("Preencha o valor de todos os filtros selecionados");
                        return false;
                    }
                    let activeFilters = filters.filter((f) => f.type !== "_none_");
                    if (activeFilters.length === 0) {
                        Swal.showValidationMessage("Adicione pelo menos um filtro, ou escolha \"Remover TODOS os objetos\"");
                        return false;
                    }
                    let query = buildFilteredQueryFromAdvanced(activeFilters);
                    let label = activeFilters.map((f) => describeFilter(f, filterOptsMap)).join(" E ");
                    return { query, label, mode };
                }
            }).then(async (formResult) => {
                if (!formResult.isConfirmed) return;

                let { query, label, mode: fMode, idsList } = formResult.value;

                let headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };

                async function notificarInicioRemocao(total, descricaoFiltro) {
                    if (!notifRecipient) return null;
                    return criarNotificacaoSydle(baseUrl, headers, {
                        recipient: notifRecipient,
                        subject: "Removendo objetos: " + className,
                        contentText: "0 de " + total.toLocaleString("pt-BR") + " removidos" + (descricaoFiltro ? " (" + descricaoFiltro + ")" : ""),
                        indeterminate: false,
                        progressValue: 0,
                        redirectObject: { _id: classId, _classId: "000000000000000000000000" }
                    });
                }

                function fazerOnProgress(notificationId, total) {
                    if (!notificationId) return null;
                    let ultimoPct = -1;
                    return (removidos) => {
                        let pct = Math.min(100, Math.round((removidos / total) * 100));
                        if (pct === ultimoPct) return;
                        ultimoPct = pct;
                        atualizarNotificacaoSydle(baseUrl, headers, notificationId, {
                            contentText: removidos.toLocaleString("pt-BR") + " de " + total.toLocaleString("pt-BR") + " removidos",
                            progressValue: pct
                        });
                    };
                }

                async function finalizarNotificacaoRemocao(notificationId, removidos, total, erros) {
                    if (!notificationId) return;
                    await atualizarNotificacaoSydle(baseUrl, headers, notificationId, {
                        subject: "Remoção concluída: " + className,
                        contentText: removidos.toLocaleString("pt-BR") + " de " + total.toLocaleString("pt-BR") + " removidos" + (erros ? " • " + erros + " erros" : ""),
                        showProgress: false,
                        indeterminate: false,
                        progressValue: 100
                    });
                }

                if (fMode === "ids" && idsList && idsList.length > 0) {
                    let idsPreview = idsList.slice(0, 8).join(", ") + (idsList.length > 8 ? " …" : "");
                    showDangerConfirmModal(
                        idsList.length.toLocaleString("pt-BR") + " objetos a deletar",
                        'classe "' + className + '" &nbsp;&middot;&nbsp; classId: ' + classId,
                        "Lista de IDs colados<br><span style=\"font-size:11px;color:#999;\">" + idsPreview + "</span>",
                        "Remover",
                        async () => {
                            let total = idsList.length;
                            let notificationId = await notificarInicioRemocao(total, "lista de IDs");

                            let batchResult = await deleteIdsBatch(idsList, classId, token, baseUrl, fazerOnProgress(notificationId, total));
                            await finalizarNotificacaoRemocao(notificationId, batchResult.removidos, total, batchResult.erros);
                        }
                    );
                    return;
                }

                showToast("info", "Contando objetos...");

                try {
                    let countResp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ size: 0, query: query })
                    });
                    let countResult = await countResp.json();
                    let count = countResult.hits && countResult.hits.total ? countResult.hits.total : 0;
                    if (typeof count === "object") count = count.value || 0;

                    if (count === 0) {
                        showToast("warning", "Nenhum objeto encontrado com este filtro");
                        return;
                    }

                    showDangerConfirmModal(
                        count.toLocaleString("pt-BR") + " objetos a deletar",
                        'classe "' + className + '" &nbsp;&middot;&nbsp; classId: ' + classId,
                        "Filtro: " + label,
                        "Remover",
                        async () => {
                            let notificationId = await notificarInicioRemocao(count, label);
                            let result = await executeBatchDeletion(classId, query, token, baseUrl, count, fazerOnProgress(notificationId, count));
                            await finalizarNotificacaoRemocao(notificationId, result.removidos, count, result.erros);
                        }
                    );
                } catch (error) {
                    showToast("error", "Erro: " + (error.message || error));
                }
            });
        })
        .catch((error) => {
            loadingPanel.remove();
            showToast("error", "Erro: " + (error.message || error));
        });
}

async function deleteIdsBatch(ids, classId, token, baseUrl, onProgress) {
    const CONCURRENT = 50;
    const DELAY_MS = 200;
    let removidos = 0;
    let erros = 0;
    let errosMsgs = [];
    let total = ids.length;
    let apiNs = getSydleApiNamespace();

    for (let i = 0; i < total; i += CONCURRENT) {
        let chunk = ids.slice(i, i + CONCURRENT);
        let results = await Promise.allSettled(
            chunk.map((id) =>
                fetch(`${baseUrl}/api/1/${apiNs}/_classId/${classId}/_delete/${id}?accessToken=${token}`, { method: "POST" }).then((r) => {
                    if (!r.ok) throw new Error("HTTP " + r.status);
                    return id;
                })
            )
        );
        for (let r of results) {
            if (r.status === "fulfilled") removidos++;
            else {
                erros++;
                if (errosMsgs.length < 30) errosMsgs.push(r.reason && r.reason.message ? r.reason.message : String(r.reason));
            }
        }
        if (onProgress) onProgress(removidos, total);
        if (i + CONCURRENT < total) await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return { removidos, erros, errosMsgs };
}

async function executeBatchDeletion(classId, query, token, baseUrl, totalConhecido, onProgress) {
    const BATCH_SIZE = 500;
    let searchAfter = null;
    let continuar = true;
    let encontrados = 0;
    let removidos = 0;
    let erros = 0;
    let errosMsgs = [];

    while (continuar) {
        let queryParam = {
            size: BATCH_SIZE,
            query: query,
            _source: false,
            sort: ["_id_doc_value"]
        };
        if (searchAfter) queryParam.search_after = searchAfter;

        let res;
        try {
            let searchResp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(queryParam)
            });
            if (!searchResp.ok) throw new Error("Erro na busca: HTTP " + searchResp.status);
            res = await searchResp.json();
        } catch (e) {
            errosMsgs.push("Erro na busca: " + (e.message || e));
            break;
        }

        if (!res || !res.hits || !res.hits.hits || res.hits.hits.length === 0) break;

        let hits = res.hits.hits;
        searchAfter = hits[hits.length - 1].sort;
        encontrados += hits.length;

        let batchIds = hits.map((h) => h._id);

        let batchResult = await deleteIdsBatch(batchIds, classId, token, baseUrl, onProgress ? (r) => onProgress(removidos + r, totalConhecido) : null);
        removidos += batchResult.removidos;
        erros += batchResult.erros;
        errosMsgs = errosMsgs.concat(batchResult.errosMsgs);

        if (hits.length < BATCH_SIZE) continuar = false;
    }

    return { encontrados, removidos, erros, errosMsgs };
}

async function cmdRevertObjects() {
    await hydrateSytoolsStore();
    let classId = getListingClassId();
    if (!classId) {
        showToast("error", "Nenhuma listagem de objetos aberta");
        return;
    }

    let execCfg = getExecutorConfig();
    if (!execCfg || !execCfg.objetoId) {
        Swal.fire({ title: "Executor não configurado", text: "Configure o Executor de Scripts primeiro (crie um Objeto Executor na aba Configurações).", icon: "warning", confirmButtonColor: "#1C3C2E" });
        return;
    }

    let _tkRev = getSydleToken();
    if (!_tkRev.token) {
        Swal.fire({ title: "Token não encontrado", text: "Faça login novamente na plataforma.", icon: "error", confirmButtonColor: "#1C3C2E" });
        return;
    }

    let loadingPanel = showProgressPanel();
    loadingPanel.update("Carregando dados da classe...");

    let filterData;
    try {
        filterData = await loadClassFilterData(classId);
    } catch (e) {
        loadingPanel.remove();
        Swal.fire({ title: "Erro", text: e.message || "Falha ao carregar dados da classe", icon: "error", confirmButtonColor: "#1C3C2E" });
        return;
    }
    loadingPanel.finish(true, "Dados carregados", "Abrindo formulário...", 3500);

    let { sample, totalHits, creationUsers, updateUsers, refFieldsData, token, baseUrl, className, fieldNames } = filterData;
    let filterOpts = buildFilterOptions(sample, creationUsers, updateUsers, refFieldsData, fieldNames);
    let optionsHtml = buildAdvancedFilterHtml(filterOpts);
    let filterOptsMap = {};
    for (let o of filterOpts) filterOptsMap[o.value] = o;

    let css = getSytoolsModalCss();

    let html =
        css +
        `
        <style>
            .rv-loading-overlay {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(255,255,255,0.85); z-index: 10;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                border-radius: 16px;
            }
            .rv-loading-overlay .sf-spinner {
                width: 40px; height: 40px; border: 4px solid #e5e5e5; border-top-color: #1C3C2E;
                border-radius: 50%; animation: sf-spin 0.7s linear infinite;
            }
            @keyframes sf-spin { to { transform: rotate(360deg); } }
            .rv-loading-overlay span { margin-top: 16px; font-size: 14px; color: #555; font-weight: 600; }
            .rv-ids-textarea { width:100%; height:80px; background:#fff; color:#333; border:1px solid #ddd; border-radius:6px; padding:10px; font-family:monospace; font-size:12px; resize:vertical; }
            .rv-count-label { font-size:13px; color:#1C3C2E; font-weight:600; margin-top:8px; }
        </style>
        <div class="sf-container" id="rv-wizard" style="position:relative;">
            <div class="sf-header">
                <h2>Reverter Objetos</h2>
                <span id="rv-subtitle">${totalHits.toLocaleString("pt-BR")} objetos na classe "${className}"</span>
            </div>

            <div class="sf-section">
                <label class="sf-label">Selecionar objetos por:</label>
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                    <button type="button" class="sf-add-filter" id="rv-mode-filter" style="background:#1C3C2E;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Filtros</button>
                    <button type="button" class="sf-add-filter" id="rv-mode-ids" style="background:#f0f0f0;color:#555;border:1px solid #ddd;padding:8px 16px;border-radius:6px;cursor:pointer;">Lista de IDs</button>
                </div>
            </div>

            <div id="rv-filter-panel">
                <div class="sf-section">
                    <label class="sf-label">Filtros de busca (quais objetos serão revertidos)</label>
                    <div class="sf-filters-box" id="rv-filters-box">
                        <div class="sf-filter-row" data-idx="0">
                            <div class="sf-filter-fields">
                                <select class="sf-select sf-filter-type" data-idx="0">${optionsHtml}</select>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="sf-add-filter" id="rv-add-filter">+ Adicionar filtro</button>
                </div>
                <div class="rv-count-label" id="rv-filter-count"></div>
            </div>

            <div id="rv-ids-panel" style="display:none;">
                <div class="sf-section">
                    <label class="sf-label">Cole os IDs dos objetos (um por linha, separados por vírgula, ou array JSON)</label>
                    <textarea class="rv-ids-textarea" id="rv-ids-input" placeholder="Cole IDs aqui..."></textarea>
                    <div class="rv-count-label" id="rv-ids-count"></div>
                </div>
            </div>

            <div class="sf-divider"></div>

            <div class="sf-section">
                <label class="sf-label">Reverter para qual versão?</label>
                <div style="display:flex;gap:12px;align-items:center;">
                    <select class="sf-select" id="rv-version-type" style="width:auto;">
                        <option value="-1">1 versão anterior (-1)</option>
                        <option value="-2">2 versões anteriores (-2)</option>
                        <option value="-3">3 versões anteriores (-3)</option>
                        <option value="specific">Versão específica (número)</option>
                    </select>
                    <input class="sf-input" id="rv-version-num" type="number" min="1" placeholder="Nº da revisão" style="width:120px;display:none;" autocomplete="off">
                </div>
            </div>
        </div>`;

    let mode = "filter";

    let swalResult = await Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: "Reverter",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#c9302c",
        cancelButtonColor: "#888",
        reverseButtons: true,
        width: "800px",
        padding: "0",
        didOpen: () => {
            attachFilterListeners("rv-filters-box", "rv-add-filter", filterOptsMap, { classId, token: _tkRev.token, baseUrl: window.location.origin, countElId: "rv-filter-count" });

            let btnFilter = document.getElementById("rv-mode-filter");
            let btnIds = document.getElementById("rv-mode-ids");
            let panelFilter = document.getElementById("rv-filter-panel");
            let panelIds = document.getElementById("rv-ids-panel");
            let vType = document.getElementById("rv-version-type");
            let vNum = document.getElementById("rv-version-num");

            btnFilter.addEventListener("click", () => {
                mode = "filter";
                panelFilter.style.display = "";
                panelIds.style.display = "none";
                btnFilter.style.background = "#1C3C2E";
                btnFilter.style.color = "#fff";
                btnFilter.style.border = "none";
                btnIds.style.background = "#f0f0f0";
                btnIds.style.color = "#555";
                btnIds.style.border = "1px solid #ddd";
            });
            btnIds.addEventListener("click", () => {
                mode = "ids";
                panelFilter.style.display = "none";
                panelIds.style.display = "";
                btnIds.style.background = "#1C3C2E";
                btnIds.style.color = "#fff";
                btnIds.style.border = "none";
                btnFilter.style.background = "#f0f0f0";
                btnFilter.style.color = "#555";
                btnFilter.style.border = "1px solid #ddd";
            });
            vType.addEventListener("change", () => {
                vNum.style.display = vType.value === "specific" ? "" : "none";
            });

            let idsInput = document.getElementById("rv-ids-input");
            idsInput.addEventListener("input", () => {
                let parsed = _rvParseIds(idsInput.value);
                document.getElementById("rv-ids-count").textContent = parsed.length + " ID(s) detectado(s)";
            });
        },
        preConfirm: async () => {
            let vType = document.getElementById("rv-version-type").value;
            let vNum = document.getElementById("rv-version-num").value;
            let targetVersion;
            if (vType === "specific") {
                targetVersion = parseInt(vNum);
                if (!targetVersion || targetVersion < 1) {
                    Swal.showValidationMessage("Informe um número de revisão válido");
                    return false;
                }
            } else {
                targetVersion = parseInt(vType);
            }

            let objectIds = [];
            if (mode === "ids") {
                let idsInput = document.getElementById("rv-ids-input").value;
                objectIds = _rvParseIds(idsInput);
                if (objectIds.length === 0) {
                    Swal.showValidationMessage("Nenhum ID válido encontrado");
                    return false;
                }
            } else {
                let { filters, hasError } = collectFilters("rv-filters-box");
                if (hasError) {
                    Swal.showValidationMessage("Preencha o valor de todos os filtros");
                    return false;
                }
                let hasFilters = filters && filters.some((f) => f.type !== "_none_");
                if (!hasFilters) {
                    Swal.showValidationMessage("Adicione pelo menos um filtro para selecionar objetos");
                    return false;
                }
                let query = buildFilteredQueryFromAdvanced(filters);

                let container = document.getElementById("rv-wizard");
                let loader = document.createElement("div");
                loader.className = "rv-loading-overlay";
                loader.innerHTML = '<div class="sf-spinner"></div><span>Coletando IDs dos objetos...</span>';
                container.appendChild(loader);

                try {
                    objectIds = await _rvFetchAllIds(classId, query, token, baseUrl);
                    loader.remove();
                    if (objectIds.length === 0) {
                        Swal.showValidationMessage("Nenhum objeto encontrado com os filtros aplicados");
                        return false;
                    }
                } catch (e) {
                    loader.remove();
                    Swal.showValidationMessage("Erro ao buscar objetos: " + (e.message || e));
                    return false;
                }
            }

            return { objectIds, targetVersion };
        }
    });

    if (!swalResult.isConfirmed || !swalResult.value) return;

    let { objectIds, targetVersion } = swalResult.value;

    let confirmResult = await Swal.fire({
        title: "Confirmar Reversão em Massa",
        html:
            getSytoolsModalCss() +
            '<div style="text-align:left;color:#333;font-size:14px;line-height:1.6;">' +
            "<p><b>" +
            objectIds.length +
            "</b> objeto(s) será(ão) revertido(s) para " +
            (targetVersion < 0 ? "<b>" + Math.abs(targetVersion) + " versão(ões) anterior(es) (" + targetVersion + ")</b>" : "a revisão <b>#" + targetVersion + "</b>") +
            ".</p>" +
            '<p style="color:#c9302c;margin-top:10px;">Esta ação não pode ser desfeita facilmente. Deseja continuar?</p>' +
            "</div>",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, reverter " + objectIds.length + " objeto(s)",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#c9302c",
        reverseButtons: true
    });

    if (!confirmResult.isConfirmed) return;

    let runnableId = execCfg.objetoId;
    let rvBaseUrl = window.location.origin;
    let rvApiBase = rvBaseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + NATIVE_RUNNABLE_CLASS_ID;
    let rvHeaders = { "Content-Type": "application/json", Authorization: "Bearer " + _tkRev.token };

    let batchSize = 10;
    let successCount = 0;
    let errorCount = 0;
    let errors = [];

    let rvPanel = showProgressPanel();
    rvPanel.update("Processando 0 de " + objectIds.length + "...");

    for (let i = 0; i < objectIds.length; i += batchSize) {
        let batch = objectIds.slice(i, i + batchSize);
        rvPanel.update(
            "Processando " +
                (i + 1) +
                " a " +
                Math.min(i + batchSize, objectIds.length) +
                " de " +
                objectIds.length +
                "... " +
                successCount +
                " revertidos" +
                (errorCount > 0 ? " • " + errorCount + " erros" : "")
        );

        let revertScript =
            "" +
            'var cid = "' +
            classId +
            '";\n' +
            "var ids = " +
            JSON.stringify(batch) +
            ";\n" +
            "var targetVersion = " +
            targetVersion +
            ";\n" +
            "var results = [];\n" +
            "for (var ii = 0; ii < ids.length; ii++) {\n" +
            "    try {\n" +
            "        var oid = ids[ii];\n" +
            '        var hist = _utils.getMethod("_classId", cid, "_getHistory")({ _id: oid });\n' +
            "        var rev = null;\n" +
            "        if (targetVersion < 0) {\n" +
            "            var steps = Math.abs(targetVersion);\n" +
            "            var count = 0;\n" +
            "            while (hist && hist.hasNext() && count < steps) {\n" +
            "                rev = hist.next();\n" +
            "                count++;\n" +
            "            }\n" +
            "            if (count < steps) rev = null;\n" +
            "        } else {\n" +
            "            var count = 0;\n" +
            "            while (hist && hist.hasNext() && count < targetVersion) {\n" +
            "                rev = hist.next();\n" +
            "                count++;\n" +
            "            }\n" +
            "            if (count !== targetVersion) rev = null;\n" +
            "        }\n" +
            '        if (!rev) { results.push({ id: oid, error: "Revisão não encontrada" }); continue; }\n' +
            '        var atual = _utils.getMethod("_classId", cid, "_get")({ _id: oid });\n' +
            "        var updatePayload = { _id: oid, _revision: atual._revision };\n" +
            "        var ignorar = { _revision: 1, _classRevision: 1, _creationUser: 1, _lastUpdateUser: 1, _creationDate: 1, _lastUpdateDate: 1, _publishedObject: 1, _protected: 1, _unprotectedFields: 1, _id: 1, _classId: 1, _class: 1 };\n" +
            "        var keys = Object.keys(rev);\n" +
            "        for (var ki = 0; ki < keys.length; ki++) {\n" +
            "            var k = keys[ki];\n" +
            "            if (ignorar[k]) continue;\n" +
            "            updatePayload[k] = rev[k];\n" +
            "        }\n" +
            '        var res = _utils.getMethod("_classId", cid, "_update")(updatePayload);\n' +
            "        results.push({ id: oid, success: true, newRev: res._revision });\n" +
            "    } catch(e) {\n" +
            "        results.push({ id: oid, error: e.message || String(e) });\n" +
            "    }\n" +
            "}\n" +
            "_output = results;\n";

        try {
            let batchResult = await _rvRunScript(revertScript, runnableId, rvApiBase, rvHeaders);
            if (Array.isArray(batchResult)) {
                for (let r of batchResult) {
                    if (r.success) successCount++;
                    else {
                        errorCount++;
                        errors.push(r.id + ": " + (r.error || "Erro desconhecido"));
                    }
                }
            } else {
                errorCount += batch.length;
                errors.push("Batch " + (i / batchSize + 1) + ": resposta inválida");
            }
        } catch (e) {
            errorCount += batch.length;
            errors.push("Batch " + (i / batchSize + 1) + ": " + (e.message || e));
        }
    }

    rvPanel.remove();

    let summaryHtml = getSytoolsModalCss() + '<div style="text-align:left;color:#333;font-size:14px;line-height:1.6;">' + '<p style="color:#1C3C2E;font-weight:700;">' + successCount + " objeto(s) revertido(s) com sucesso</p>";
    if (errorCount > 0) {
        summaryHtml +=
            '<p style="color:#c9302c;margin-top:8px;">' +
            errorCount +
            " erro(s)</p>" +
            '<div style="max-height:150px;overflow:auto;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:8px;margin-top:8px;font-size:11px;font-family:monospace;color:#333;">' +
            errors
                .slice(0, 20)
                .map((e) => "<div>" + e + "</div>")
                .join("") +
            (errors.length > 20 ? "<div>... e mais " + (errors.length - 20) + "</div>" : "") +
            "</div>";
    }
    summaryHtml += "</div>";

    Swal.fire({
        title: "Reversão Concluída",
        html: summaryHtml,
        icon: successCount > 0 ? "success" : "error",
        confirmButtonColor: "#1C3C2E"
    });
}

function _rvParseIds(text) {
    if (!text || !text.trim()) return [];
    let cleaned = text.trim();
    if (cleaned.startsWith("[")) {
        try {
            let arr = JSON.parse(cleaned);
            if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter((x) => x.length >= 20);
        } catch (e) {}
    }
    let ids = cleaned
        .split(/[\n,;\s]+/)
        .map((x) => x.replace(/['"[\]{}]/g, "").trim())
        .filter((x) => /^[a-f0-9]{24}$/.test(x));
    return [...new Set(ids)];
}

async function _rvFetchAllIds(classId, query, token, baseUrl) {
    let allIds = [];
    let searchAfter = null;
    let hasMore = true;
    let batchSize = 1000;

    while (hasMore) {
        let body = { size: batchSize, query: query, sort: [{ _id: "asc" }], _source: ["_id"] };
        if (searchAfter) body.search_after = searchAfter;

        let response = await doSearch(baseUrl, classId, token, body);
        if (!response.ok) {
            if (allIds.length > 0) break;
            throw new Error("Erro na busca (HTTP " + response.status + ")");
        }

        let result = await response.json();
        if (!result || !result.hits || !result.hits.hits || result.hits.hits.length === 0) break;

        let hits = result.hits.hits;
        for (let h of hits) allIds.push(h._id);

        if (hits.length < batchSize) hasMore = false;
        else {
            searchAfter = hits[hits.length - 1].sort;
            if (!searchAfter) hasMore = false;
        }
    }
    return allIds;
}

async function _rvRunScript(script, runnableId, apiBase, headers) {
    let getResp = await fetch(apiBase + "/_get/" + runnableId, { method: "GET", headers });
    if (!getResp.ok) throw new Error("Falha ao buscar executor: HTTP " + getResp.status);
    let obj = await getResp.json();
    if (!obj.form) obj.form = { _class: { _id: "63ecefb88b2dca658b072085", _classId: "000000000000000000000000" } };
    if (!obj.form._class) obj.form._class = { _id: "63ecefb88b2dca658b072085", _classId: "000000000000000000000000" };
    obj.form.script = script;
    let updResp = await fetch(apiBase + "/_update", { method: "POST", headers, body: JSON.stringify(obj) });
    if (!updResp.ok) throw new Error("Falha ao gravar script: HTTP " + updResp.status);
    let updObj = await updResp.json();
    let revBefore = updObj._revision;

    let runResp = await fetch(apiBase + "/run", { method: "POST", headers, body: JSON.stringify({ _id: runnableId }) });
    if (!runResp.ok) throw new Error("Erro ao executar: HTTP " + runResp.status);
    let execResult = await runResp.json();

    let resultado = null;
    if (execResult && execResult.response) {
        let resp = execResult.response;
        if (typeof resp === "object" && resp.result) {
            resultado = typeof resp.result === "string" ? resp.result : JSON.stringify(resp.result, null, 2);
        } else if (typeof resp === "string") {
            resultado = resp;
        } else {
            resultado = JSON.stringify(resp, null, 2);
        }
    }

    if (!resultado) {
        let maxAttempts = 15;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise((r) => setTimeout(r, 5000));
            let pollResp = await fetch(apiBase + "/_get/" + runnableId, { method: "GET", headers });
            if (!pollResp.ok) continue;
            let pollObj = await pollResp.json();
            if (pollObj._revision === revBefore) continue;
            let candidates = ["resultado", "result", "output", "response"];
            for (let c of candidates) {
                let v = pollObj[c];
                if (v && String(v).trim()) {
                    resultado = typeof v === "string" ? v : JSON.stringify(v, null, 2);
                    break;
                }
                if (pollObj.form) {
                    v = pollObj.form[c];
                    if (v && String(v).trim()) {
                        resultado = typeof v === "string" ? v : JSON.stringify(v, null, 2);
                        break;
                    }
                }
            }
            if (resultado) break;
        }
    }

    if (!resultado) return null;
    try {
        return JSON.parse(resultado);
    } catch (e) {
        return resultado;
    }
}
