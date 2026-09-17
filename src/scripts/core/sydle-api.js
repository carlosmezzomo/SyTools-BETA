function getElements(root) {
    return Array.from(root.querySelectorAll("*")).flatMap((item) => (item.shadowRoot ? [item, ...getElements(item.shadowRoot)] : [item]));
}
function getActiveObjectIdsNoCopy() {
    let doc = window.document;
    let elements = getElements(doc);
    let objectViews = elements.filter((element) => element.localName === "sy-one-object-view" || element.localName === "sy-one-process-instance-view" || element.localName === "sy-one-user-task-view");

    let object = objectViews[objectViews.length - 1];

    if (!object) return { id: "", cid: "" };

    let id = object.getAttribute("object-id");
    let cid = object.getAttribute("class-id");

    return { id: id, cid: cid };
}
function getActiveObjectIds() {
    let doc = window.document;
    let elements = getElements(doc);
    let objectViews = elements.filter((element) => element.localName === "sy-one-object-view" || element.localName === "sy-one-process-instance-view" || element.localName === "sy-one-user-task-view");

    let object = objectViews[objectViews.length - 1];

    if (!object) return { id: "", cid: "" };

    let id = object.getAttribute("object-id");
    let cid = object.getAttribute("class-id");

    setTimeout(async () => {
        await window.navigator.clipboard.writeText(id);
    }, 250);

    return { id: id, cid: cid };
}

function getCachedClassName(classId) {
    try {
        let classTree = JSON.parse(localStorage.getItem("classTree"));
        if (classTree && classTree.length) {
            for (let p of classTree) {
                let c = p.packageClasses.find((c) => c._id === classId);
                if (!c || !c.name) continue;
                if (typeof c.name === "string") return c.name;
                return c.name._current || c.name.pt_BR || Object.values(c.name).find((v) => typeof v === "string") || "";
            }
        }
    } catch (e) {}
    return "";
}

async function fetchObjectIdentifiers(objectId, classId) {
    let _tk = getSydleToken();
    if (!_tk.token) return [];
    try {
        let resp = await fetch(`${window.location.origin}/api/1/${getSydleApiNamespace()}/_system/_workspace/getCards?accessToken=${_tk.token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + _tk.token },
            body: JSON.stringify({
                classId: "000000000000000000000000",
                objectsReferences: [{ _id: objectId, _classId: classId }],
                small: true,
                storage: "published",
                tags: false,
                timezoneId: "America/Sao_Paulo"
            })
        });
        if (!resp.ok) return [];
        let data = await resp.json();
        let card = data.cards && data.cards.length ? data.cards[0] : null;
        if (!card || !card.ids) return [];
        return card.ids.filter((v) => v !== null && v !== undefined && String(v).trim() !== "").map((v) => String(v).trim());
    } catch (e) {
        return [];
    }
}

async function deleteObject(id, cid) {
    let _tk = getSydleToken();
    if (!_tk.token) throw new Error("Token de acesso não encontrado.");
    return await $.ajax({
        url: `/api/1/${getSydleApiNamespace()}/_classId/${cid}/_delete/${id}?accessToken=${_tk.token}`,
        type: "POST"
    });
}

function _sfNormalizeText(s) {
    return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}

function _extractReadableName(source) {
    if (!source || typeof source !== "object") return null;

    function resolveString(val) {
        if (!val) return null;
        if (typeof val === "string" && val.length > 1 && !/^[0-9a-f]{24}$/i.test(val)) return val;
        if (typeof val === "object" && !Array.isArray(val)) {
            if (val._current && typeof val._current === "string") return val._current;
            if (val.pt_BR && typeof val.pt_BR === "string") return val.pt_BR;
            if (val.name) return resolveString(val.name);
            let strVal = Object.values(val).find((v) => typeof v === "string" && v.length > 2 && !/^[0-9a-f]{24}$/i.test(v));
            if (strVal) return strVal;
        }
        return null;
    }

    let fields = ["name", "fullName", "displayName", "title", "label", "description"];
    for (let f of fields) {
        let result = resolveString(source[f]);
        if (result) return result;
    }

    for (let k in source) {
        if (k.startsWith("_")) continue;
        let v = source[k];
        if (v && typeof v === "object" && !Array.isArray(v) && !v._classId) {
            for (let f of fields) {
                let nested = resolveString(v[f]);
                if (nested) return nested;
            }
        }
    }

    return null;
}

function _getRefFieldsToResolve(source) {
    if (!source || typeof source !== "object") return [];
    let refs = [];
    let priority = ["person", "staffMember", "employee", "beneficiary", "contact", "company"];
    for (let k of priority) {
        if (source[k] && typeof source[k] === "object" && source[k]._id && source[k]._classId) {
            refs.push({ field: k, id: source[k]._id, classId: source[k]._classId });
        }
    }
    return refs;
}

async function _resolveNamesForIds(ids, refClassId, token, baseUrl) {
    let nameMap = {};
    let objectsRefs = ids.map((id) => ({ _id: id, _classId: refClassId }));
    let headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };

    for (let i = 0; i < objectsRefs.length; i += 50) {
        let batch = objectsRefs.slice(i, i + 50);
        try {
            let resp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_system/_workspace/getCards?accessToken=${token}`, {
                method: "POST",
                headers: headers,
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
                        nameMap[card._id] = card.ids[0];
                    }
                }
            }
        } catch (e) {}
    }

    return nameMap;
}

