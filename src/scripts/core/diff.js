function _cmpSplitScript(s) {
    if (!s) return [""];
    if (s.indexOf("\n") !== -1) return s.split("\n");
    return s
        .split(";")
        .map((p, i, a) => p.trim() + (i < a.length - 1 && p.trim().length > 0 ? ";" : ""))
        .filter((l) => l.length > 0);
}

function _cmpLcsDiff(a, b) {
    let m = a.length,
        n = b.length;
    if (m + n > 8000) {
        let ops = [];
        let ia = 0,
            ib = 0;
        while (ia < m || ib < n) {
            if (ia < m && ib < n && a[ia].trim() === b[ib].trim()) {
                ops.push({ type: "equal", lineA: ia, lineB: ib });
                ia++;
                ib++;
            } else if (ib < n && (ia >= m || ib < n)) {
                let foundAhead = -1;
                for (let look = ia; look < Math.min(ia + 5, m); look++) {
                    if (a[look].trim() === b[ib].trim()) {
                        foundAhead = look;
                        break;
                    }
                }
                if (foundAhead > ia) {
                    for (let x = ia; x < foundAhead; x++) {
                        ops.push({ type: "delete", lineA: x });
                    }
                    ia = foundAhead;
                } else if (foundAhead === ia) {
                    ops.push({ type: "equal", lineA: ia, lineB: ib });
                    ia++;
                    ib++;
                } else {
                    ops.push({ type: "insert", lineB: ib });
                    ib++;
                }
            } else {
                ops.push({ type: "delete", lineA: ia });
                ia++;
            }
        }
        return ops;
    }
    let dp = [];
    for (let i = 0; i <= m; i++) {
        dp[i] = [];
        for (let j = 0; j <= n; j++) dp[i][j] = 0;
    }
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1].trim() === b[j - 1].trim()) dp[i][j] = dp[i - 1][j - 1] + 1;
            else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    let ops = [];
    let i = m,
        j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1].trim() === b[j - 1].trim()) {
            ops.push({ type: "equal", lineA: i - 1, lineB: j - 1 });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.push({ type: "insert", lineB: j - 1 });
            j--;
        } else {
            ops.push({ type: "delete", lineA: i - 1 });
            i--;
        }
    }
    ops.reverse();
    return ops;
}

