function removeSpecials(str) {
    var lower = str.toLowerCase();
    var upper = str.toUpperCase();

    var res = "";
    for (var i = 0; i < lower.length; ++i) {
        if (lower[i] != upper[i] || lower[i].trim() === '' || lower[i] == '_')
            res += str[i];
    }
    return removePunctuation(res).toLowerCase();
}

function removePunctuation(str) {
    let com_acento = "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝŔÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿŕ";
    let sem_acento = "AAAAAAACEEEEIIIIDNOOOOOOUUUUYRsBaaaaaaaceeeeiiiionoooooouuuuybyr";
    let novastr = "";
    for (let i = 0; i < str.length; i++) {
        let troca = false;
        for (let a = 0; a < com_acento.length; a++) {
            if (str.substr(i, 1) == com_acento.substr(a, 1)) {
                novastr += sem_acento.substr(a, 1);
                troca = true;
                break;
            }
        }
        if (troca == false) {
            novastr += str.substr(i, 1);
        }
    }
    return novastr;
}

function getSydleToken() {
    let storage = null;
    try { storage = JSON.parse(localStorage.getItem('explorer_user_map')); } catch(e) {}
    if (storage) {
        let keys = Object.keys(storage);
        let bestToken = null;
        let bestExp = 0;
        for (let k of keys) {
            let entry = storage[k];
            if (entry && entry.users && entry.users.length > 0) {
                for (let u = 0; u < entry.users.length; u++) {
                    let user = entry.users[u];
                    if (user.accessToken && user.accessToken.token) {
                        let exp = (user.accessToken.payload && user.accessToken.payload.exp) ? user.accessToken.payload.exp : 0;
                        if (exp > bestExp) {
                            bestExp = exp;
                            bestToken = { token: user.accessToken.token, userId: user._id || user.id || user.code || '', storage: storage, key: k, userObj: user, expiresAt: exp };
                        }
                    }
                }
            }
        }
        if (bestToken) return bestToken;
    }
    let tokenFromStorage = _findTokenInStorage();
    if (tokenFromStorage) return { token: tokenFromStorage, userId: '', storage: storage, expiresAt: 0 };
    let cookieToken = _extractTokenFromCookie();
    if (cookieToken) return { token: cookieToken, userId: '', storage: storage, expiresAt: 0 };
    return { token: '', userId: '', storage: storage, expiresAt: 0 };
}
function isSydleTokenValid(tkObj) {
    if (!tkObj || !tkObj.token) return false;
    if (!tkObj.expiresAt || tkObj.expiresAt === 0) return true;
    let now = Math.floor(Date.now() / 1000);
    return now < (tkObj.expiresAt - 300);
}
function getValidSydleToken() {
    let tk = getSydleToken();
    if (isSydleTokenValid(tk)) return tk;
    try {
        let freshStorage = JSON.parse(localStorage.getItem('explorer_user_map'));
        if (freshStorage) {
            let keys = Object.keys(freshStorage);
            let bestToken = null;
            let bestExp = 0;
            for (let k of keys) {
                let entry = freshStorage[k];
                if (entry && entry.users) {
                    for (let u = 0; u < entry.users.length; u++) {
                        let user = entry.users[u];
                        if (user.accessToken && user.accessToken.token) {
                            let exp = (user.accessToken.payload && user.accessToken.payload.exp) ? user.accessToken.payload.exp : 0;
                            if (exp > bestExp) {
                                bestExp = exp;
                                bestToken = { token: user.accessToken.token, userId: user._id || user.id || user.code || '', storage: freshStorage, key: k, userObj: user, expiresAt: exp };
                            }
                        }
                    }
                }
            }
            if (bestToken && isSydleTokenValid(bestToken)) return bestToken;
        }
    } catch(e) {}
    return tk;
}
function _findTokenInStorage() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key === 'explorer_user_map') continue;
            let val = localStorage.getItem(key);
            if (!val || val.length < 100) continue;
            try {
                let parsed = JSON.parse(val);
                if (parsed && typeof parsed === 'object') {
                    if (parsed.accessToken && parsed.accessToken.token) return parsed.accessToken.token;
                    if (parsed.token && typeof parsed.token === 'string' && parsed.token.length > 50) return parsed.token;
                    let subKeys = Object.keys(parsed);
                    for (let sk of subKeys) {
                        let sub = parsed[sk];
                        if (sub && sub.users && sub.users[0] && sub.users[0].accessToken && sub.users[0].accessToken.token) return sub.users[0].accessToken.token;
                        if (sub && sub.accessToken && sub.accessToken.token) return sub.accessToken.token;
                    }
                }
            } catch(e2) {}
        }
    } catch(e) {}
    return '';
}
function _extractTokenFromCookie() {
    try {
        let cookies = document.cookie.split(';');
        for (let c of cookies) {
            let trimmed = c.trim();
            if (trimmed.startsWith('JW-UserToken')) {
                let val = trimmed.substring(trimmed.indexOf('=') + 1);
                if (val && val.length > 50) return val;
            }
        }
    } catch(e) {}
    return '';
}
function getSydleApiNamespace() {
    let path = window.location.pathname;
    let match = path.match(/^\/app\/([^\/]+)/);
    if (match && match[1]) return match[1];
    let tk = getSydleToken();
    if (tk.key) return tk.key;
    return 'main';
}
function getSydleApiBase() {
    return '/api/1/' + getSydleApiNamespace();
}