function copyObjectsToClipboard(objects) {
    let jsonText = JSON.stringify(objects, null, 2);
    window.navigator.clipboard
        .writeText(jsonText)
        .then(() => {
            showToast("success", objects.length + " objetos copiados");
        })
        .catch(() => {
            let ta = document.createElement("textarea");
            ta.value = jsonText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            showToast("success", objects.length + " objetos copiados");
        });
}

async function fetchAllObjectsViaSearch(classId, searchQuery) {
    let _tk = getSydleToken();
    if (!_tk.token) throw new Error("Token de acesso não encontrado.");
    let token = _tk.token;
    let baseUrl = window.location.origin;
    let query = searchQuery || { match_all: {} };

    let firstResp = await doSearch(baseUrl, classId, token, {
        size: 1,
        from: 0,
        query: query
    });

    if (!firstResp.ok) {
        throw new Error("_search não suportado para esta classe (HTTP " + firstResp.status + ")");
    }

    let firstResult = await firstResp.json();
    let totalHits = 0;
    if (firstResult && firstResult.hits) {
        totalHits = firstResult.hits.total;
        if (typeof totalHits === "object") totalHits = totalHits.value || 0;
    }

    if (totalHits === 0) return [];

    showToast("info", totalHits + " objetos encontrados, buscando...");

    let allObjects = [];
    let batchSize = 500;
    let searchAfter = null;
    let hasMore = true;

    while (hasMore) {
        let body = {
            size: batchSize,
            query: query,
            sort: [{ _id: "asc" }]
        };
        if (searchAfter) {
            body.search_after = searchAfter;
        }

        let response = await doSearch(baseUrl, classId, token, body);

        if (!response.ok) {
            if (allObjects.length > 0) break;
            throw new Error("Erro na busca (HTTP " + response.status + ")");
        }

        let result = await response.json();
        if (!result || !result.hits || !result.hits.hits || result.hits.hits.length === 0) {
            hasMore = false;
            break;
        }

        let hits = result.hits.hits;
        for (let i = 0; i < hits.length; i++) {
            allObjects.push(hits[i]._source);
        }

        if (hits.length < batchSize) {
            hasMore = false;
        } else {
            searchAfter = hits[hits.length - 1].sort;
            if (!searchAfter) hasMore = false;
        }

        if (allObjects.length % 2000 < batchSize) {
            showToast("info", allObjects.length + " de ~" + totalHits + " objetos...");
        }
    }

    return allObjects;
}