function _cmpEscHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _cmpBuildScriptDiff(key, scriptA, scriptC) {
    let linesA = _cmpSplitScript(scriptA);
    let linesC = _cmpSplitScript(scriptC);
    let ops = _cmpLcsDiff(linesA, linesC);

    let anyChanged = false;
    let rowsHtml = "";
    let CONTEXT = 3;

    let changedIdx = new Set();
    for (let k = 0; k < ops.length; k++) {
        if (ops[k].type !== "equal") {
            for (let c = Math.max(0, k - CONTEXT); c <= Math.min(ops.length - 1, k + CONTEXT); c++) {
                changedIdx.add(c);
            }
        }
    }

    let numS = "padding:2px 8px 2px 6px;color:#555;text-align:right;user-select:none;width:45px;min-width:45px;font-size:13px;font-family:Consolas,monospace;vertical-align:top;border-right:1px solid #333;";
    let codeS = "padding:2px 10px;font-size:13px;font-family:Consolas,'Courier New',monospace;color:#c9d1d9;white-space:pre-wrap;word-wrap:break-word;vertical-align:top;text-align:left;";
    let lastShown = -1;

    for (let k = 0; k < ops.length; k++) {
        if (!changedIdx.has(k)) continue;

        if (lastShown !== -1 && k > lastShown + 1) {
            let skipped = k - lastShown - 1;
            rowsHtml +=
                '<tr data-changed="0"><td colspan="4" style="padding:4px 12px;text-align:center;color:#555;font-size:11px;background:#161b22;border-top:1px solid #333;border-bottom:1px solid #333;">··· ' +
                skipped +
                " linhas iguais ocultas ···</td></tr>";
        }
        lastShown = k;

        let op = ops[k];
        if (op.type === "equal") {
            let numA = op.lineA + 1;
            let numB = op.lineB + 1;
            let line = linesA[op.lineA];
            rowsHtml +=
                '<tr data-changed="0">' +
                '<td style="' +
                numS +
                '">' +
                numA +
                "</td>" +
                '<td style="' +
                numS +
                '">' +
                numB +
                "</td>" +
                '<td style="padding:0 8px 0 4px;color:#555;font-size:13px;font-family:Consolas,monospace;vertical-align:top;width:16px;min-width:16px;user-select:none;"> </td>' +
                '<td style="' +
                codeS +
                '">' +
                _cmpEscHtml(line) +
                "</td></tr>";
        } else if (op.type === "delete") {
            anyChanged = true;
            let numA = op.lineA + 1;
            let bgDel = "background:rgba(248,81,73,0.18);";
            rowsHtml +=
                '<tr data-changed="1">' +
                '<td style="' +
                numS +
                bgDel +
                '">' +
                numA +
                "</td>" +
                '<td style="' +
                numS +
                bgDel +
                '"></td>' +
                '<td style="padding:0 8px 0 4px;color:#f85149;font-size:13px;font-family:Consolas,monospace;font-weight:700;vertical-align:top;width:16px;min-width:16px;user-select:none;' +
                bgDel +
                '">−</td>' +
                '<td style="' +
                codeS +
                bgDel +
                '">' +
                _cmpEscHtml(linesA[op.lineA]) +
                "</td></tr>";
        } else if (op.type === "insert") {
            anyChanged = true;
            let numB = op.lineB + 1;
            let bgIns = "background:rgba(63,185,80,0.18);";
            rowsHtml +=
                '<tr data-changed="1">' +
                '<td style="' +
                numS +
                bgIns +
                '"></td>' +
                '<td style="' +
                numS +
                bgIns +
                '">' +
                numB +
                "</td>" +
                '<td style="padding:0 8px 0 4px;color:#3fb950;font-size:13px;font-family:Consolas,monospace;font-weight:700;vertical-align:top;width:16px;min-width:16px;user-select:none;' +
                bgIns +
                '">+</td>' +
                '<td style="' +
                codeS +
                bgIns +
                '">' +
                _cmpEscHtml(linesC[op.lineB]) +
                "</td></tr>";
        }
    }

    let totalOps = ops.length;
    let shownOps = changedIdx.size;
    let hiddenAfter = totalOps - (lastShown + 1);
    if (hiddenAfter > 0 && shownOps < totalOps) {
        if (!anyChanged) {
            for (let k = 0; k < ops.length; k++) {
                let op = ops[k];
                let numA = op.lineA !== undefined ? op.lineA + 1 : "";
                let numB = op.lineB !== undefined ? op.lineB + 1 : "";
                let line = op.lineA !== undefined ? linesA[op.lineA] : op.lineB !== undefined ? linesC[op.lineB] : "";
                rowsHtml +=
                    '<tr data-changed="0">' +
                    '<td style="' +
                    numS +
                    '">' +
                    numA +
                    "</td>" +
                    '<td style="' +
                    numS +
                    '">' +
                    numB +
                    "</td>" +
                    '<td style="padding:0 8px 0 4px;color:#555;font-size:13px;font-family:Consolas,monospace;vertical-align:top;width:16px;min-width:16px;user-select:none;"> </td>' +
                    '<td style="' +
                    codeS +
                    '">' +
                    _cmpEscHtml(line) +
                    "</td></tr>";
            }
        } else {
            rowsHtml +=
                '<tr data-changed="0"><td colspan="4" style="padding:4px 12px;text-align:center;color:#555;font-size:11px;background:#161b22;border-top:1px solid #333;">··· ' +
                hiddenAfter +
                " linhas iguais ocultas ···</td></tr>";
        }
    }

    let delCount = ops.filter((o) => o.type === "delete").length;
    let insCount = ops.filter((o) => o.type === "insert").length;
    let badge = anyChanged ? '<span style="color:#e74c3c;font-weight:700;margin-left:6px;">●</span>' : "";
    let statsHtml = "";
    if (anyChanged) {
        let parts = [];
        if (delCount > 0) parts.push('<span style="color:#f85149;">−' + delCount + "</span>");
        if (insCount > 0) parts.push('<span style="color:#3fb950;">+' + insCount + "</span>");
        statsHtml = ' <span style="font-size:11px;font-weight:400;">(' + parts.join(" ") + ")</span>";
    }
    let header =
        '<tr data-changed="' +
        (anyChanged ? "1" : "0") +
        '" style="background:#0d1117;border-left:3px solid #c9a0dc;">' +
        '<td colspan="3" style="padding:10px 12px;font-family:monospace;font-size:13px;color:#c9a0dc;font-weight:700;cursor:pointer;" class="cmp-field-name" data-field="' +
        _cmpEscHtml(key) +
        '">' +
        _cmpEscHtml(key) +
        " (script — " +
        linesA.length +
        "→" +
        linesC.length +
        " linhas)" +
        statsHtml +
        badge +
        "</td></tr>";
    let content =
        '<tr data-changed="' +
        (anyChanged ? "1" : "0") +
        '"><td colspan="3" style="padding:0;">' +
        '<table style="width:100%;border-collapse:collapse;background:#0d1117;text-align:left;">' +
        '<colgroup><col style="width:45px"><col style="width:45px"><col style="width:16px"><col></colgroup>' +
        "<thead><tr>" +
        '<th style="padding:6px 8px;text-align:right;font-size:11px;color:#f85149;border-right:1px solid #333;border-bottom:1px solid #333;">ant</th>' +
        '<th style="padding:6px 8px;text-align:right;font-size:11px;color:#3fb950;border-right:1px solid #333;border-bottom:1px solid #333;">atual</th>' +
        '<th style="border-bottom:1px solid #333;"></th>' +
        '<th style="padding:6px 10px;text-align:left;font-size:12px;color:#888;border-bottom:1px solid #333;">código</th>' +
        "</tr></thead>" +
        "<tbody>" +
        rowsHtml +
        "</tbody></table></td></tr>";
    return { changed: anyChanged, html: header + content };
}
