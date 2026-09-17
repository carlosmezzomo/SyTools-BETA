const DATE_BR_PLACEHOLDER = "DD/MM/AAAA";

function aplicarMascaraData(valor) {
    let d = String(valor || "").replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
    return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
}

function dataBrParaIso(valorBr) {
    let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(valorBr || "").trim());
    if (!m) return "";
    let dia = parseInt(m[1], 10);
    let mes = parseInt(m[2], 10);
    let ano = parseInt(m[3], 10);
    if (mes < 1 || mes > 12 || dia < 1) return "";

    let dt = new Date(Date.UTC(ano, mes - 1, dia));
    if (dt.getUTCFullYear() !== ano || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== dia) return "";
    return m[3] + "-" + m[2] + "-" + m[1];
}

function normalizarTrechoData(trecho) {
    let bruto = String(trecho || "").trim();
    let iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bruto);
    return iso ? iso[3] + "/" + iso[2] + "/" + iso[1] : aplicarMascaraData(bruto);
}

function posicaoAposMascara(novoValor, relevantesAntes) {
    if (relevantesAntes <= 0) return 0;
    let vistos = 0;
    for (let i = 0; i < novoValor.length; i++) {
        if (/[\d|]/.test(novoValor[i])) {
            vistos++;
            if (vistos === relevantesAntes) return i + 1;
        }
    }
    return novoValor.length;
}

function ativarMascaraData(inp) {

    let anterior = inp.value;

    inp.addEventListener("input", (e) => {
        let valor = inp.value;
        let cursor = inp.selectionStart;
        let apagando = !!(e && e.inputType && e.inputType.indexOf("delete") === 0);

        if (apagando) {
            anterior = valor;
            return;
        }

        let excedeu = valor.split("|").some((parte) => (parte.match(/\d/g) || []).length > 8);
        if (excedeu) {
            inp.value = anterior;
            let volta = Math.max(0, cursor - 1);
            inp.setSelectionRange(volta, volta);
            return;
        }

        let relevantesAntes = (valor.slice(0, cursor).match(/[\d|]/g) || []).length;
        let novo = valor.includes("|") ? valor.split("|").slice(0, 2).map(normalizarTrechoData).join("|") : normalizarTrechoData(valor);
        anterior = novo;
        if (novo === valor) return;

        inp.value = novo;
        let pos = posicaoAposMascara(novo, relevantesAntes);

        if (novo[pos] === "/") pos++;
        inp.setSelectionRange(pos, pos);
    });
}

function intervaloBrParaIso(valor) {
    let partes = String(valor || "").split("|");
    let ini = dataBrParaIso(partes[0]);
    let fim = dataBrParaIso(partes[1]);
    return { ini, fim };
}