async function doSearch(baseUrl, classId, token, body) {
    return fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/${classId}/_search?accessToken=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

function getListingClassId() {
    let doc = window.parent ? window.parent.document : window.document;

    let iFrameListing = doc.querySelector("iframe[slotname=explorer_object_listing]");
    if (iFrameListing) {
        if (iFrameListing.src) {
            let srcMatch = iFrameListing.src.match(/[?&]cid=([a-f0-9]{24})/);
            if (srcMatch) return srcMatch[1];
        }
        try {
            let iElements = getElements(iFrameListing.contentDocument);
            let innerListing = iElements.find((el) => (el.localName === "sy-one-object-listing-view" || el.localName === "sy-one-object-listing") && el.getAttribute("class-id"));
            if (innerListing) return innerListing.getAttribute("class-id");
        } catch (e) {}
    }

    let iFrameDetails = doc.querySelector("iframe[slotname=explorer_object_details]") || doc.querySelector("iframe[slotname=permalink-workspace-slot]");
    if (iFrameDetails) {
        if (iFrameDetails.src) {
            let srcMatch = iFrameDetails.src.match(/[?&]cid=([a-f0-9]{24})/);
            if (srcMatch) return srcMatch[1];
        }
        try {
            let iElements = getElements(iFrameDetails.contentDocument);
            let objView = iElements.find((el) => (el.localName === "sy-one-object-view" || el.localName === "sy-one-object-listing-view") && el.getAttribute("class-id"));
            if (objView) return objView.getAttribute("class-id");
        } catch (e) {}
    }

    let elements = getElements(doc);
    let anyView = elements.find((el) => (el.localName === "sy-one-object-listing-view" || el.localName === "sy-one-object-listing" || el.localName === "sy-one-object-view") && el.getAttribute("class-id"));
    if (anyView) return anyView.getAttribute("class-id");

    let objectInfo = getActiveObjectIdsNoCopy();
    if (objectInfo.cid) return objectInfo.cid;

    let url = window.location.href;
    let cidMatch = url.match(/[?&]cid=([a-f0-9]{24})/);
    if (cidMatch) return cidMatch[1];

    let allIframes = doc.querySelectorAll("iframe");
    for (let i = 0; i < allIframes.length; i++) {
        let src = allIframes[i].src || "";
        let m = src.match(/[?&]cid=([a-f0-9]{24})/);
        if (m) return m[1];
    }

    return null;
}

const CLASS_PANEL_KEY = "sytools_class_panel";

function getClassPanelStore() {
    try {
        let raw = sytoolsGetRaw(CLASS_PANEL_KEY, sytoolsEnvId());
        let parsed = raw ? JSON.parse(raw) : null;
        return {
            favoritas: (parsed && parsed.favoritas) || [],
            ocultos: (parsed && parsed.ocultos) || {},
            metodosFavoritos: (parsed && parsed.metodosFavoritos) || {},
            ultimaClasseId: (parsed && parsed.ultimaClasseId) || null
        };
    } catch (e) {
        return { favoritas: [], ocultos: {}, metodosFavoritos: {}, ultimaClasseId: null };
    }
}

function setClassPanelStore(store) {
    sytoolsSetRaw(CLASS_PANEL_KEY, JSON.stringify(store), sytoolsEnvId());
}

function classPanelAddFavorita(classId, nome) {
    let store = getClassPanelStore();
    if (store.favoritas.some((f) => f.classId === classId)) return store;
    store.favoritas.push({ classId, nome });
    setClassPanelStore(store);
    return store;
}

function classPanelRemoveFavorita(classId) {
    let store = getClassPanelStore();
    store.favoritas = store.favoritas.filter((f) => f.classId !== classId);
    delete store.ocultos[classId];
    delete store.metodosFavoritos[classId];
    setClassPanelStore(store);
    return store;
}

function classPanelToggleMetodoFavorito(classId, identifier) {
    let store = getClassPanelStore();
    let lista = store.metodosFavoritos[classId] || (store.metodosFavoritos[classId] = []);
    let idx = lista.indexOf(identifier);
    if (idx === -1) lista.push(identifier);
    else lista.splice(idx, 1);
    setClassPanelStore(store);
    return store;
}

function extrairTextoI18n(val, fallback) {
    if (!val) return fallback || "";
    if (typeof val === "string") return val;
    if (typeof val === "object") return val._current || val.pt_BR || Object.values(val).find((v) => typeof v === "string") || fallback || "";
    return fallback || "";
}

async function buscarClassesPorTermo(termo) {
    let _tk = getValidSydleToken();
    if (!_tk.token) return [];
    let baseUrl = window.location.origin;
    if (/^[a-f0-9]{24}$/i.test(termo)) {
        try {
            let meta = await classPanelFetchFields(termo);
            return [{ classId: meta.classId, nome: meta.nome }];
        } catch (e) {
            return [];
        }
    }
    let resp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000/_search?accessToken=${_tk.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            size: 12,
            _source: ["identifier"],
            query: { bool: { should: [{ match: { name: termo } }, { wildcard: { "identifier.keyword": `*${termo}*` } }] } }
        })
    });
    let result = await resp.json();
    let hits = (result && result.hits && result.hits.hits) || [];
    if (!hits.length) return [];

    return Promise.all(
        hits.slice(0, 12).map(async (h) => {
            try {
                let meta = await classPanelFetchFields(h._id);
                return { classId: h._id, nome: meta.nome };
            } catch (e) {
                return { classId: h._id, nome: h._id };
            }
        })
    );
}

