function cmdListObjectsFromActive() {
    let objectInfo = getActiveObjectIdsNoCopy();
    if (!objectInfo.cid) {
        showToast("error", "Nenhum objeto ativo encontrado. Abra um objeto primeiro.");
        return;
    }
    let message = {
        source: "SYDLE_EXPLORER",
        subject: "_open",
        delay: 0,
        body: {
            view: "explorer_object_listing",
            stack: null,
            queryParameters: { cid: objectInfo.cid }
        },
        recipient: { slot: "explorer_object_listing", target: "_workspace" }
    };
    window.postMessage(JSON.stringify(message), "*");
}

function cmdCopyListing() {
    let classId = getListingClassId();

    if (!classId) {
        showToast("error", "Nenhuma listagem de objetos aberta");
        return;
    }

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
                    <h2>Copiar Listagem (JSONs)</h2>
                    <span>${totalHits.toLocaleString("pt-BR")} objetos na classe "${className}" &nbsp;&middot;&nbsp; classId: ${classId}</span>
                </div>

                <div class="sf-section">
                    <label class="sf-label">Filtros de busca</label>
                    <div class="sf-filters-box" id="cl-filters-box">
                        <div class="sf-filter-row" data-idx="0">
                            <div class="sf-filter-fields">
                                <select class="sf-select sf-filter-type" data-idx="0">${optionsHtml}</select>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="sf-add-filter" id="cl-add-filter">+ Adicionar filtro</button>
                    <div id="cl-filter-count"></div>
                </div>

                <div class="sf-divider"></div>

                <div class="sf-section">
                    <label class="sf-label">Entrada manual (opcional)</label>
                    <textarea class="sf-input" id="cl-manual-input" placeholder="Array de IDs, JSON {ids:[], field:''}, ou vazio para usar filtros" style="height:70px;font-family:monospace;font-size:12px;resize:vertical;"></textarea>
                </div>

                <div class="sf-info-box">Sem filtros e sem entrada manual = todos os objetos da classe.</div>
            </div>`;

            Swal.fire({
                html: html,
                showCancelButton: true,
                confirmButtonText: '<i class="fa fa-copy"></i>&nbsp;&nbsp;Copiar JSONs',
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#1C3C2E",
                cancelButtonColor: "#888",
                reverseButtons: true,
                width: "800px",
                padding: "0",
                didOpen: () => {
                    attachFilterListeners("cl-filters-box", "cl-add-filter", filterOptsMap, { classId, token, baseUrl, countElId: "cl-filter-count" });
                },
                preConfirm: () => {
                    let manualInput = (document.getElementById("cl-manual-input").value || "").trim();

                    if (manualInput) {
                        let parsedIds = null;
                        let parsedField = null;

                        if (manualInput.startsWith("{")) {
                            try {
                                let meta = JSON.parse(manualInput);
                                if (meta.ids && Array.isArray(meta.ids) && meta.ids.length > 0) {
                                    parsedIds = meta.ids;
                                    parsedField = meta.field || null;
                                }
                            } catch (e) {}
                        }
                        if (!parsedIds && manualInput.startsWith("[")) {
                            try {
                                let arr = JSON.parse(manualInput);
                                if (Array.isArray(arr) && arr.length > 0) parsedIds = arr;
                            } catch (e) {}
                        }

                        if (parsedIds) return { mode: "manual_ids", ids: parsedIds, field: parsedField };

                        return { mode: "manual_text", text: manualInput };
                    }

                    let { filters, hasError } = collectFilters("cl-filters-box");
                    if (hasError) {
                        Swal.showValidationMessage("Preencha o valor de todos os filtros selecionados");
                        return false;
                    }
                    return { mode: "filters", filters };
                }
            }).then((formResult) => {
                if (!formResult.isConfirmed) return;

                let data = formResult.value;

                if (data.mode === "manual_ids") {
                    promptFieldForIds(classId, data.ids, data.field);
                    return;
                }

                if (data.mode === "manual_text") {
                    let textQuery = { query_string: { query: "*" + data.text + "*", default_operator: "AND" } };
                    showToast("info", 'Buscando: "' + data.text + '"...');
                    fetchAllObjectsViaSearch(classId, textQuery)
                        .then((objects) => {
                            if (!objects || !objects.length) {
                                showToast("warning", 'Nenhum objeto encontrado para "' + data.text + '"');
                                return;
                            }
                            copyObjectsToClipboard(objects);
                        })
                        .catch((error) => {
                            showToast("error", "Erro: " + (error.message || error));
                        });
                    return;
                }

                let query = buildFilteredQueryFromAdvanced(data.filters);
                let hasFilters = data.filters && data.filters.some((f) => f.type !== "_none_");
                let label = hasFilters ? data.filters.length + " filtro(s)" : "todos";

                showToast("info", "Buscando: " + label + "...");

                fetchAllObjectsViaSearch(classId, query)
                    .then((objects) => {
                        if (!objects || !objects.length) {
                            showToast("warning", "Nenhum objeto encontrado");
                            return;
                        }
                        copyObjectsToClipboard(objects);
                    })
                    .catch((error) => {
                        showToast("error", "Erro: " + (error.message || error));
                    });
            });
        })
        .catch((error) => {
            loadingPanel.remove();
            showToast("error", "Erro: " + (error.message || error));
        });
}

function promptFieldForIds(classId, ids, suggestedField) {
    let _tk = getSydleToken();
    if (!_tk.token) {
        showToast("error", "Token não encontrado");
        return;
    }
    let token = _tk.token;
    let baseUrl = window.location.origin;

    fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: 1, query: { match_all: {} } })
    })
        .then((r) => r.json())
        .then((result) => {
            let refFields = ["_id"];

            if (result && result.hits && result.hits.hits && result.hits.hits.length > 0) {
                let sample = result.hits.hits[0]._source;
                for (let key in sample) {
                    if (key.startsWith("_")) continue;
                    let val = sample[key];
                    if (val && typeof val === "object" && !Array.isArray(val) && val._id) {
                        refFields.push(key);
                    }
                }
            }

            if (suggestedField && refFields.indexOf(suggestedField) === -1) {
                refFields.splice(1, 0, suggestedField);
            }

            let inputOptions = {};
            for (let f of refFields) {
                if (f === "_id") {
                    inputOptions["_id"] = "_id (ID do pr\u00f3prio objeto)";
                } else {
                    inputOptions[f] = f + "._id";
                }
            }

            let defaultVal = suggestedField && refFields.indexOf(suggestedField) !== -1 ? suggestedField : "_id";

            Swal.fire({
                title: ids.length + " IDs detectados",
                text: "Em qual campo buscar?",
                input: "select",
                inputOptions: inputOptions,
                inputValue: defaultVal,
                showCancelButton: true,
                confirmButtonText: "Buscar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#1C3C2E",
                width: "550px"
            }).then((fieldResult) => {
                if (!fieldResult.isConfirmed) return;

                let selectedField = fieldResult.value;
                let fieldPath = selectedField === "_id" ? "_id" : selectedField + "._id";
                let query = { terms: { [fieldPath]: ids } };
                let label = ids.length + ' IDs em "' + fieldPath + '"';

                showToast("info", "Buscando: " + label + "...");

                fetchAllObjectsViaSearch(classId, query)
                    .then((objects) => {
                        if (!objects || !objects.length) {
                            showToast("warning", "Nenhum objeto encontrado para " + fieldPath);
                            return;
                        }
                        copyObjectsToClipboard(objects);
                    })
                    .catch((error) => {
                        showToast("error", "Erro: " + (error.message || error));
                    });
            });
        })
        .catch(() => {
            let query = suggestedField ? { terms: { [suggestedField + "._id"]: ids } } : { terms: { _id: ids } };

            showToast("info", "Buscando " + ids.length + " IDs...");

            fetchAllObjectsViaSearch(classId, query)
                .then((objects) => {
                    if (!objects || !objects.length) {
                        showToast("warning", "Nenhum objeto encontrado");
                        return;
                    }
                    copyObjectsToClipboard(objects);
                })
                .catch((error) => {
                    showToast("error", "Erro: " + (error.message || error));
                });
        });
}

function cmdCopyFieldIds() {
    let classId = getListingClassId();

    if (!classId) {
        showToast("error", "Nenhuma listagem de objetos aberta");
        return;
    }

    let loadingPanel = showProgressPanel();
    loadingPanel.update("Carregando dados da classe...");

    loadClassFilterData(classId)
        .then(async ({ sample, totalHits, creationUsers, updateUsers, refFieldsData, token, baseUrl, className, fieldNames }) => {
            loadingPanel.finish(true, "Dados carregados", "Abrindo formulário...", 3500);
            let refFields = [];
            for (let key in sample) {
                if (key.startsWith("_")) continue;
                let val = sample[key];
                if (val && typeof val === "object" && !Array.isArray(val) && val._id) {
                    refFields.push({ key: key, isArray: false });
                }
                if (Array.isArray(val) && val.length > 0 && val[0] && val[0]._id) {
                    refFields.push({ key: key, isArray: true });
                }
            }

            if (refFields.length === 0) {
                showToast("warning", "Nenhum campo com _id encontrado");
                return;
            }

            let fieldOptionsHtml = "";
            for (let f of refFields) {
                let optKey = f.isArray ? f.key + "[]" : f.key;
                let displayName = fieldNames[f.key] || f.key;
                let label = displayName !== f.key ? displayName + "  (" + f.key + ")" : f.key;
                fieldOptionsHtml += '<option value="' + optKey + '">' + label + "</option>";
            }

            let filterOpts = buildFilterOptions(sample, creationUsers, updateUsers, refFieldsData, fieldNames);
            let optionsHtml = buildAdvancedFilterHtml(filterOpts);
            let filterOptsMap = {};
            for (let o of filterOpts) filterOptsMap[o.value] = o;

            let classTree = null;
            try {
                classTree = JSON.parse(localStorage.getItem("classTree"));
            } catch (e) {}
            let autocompleteOptions = [];
            if (classTree && classTree.length) {
                classTree.forEach((p) => p.packageClasses.forEach((c) => autocompleteOptions.push(c.name)));
            }

            let css = getSytoolsModalCss();

            let html =
                css +
                `
            <style>
                .ui-autocomplete {
                    max-height: 220px; overflow-y: auto; overflow-x: hidden;
                    border: 1.5px solid #ddd; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.12);
                    background: #fff; z-index: 99999 !important;
                }
                .ui-menu-item-wrapper {
                    padding: 10px 16px !important; font-size: 14px !important; color: #222 !important;
                    border-bottom: 1px solid #f0f0f0; cursor: pointer;
                }
                .ui-menu-item-wrapper.ui-state-active,
                .ui-menu-item-wrapper:hover {
                    background: #f0f7f4 !important; color: #1C3C2E !important; border-color: #f0f0f0 !important;
                }
                .sf-step-panel { display: none; }
                .sf-step-panel.sf-active { display: block; }
                .sf-loading-overlay {
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(255,255,255,0.85); z-index: 10;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    border-radius: 16px;
                }
                .sf-loading-overlay .sf-spinner {
                    width: 40px; height: 40px; border: 4px solid #e5e5e5; border-top-color: #1C3C2E;
                    border-radius: 50%; animation: sf-spin 0.7s linear infinite;
                }
                @keyframes sf-spin { to { transform: rotate(360deg); } }
                .sf-loading-overlay span { margin-top: 16px; font-size: 14px; color: #555; font-weight: 600; }
            </style>
            <div class="sf-container" id="cjr-wizard" style="position:relative;">
                <div class="sf-header">
                    <h2 id="cjr-title">Copiar JSON por Referência</h2>
                    <span id="cjr-subtitle">${totalHits.toLocaleString("pt-BR")} objetos na classe "${className}"</span>
                </div>

                <div class="sf-step-indicator">
                    <div class="sf-step active" id="cjr-step-1">1. Campo de origem</div>
                    <div class="sf-step" id="cjr-step-2">2. Classe de destino</div>
                    <div class="sf-step" id="cjr-step-3">3. Busca e resultado</div>
                </div>

                <!-- ETAPA 1: Filtrar e selecionar campo de origem -->
                <div class="sf-step-panel sf-active" id="cjr-panel-1">
                    <div class="sf-section">
                        <label class="sf-label">Filtros de busca (quais objetos participam da coleta)</label>
                        <div class="sf-filters-box" id="cf-filters-box">
                            <div class="sf-filter-row" data-idx="0">
                                <div class="sf-filter-fields">
                                    <select class="sf-select sf-filter-type" data-idx="0">${optionsHtml}</select>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="sf-add-filter" id="cf-add-filter">+ Adicionar filtro</button>
                        <div id="cf-filter-count"></div>
                    </div>
                    <div class="sf-divider"></div>
                    <div class="sf-section">
                        <label class="sf-label">Campo de referência para coletar IDs</label>
                        <select class="sf-select" id="cf-ref-field">${fieldOptionsHtml}</select>
                    </div>
                    <div class="sf-info-box">Sem filtros = coleta IDs de TODOS os objetos. Com filtros = apenas dos objetos que atendem aos critérios.</div>
                </div>

                <!-- ETAPA 2: Classe de destino -->
                <div class="sf-step-panel" id="cjr-panel-2">
                    <div class="sf-section">
                        <label class="sf-label">Nome da classe de destino</label>
                        <input class="sf-input" id="cjr-target-class" placeholder="Digite o nome da classe..." autocapitalize="off">
                    </div>
                    <div class="sf-info-box" id="cjr-ids-info"></div>
                </div>

                <!-- ETAPA 3: Campo de busca na classe destino + formato -->
                <div class="sf-step-panel" id="cjr-panel-3">
                    <div id="cjr-panel-3-content"></div>
                </div>
            </div>`;

            let currentStep = 1;
            let collectedIds = null;
            let collectedFieldName = null;
            let resolvedClass = null;
            let targetData = null;

            Swal.fire({
                html: html,
                showCancelButton: true,
                confirmButtonText: "Próximo &rarr;",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#1C3C2E",
                cancelButtonColor: "#888",
                reverseButtons: true,
                width: "800px",
                padding: "0",
                didOpen: () => {
                    attachFilterListeners("cf-filters-box", "cf-add-filter", filterOptsMap, { classId, token, baseUrl, countElId: "cf-filter-count" });
                },
                preConfirm: async () => {
                    if (currentStep === 1) {
                        let selectedField = document.getElementById("cf-ref-field").value;
                        if (!selectedField) {
                            Swal.showValidationMessage("Selecione um campo de referência");
                            return false;
                        }
                        let { filters, hasError } = collectFilters("cf-filters-box");
                        if (hasError) {
                            Swal.showValidationMessage("Preencha o valor de todos os filtros selecionados");
                            return false;
                        }

                        let isArray = selectedField.endsWith("[]");
                        let fName = selectedField.replace("[]", "");
                        let hasFilters = filters && filters.some((f) => f.type !== "_none_");
                        let query = hasFilters ? buildFilteredQueryFromAdvanced(filters) : null;

                        let container = document.getElementById("cjr-wizard");
                        let loader = document.createElement("div");
                        loader.className = "sf-loading-overlay";
                        loader.id = "cjr-loader";
                        loader.innerHTML = '<div class="sf-spinner"></div><span>Coletando IDs de "' + fName + '"...</span>';
                        container.appendChild(loader);

                        try {
                            let ids;
                            if (query) {
                                ids = await fetchFilteredFieldIds(classId, fName, isArray, query);
                            } else {
                                ids = await fetchAllFieldIds(classId, fName, isArray);
                            }

                            let ld = document.getElementById("cjr-loader");
                            if (ld) ld.remove();

                            if (!ids || !ids.length) {
                                Swal.showValidationMessage('Nenhum ID encontrado para "' + fName + '"');
                                return false;
                            }

                            collectedIds = [...new Set(ids)];
                            collectedFieldName = fName;
                        } catch (e) {
                            let ld = document.getElementById("cjr-loader");
                            if (ld) ld.remove();
                            Swal.showValidationMessage("Erro ao coletar IDs: " + (e.message || e));
                            return false;
                        }

                        document.getElementById("cjr-ids-info").textContent = collectedIds.length.toLocaleString("pt-BR") + ' IDs coletados de "' + collectedFieldName + '". Selecione a classe onde buscar.';
                        document.getElementById("cjr-panel-1").classList.remove("sf-active");
                        document.getElementById("cjr-panel-2").classList.add("sf-active");
                        document.getElementById("cjr-step-1").classList.remove("active");
                        document.getElementById("cjr-step-1").classList.add("done");
                        document.getElementById("cjr-step-2").classList.add("active");
                        document.getElementById("cjr-subtitle").textContent = collectedIds.length.toLocaleString("pt-BR") + ' IDs coletados de "' + collectedFieldName + '"';

                        $(function () {
                            $("#cjr-target-class").autocomplete({ source: autocompleteOptions });
                            $("#cjr-target-class").focus();
                        });

                        currentStep = 2;
                        return false;
                    }

                    if (currentStep === 2) {
                        let search = (document.getElementById("cjr-target-class").value || "").trim();
                        if (!search) {
                            Swal.showValidationMessage("Digite o nome da classe");
                            return false;
                        }

                        let cSearch = removeSpecials(search);
                        let foundClass = null;
                        if (classTree && classTree.length) {
                            for (let p of classTree) {
                                let c = p.packageClasses.find((c) => {
                                    let idf = removeSpecials(c.identifier);
                                    let id = removeSpecials(c._id);
                                    let name = removeSpecials(c.name);
                                    return idf === cSearch || id === cSearch || name === cSearch;
                                });
                                if (c) {
                                    foundClass = c;
                                    break;
                                }
                            }
                            if (!foundClass) {
                                for (let p of classTree) {
                                    let c = p.packageClasses.find((c) => {
                                        let idf = removeSpecials(c.identifier);
                                        let id = removeSpecials(c._id);
                                        let name = removeSpecials(c.name);
                                        return idf.indexOf(cSearch) !== -1 || id.indexOf(cSearch) !== -1 || name.indexOf(cSearch) !== -1;
                                    });
                                    if (c) {
                                        foundClass = c;
                                        break;
                                    }
                                }
                            }
                        }
                        if (!foundClass && /^[0-9a-f]{24}$/i.test(search)) {
                            foundClass = { _id: search, name: search, identifier: search };
                        }
                        if (!foundClass) {
                            Swal.showValidationMessage('Classe "' + search + '" não encontrada');
                            return false;
                        }

                        resolvedClass = foundClass;

                        let container = document.getElementById("cjr-wizard");
                        let loader = document.createElement("div");
                        loader.className = "sf-loading-overlay";
                        loader.id = "cjr-loader";
                        loader.innerHTML = '<div class="sf-spinner"></div><span>Carregando campos de "' + foundClass.name + '"...</span>';
                        container.appendChild(loader);

                        try {
                            targetData = await loadClassFilterData(foundClass._id);
                        } catch (e) {
                            let ld = document.getElementById("cjr-loader");
                            if (ld) ld.remove();
                            Swal.showValidationMessage("Erro ao carregar classe: " + (e.message || e));
                            return false;
                        }

                        let ld = document.getElementById("cjr-loader");
                        if (ld) ld.remove();

                        let { sample: tSample, totalHits: tTotal, fieldNames: tFieldNames } = targetData;

                        let allTargetFields = ["_id"];
                        for (let key in tSample) {
                            if (key.startsWith("_")) continue;
                            allTargetFields.push(key);
                        }

                        let tFieldOptionsHtml = "";
                        for (let f of allTargetFields) {
                            let displayName = tFieldNames && tFieldNames[f] ? tFieldNames[f] + "  (" + f + ")" : f;
                            if (f === "_id") displayName = "_id (ID do próprio objeto)";
                            let isRef = false;
                            if (f !== "_id") {
                                let val = tSample[f];
                                if (val && typeof val === "object" && !Array.isArray(val) && val._id) isRef = true;
                                if (Array.isArray(val) && val.length > 0 && val[0] && val[0]._id) isRef = true;
                            }
                            let suffix = isRef ? "._id" : "";
                            tFieldOptionsHtml += '<option value="' + f + '" data-isref="' + isRef + '">' + displayName + suffix + "</option>";
                        }

                        let suggestedField = collectedFieldName && allTargetFields.indexOf(collectedFieldName) !== -1 ? collectedFieldName : "_id";

                        document.getElementById("cjr-panel-3-content").innerHTML = `
                        <div class="sf-section">
                            <label class="sf-label">Campo onde buscar os IDs em "${foundClass.name}"</label>
                            <select class="sf-select" id="cjr-match-field">${tFieldOptionsHtml}</select>
                        </div>
                        <div class="sf-divider"></div>
                        <div class="sf-section">
                            <label class="sf-label">Formato de saída</label>
                            <select class="sf-select" id="cjr-output-format">
                                <option value="json">JSON completo (objetos)</option>
                                <option value="array">Array de IDs</option>
                                <option value="lines">Um ID por linha</option>
                                <option value="comma">Separado por vírgula</option>
                            </select>
                        </div>
                        <div class="sf-info-box">${collectedIds.length.toLocaleString("pt-BR")} IDs serão buscados em "${foundClass.name}" (${tTotal.toLocaleString("pt-BR")} objetos). Apenas campos desta classe são listados.</div>`;

                        if (suggestedField !== "_id") {
                            let sel = document.getElementById("cjr-match-field");
                            if (sel) sel.value = suggestedField;
                        }

                        document.getElementById("cjr-panel-2").classList.remove("sf-active");
                        document.getElementById("cjr-panel-3").classList.add("sf-active");
                        document.getElementById("cjr-step-2").classList.remove("active");
                        document.getElementById("cjr-step-2").classList.add("done");
                        document.getElementById("cjr-step-3").classList.add("active");
                        document.getElementById("cjr-title").textContent = 'Buscar em "' + foundClass.name + '"';
                        document.getElementById("cjr-subtitle").textContent = collectedIds.length.toLocaleString("pt-BR") + " IDs  ·  " + tTotal.toLocaleString("pt-BR") + " objetos na classe destino";

                        currentStep = 3;
                        Swal.getConfirmButton().innerHTML = '<i class="fa fa-copy"></i>&nbsp;&nbsp;Buscar e Copiar';
                        return false;
                    }

                    if (currentStep === 3) {
                        let matchField = document.getElementById("cjr-match-field").value;
                        let matchOpt = document.getElementById("cjr-match-field").selectedOptions[0];
                        let isRef = matchOpt && matchOpt.dataset.isref === "true";
                        let outputFormat = document.getElementById("cjr-output-format").value;

                        let fieldPath = isRef || matchField !== "_id" ? matchField + "._id" : "_id";
                        if (matchField === "_id") fieldPath = "_id";

                        let finalQuery = { terms: { [fieldPath]: collectedIds } };

                        let container = document.getElementById("cjr-wizard");
                        let loader = document.createElement("div");
                        loader.className = "sf-loading-overlay";
                        loader.id = "cjr-loader-final";
                        loader.innerHTML = '<div class="sf-spinner"></div><span>Buscando ' + collectedIds.length + " IDs...</span>";
                        container.appendChild(loader);

                        try {
                            let objects = await fetchAllObjectsViaSearch(resolvedClass._id, finalQuery);
                            let ld = document.getElementById("cjr-loader-final");
                            if (ld) ld.remove();

                            if (!objects || !objects.length) {
                                Swal.showValidationMessage("Nenhum objeto encontrado para " + fieldPath);
                                return false;
                            }

                            let output;
                            if (outputFormat === "json") {
                                output = JSON.stringify(objects, null, 2);
                            } else {
                                let resultIds = objects.map((o) => o._id);
                                if (outputFormat === "array") output = "[\n" + resultIds.map((id) => "    '" + id + "',").join("\n") + "\n]";
                                else if (outputFormat === "lines") output = resultIds.join("\n");
                                else if (outputFormat === "comma") output = resultIds.join(",");
                                else output = JSON.stringify(objects, null, 2);
                            }

                            try {
                                await window.navigator.clipboard.writeText(output);
                            } catch (e) {
                                let ta = document.createElement("textarea");
                                ta.value = output;
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand("copy");
                                document.body.removeChild(ta);
                            }

                            showToast("success", objects.length + " objetos copiados!");
                            return true;
                        } catch (error) {
                            let ld = document.getElementById("cjr-loader-final");
                            if (ld) ld.remove();
                            Swal.showValidationMessage("Erro: " + (error.message || error));
                            return false;
                        }
                    }
                }
            });
        })
        .catch((error) => {
            loadingPanel.remove();
            showToast("error", "Erro ao carregar dados: " + (error.message || error));
        });
}

async function fetchFilteredFieldIds(classId, fieldName, isArray, query) {
    let _tk = getSydleToken();
    if (!_tk.token) throw new Error("Token não encontrado");
    let token = _tk.token;
    let baseUrl = window.location.origin;
    let allIds = [];
    let searchAfter = null;
    let hasMore = true;
    let batchSize = 1000;

    let combinedQuery = {
        bool: {
            must: [query, { exists: { field: fieldName + "._id" } }]
        }
    };

    while (hasMore) {
        let body = {
            size: batchSize,
            query: combinedQuery,
            sort: [{ _id: "asc" }],
            _source: [fieldName]
        };
        if (searchAfter) body.search_after = searchAfter;

        let response = await doSearch(baseUrl, classId, token, body);
        if (!response.ok) {
            if (allIds.length > 0) break;
            throw new Error("Erro na busca (HTTP " + response.status + ")");
        }

        let result = await response.json();
        if (!result || !result.hits || !result.hits.hits || result.hits.hits.length === 0) {
            hasMore = false;
            break;
        }

        let hits = result.hits.hits;
        for (let i = 0; i < hits.length; i++) {
            let src = hits[i]._source;
            let val = src[fieldName];
            if (isArray && Array.isArray(val)) {
                for (let item of val) {
                    if (item && item._id) allIds.push(item._id);
                }
            } else if (val && val._id) {
                allIds.push(val._id);
            }
        }

        if (hits.length < batchSize) {
            hasMore = false;
        } else {
            searchAfter = hits[hits.length - 1].sort;
            if (!searchAfter) hasMore = false;
        }

        if (allIds.length % 5000 < batchSize) {
            showToast("info", allIds.length + " IDs coletados...");
        }
    }
    return allIds;
}

function promptTargetClass(ids, sourceFieldName) {
    let classTree = null;
    try {
        classTree = JSON.parse(localStorage.getItem("classTree"));
    } catch (e) {}

    let autocompleteOptions = [];
    if (classTree && classTree.length) {
        classTree.forEach((p) => p.packageClasses.forEach((c) => autocompleteOptions.push(c.name)));
    }

    Swal.fire({
        title: ids.length + ' IDs coletados de "' + sourceFieldName + '"',
        text: "Digite o nome da classe de destino:",
        input: "text",
        inputAttributes: { autocapitalize: "off" },
        showCancelButton: true,
        confirmButtonText: "Próximo",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#1C3C2E",
        width: "800px",
        didOpen: () => {
            if (autocompleteOptions.length > 0) {
                $(function () {
                    $("#swal2-input").autocomplete({ source: autocompleteOptions, minLength: 1 });
                });
            } else {
                let _tkAuto = getSydleToken();
                if (_tkAuto.token) {
                    let tkn = _tkAuto.token;
                    let bUrl = window.location.origin;
                    $(function () {
                        $("#swal2-input").autocomplete({
                            minLength: 2,
                            source: function (request, response) {
                                fetch(bUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/000000000000000000000000/_search?accessToken=" + tkn, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ size: 15, _source: ["name", "identifier"], query: { query_string: { query: "*" + request.term + "*", default_operator: "AND" } } })
                                })
                                    .then((r) => r.json())
                                    .then((result) => {
                                        let items = [];
                                        if (result && result.hits && result.hits.hits) {
                                            for (let h of result.hits.hits) {
                                                let nm = h._source && h._source.name;
                                                if (nm && typeof nm === "object") nm = nm._current || nm.pt_BR || Object.values(nm).find((v) => typeof v === "string");
                                                if (nm) items.push({ label: nm + " (" + h._id + ")", value: h._id });
                                            }
                                        }
                                        response(items);
                                    })
                                    .catch(() => response([]));
                            }
                        });
                    });
                }
            }
        }
    }).then((searchResult) => {
        if (!searchResult.isConfirmed || !searchResult.value) return;

        let search = searchResult.value;
        let cSearch = removeSpecials(search);
        let foundClass = null;

        if (classTree && classTree.length) {
            for (let p of classTree) {
                let c = p.packageClasses.find((c) => {
                    let idf = removeSpecials(c.identifier);
                    let id = removeSpecials(c._id);
                    let name = removeSpecials(c.name);
                    return idf === cSearch || id === cSearch || name === cSearch;
                });
                if (c) {
                    foundClass = c;
                    break;
                }
            }

            if (!foundClass) {
                for (let p of classTree) {
                    let c = p.packageClasses.find((c) => {
                        let idf = removeSpecials(c.identifier);
                        let id = removeSpecials(c._id);
                        let name = removeSpecials(c.name);
                        return idf.indexOf(cSearch) !== -1 || id.indexOf(cSearch) !== -1 || name.indexOf(cSearch) !== -1;
                    });
                    if (c) {
                        foundClass = c;
                        break;
                    }
                }
            }
        }

        if (!foundClass && /^[0-9a-f]{24}$/i.test(search)) {
            foundClass = { _id: search, name: search, identifier: search };
        }

        if (!foundClass) {
            showToast("error", 'Classe "' + search + '" n\u00e3o encontrada. Use o classId (24 caracteres hex) se a \u00e1rvore n\u00e3o estiver dispon\u00edvel.');
            return;
        }

        showToast("info", "Classe encontrada: " + foundClass.name + ". Carregando campos...");
        promptTargetField(foundClass._id, foundClass.name, ids, sourceFieldName);
    });
}

function promptTargetField(targetClassId, targetClassName, ids, sourceFieldName) {
    let _tk = getSydleToken();
    if (!_tk.token) {
        showToast("error", "Token não encontrado");
        return;
    }
    let token = _tk.token;
    let baseUrl = window.location.origin;

    Promise.all([
        fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${targetClassId}/_search?accessToken=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ size: 3, query: { match_all: {} } })
        }).then((r) => r.json()),
        fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000/_get/${targetClassId}?accessToken=${token}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
    ])
        .then(([searchResult, classDef]) => {
            let refFields = ["_id"];
            let fieldNames = {};

            if (classDef && classDef.fields) {
                for (let f of classDef.fields) {
                    let ident = f.identifier;
                    let label = f.label || f.name;
                    if (typeof label === "object") label = label._current || label.pt_BR || Object.values(label).find((v) => typeof v === "string") || ident;
                    if (ident && label && label !== ident) fieldNames[ident] = label;
                }
            }

            if (searchResult && searchResult.hits && searchResult.hits.hits && searchResult.hits.hits.length > 0) {
                let sample = searchResult.hits.hits[0]._source;
                for (let key in sample) {
                    if (key.startsWith("_")) continue;
                    let val = sample[key];
                    if (val && typeof val === "object" && !Array.isArray(val) && val._id) {
                        refFields.push(key);
                    }
                    if (Array.isArray(val) && val.length > 0 && val[0] && val[0]._id) {
                        refFields.push(key);
                    }
                }
            }

            if (sourceFieldName && refFields.indexOf(sourceFieldName) === -1) {
                refFields.splice(1, 0, sourceFieldName);
            }

            let inputOptions = {};
            for (let f of refFields) {
                if (f === "_id") {
                    inputOptions["_id"] = "_id (ID do pr\u00f3prio objeto)";
                } else {
                    let displayName = fieldNames[f] || f;
                    if (displayName !== f) {
                        inputOptions[f] = displayName + "  (" + f + "._id)";
                    } else {
                        inputOptions[f] = f + "._id";
                    }
                }
            }

            let defaultVal = sourceFieldName && refFields.indexOf(sourceFieldName) !== -1 ? sourceFieldName : "_id";

            Swal.fire({
                title: 'Campo de destino em "' + targetClassName + '"',
                text: ids.length + " IDs â€” em qual campo buscar?",
                input: "select",
                inputOptions: inputOptions,
                inputValue: defaultVal,
                showCancelButton: true,
                confirmButtonText: "Buscar e Copiar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#1C3C2E",
                width: "600px",
                customClass: { input: "sytools-wide-select" }
            }).then((fieldResult) => {
                if (!fieldResult.isConfirmed) return;

                let selectedField = fieldResult.value;
                let fieldPath = selectedField === "_id" ? "_id" : selectedField + "._id";
                let query = { terms: { [fieldPath]: ids } };
                let label = ids.length + ' IDs em "' + fieldPath + '" de "' + targetClassName + '"';

                showToast("info", "Buscando: " + label + "...");

                fetchAllObjectsViaSearch(targetClassId, query)
                    .then((objects) => {
                        if (!objects || !objects.length) {
                            showToast("warning", "Nenhum objeto encontrado para " + fieldPath);
                            return;
                        }
                        copyObjectsToClipboard(objects);
                    })
                    .catch((error) => {
                        showToast("error", "Erro: " + (error.message || error));
                    });
            });
        })
        .catch((error) => {
            showToast("error", "Erro ao carregar campos da classe: " + (error.message || error));
        });
}

async function fetchAllFieldIds(classId, fieldName, isArray) {
    let _tk = getSydleToken();
    if (!_tk.token) throw new Error("Token de acesso não encontrado.");
    let token = _tk.token;
    let baseUrl = window.location.origin;

    let allIds = [];
    let searchAfter = null;
    let hasMore = true;
    let batchSize = 1000;
    let sourceField = fieldName + "._id";

    while (hasMore) {
        let body = {
            size: batchSize,
            query: { exists: { field: fieldName + "._id" } },
            sort: [{ _id: "asc" }],
            _source: [fieldName]
        };
        if (searchAfter) body.search_after = searchAfter;

        let response = await doSearch(baseUrl, classId, token, body);
        if (!response.ok) {
            if (allIds.length > 0) break;
            throw new Error("Erro na busca (HTTP " + response.status + ")");
        }

        let result = await response.json();
        if (!result || !result.hits || !result.hits.hits || result.hits.hits.length === 0) {
            hasMore = false;
            break;
        }

        let hits = result.hits.hits;
        for (let i = 0; i < hits.length; i++) {
            let src = hits[i]._source;
            let val = src[fieldName];
            if (isArray && Array.isArray(val)) {
                for (let item of val) {
                    if (item && item._id) allIds.push(item._id);
                }
            } else if (val && val._id) {
                allIds.push(val._id);
            }
        }

        if (hits.length < batchSize) {
            hasMore = false;
        } else {
            searchAfter = hits[hits.length - 1].sort;
            if (!searchAfter) hasMore = false;
        }

        if (allIds.length % 5000 < batchSize) {
            showToast("info", allIds.length + " IDs coletados...");
        }
    }

    return allIds;
}

function cmdCopyFilteredIds() {
    let classId = getListingClassId();
    if (!classId) {
        showToast("error", "Nenhuma listagem aberta");
        return;
    }

    let loadingPanel = showProgressPanel();
    loadingPanel.update("Carregando dados da classe...");

    loadClassFilterData(classId)
        .then(({ sample, totalHits, creationUsers, updateUsers, refFieldsData, token, baseUrl, className, fieldNames }) => {
            loadingPanel.finish(true, "Dados carregados", "Abrindo formul\u00e1rio...", 3500);
            let filterOpts = buildFilterOptions(sample, creationUsers, updateUsers, refFieldsData, fieldNames);
            let optionsHtml = buildAdvancedFilterHtml(filterOpts);
            let filterOptsMap = {};
            for (let o of filterOpts) filterOptsMap[o.value] = o;

            let copyOpts = [{ value: "_id", label: "_id (pr\u00f3prio objeto)" }];
            for (let key in sample) {
                if (key.startsWith("_")) continue;
                let val = sample[key];
                if (val && typeof val === "object" && !Array.isArray(val) && val._id) copyOpts.push({ value: key + "._id", label: key + "._id" });
            }

            let outputFormatOpts = [
                { value: "array", label: "Array JS &mdash; ['id1', 'id2']" },
                { value: "lines", label: "Um ID por linha" },
                { value: "comma", label: "Separado por v\u00edrgula" },
                { value: "quoted", label: "Quoted &mdash; 'id1','id2'" },
                { value: "summary", label: "Resumo &mdash; Nome, ID, Qtd" }
            ];

            let copyHtml = copyOpts.map((o) => '<option value="' + o.value + '">' + o.label + "</option>").join("");

            let css = getSytoolsModalCss();

            let html =
                css +
                `
            <div class="sf-container">
                <div class="sf-header">
                    <h2>Copiar IDs Filtrado</h2>
                    <span>${totalHits.toLocaleString("pt-BR")} objetos na classe "${className}" &nbsp;&middot;&nbsp; classId: ${classId}</span>
                </div>

                <div class="sf-section">
                    <label class="sf-label">Filtros de busca</label>
                    <div class="sf-filters-box" id="sf-filters-box">
                        <div class="sf-filter-row" data-idx="0">
                            <div class="sf-filter-fields">
                                <select class="sf-select sf-filter-type" data-idx="0">${optionsHtml}</select>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="sf-add-filter" id="sf-add-filter">+ Adicionar filtro</button>
                    <div id="sf-filter-count"></div>
                </div>

                <div class="sf-divider"></div>

                <div class="sf-bottom-row">
                    <div class="sf-section">
                        <label class="sf-label">Campo para copiar</label>
                        <select class="sf-select" id="sf-copy-field">${copyHtml}</select>
                    </div>
                    <div class="sf-section">
                        <label class="sf-label">Formato de sa\u00edda</label>
                        <select class="sf-select" id="sf-output-format">
                            ${outputFormatOpts.map((o) => '<option value="' + o.value + '">' + o.label + "</option>").join("")}
                        </select>
                    </div>
                </div>
            </div>`;

            Swal.fire({
                html: html,
                showCancelButton: true,
                confirmButtonText: '<i class="fa fa-copy"></i>&nbsp;&nbsp;Copiar IDs',
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#1C3C2E",
                cancelButtonColor: "#888",
                reverseButtons: true,
                width: "800px",
                padding: "0",
                didOpen: () => {
                    attachFilterListeners("sf-filters-box", "sf-add-filter", filterOptsMap, { classId, token, baseUrl, countElId: "sf-filter-count" });
                },
                preConfirm: () => {
                    let outputFormat = document.getElementById("sf-output-format").value;
                    let copyField = document.getElementById("sf-copy-field").value;
                    let { filters } = collectFilters("sf-filters-box");
                    let hasSummaryFilter = false;
                    let finalFilters = [];
                    let finalError = false;

                    for (let f of filters) {
                        let isBoolean = f.type.startsWith("_no") || f.type.startsWith("_has");
                        if (isBoolean) {
                            finalFilters.push(f);
                            continue;
                        }
                        if (!f.val && f.type !== "_text_") {
                            let isRefField = f.type.endsWith("._id") && !f.type.startsWith("_");
                            if (isRefField && (outputFormat === "summary" || copyField === f.type)) {
                                hasSummaryFilter = true;
                                finalFilters.push({ type: f.type, val: "", _summaryField: true });
                                continue;
                            }
                            finalError = true;
                        }
                        finalFilters.push(f);
                    }

                    if (finalError) {
                        Swal.showValidationMessage("Preencha o valor de todos os filtros selecionados");
                        return false;
                    }
                    if (outputFormat === "summary" && copyField === "_id") {
                        Swal.showValidationMessage('Para formato Resumo, selecione um campo de refer\u00eancia em "Campo para copiar" (ex: benefit._id)');
                        return false;
                    }
                    return {
                        filters: finalFilters,
                        copyField: copyField,
                        outputFormat: outputFormat,
                        hasSummaryFilter: hasSummaryFilter
                    };
                }
            }).then(async (formResult) => {
                if (!formResult.isConfirmed) return;

                let { filters, copyField, outputFormat } = formResult.value;

                if (outputFormat === "summary") {
                    let summaryField = copyField.replace("._id", "");
                    showToast("info", "Gerando resumo por " + summaryField + "...");

                    let activeFilters = filters.filter((f) => {
                        if (f._summaryField) return false;
                        let isBoolean = f.type.startsWith("_no") || f.type.startsWith("_has");
                        if (isBoolean) return true;
                        return f.val !== "";
                    });
                    let baseQuery = buildFilteredQuery(activeFilters);

                    try {
                        let aggResp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                size: 0,
                                query: baseQuery,
                                aggs: { summary_field: { terms: { field: summaryField + "._id", size: 500 } } }
                            })
                        });
                        let aggResult = await aggResp.json();
                        let buckets = aggResult.aggregations && aggResult.aggregations.summary_field ? aggResult.aggregations.summary_field.buckets : [];

                        if (!buckets.length) {
                            showToast("warning", "Nenhum resultado para resumo");
                            return;
                        }

                        let refClassId = null;
                        if (sample[summaryField] && sample[summaryField]._classId) {
                            refClassId = sample[summaryField]._classId;
                        }

                        let nameMap = {};
                        if (refClassId) {
                            let refIds = buckets.map((b) => b.key);
                            nameMap = await _resolveNamesForIds(refIds, refClassId, token, baseUrl);
                        }

                        let totalAgg = (aggResult.hits && aggResult.hits.total) || 0;
                        if (typeof totalAgg === "object") totalAgg = totalAgg.value || 0;

                        let lines = [];
                        lines.push("Filtro: " + summaryField + " | Campo: " + copyField + " | Total objetos: " + totalAgg.toLocaleString("pt-BR"));
                        lines.push("---");
                        buckets.sort((a, b) => b.doc_count - a.doc_count);
                        for (let b of buckets) {
                            let name = nameMap[b.key] || b.key;
                            lines.push(name + " | " + b.key + " | " + b.doc_count.toLocaleString("pt-BR") + " obj");
                        }

                        let output = lines.join("\n");
                        window.navigator.clipboard
                            .writeText(output)
                            .then(() => {
                                showToast("success", buckets.length + " itens copiados no resumo!");
                            })
                            .catch(() => {
                                let ta = document.createElement("textarea");
                                ta.value = output;
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand("copy");
                                document.body.removeChild(ta);
                                showToast("success", buckets.length + " itens copiados no resumo!");
                            });
                    } catch (error) {
                        showToast("error", "Erro no resumo: " + (error.message || error));
                    }
                    return;
                }

                let query = buildFilteredQuery(filters.filter((f) => !f._summaryField));

                console.log("[SyTools] Filtros:", JSON.stringify(filters));
                console.log("[SyTools] Query ES:", JSON.stringify(query, null, 2));
                showToast("info", "Buscando com " + filters.length + " filtro(s)...");
                let sourceField = copyField === "_id" ? [] : [copyField.replace("._id", "")];

                fetchFilteredIds(classId, query, copyField, sourceField)
                    .then((ids) => {
                        if (!ids || !ids.length) {
                            showToast("warning", "Nenhum ID encontrado");
                            return;
                        }
                        let uniqueIds = [...new Set(ids)];
                        let output = formatFilteredOutput(uniqueIds, outputFormat);

                        window.navigator.clipboard
                            .writeText(output)
                            .then(() => {
                                showToast("success", uniqueIds.length + " IDs copiados!");
                            })
                            .catch(() => {
                                let ta = document.createElement("textarea");
                                ta.value = output;
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand("copy");
                                document.body.removeChild(ta);
                                showToast("success", uniqueIds.length + " IDs copiados!");
                            });
                    })
                    .catch((error) => {
                        showToast("error", "Erro: " + (error.message || error));
                    });
            });
        })
        .catch((error) => {
            loadingPanel.remove();
            showToast("error", "Erro: " + (error.message || error));
        });
}
