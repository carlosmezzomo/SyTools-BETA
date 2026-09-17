async function cmdCompareHistory() {
    await hydrateSytoolsStore();
    let objectInfo = getActiveObjectIdsNoCopy();
    let objId = objectInfo.id;
    let classId = objectInfo.cid;

    if (!objId || objId === "000000000000000000000000" || !classId) {
        Swal.fire({ title: "Erro", text: "Abra um objeto para comparar o histórico.", icon: "error", confirmButtonColor: "#1C3C2E" });
        return;
    }

    let execCfg = getExecutorConfig();
    if (!execCfg || !execCfg.objetoId) {
        Swal.fire({ title: "Executor não configurado", text: "Configure o Executor de Scripts primeiro (crie um Objeto Executor na aba Config).", icon: "warning", confirmButtonColor: "#1C3C2E" });
        return;
    }

    let baseUrl = window.location.origin;
    let _tkCmp = getSydleToken();
    if (!_tkCmp.token) {
        Swal.fire({ title: "Token não encontrado", text: "Faça login novamente na plataforma.", icon: "error", confirmButtonColor: "#1C3C2E" });
        return;
    }
    let token = _tkCmp.token;
    let headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };
    let runnableId = execCfg.objetoId;
    let apiBase = baseUrl + "/api/1/" + getSydleApiNamespace() + "/_classId/" + NATIVE_RUNNABLE_CLASS_ID;

    function _cmpFormatDate(s) {
        try {
            let d = new Date(s);
            if (isNaN(d.getTime())) return String(s);
            let day = String(d.getDate()).padStart(2, "0");
            let mon = String(d.getMonth() + 1).padStart(2, "0");
            let year = d.getFullYear();
            return day + "/" + mon + "/" + year;
        } catch (e) {
            return String(s);
        }
    }

    function _cmpIsDateString(s) {
        return typeof s === "string" && /^\d{4}-\d{2}-\d{2}T/.test(s);
    }

    function _cmpRefSpan(id, label) {
        return (
            '<span class="cmp-ref-link" data-copy-id="' +
            _cmpEscHtml(id) +
            '" style="cursor:pointer;" title="Clique para copiar ID: ' +
            _cmpEscHtml(id) +
            '">' +
            '<span style="font-weight:600;">' +
            _cmpEscHtml(label) +
            "</span>" +
            '<span style="color:#666;font-size:10px;margin-left:4px;">(' +
            _cmpEscHtml(id) +
            ")</span></span>"
        );
    }

    let _scriptFieldNames = [
        "script",
        "calculationscript",
        "memorycalculationscript",
        "memoriadeculculoscript",
        "debugscript",
        "validationscript",
        "filterscript",
        "transformscript",
        "customscript",
        "preprocessscript",
        "postprocessscript",
        "beforescript",
        "afterscript",
        "onchangescript",
        "formulascript"
    ];

    function _cmpIsScriptField(fieldName) {
        if (!fieldName) return false;
        let lower = fieldName.toLowerCase().replace(/[^a-z]/g, "");
        for (let sf of _scriptFieldNames) {
            if (lower.indexOf(sf) !== -1) return true;
        }
        return lower.endsWith("script") || lower.endsWith("scripts");
    }

    function _cmpIsScript(s, fieldName) {
        if (fieldName && _cmpIsScriptField(fieldName)) return s && s.length > 10;
        if (!s || s.length < 20) return false;
        let indicators = [
            "function ",
            "function(",
            "var ",
            "let ",
            "const ",
            "return ",
            "return;",
            "if (",
            "if(",
            "for (",
            "for(",
            "while(",
            "while (",
            "=>",
            "===",
            "!==",
            ".push(",
            ".map(",
            ".filter(",
            ".forEach(",
            ".reduce(",
            ".find(",
            "_utils.",
            "_output",
            "_input",
            "console.",
            "try {",
            "try{",
            "catch(",
            "catch (",
            "require(",
            "module.",
            "exports",
            "new ",
            "throw ",
            "switch(",
            "switch (",
            "case ",
            "break;",
            "else {",
            "else{",
            "} else",
            "};",
            "});",
            "){",
            "= {",
            "= ["
        ];
        let count = 0;
        for (let ind of indicators) {
            if (s.indexOf(ind) !== -1) count++;
        }
        if (count >= 2) return true;
        if (count >= 1 && s.length > 100) return true;
        return false;
    }

    function _cmpFormatScript(s) {
        let lines = _cmpSplitScript(s);
        let numbered = lines.map((l, idx) => '<span style="color:#555;user-select:none;">' + String(idx + 1).padStart(3, " ") + "</span>  " + _cmpEscHtml(l)).join("\n");
        return (
            "<pre style=\"background:#0d1117;color:#c9d1d9;padding:10px 12px;border-radius:4px;border:1px solid #333;font-size:13px;font-family:Consolas,'Courier New',monospace;white-space:pre-wrap;word-wrap:break-word;max-height:400px;overflow:auto;margin:2px 0;text-align:left;line-height:1.5;\">" +
            numbered +
            "</pre>"
        );
    }

    function _cmpExtractScript(val, fieldName) {
        if (typeof val === "string" && _cmpIsScript(val, fieldName)) return val;
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
            let joined = val.join("\n");
            if (_cmpIsScript(joined, fieldName)) return joined;
        }
        return null;
    }

    function _cmpFormatVal(v, nameCache, fieldName) {
        if (v === null || v === undefined) return '<span style="color:#666;font-style:italic;">vazio</span>';
        if (typeof v === "string") {
            if (_cmpIsDateString(v)) return _cmpFormatDate(v);
            if (_cmpIsScript(v, fieldName)) return _cmpFormatScript(v);
            return _cmpEscHtml(v);
        }
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        if (typeof v === "object" && !Array.isArray(v) && v._id) {
            let resolved = nameCache && nameCache[v._id] ? nameCache[v._id] : null;
            if (resolved) return _cmpRefSpan(v._id, resolved);
            return '<span class="cmp-ref-link" data-copy-id="' + _cmpEscHtml(v._id) + '" style="cursor:pointer;color:#888;" title="Clique para copiar ID">' + v._id + "</span>";
        }
        if (Array.isArray(v)) {
            if (v.length === 0) return '<span style="color:#666;font-style:italic;">[ ]</span>';
            let items = [];
            for (let i = 0; i < v.length; i++) {
                if (v[i] && typeof v[i] === "object") {
                    let userKeys = Object.keys(v[i]).filter((k) => k.charAt(0) !== "_");
                    if (v[i]._id && userKeys.length > 0) {
                        items.push(_cmpFormatEmbeddedObj(v[i], nameCache));
                    } else if (v[i]._id) {
                        let resolved = nameCache && nameCache[v[i]._id] ? nameCache[v[i]._id] : null;
                        if (resolved) items.push(_cmpRefSpan(v[i]._id, resolved));
                        else items.push('<span class="cmp-ref-link" data-copy-id="' + _cmpEscHtml(v[i]._id) + '" style="cursor:pointer;color:#888;" title="Clique para copiar ID">' + v[i]._id + "</span>");
                    } else {
                        items.push(_cmpFormatEmbeddedObj(v[i], nameCache));
                    }
                } else {
                    let sv = String(v[i]);
                    if (_cmpIsDateString(sv)) items.push(_cmpFormatDate(sv));
                    else items.push(_cmpEscHtml(sv.length > 60 ? sv.substring(0, 60) + "..." : sv));
                }
            }
            return '<div style="display:flex;flex-direction:column;gap:2px;">' + items.join("") + "</div>";
        }
        try {
            let s = JSON.stringify(v);
            return _cmpEscHtml(s.length > 200 ? s.substring(0, 200) + "..." : s);
        } catch (e) {
            return '<span style="color:#888;">{...}</span>';
        }
    }

    function _cmpFormatEmbeddedObj(obj, nameCache) {
        let fields = Object.keys(obj).filter((k) => k.charAt(0) !== "_");
        if (fields.length === 0) {
            if (obj._id) {
                let resolved = nameCache && nameCache[obj._id] ? nameCache[obj._id] : null;
                return resolved ? _cmpRefSpan(obj._id, resolved) : '<span class="cmp-ref-link" data-copy-id="' + _cmpEscHtml(obj._id) + '" style="cursor:pointer;color:#888;">' + obj._id + "</span>";
            }
            return '<span style="color:#666;">{}</span>';
        }
        let parts = [];
        for (let f of fields) {
            let val = obj[f];
            let formatted;
            if (val === null || val === undefined) {
                formatted = '<span style="color:#666;font-style:italic;">vazio</span>';
            } else if (typeof val === "object" && !Array.isArray(val) && val._id) {
                let resolved = nameCache && nameCache[val._id] ? nameCache[val._id] : null;
                formatted = resolved ? _cmpRefSpan(val._id, resolved) : val._id;
            } else if (Array.isArray(val)) {
                let arrItems = val.map((item) => {
                    if (item && typeof item === "object" && item._id) {
                        let r = nameCache && nameCache[item._id] ? nameCache[item._id] : null;
                        return r ? _cmpRefSpan(item._id, r) : item._id;
                    }
                    return _cmpEscHtml(String(item));
                });
                formatted = "[" + arrItems.join(", ") + "]";
            } else if (typeof val === "string" && _cmpIsDateString(val)) {
                formatted = _cmpFormatDate(val);
            } else if (typeof val === "string" && _cmpIsScript(val, f)) {
                formatted = _cmpFormatScript(val);
            } else if (typeof val === "boolean") {
                formatted = val ? "Verdadeiro" : "Falso";
            } else {
                formatted = _cmpEscHtml(String(val));
            }
            parts.push('<span style="color:#6eb5ff;font-size:11px;">' + _cmpEscHtml(f) + ":</span> " + formatted);
        }
        let idLabel = obj._id ? '<div style="color:#555;font-size:10px;margin-bottom:3px;" class="cmp-ref-link" data-copy-id="' + _cmpEscHtml(obj._id) + '" title="Clique para copiar ID" >' + obj._id + "</div>" : "";
        let rows = parts.map((p) => '<div style="padding:1px 0;border-bottom:1px solid #333;">' + p + "</div>").join("");
        return '<div style="border:1px solid #444;border-radius:4px;padding:6px 10px;margin:3px 0;background:#252525;font-size:11px;">' + idLabel + rows + "</div>";
    }

    function _cmpSimpleHash(v, depth) {
        if (depth === undefined) depth = 0;
        if (v === null || v === undefined) return "null";
        if (typeof v !== "object") return typeof v + ":" + String(v);
        if (depth > 4) return typeof v + ":MAX";
        if (Array.isArray(v)) {
            let parts = [];
            for (let i = 0; i < v.length; i++) parts.push(_cmpSimpleHash(v[i], depth + 1));
            return "[" + parts.join(",") + "]";
        }
        let keys = Object.keys(v)
            .filter((k) => k.charAt(0) !== "_")
            .sort();
        let parts = [];
        for (let i = 0; i < keys.length; i++) parts.push(keys[i] + "=" + _cmpSimpleHash(v[keys[i]], depth + 1));
        return "{" + parts.join(",") + "}";
    }

    async function _cmpRunScript(script) {
        let getResp = await fetch(apiBase + "/_get/" + runnableId, { method: "GET", headers });
        if (!getResp.ok) {
            if (getResp.status === 403 || getResp.status === 404) {
                throw new Error("Objeto Executor não encontrado ou sem permissão (HTTP " + getResp.status + "). Vá em Executor → Configurações e crie um novo Objeto Executor.");
            }
            throw new Error("Falha ao buscar objeto executor: HTTP " + getResp.status);
        }
        let obj = await getResp.json();
        if (!obj.form) obj.form = { _class: { _id: "63ecefb88b2dca658b072085", _classId: "000000000000000000000000" } };
        if (!obj.form._class) obj.form._class = { _id: "63ecefb88b2dca658b072085", _classId: "000000000000000000000000" };
        obj.form.script = script;
        let updResp = await fetch(apiBase + "/_update", { method: "POST", headers, body: JSON.stringify(obj) });
        if (!updResp.ok) {
            if (updResp.status === 403) {
                throw new Error("Sem permissão para atualizar o Executor (HTTP 403). Verifique se o objeto ainda existe ou crie um novo em Configurações.");
            }
            throw new Error("Falha ao gravar script: HTTP " + updResp.status);
        }
        let updObj = await updResp.json();
        let revBefore = updObj._revision;

        let runResp = await fetch(apiBase + "/run", { method: "POST", headers, body: JSON.stringify({ _id: runnableId }) });
        if (!runResp.ok) {
            if (runResp.status === 403) {
                throw new Error("Sem permissão para executar o Executor (HTTP 403). Verifique se o objeto ainda existe ou crie um novo em Configurações.");
            }
            throw new Error("Erro ao executar: HTTP " + runResp.status);
        }
        let execResult = await runResp.json();

        let resultado = null;
        if (execResult && execResult.response) {
            let resp = execResult.response;
            if (typeof resp === "object" && resp.result) {
                resultado = typeof resp.result === "string" ? resp.result : JSON.stringify(resp.result, null, 2);
            } else if (typeof resp === "object" && resp.resultado) {
                resultado = typeof resp.resultado === "string" ? resp.resultado : JSON.stringify(resp.resultado, null, 2);
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

        console.log("[sytools][_cmpRunScript] resultado bruto recebido, tamanho:", resultado ? resultado.length : 0);
        if (!resultado) {
            console.warn("[sytools][_cmpRunScript] nenhum resultado retornado pelo executor (nem imediato, nem por polling)");
            return null;
        }
        try {
            let parsed = JSON.parse(resultado);
            console.log("[sytools][_cmpRunScript] JSON.parse OK, chaves:", Object.keys(parsed));
            return parsed;
        } catch (e) {
            console.warn("[sytools][_cmpRunScript] JSON.parse falhou:", e.message, "— últimos 300 chars do resultado bruto:", resultado.slice(-300));
            return resultado;
        }
    }

    async function _cmpResolveNames(atual, anterior) {
        let refs = [];
        let seen = {};
        let collectRefs = (obj, depth) => {
            if (!obj || typeof obj !== "object" || (depth || 0) > 3) return;
            let d = (depth || 0) + 1;
            for (let k in obj) {
                let v = obj[k];
                if (v && typeof v === "object" && !Array.isArray(v)) {
                    if (v._id && v._classId && !seen[v._id]) {
                        seen[v._id] = true;
                        refs.push({ _id: v._id, _classId: v._classId });
                    } else if (!v._id) {
                        collectRefs(v, d);
                    }
                }
                if (Array.isArray(v)) {
                    for (let item of v) {
                        if (item && typeof item === "object") {
                            if (item._id && item._classId && !seen[item._id]) {
                                seen[item._id] = true;
                                refs.push({ _id: item._id, _classId: item._classId });
                            }
                            if (!item._id || Object.keys(item).filter((x) => x.charAt(0) !== "_").length > 0) {
                                collectRefs(item, d);
                            }
                        }
                    }
                }
            }
        };
        collectRefs(atual);
        collectRefs(anterior);

        let nameCache = {};
        if (refs.length === 0) return nameCache;

        let batches = [];
        for (let i = 0; i < refs.length; i += 50) batches.push(refs.slice(i, i + 50));

        for (let batch of batches) {
            try {
                let resp = await fetch(baseUrl + "/api/1/" + getSydleApiNamespace() + "/_system/_workspace/getCards", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        classId: "000000000000000000000000",
                        objectsReferences: batch,
                        small: true,
                        storage: "published",
                        tags: false,
                        timezoneId: "America/Sao_Paulo"
                    })
                });
                if (!resp.ok) continue;
                let data = await resp.json();
                if (data.cards) {
                    for (let card of data.cards) {
                        if (card._id && card.ids && card.ids.length > 0) {
                            nameCache[card._id] = card.ids[0];
                        }
                    }
                }
            } catch (e) {}
        }
        return nameCache;
    }

    function _cmpBuildRow(key, vAnterior, vAtual, nameCache, indent) {
        let pfx = indent ? '<span style="color:#444;margin-right:4px;">' + indent + "</span>" : "";
        let changed = _cmpSimpleHash(vAtual) !== _cmpSimpleHash(vAnterior);
        let rowBg = changed ? "#1a1a1a" : "transparent";
        let leftBorder = changed ? "3px solid #e74c3c" : "3px solid transparent";
        let badge = changed ? '<span style="color:#e74c3c;font-weight:700;margin-left:6px;">●</span>' : "";
        let anteriorBg = changed ? "background:rgba(248,81,73,0.12);" : "";
        let atualBg = changed ? "background:rgba(63,185,80,0.12);" : "";
        let bareField = key.indexOf(".") !== -1 ? key.substring(key.lastIndexOf(".") + 1) : key;
        return {
            changed,
            html:
                '<tr data-changed="' +
                (changed ? "1" : "0") +
                '" style="background:' +
                rowBg +
                ";border-left:" +
                leftBorder +
                ';">' +
                '<td style="padding:8px 12px;font-family:monospace;font-size:13px;color:#6eb5ff;white-space:nowrap;vertical-align:top;cursor:pointer;" class="cmp-field-name" data-field="' +
                _cmpEscHtml(key) +
                '" title="Clique para copiar nome do campo">' +
                pfx +
                _cmpEscHtml(key) +
                badge +
                "</td>" +
                '<td style="padding:8px 12px;font-size:13px;color:#d4d4d4;border-right:1px solid #333;word-break:break-all;vertical-align:top;' +
                anteriorBg +
                '">' +
                _cmpFormatVal(vAnterior, nameCache, bareField) +
                "</td>" +
                '<td style="padding:8px 12px;font-size:13px;color:#d4d4d4;word-break:break-all;vertical-align:top;' +
                atualBg +
                '">' +
                _cmpFormatVal(vAtual, nameCache, bareField) +
                "</td>" +
                "</tr>"
        };
    }

    function _cmpBuildDiffHtml(atual, anterior, revNumAtual, revNumAnterior, nome, objIdDisplay, nameCache) {
        let ignorar = ["_revision", "_classRevision", "_creationUser", "_lastUpdateUser", "_creationDate", "_lastUpdateDate", "_publishedObject", "_protected", "_unprotectedFields", "_id", "_classId", "_class"];
        let allKeys = {};
        for (let k in atual) allKeys[k] = true;
        for (let k in anterior) allKeys[k] = true;
        let sortedKeys = Object.keys(allKeys).sort();

        let rows = "";
        let changedCount = 0;
        let totalFields = 0;
        for (let i = 0; i < sortedKeys.length; i++) {
            let key = sortedKeys[i];
            if (ignorar.indexOf(key) !== -1) continue;
            totalFields++;
            let vAtual = atual[key];
            let vAnterior = anterior[key];

            let isEmbeddedArray =
                (Array.isArray(vAtual) || Array.isArray(vAnterior)) &&
                ((vAtual && vAtual.length > 0 && vAtual[0] && typeof vAtual[0] === "object" && Object.keys(vAtual[0]).filter((x) => x.charAt(0) !== "_").length > 0) ||
                    (vAnterior && vAnterior.length > 0 && vAnterior[0] && typeof vAnterior[0] === "object" && Object.keys(vAnterior[0]).filter((x) => x.charAt(0) !== "_").length > 0));

            if (isEmbeddedArray) {
                let arrA = Array.isArray(vAnterior) ? vAnterior : [];
                let arrC = Array.isArray(vAtual) ? vAtual : [];
                let maxLen = Math.max(arrA.length, arrC.length);
                let parentChanged = _cmpSimpleHash(vAtual) !== _cmpSimpleHash(vAnterior);
                if (parentChanged) changedCount++;
                let parentBadge = parentChanged ? '<span style="color:#e74c3c;font-weight:700;margin-left:6px;">●</span>' : "";
                rows +=
                    '<tr data-changed="' +
                    (parentChanged ? "1" : "0") +
                    '" style="background:#0d1117;border-left:3px solid #6eb5ff;">' +
                    '<td colspan="3" style="padding:10px 12px;font-family:monospace;font-size:13px;color:#6eb5ff;font-weight:700;cursor:pointer;" class="cmp-field-name" data-field="' +
                    _cmpEscHtml(key) +
                    '">' +
                    _cmpEscHtml(key) +
                    " [" +
                    maxLen +
                    " itens]" +
                    parentBadge +
                    "</td></tr>";
                for (let j = 0; j < maxLen; j++) {
                    let itemA = j < arrA.length ? arrA[j] : null;
                    let itemC = j < arrC.length ? arrC[j] : null;
                    if (itemA && typeof itemA === "object" && itemC && typeof itemC === "object") {
                        let subKeys = {};
                        for (let sk in itemA) {
                            if (sk.charAt(0) !== "_") subKeys[sk] = true;
                        }
                        for (let sk in itemC) {
                            if (sk.charAt(0) !== "_") subKeys[sk] = true;
                        }
                        let sortedSub = Object.keys(subKeys).sort();
                        for (let sk of sortedSub) {
                            let valA = itemA ? itemA[sk] : undefined;
                            let valC = itemC ? itemC[sk] : undefined;
                            let scriptA = _cmpExtractScript(valA, sk);
                            let scriptC = _cmpExtractScript(valC, sk);
                            if (scriptA !== null || scriptC !== null) {
                                let sr = _cmpBuildScriptDiff(key + "[" + j + "]." + sk, scriptA || "", scriptC || "");
                                rows += sr.html;
                            } else {
                                let r = _cmpBuildRow(key + "[" + j + "]." + sk, valA, valC, nameCache, "  ");
                                rows += r.html;
                            }
                        }
                    } else {
                        let r = _cmpBuildRow(key + "[" + j + "]", itemA, itemC, nameCache, "  ");
                        rows += r.html;
                    }
                }
                continue;
            }

            let rootScriptA = _cmpExtractScript(vAnterior, key);
            let rootScriptC = _cmpExtractScript(vAtual, key);
            if (rootScriptA !== null || rootScriptC !== null) {
                let sr = _cmpBuildScriptDiff(key, rootScriptA || "", rootScriptC || "");
                if (sr.changed) changedCount++;
                rows += sr.html;
                continue;
            }

            let r = _cmpBuildRow(key, vAnterior, vAtual, nameCache, null);
            if (r.changed) changedCount++;
            rows += r.html;
        }

        return (
            '<div style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;height:75vh;display:flex;flex-direction:column;">' +
            '<div style="padding:14px 18px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
            '<div><span style="font-size:16px;font-weight:700;">' +
            _cmpEscHtml(nome || objIdDisplay) +
            "</span>" +
            '<span style="color:#888;font-size:13px;margin-left:10px;">' +
            objIdDisplay +
            "</span></div>" +
            '<div style="font-size:13px;color:#888;">Rev #' +
            revNumAnterior +
            " \u2192 #" +
            revNumAtual +
            " | " +
            changedCount +
            " campo(s) alterado(s)</div></div>" +
            '<div style="padding:10px 18px;display:flex;gap:8px;">' +
            '<button id="cmp-show-all" style="padding:6px 16px;border:1px solid #444;border-radius:4px;background:#1C3C2E;color:#fff;cursor:pointer;font-size:13px;">Todos (' +
            totalFields +
            ")</button>" +
            '<button id="cmp-show-changed" style="padding:6px 16px;border:1px solid #444;border-radius:4px;background:#333;color:#ccc;cursor:pointer;font-size:13px;">Alterados (' +
            changedCount +
            ")</button>" +
            "</div>" +
            '<div style="overflow:auto;flex:1;padding:0 18px 14px;">' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="border-bottom:2px solid #444;">' +
            '<th style="padding:10px 12px;text-align:left;font-size:14px;color:#888;width:220px;">Campo</th>' +
            '<th style="padding:10px 12px;text-align:left;font-size:14px;color:#f85149;">Rev #' +
            revNumAnterior +
            " (anterior)</th>" +
            '<th style="padding:10px 12px;text-align:left;font-size:14px;color:#3fb950;">Rev #' +
            revNumAtual +
            " (atual)</th>" +
            '</tr></thead><tbody id="cmp-tbody">' +
            rows +
            "</tbody></table></div></div>"
        );
    }

    function _cmpBindFilters() {
        let tbody = document.getElementById("cmp-tbody");
        if (!tbody) return;
        let allRows = tbody.querySelectorAll("tr");
        let btnAll = document.getElementById("cmp-show-all");
        let btnChanged = document.getElementById("cmp-show-changed");
        if (btnAll)
            btnAll.addEventListener("click", () => {
                allRows.forEach((r) => (r.style.display = ""));
                btnAll.style.background = "#1C3C2E";
                btnAll.style.color = "#fff";
                btnChanged.style.background = "#333";
                btnChanged.style.color = "#ccc";
            });
        if (btnChanged)
            btnChanged.addEventListener("click", () => {
                allRows.forEach((r) => {
                    r.style.display = r.dataset.changed === "1" ? "" : "none";
                });
                btnChanged.style.background = "#1C3C2E";
                btnChanged.style.color = "#fff";
                btnAll.style.background = "#333";
                btnAll.style.color = "#ccc";
            });

        let container = document.querySelector(".swal2-html-container") || document;
        container.addEventListener("click", (e) => {
            let refEl = e.target.closest(".cmp-ref-link");
            if (refEl) {
                let copyId = refEl.dataset.copyId;
                if (!copyId) return;
                navigator.clipboard
                    .writeText(copyId)
                    .then(() => {
                        showToast("success", "ID copiado: " + copyId);
                    })
                    .catch(() => {
                        showToast("info", "ID: " + copyId);
                    });
                return;
            }
            let fieldEl = e.target.closest(".cmp-field-name");
            if (fieldEl) {
                let fieldName = fieldEl.dataset.field;
                if (!fieldName) return;
                navigator.clipboard
                    .writeText(fieldName)
                    .then(() => {
                        showToast("success", "Campo copiado: " + fieldName);
                    })
                    .catch(() => {
                        showToast("info", "Campo: " + fieldName);
                    });
            }
        });
    }

    showToast("info", "Buscando revisões...");

    let cmpPanel = null;
    try {
        let listScript =
            "" +
            'var cid = "' +
            classId +
            '";\n' +
            'var oid = "' +
            objId +
            '";\n' +
            'var atual = _utils.getMethod("_classId", cid, "_get")({ _id: oid });\n' +
            'var hist = _utils.getMethod("_classId", cid, "_getHistory")({ _id: oid });\n' +
            "var revs = [];\n" +
            'if (hist && typeof hist.hasNext === "function") {\n' +
            "    while (hist.hasNext()) {\n" +
            "        var r = hist.next();\n" +
            "        revs.push({ _revision: r._revision, _lastUpdateDate: r._lastUpdateDate, _lastUpdateUser: r._lastUpdateUser ? (r._lastUpdateUser.name || r._lastUpdateUser._id) : null });\n" +
            "    }\n" +
            "}\n" +
            'var atualName = atual.name || "";\n' +
            'if (typeof atualName === "object") atualName = atualName._current || atualName.pt_BR || "";\n' +

            'var atualUser = atual._lastUpdateUser ? (atual._lastUpdateUser.name || atual._lastUpdateUser._id) : null;\n' +
            "_output = { atualRev: atual._revision, atualUser: atualUser, atualDate: atual._lastUpdateDate, nome: atualName, total: hist ? hist.totalElements : 0, revisoes: revs };\n";

        let listResult = await _cmpRunScript(listScript);

        if (!listResult || !listResult.revisoes || listResult.revisoes.length === 0) {
            Swal.fire({ title: "Sem histórico", text: "O objeto não possui revisões anteriores.", icon: "info", confirmButtonColor: "#1C3C2E" });
            return;
        }

        let revs = listResult.revisoes;

        revs.sort((a, b) => parseInt(a._revision, 10) - parseInt(b._revision, 10));
        let nome = listResult.nome || "";
        let totalRevs = revs.length;

        let revAtualNum = listResult.atualRev != null ? parseInt(listResult.atualRev, 10) : totalRevs + 1;
        if (isNaN(revAtualNum)) revAtualNum = totalRevs + 1;

        let ultimaDoArray = totalRevs > 0 ? revs[totalRevs - 1] : null;
        let ultimaRevArray = ultimaDoArray ? parseInt(ultimaDoArray._revision, 10) : null;
        let atualEhRevisaoExtra =
            ultimaRevArray != null &&
            ultimaRevArray === revAtualNum &&
            listResult.atualDate &&
            ultimaDoArray._lastUpdateDate &&
            new Date(listResult.atualDate).getTime() > new Date(ultimaDoArray._lastUpdateDate).getTime();
        if (atualEhRevisaoExtra) revAtualNum = ultimaRevArray + 1;
        let atualUserStr = listResult.atualUser || "Sistema";
        let atualDateStr = "";
        if (listResult.atualDate) {
            try {
                let da = new Date(listResult.atualDate);
                atualDateStr =
                    String(da.getDate()).padStart(2, "0") +
                    "/" +
                    String(da.getMonth() + 1).padStart(2, "0") +
                    "/" +
                    da.getFullYear() +
                    ", " +
                    String(da.getHours()).padStart(2, "0") +
                    ":" +
                    String(da.getMinutes()).padStart(2, "0") +
                    ":" +
                    String(da.getSeconds()).padStart(2, "0");
            } catch (e) {
                atualDateStr = String(listResult.atualDate);
            }
        }

        let optionsHtml = "";
        for (let i = revs.length - 1; i >= 0; i--) {
            let r = revs[i];
            let revNumParsed = parseInt(r._revision, 10);
            let revNum = !isNaN(revNumParsed) ? revNumParsed : i + 1;
            let dateStr = "";
            if (r._lastUpdateDate) {
                try {
                    let d = new Date(r._lastUpdateDate);
                    let day = String(d.getDate()).padStart(2, "0");
                    let mon = String(d.getMonth() + 1).padStart(2, "0");
                    let year = d.getFullYear();
                    let hh = String(d.getHours()).padStart(2, "0");
                    let mm = String(d.getMinutes()).padStart(2, "0");
                    let ss = String(d.getSeconds()).padStart(2, "0");
                    dateStr = day + "/" + mon + "/" + year + ", " + hh + ":" + mm + ":" + ss;
                } catch (e) {
                    dateStr = String(r._lastUpdateDate);
                }
            }
            let userStr = r._lastUpdateUser || "Sistema";
            optionsHtml += '<option value="' + i + '">#' + revNum + " \u2014 " + (dateStr || "?") + " \u2014 " + _cmpEscHtml(userStr) + "</option>";
        }

        let revsFaltando = revAtualNum - 1 - totalRevs;
        let avisoBuraco =
            revsFaltando && revsFaltando > 0
                ? '<div style="margin-bottom:8px;font-size:12px;color:#e3b341;background:#3a2f14;padding:8px;border-radius:4px;">⚠ ' +
                  revsFaltando +
                  " revisão(ões) mais antigas não aparecem na lista — o histórico do Sydle mantém apenas uma janela recente de revisões.</div>"
                : "";

        let avisoAtualSemLinha =
            atualEhRevisaoExtra && atualUserStr
                ? '<span style="color:#888;font-size:12px;margin-left:10px;" title="Esta revisão não tem linha própria no histórico do Sydle: ela é o estado atual do objeto, sempre usado como lado atual da comparação.">(por ' +
                  _cmpEscHtml(atualUserStr) +
                  (atualDateStr ? " em " + atualDateStr : "") +
                  ")</span>"
                : "";

        let selectHtml =
            '<div style="background:#1e1e1e;color:#d4d4d4;padding:20px;">' +
            '<div style="margin-bottom:16px;">' +
            '<span style="font-size:15px;font-weight:700;">' +
            _cmpEscHtml(nome || objId) +
            "</span>" +
            '<span style="color:#888;font-size:12px;margin-left:10px;">' +
            objId +
            "</span>" +
            '<span style="color:#3fb950;font-size:12px;margin-left:10px;font-weight:600;">Rev atual: #' +
            revAtualNum +
            "</span>" +
            avisoAtualSemLinha +
            "</div>" +
            avisoBuraco +
            '<div style="margin-bottom:8px;font-size:13px;color:#aaa;">Selecione a revisão para comparar com a atual (' +
            revs.length +
            " revisões):</div>" +
            '<select id="cmp-rev-select" style="width:100%;padding:10px;background:#2a2a2a;color:#d4d4d4;border:1px solid #444;border-radius:4px;font-size:13px;font-family:monospace;">' +
            optionsHtml +
            "</select>" +
            "</div>";

        let selectResult = await Swal.fire({
            html: selectHtml,
            width: "650px",
            background: "#1e1e1e",
            position: "top",
            showCancelButton: true,
            confirmButtonText: "Comparar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#1C3C2E",
            reverseButtons: true,
            showCloseButton: true,
            preConfirm: () => {
                let sel = document.getElementById("cmp-rev-select");
                return sel ? parseInt(sel.value) : 0;
            }
        });

        if (!selectResult.isConfirmed) return;
        let selectedIdx = selectResult.value;

        let selectedRevParsed = revs[selectedIdx] ? parseInt(revs[selectedIdx]._revision, 10) : NaN;
        let selectedRevNum = !isNaN(selectedRevParsed) ? selectedRevParsed : selectedIdx + 1;

        cmpPanel = showProgressPanel();
        cmpPanel.update("Carregando revisão #" + selectedRevNum);

        let CHUNK_SIZE = 60000;
        let buildCompareScript = (chunkIdx) =>
            "" +
            'var cid = "' +
            classId +
            '";\n' +
            'var oid = "' +
            objId +
            '";\n' +
            "var targetRev = " +
            selectedRevNum +
            ";\n" +
            "var chunkIdx = " +
            chunkIdx +
            ";\n" +
            "var CHUNK_SIZE = " +
            CHUNK_SIZE +
            ";\n" +
            'var atual = _utils.getMethod("_classId", cid, "_get")({ _id: oid });\n' +
            'var hist = _utils.getMethod("_classId", cid, "_getHistory")({ _id: oid });\n' +
            "var rev = null;\n" +
            'if (hist && typeof hist.hasNext === "function") {\n' +
            "    while (hist.hasNext()) {\n" +
            "        var cand = hist.next();\n" +
            "        if (parseInt(cand._revision, 10) === targetRev) { rev = cand; break; }\n" +
            "    }\n" +
            "}\n" +
            "function flattenRef(v) {\n" +
            '    if (!v || typeof v !== "object") return v;\n' +
            "    if (v._id) return { _id: v._id, _classId: v._classId || null };\n" +
            "    return v;\n" +
            "}\n" +
            "function shallow(obj) {\n" +
            "    if (!obj) return null;\n" +
            "    var r = {};\n" +
            "    var keys = Object.keys(obj);\n" +
            "    for (var i = 0; i < keys.length; i++) {\n" +
            "        var k = keys[i];\n" +
            '        if (k.charAt(0) === "_" && k !== "_id" && k !== "_classId") continue;\n' +
            "        var v = obj[k];\n" +
            '        if (v === null || v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean") { r[k] = v; continue; }\n' +
            '        if (typeof v === "object" && !Array.isArray(v)) {\n' +
            "            if (v._id) { r[k] = { _id: v._id, _classId: v._classId || null }; }\n" +
            "            else { try { r[k] = JSON.parse(JSON.stringify(v)); } catch(e) { r[k] = String(v); } }\n" +
            "            continue;\n" +
            "        }\n" +
            "        if (Array.isArray(v)) {\n" +
            "            var arr = [];\n" +
            "            for (var j = 0; j < v.length; j++) {\n" +
            "                var item = v[j];\n" +
            '                if (item === null || item === undefined || typeof item !== "object") { arr.push(item); continue; }\n' +
            "                if (item._id) {\n" +
            "                    var ik = Object.keys(item);\n" +
            "                    var userKeys = [];\n" +
            '                    for (var ki = 0; ki < ik.length; ki++) { if (ik[ki].charAt(0) !== "_") userKeys.push(ik[ki]); }\n' +
            "                    if (userKeys.length === 0) { arr.push({ _id: item._id, _classId: item._classId || null }); continue; }\n" +
            "                    var emb = { _id: item._id };\n" +
            "                    for (var ui = 0; ui < userKeys.length; ui++) {\n" +
            "                        var uk = userKeys[ui];\n" +
            "                        var uv = item[uk];\n" +
            '                        if (uv === null || uv === undefined || typeof uv === "string" || typeof uv === "number" || typeof uv === "boolean") { emb[uk] = uv; }\n' +
            "                        else if (Array.isArray(uv)) { emb[uk] = uv.map(flattenRef); }\n" +
            "                        else { emb[uk] = flattenRef(uv); }\n" +
            "                    }\n" +
            "                    arr.push(emb);\n" +
            "                } else {\n" +
            "                    try { arr.push(JSON.parse(JSON.stringify(item))); } catch(e) { arr.push(String(item)); }\n" +
            "                }\n" +
            "            }\n" +
            "            r[k] = arr;\n" +
            "        }\n" +
            "    }\n" +
            "    return r;\n" +
            "}\n" +
            "try {\n" +
            "    if (!rev) { _output = { error: \"Revisão #\" + targetRev + \" não encontrada no histórico\" }; }\n" +
            "    else {\n" +
            "        var full = JSON.stringify({ atual: shallow(atual), anterior: shallow(rev) });\n" +
            "        var totalChunks = Math.ceil(full.length / CHUNK_SIZE);\n" +
            "        _output = { totalLen: full.length, totalChunks: totalChunks, chunkIdx: chunkIdx, chunk: full.substr(chunkIdx * CHUNK_SIZE, CHUNK_SIZE) };\n" +
            "    }\n" +
            "} catch(e) {\n" +
            "    _output = { error: e.message || String(e) };\n" +
            "}\n";

        console.log("[sytools][compare] targetRev buscado:", selectedRevNum, "classId:", classId, "objId:", objId);

        let fullJson = "";
        let cmpResult = null;
        let chunkIdx = 0;
        let totalChunks = 1;
        while (chunkIdx < totalChunks) {
            let parte = await _cmpRunScript(buildCompareScript(chunkIdx));
            if (!parte || parte.error || typeof parte !== "object" || typeof parte.chunk !== "string") {
                console.warn("[sytools][compare] falha ao buscar bloco", chunkIdx, parte);
                cmpPanel.finish(false, "Falha ao carregar", parte && parte.error ? parte.error : "Revisão não pôde ser carregada");
                Swal.fire({
                    title: "Erro",
                    text: parte && parte.error ? "Erro no executor: " + parte.error : "Não foi possível carregar a revisão selecionada.",
                    icon: "error",
                    confirmButtonColor: "#1C3C2E"
                });
                return;
            }
            totalChunks = parte.totalChunks || 1;
            fullJson += parte.chunk;
            console.log("[sytools][compare] bloco " + (chunkIdx + 1) + "/" + totalChunks + " recebido (" + parte.chunk.length + " chars)");
            chunkIdx++;
        }

        console.log("[sytools][compare] payload remontado:", fullJson.length, "chars");
        try {
            cmpResult = JSON.parse(fullJson);
        } catch (e) {
            console.warn("[sytools][compare] JSON.parse do payload remontado falhou:", e.message);
            cmpPanel.finish(false, "Falha ao carregar", "Resposta inválida do servidor");
            Swal.fire({ title: "Erro", text: "Resposta inválida ao remontar a revisão: " + e.message, icon: "error", confirmButtonColor: "#1C3C2E" });
            return;
        }

        if (!cmpResult.atual || !cmpResult.anterior) {
            console.warn("[sytools][compare] revisão não encontrada — cmpResult:", cmpResult);
            cmpPanel.finish(false, "Revisão não encontrada", "Tente outra revisão");
            Swal.fire({ title: "Erro", text: "Revisão não encontrada. Tente outra revisão.", icon: "error", confirmButtonColor: "#1C3C2E" });
            return;
        }

        let atual = cmpResult.atual;
        let anterior = cmpResult.anterior;
        let revNumAtual = revAtualNum;
        let revNumAnterior = selectedRevNum;

        cmpPanel.update("Resolvendo nomes...");
        let nameCache = await _cmpResolveNames(atual, anterior);

        let diffHtml = _cmpBuildDiffHtml(atual, anterior, revNumAtual, revNumAnterior, nome, objId, nameCache);
        cmpPanel.remove();

        let diffResult = await Swal.fire({
            html: diffHtml,
            width: "90%",
            background: "#1e1e1e",
            showConfirmButton: true,
            confirmButtonText: "Fechar",
            confirmButtonColor: "#1C3C2E",
            showDenyButton: true,
            denyButtonText: "Reverter para #" + revNumAnterior,
            denyButtonColor: "#c9302c",
            showCloseButton: true,
            didOpen: _cmpBindFilters
        });

        if (diffResult.isDenied) {
            let confirmRevert = await Swal.fire({
                title: "Confirmar Reversão",
                html:
                    getSytoolsModalCss() +
                    '<div style="text-align:center;color:#333;font-size:14px;line-height:1.6;">' +
                    "<p>Reverter <b>" +
                    _cmpEscHtml(nome || objId) +
                    "</b> para o estado da revisão <b>#" +
                    revNumAnterior +
                    "</b>?</p>" +
                    '<p style="color:#c9302c;margin-top:10px;">Esta ação sobrescreverá os campos alterados com os valores da revisão selecionada.</p>' +
                    "</div>",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sim, reverter",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#c9302c",
                reverseButtons: true
            });

            if (confirmRevert.isConfirmed) {
                showToast("info", "Revertendo para revisão #" + revNumAnterior + "...");
                try {
                    let revertScript =
                        "" +
                        'var cid = "' +
                        classId +
                        '";\n' +
                        'var oid = "' +
                        objId +
                        '";\n' +
                        "var targetRev = " +
                        selectedRevNum +
                        ";\n" +
                        'var hist = _utils.getMethod("_classId", cid, "_getHistory")({ _id: oid });\n' +
                        "var rev = null;\n" +
                        'if (hist && typeof hist.hasNext === "function") {\n' +
                        "    while (hist.hasNext()) {\n" +
                        "        var cand = hist.next();\n" +
                        "        if (parseInt(cand._revision, 10) === targetRev) { rev = cand; break; }\n" +
                        "    }\n" +
                        "}\n" +
                        'if (!rev) { _output = { error: "Revisão não encontrada" }; }\n' +
                        "else {\n" +
                        '    var atual = _utils.getMethod("_classId", cid, "_get")({ _id: oid });\n' +
                        "    var updatePayload = { _id: oid, _revision: atual._revision };\n" +
                        "    var ignorar = { _revision: 1, _classRevision: 1, _creationUser: 1, _lastUpdateUser: 1, _creationDate: 1, _lastUpdateDate: 1, _publishedObject: 1, _protected: 1, _unprotectedFields: 1, _id: 1, _classId: 1, _class: 1 };\n" +
                        "    var keys = Object.keys(rev);\n" +
                        "    for (var i = 0; i < keys.length; i++) {\n" +
                        "        var k = keys[i];\n" +
                        "        if (ignorar[k]) continue;\n" +
                        "        updatePayload[k] = rev[k];\n" +
                        "    }\n" +
                        '    var res = _utils.getMethod("_classId", cid, "_update")(updatePayload);\n' +
                        "    _output = { success: true, newRevision: res._revision };\n" +
                        "}\n";

                    let revertResult = await _cmpRunScript(revertScript);
                    if (revertResult && revertResult.success) {
                        Swal.fire({
                            title: "Revertido!",
                            html:
                                '<p style="color:#333;">Objeto revertido para a revisão #' +
                                revNumAnterior +
                                ' com sucesso.</p><p style="color:#888;font-size:12px;margin-top:8px;">Nova revisão: ' +
                                (revertResult.newRevision || "-") +
                                "</p>",
                            icon: "success",
                            confirmButtonColor: "#1C3C2E"
                        });
                    } else {
                        Swal.fire({ title: "Erro", text: revertResult && revertResult.error ? revertResult.error : "Falha ao reverter.", icon: "error", confirmButtonColor: "#1C3C2E" });
                    }
                } catch (revertErr) {
                    Swal.fire({ title: "Erro ao reverter", text: revertErr.message || String(revertErr), icon: "error", confirmButtonColor: "#1C3C2E" });
                }
            }
        }
    } catch (err) {
        if (cmpPanel) cmpPanel.remove();
        let msg = err.message || String(err);
        let escMsg = String(msg).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let isExecError = msg.indexOf("403") !== -1 || msg.indexOf("404") !== -1 || msg.indexOf("Executor") !== -1;
        Swal.fire({
            title: isExecError ? "Executor não disponível" : "Erro",
            html: isExecError
                ? '<p style="color:#ccc;font-size:14px;">' +
                  escMsg +
                  '</p><p style="color:#888;font-size:13px;margin-top:12px;">Para corrigir: abra o <b>Executor de Scripts</b>, vá na aba <b>Configurações</b> e clique em <b>"Criar Objeto Executor"</b>.</p>'
                : escMsg,
            icon: isExecError ? "warning" : "error",
            confirmButtonColor: "#1C3C2E"
        });
    }
}