function resolverInsercaoAutocomplete(item) {
    if (!item._snippet) return { texto: item.texto, cursorOffset: item.texto.length };
    let codigo = item._codigo;
    let marcador = codigo.indexOf("${cursor}");
    if (marcador === -1) return { texto: codigo, cursorOffset: codigo.length };
    return { texto: codigo.slice(0, marcador) + codigo.slice(marcador + "${cursor}".length), cursorOffset: marcador };
}

async function detectarTipoDoId(id) {
    let _tk = getValidSydleToken();
    if (!_tk.token) return "object";
    try {
        let baseUrl = window.location.origin;
        let resp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000/_get/${id}?accessToken=${_tk.token}`);
        if (!resp.ok) return "object";
        let body = await resp.json();
        return body && Array.isArray(body.fields) ? "class" : "object";
    } catch (e) {
        return "object";
    }
}

async function classPanelFetchFields(classId) {
    let _tk = getValidSydleToken();
    if (!_tk.token) throw new Error("Token não encontrado");
    let baseUrl = window.location.origin;
    let resp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000/_get/${classId}?accessToken=${_tk.token}`);
    if (!resp.ok) throw new Error("Falha ao buscar classe: HTTP " + resp.status);
    let classDef = await resp.json();
    let nome = extrairTextoI18n(classDef.name, classId);
    let campos = (classDef.fields || [])
        .filter((f) => f.identifier && !f.identifier.startsWith("_"))
        .map((f) => ({
            identifier: f.identifier,
            nome: extrairTextoI18n(f.name, f.identifier),
            tipo: f.type,
            readOnly: !!f.readOnly,
            calculado: !!f.calculated
        }));
    return { classId, nome, campos, classDefRaw: classDef };
}