async function loadClassFilterData(classId) {
    let _tk = getSydleToken();
    if (!_tk.token) throw new Error("Token não encontrado");
    let token = _tk.token;
    let baseUrl = window.location.origin;

    let [result, aggsResult] = await Promise.all([
        fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ size: 3, query: { match_all: {} } })
        }).then((r) => r.json()),
        fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                size: 0,
                query: { match_all: {} },
                aggs: {
                    creation_users: { terms: { field: "_creationUser._id", size: 200 } },
                    update_users: { terms: { field: "_lastUpdateUser._id", size: 200 } }
                }
            })
        }).then((r) => r.json())
    ]);

    if (!result || !result.hits || !result.hits.hits || !result.hits.hits.length) throw new Error("Classe vazia");

    let sample = result.hits.hits[0]._source;
    let totalHits = result.hits.total;
    if (typeof totalHits === "object") totalHits = totalHits.value || 0;

    let userIdsSet = new Set();
    let creationBuckets = aggsResult.aggregations && aggsResult.aggregations.creation_users ? aggsResult.aggregations.creation_users.buckets : [];
    let updateBuckets = aggsResult.aggregations && aggsResult.aggregations.update_users ? aggsResult.aggregations.update_users.buckets : [];

    for (let b of creationBuckets) userIdsSet.add(b.key);
    for (let b of updateBuckets) userIdsSet.add(b.key);

    let userMap = {};
    let userIds = [...userIdsSet];
    if (userIds.length > 0) {
        let userClassId = "000000000000000000000002";
        for (let i = 0; i < userIds.length; i += 50) {
            try {
                let batch = userIds.slice(i, i + 50);
                let uResp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${userClassId}/_search?accessToken=${token}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ size: 50, _source: ["name"], query: { terms: { _id: batch } } })
                });
                let uResult = await uResp.json();
                if (uResult && uResult.hits && uResult.hits.hits) {
                    for (let h of uResult.hits.hits) {
                        let name = h._source && h._source.name;
                        if (name && typeof name === "object") name = name._current || name.pt_BR || Object.values(name).find((v) => typeof v === "string") || h._id;
                        userMap[h._id] = name || h._id;
                    }
                }
            } catch (e) {}
        }
        for (let uid of userIds) {
            if (!userMap[uid]) userMap[uid] = uid;
        }
    }

    let creationUsers = creationBuckets.map((b) => ({ id: b.key, name: userMap[b.key] || b.key, count: b.doc_count }));
    let updateUsers = updateBuckets.map((b) => ({ id: b.key, name: userMap[b.key] || b.key, count: b.doc_count }));

    let refFieldsData = {};
    for (let key in sample) {
        if (key.startsWith("_")) continue;
        let val = sample[key];
        if (val && typeof val === "object" && !Array.isArray(val) && val._id && val._classId) {
            try {
                let refAgg = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ size: 0, query: { match_all: {} }, aggs: { ref_vals: { terms: { field: key + "._id", size: 200 } } } })
                });
                let refAggResult = await refAgg.json();
                let refBuckets = refAggResult.aggregations && refAggResult.aggregations.ref_vals ? refAggResult.aggregations.ref_vals.buckets : [];
                if (refBuckets.length > 0) {
                    let refIds = refBuckets.map((b) => b.key);
                    let refClassId = val._classId;
                    let refMap = await _resolveNamesForIds(refIds, refClassId, token, baseUrl);
                    refFieldsData[key] = refBuckets.map((b) => ({ id: b.key, name: refMap[b.key] || b.key, count: b.doc_count }));
                }
            } catch (e) {}
        }
    }

    let className = classId;
    try {
        let classTree = JSON.parse(localStorage.getItem("classTree"));
        if (classTree && classTree.length) {
            for (let p of classTree) {
                let c = p.packageClasses.find((c) => c._id === classId);
                if (c) {
                    className = c.name;
                    break;
                }
            }
        }
    } catch (e) {}

    let fieldNames = {};
    try {
        let classResp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000/_get/${classId}?accessToken=${token}`);
        if (classResp.ok) {
            let classDef = await classResp.json();
            if (classDef && classDef.name && className === classId) {
                let nm = classDef.name;
                if (typeof nm === "object") nm = nm._current || nm.pt_BR || Object.values(nm).find((v) => typeof v === "string") || classId;
                className = nm;
            }
            if (classDef && classDef.fields) {
                for (let f of classDef.fields) {
                    let ident = f.identifier;
                    let label = f.label || f.name;
                    if (typeof label === "object") label = label._current || label.pt_BR || Object.values(label).find((v) => typeof v === "string") || ident;
                    if (ident && label && label !== ident) fieldNames[ident] = label;
                }
            }
        }
    } catch (e) {}

    return { sample, totalHits, creationUsers, updateUsers, refFieldsData, token, baseUrl, className, fieldNames };
}

function buildFilterOptions(sample, creationUsers, updateUsers, refFieldsData, fieldNames) {
    fieldNames = fieldNames || {};
    let filterOpts = [
        { value: "_none_", label: "Nenhum", icon: "\u2014", inputType: "none" },
        { value: "_creationUser._id", label: "Usu\u00e1rio de cria\u00e7\u00e3o", icon: "\uD83D\uDC64", inputType: "userSelect", users: creationUsers },
        { value: "_lastUpdateUser._id", label: "\u00daltima altera\u00e7\u00e3o (user)", icon: "\u270F\uFE0F", inputType: "userSelect", users: updateUsers },
        { value: "_creationDate", label: "Data de cria\u00e7\u00e3o", icon: "\uD83D\uDCC5", inputType: "date" },
        { value: "_lastUpdateDate", label: "Data \u00faltima altera\u00e7\u00e3o", icon: "\uD83D\uDCC5", inputType: "date" },
        { value: "_noEndDate_", label: "Sem endDate", icon: "\uD83D\uDD13", inputType: "none" },
        { value: "_hasEndDate_", label: "Com endDate", icon: "\uD83D\uDD12", inputType: "none" },
        { value: "_noExternalCode_", label: "Sem externalCode", icon: "\u2205", inputType: "none" },
        { value: "_hasExternalCode_", label: "Com externalCode", icon: "\uD83C\uDFF7\uFE0F", inputType: "none" },
        { value: "_text_", label: "Busca por texto (query_string)", icon: "\uD83D\uDD0D", inputType: "text_search" }
    ];

    for (let key in sample) {
        if (key.startsWith("_")) continue;
        let val = sample[key];
        let displayLabel = fieldNames[key] ? fieldNames[key] + " / " + key : key;
        if (val && typeof val === "object" && !Array.isArray(val) && val._id) {
            if (refFieldsData[key]) {
                filterOpts.push({ value: key + "._id", label: displayLabel, icon: "\uD83D\uDD17", inputType: "userSelect", users: refFieldsData[key] });
            } else {
                filterOpts.push({ value: key + "._id", label: displayLabel, icon: "\uD83D\uDD17", inputType: "text" });
            }
        }
    }

    return filterOpts;
}

function buildAdvancedFilterHtml(filterOpts) {
    return filterOpts.map((o) => '<option value="' + o.value + '">' + o.icon + "  " + o.label + "</option>").join("");
}

function isDateFilterType(type) {
    return type === "_creationDate" || type === "_lastUpdateDate";
}

const DATE_OPS = [
    { value: "eq", label: "em" },
    { value: "lt", label: "antes de" },
    { value: "gt", label: "depois de" },
    { value: "between", label: "entre" }
];

function buildDateRangeClause(f) {
    let campo = f.type;
    let op = f.op || "eq";

    if (op === "between") {

        let { ini, fim } = intervaloBrParaIso(f.val);
        if (!ini || !fim) return null;
        return { range: { [campo]: { gte: ini + "T00:00:00Z", lte: fim + "T23:59:59Z" } } };
    }

    let iso = dataBrParaIso(f.val);
    if (!iso) return null;

    if (op === "lt") return { range: { [campo]: { lt: iso + "T00:00:00Z" } } };
    if (op === "gt") return { range: { [campo]: { gt: iso + "T23:59:59Z" } } };
    return { range: { [campo]: { gte: iso + "T00:00:00Z", lte: iso + "T23:59:59Z" } } };
}

function buildFilteredQueryFromAdvanced(filters) {
    if (!filters || filters.length === 0) return { match_all: {} };
    let must = [];
    let mustNot = [];

    for (let f of filters) {
        if (f.type === "_none_") continue;
        if (f.type === "_noEndDate_") mustNot.push({ exists: { field: "endDate" } });
        else if (f.type === "_hasEndDate_") must.push({ exists: { field: "endDate" } });
        else if (f.type === "_noExternalCode_") mustNot.push({ exists: { field: "externalCode" } });
        else if (f.type === "_hasExternalCode_") must.push({ exists: { field: "externalCode" } });
        else if (f.type === "_text_") {
            if (f.val) must.push({ query_string: { query: "*" + f.val + "*", default_operator: "AND" } });
        } else if (isDateFilterType(f.type)) {
            let clause = buildDateRangeClause(f);
            if (clause) must.push(clause);
        } else {
            must.push({ term: { [f.type]: f.val } });
        }
    }

    if (must.length === 0 && mustNot.length === 0) return { match_all: {} };
    let boolQuery = {};
    if (must.length > 0) boolQuery.must = must;
    if (mustNot.length > 0) boolQuery.must_not = mustNot;
    return { bool: boolQuery };
}

function describeFilter(f, filterOptsMap) {
    let opt = filterOptsMap ? filterOptsMap[f.type] : null;
    let fLabel = opt ? opt.label : f.type;
    if (!f.val) return fLabel;
    if (isDateFilterType(f.type)) {
        let opDef = DATE_OPS.filter((o) => o.value === (f.op || "eq"))[0];
        let opLabel = opDef ? opDef.label : "em";
        if ((f.op || "eq") === "between") {
            let partes = f.val.split("|");
            return fLabel + " " + opLabel + " " + (partes[0] || "").trim() + " e " + (partes[1] || "").trim();
        }
        return fLabel + " " + opLabel + " " + f.val;
    }
    return fLabel + " = " + f.val;
}

function attachFilterListeners(containerId, addBtnId, filterOptsMap, liveCountOpts) {
    let box = document.getElementById(containerId);
    let filterIdx = 1;

    function buildUserSelectHtml(users, idx) {
        let opts = '<option value="">Selecione...</option>';
        for (let u of users) {
            let displayName = u.name && u.name !== u.id ? u.name : null;
            let optLabel = displayName ? displayName + " / " + u.id + "  (" + u.count + " objetos)" : u.id + "  (" + u.count + " objetos)";
            opts += '<option value="' + u.id + '">' + optLabel + "</option>";
        }
        return '<select class="sf-select sf-filter-value-select" data-idx="' + idx + '">' + opts + "</select>";
    }

    function renderDateInputs(fieldsDiv, idx, op) {
        fieldsDiv.querySelectorAll(".sf-filter-value, .sf-date-sep").forEach((el) => el.remove());

        function novoCampo(classeExtra, ph) {
            let inp = document.createElement("input");
            inp.className = "sf-input sf-filter-value" + (classeExtra ? " " + classeExtra : "");
            inp.dataset.idx = idx;
            inp.inputMode = "numeric";
            inp.placeholder = ph;
            ativarMascaraData(inp);

            fieldsDiv.appendChild(inp);
            return inp;
        }

        if (op === "between") {
            novoCampo("sf-date-ini", "De: " + DATE_BR_PLACEHOLDER);
            let sep = document.createElement("span");
            sep.className = "sf-date-sep";
            sep.textContent = "e";
            sep.style.cssText = "color:#777;font-size:13px;padding:0 2px;flex:0 0 auto;";
            fieldsDiv.appendChild(sep);
            novoCampo("sf-date-fim", "Até: " + DATE_BR_PLACEHOLDER);
            return;
        }

        novoCampo("", "Data: " + DATE_BR_PLACEHOLDER);
    }

    function updateValueInput(row, filterType, idx) {
        let fieldsDiv = row.querySelector(".sf-filter-fields");
        let oldSelect = fieldsDiv.querySelector(".sf-filter-value-select");
        let oldDateOp = fieldsDiv.querySelector(".sf-filter-dateop");
        fieldsDiv.querySelectorAll(".sf-filter-value, .sf-date-sep").forEach((el) => el.remove());
        if (oldSelect) (oldSelect.closest(".sf-ssel") || oldSelect).remove();
        if (oldDateOp) oldDateOp.remove();

        let opt = filterOptsMap[filterType];

        fieldsDiv.classList.toggle("sf-fields-date", !!opt && opt.inputType === "date");
        if (!opt || opt.inputType === "none") return;

        if (opt.inputType === "userSelect") {
            fieldsDiv.insertAdjacentHTML("beforeend", buildUserSelectHtml(opt.users, idx));
            createSearchableSelect(fieldsDiv.querySelector(".sf-filter-value-select"), "Filtrar valores...");
        } else if (opt.inputType === "date") {

            let opSel = document.createElement("select");
            opSel.className = "sf-select sf-filter-dateop";
            opSel.dataset.idx = idx;
            opSel.style.maxWidth = "150px";
            opSel.innerHTML = DATE_OPS.map((o) => '<option value="' + o.value + '">' + o.label + "</option>").join("");
            fieldsDiv.appendChild(opSel);

            renderDateInputs(fieldsDiv, idx, opSel.value);
            opSel.addEventListener("change", () => {
                renderDateInputs(fieldsDiv, idx, opSel.value);
                triggerLiveCount();
            });
        } else if (opt.inputType === "text_search") {
            let inp = document.createElement("input");
            inp.className = "sf-input sf-filter-value";
            inp.dataset.idx = idx;
            inp.placeholder = "Digite o texto para buscar...";
            fieldsDiv.appendChild(inp);
        } else {
            let inp = document.createElement("input");
            inp.className = "sf-input sf-filter-value";
            inp.dataset.idx = idx;
            inp.placeholder = "Cole o ID aqui...";
            fieldsDiv.appendChild(inp);
        }
    }

    let optionsHtml = "";
    for (let key in filterOptsMap) {
        let o = filterOptsMap[key];
        optionsHtml += '<option value="' + o.value + '">' + o.icon + "  " + o.label + "</option>";
    }

    let debounceCount = null;
    function triggerLiveCount() {
        if (!liveCountOpts) return;
        clearTimeout(debounceCount);
        debounceCount = setTimeout(async () => {
            let { filters } = collectFilters(containerId);
            let hasFilters = filters && filters.some((f) => f.type !== "_none_" && (f.val || f.type.startsWith("_no") || f.type.startsWith("_has")));
            let countEl = document.getElementById(liveCountOpts.countElId);
            if (!countEl) return;
            if (!hasFilters) {
                countEl.textContent = "";
                updateSelectCounts(null);
                return;
            }
            let query = buildFilteredQueryFromAdvanced(filters);
            try {
                let resp = await doSearch(liveCountOpts.baseUrl, liveCountOpts.classId, liveCountOpts.token, { size: 0, query: query });
                if (!resp.ok) return;
                let result = await resp.json();
                let total = result.hits && result.hits.total;
                if (typeof total === "object") total = total.value || 0;
                countEl.textContent = total.toLocaleString("pt-BR") + " objeto(s) com os filtros combinados";
                countEl.style.color = "#1C3C2E";
                countEl.style.fontSize = "13px";
                countEl.style.fontWeight = "600";
                countEl.style.marginTop = "8px";
            } catch (e) {}
            updateSelectCounts(filters);
        }, 600);
    }

    async function updateSelectCounts(currentFilters) {
        if (!liveCountOpts) return;
        let rows = box.querySelectorAll(".sf-filter-row");
        for (let row of rows) {
            let typeSelect = row.querySelector(".sf-filter-type");
            let valueSelect = row.querySelector(".sf-filter-value-select");
            if (!typeSelect || !valueSelect) continue;
            if (valueSelect.value) continue;
            let filterType = typeSelect.value;
            let opt = filterOptsMap[filterType];
            if (!opt || opt.inputType !== "userSelect") continue;

            let otherFilters = [];
            if (currentFilters) {
                let rowIdx = row.dataset.idx;
                let allRows = box.querySelectorAll(".sf-filter-row");
                for (let otherRow of allRows) {
                    if (otherRow.dataset.idx === rowIdx) continue;
                    let otherType = otherRow.querySelector(".sf-filter-type");
                    if (!otherType || otherType.value === "_none_") continue;
                    let otherVal = "";
                    let otherValSelect = otherRow.querySelector(".sf-filter-value-select");
                    let otherValInput = otherRow.querySelector(".sf-filter-value");
                    let otherOpSel = otherRow.querySelector(".sf-filter-dateop");
                    let otherOp = otherOpSel ? otherOpSel.value : null;
                    if (otherOp === "between") {

                        let ini = otherRow.querySelector(".sf-date-ini");
                        let fim = otherRow.querySelector(".sf-date-fim");
                        let a = ini ? ini.value.trim() : "";
                        let b = fim ? fim.value.trim() : "";
                        otherVal = a || b ? a + "|" + b : "";
                    } else if (otherValSelect) otherVal = otherValSelect.value;
                    else if (otherValInput) otherVal = otherValInput.value.trim();
                    let isBoolean = otherType.value.startsWith("_no") || otherType.value.startsWith("_has");
                    if (!otherVal && !isBoolean) continue;
                    otherFilters.push(otherOp ? { type: otherType.value, val: otherVal, op: otherOp } : { type: otherType.value, val: otherVal });
                }
            }

            if (otherFilters.length === 0) continue;

            let baseQuery = buildFilteredQueryFromAdvanced(otherFilters);
            let aggField = filterType;
            try {
                let aggResp = await doSearch(liveCountOpts.baseUrl, liveCountOpts.classId, liveCountOpts.token, {
                    size: 0,
                    query: baseQuery,
                    aggs: { filtered_vals: { terms: { field: aggField, size: 200 } } }
                });
                if (!aggResp.ok) continue;
                let aggResult = await aggResp.json();
                let buckets = aggResult.aggregations && aggResult.aggregations.filtered_vals ? aggResult.aggregations.filtered_vals.buckets : [];
                let countMap = {};
                for (let b of buckets) countMap[b.key] = b.doc_count;

                let options = valueSelect.querySelectorAll("option");
                for (let option of options) {
                    if (!option.value) continue;
                    let user = opt.users.find((u) => u.id === option.value);
                    let newCount = countMap[option.value] !== undefined ? countMap[option.value] : 0;
                    let displayName = user && user.name && user.name !== user.id ? user.name : null;
                    option.textContent = displayName ? displayName + " / " + option.value + "  (" + newCount + " objetos)" : option.value + "  (" + newCount + " objetos)";
                }
            } catch (e) {}
        }
    }

    box.addEventListener("change", (e) => {
        if (e.target.classList.contains("sf-filter-type")) {
            let idx = e.target.dataset.idx;
            let row = e.target.closest(".sf-filter-row");
            updateValueInput(row, e.target.value, idx);
        }
        triggerLiveCount();
    });

    box.addEventListener("input", () => {
        triggerLiveCount();
    });

    document.getElementById(addBtnId).addEventListener("click", () => {
        let row = document.createElement("div");
        row.className = "sf-filter-row";
        row.dataset.idx = filterIdx;
        row.innerHTML =
            '<div class="sf-filter-fields">' +
            '<select class="sf-select sf-filter-type" data-idx="' +
            filterIdx +
            '">' +
            optionsHtml +
            "</select>" +
            "</div>" +
            '<button type="button" class="sf-remove-btn" data-idx="' +
            filterIdx +
            '">&times;</button>';
        box.appendChild(row);
        filterIdx++;
    });

    box.addEventListener("click", (e) => {
        if (!e.target.classList.contains("sf-remove-btn")) return;
        let row = e.target.closest(".sf-filter-row");
        if (row && box.querySelectorAll(".sf-filter-row").length > 1) {
            row.remove();
            triggerLiveCount();
        }
    });
}

function collectFilters(containerId) {
    let rows = document.querySelectorAll("#" + containerId + " .sf-filter-row");
    let filters = [];
    let hasError = false;

    rows.forEach((row) => {
        let type = row.querySelector(".sf-filter-type").value;
        if (type === "_none_") return;
        let isBoolean = type.startsWith("_no") || type.startsWith("_has");
        if (isBoolean) {
            filters.push({ type, val: "" });
            return;
        }
        let valInput = row.querySelector(".sf-filter-value");
        let valSelect = row.querySelector(".sf-filter-value-select");
        let dateOpSel = row.querySelector(".sf-filter-dateop");
        let op = dateOpSel ? dateOpSel.value : null;

        let val = "";
        let dateInputs = [];
        if (op === "between") {

            dateInputs = [row.querySelector(".sf-date-ini"), row.querySelector(".sf-date-fim")];
            let ini = dateInputs[0] ? dateInputs[0].value.trim() : "";
            let fim = dateInputs[1] ? dateInputs[1].value.trim() : "";
            val = ini || fim ? ini + "|" + fim : "";
        } else if (valSelect) {
            val = valSelect.value;
        } else if (valInput) {
            val = valInput.value.trim();
            dateInputs = [valInput];
        }

        function marcarErro() {
            hasError = true;
            if (op === "between") {
                dateInputs.forEach((el, i) => {
                    if (!el) return;
                    let parte = (val.split("|")[i] || "").trim();
                    el.style.borderColor = parte && dataBrParaIso(parte) ? "" : "#e74c3c";
                });
                return;
            }
            let el = valSelect || valInput;
            if (el) el.style.borderColor = "#e74c3c";
        }

        if (!val && type !== "_text_") {
            marcarErro();
        } else if (val && isDateFilterType(type) && !buildDateRangeClause({ type, val, op })) {

            marcarErro();
        } else {

            if (valSelect) valSelect.style.borderColor = "";
            dateInputs.forEach((el) => el && (el.style.borderColor = ""));
        }
        filters.push(op ? { type, val, op } : { type, val });
    });

    return { filters, hasError };
}

function buildFilteredQuery(filters) {
    if (!filters || filters.length === 0) return { match_all: {} };

    let must = [];
    let mustNot = [];

    for (let f of filters) {
        if (f.type === "_none_") continue;
        if (f.type === "_noEndDate_") mustNot.push({ exists: { field: "endDate" } });
        else if (f.type === "_hasEndDate_") must.push({ exists: { field: "endDate" } });
        else if (f.type === "_noExternalCode_") mustNot.push({ exists: { field: "externalCode" } });
        else if (f.type === "_hasExternalCode_") must.push({ exists: { field: "externalCode" } });
        else if (f.type === "_text_") {
            if (f.val) must.push({ query_string: { query: "*" + f.val + "*", default_operator: "AND" } });
        } else if (isDateFilterType(f.type)) {
            let clause = buildDateRangeClause(f);
            if (clause) must.push(clause);
        } else {
            must.push({ term: { [f.type]: f.val } });
        }
    }

    if (must.length === 0 && mustNot.length === 0) return { match_all: {} };

    let boolQuery = {};
    if (must.length > 0) boolQuery.must = must;
    if (mustNot.length > 0) boolQuery.must_not = mustNot;
    return { bool: boolQuery };
}

function formatFilteredOutput(ids, format) {
    if (format === "array") return "[\n" + ids.map((id) => "    '" + id + "',").join("\n") + "\n]";
    if (format === "lines") return ids.join("\n");
    if (format === "comma") return ids.join(",");
    if (format === "quoted") return ids.map((id) => "'" + id + "'").join(",");
    return ids.join("\n");
}

async function fetchFilteredIds(classId, query, copyField, sourceFields) {
    let _tk = getSydleToken();
    if (!_tk.token) throw new Error("Token não encontrado");
    let token = _tk.token;
    let baseUrl = window.location.origin;
    let allIds = [];
    let searchAfter = null;
    let hasMore = true;
    let batchSize = 1000;

    while (hasMore) {
        let body = { size: batchSize, query: query, sort: [{ _id: "asc" }] };
        if (sourceFields.length > 0) body._source = sourceFields;
        else body._source = false;
        if (searchAfter) body.search_after = searchAfter;

        let response = await doSearch(baseUrl, classId, token, body);
        if (!response.ok) {
            let errText = "";
            try {
                errText = await response.text();
            } catch (e) {}
            if (allIds.length > 0) break;
            throw new Error("Erro HTTP " + response.status + (errText ? ": " + errText.substring(0, 200) : ""));
        }

        let result = await response.json();
        if (!result || !result.hits || !result.hits.hits || !result.hits.hits.length) break;

        let hits = result.hits.hits;
        for (let h of hits) {
            if (copyField === "_id") {
                allIds.push(h._id);
            } else {
                let fieldName = copyField.split(".")[0];
                let val = h._source[fieldName];
                if (val && val._id) allIds.push(val._id);
                else if (Array.isArray(val)) {
                    for (let item of val) {
                        if (item && item._id) allIds.push(item._id);
                    }
                }
            }
        }

        if (hits.length < batchSize) hasMore = false;
        else {
            searchAfter = hits[hits.length - 1].sort;
            if (!searchAfter) hasMore = false;
        }

        if (allIds.length % 5000 < batchSize) showToast("info", allIds.length + " IDs coletados...");
    }
    return allIds;
}

function parseIdsFromText(text) {
    let ids = [];
    text = text.trim();
    if (text.startsWith("[")) {
        try {
            let arr = JSON.parse(text);
            if (Array.isArray(arr)) {
                for (let item of arr) {
                    let id = typeof item === "string" ? item.trim() : (item && item._id ? item._id : String(item)).trim();
                    if (id && /^[a-f0-9]{24}$/i.test(id)) ids.push(id);
                }
                return ids;
            }
        } catch (e) {}
    }
    let raw = text.replace(/[\[\]"'{}]/g, "");
    let parts = raw.split(/[\n\r,;]+/);
    for (let p of parts) {
        let id = p.trim();
        if (id && /^[a-f0-9]{24}$/i.test(id)) ids.push(id);
    }
    return ids;
}