async function classPanelFetchMethods(classId) {
    let _tk = getValidSydleToken();
    if (!_tk.token) throw new Error("Token não encontrado");
    let baseUrl = window.location.origin;
    let resp = await fetch(`${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000/_search?accessToken=${_tk.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: 1, _source: ["methods"], query: { term: { _id: classId } } })
    });
    if (!resp.ok) throw new Error("Falha ao buscar métodos: HTTP " + resp.status);
    let result = await resp.json();
    let hit = result && result.hits && result.hits.hits && result.hits.hits[0];
    let methods = (hit && hit._source && hit._source.methods) || [];
    return methods.map((m) => ({
        _id: m._id,
        identifier: m.identifier,
        nome: extrairTextoI18n(m.name, m.identifier),
        editavel: Array.isArray(m.scripts) && typeof m.scripts[0] === "string",
        engine: m.engine,
        executionContext: m.executionContext || []
    }));
}

function _classPanelHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h + ":" + str.length;
}

async function classPanelOpenMethodForEdit(classId, methodId) {
    let _tk = getValidSydleToken();
    if (!_tk.token) throw new Error("Token não encontrado");
    let baseUrl = window.location.origin;
    let apiBase = `${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000`;
    let headers = { "Content-Type": "application/json" };

    let createResp = await fetch(`${apiBase}/_createDraft?accessToken=${_tk.token}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ _id: classId })
    });
    if (!createResp.ok) throw new Error("Falha ao criar rascunho: HTTP " + createResp.status);
    let draftRef = await createResp.json();
    let draftId = draftRef._id;

    let getResp = await fetch(`${apiBase}/_getDraft/${draftId}?accessToken=${_tk.token}`);
    if (!getResp.ok) throw new Error("Falha ao ler rascunho: HTTP " + getResp.status);
    let draft = await getResp.json();
    if (!draft) throw new Error("Rascunho vazio - _getDraft precisa do _id do draft, não o da classe publicada");

    let metodo = (draft.methods || []).find((m) => m._id === methodId);
    if (!metodo) throw new Error("Método não encontrado no rascunho");
    if (!Array.isArray(metodo.scripts) || typeof metodo.scripts[0] !== "string") throw new Error("Este método não tem script editável");

    let scriptAtual = metodo.scripts[0].replace(/\r\n/g, "\n");
    return { draftId, methodId, scriptOriginal: scriptAtual, hashOriginal: _classPanelHash(scriptAtual) };
}

async function classPanelSaveMethod(classId, methodId, hashOriginal, scriptNovo) {
    let _tk = getValidSydleToken();
    if (!_tk.token) throw new Error("Token não encontrado");
    let baseUrl = window.location.origin;
    let apiBase = `${baseUrl}/api/1/${getSydleApiNamespace()}/_classId/000000000000000000000000`;
    let headers = { "Content-Type": "application/json" };

    let createResp = await fetch(`${apiBase}/_createDraft?accessToken=${_tk.token}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ _id: classId })
    });
    if (!createResp.ok) throw new Error("Falha ao criar rascunho: HTTP " + createResp.status);
    let draftRef = await createResp.json();
    let draftId = draftRef._id;

    let getResp = await fetch(`${apiBase}/_getDraft/${draftId}?accessToken=${_tk.token}`);
    if (!getResp.ok) throw new Error("Falha ao ler rascunho: HTTP " + getResp.status);
    let draft = await getResp.json();

    let metodo = (draft.methods || []).find((m) => m._id === methodId);
    if (!metodo) throw new Error("Método não encontrado no rascunho");

    let scriptAgora = metodo.scripts[0].replace(/\r\n/g, "\n");
    let hashAgora = _classPanelHash(scriptAgora);

    if (hashAgora !== hashOriginal) {

        return { conflito: true, scriptPublicadoAgora: scriptAgora, draftId };
    }

    metodo.scripts[0] = scriptNovo;
    let updateResp = await fetch(`${apiBase}/_updateDraft?accessToken=${_tk.token}`, {
        method: "POST",
        headers,
        body: JSON.stringify(draft)
    });
    if (!updateResp.ok) throw new Error("Falha ao salvar rascunho: HTTP " + updateResp.status);

    let publishResp = await fetch(`${apiBase}/_publish?accessToken=${_tk.token}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ _id: draftId })
    });
    if (!publishResp.ok) throw new Error("Falha ao publicar: HTTP " + publishResp.status);
    let published = await publishResp.json();

    return { conflito: false, revisao: published._revision, hashNovo: _classPanelHash(scriptNovo) };
}
