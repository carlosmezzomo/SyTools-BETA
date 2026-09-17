(function () {
    "use strict";

    function temTypeScript() {
        return typeof ts !== "undefined" && ts && typeof ts.createSourceFile === "function";
    }

    var TRADUCOES = [
        [/^Identifier expected\.?$/, "Esperado um nome aqui"],
        [/^'(.+)' expected\.?$/, function (m) { return 'Esperado "' + m[1] + '" aqui'; }],
        [/^Declaration or statement expected\.?$/, "Esperado uma declaração ou comando"],
        [/^Expression expected\.?$/, "Esperado uma expressão"],
        [/^Argument expression expected\.?$/, "Esperado um argumento"],
        [/^Property or signature expected\.?$/, "Esperado uma propriedade"],
        [/^Property assignment expected\.?$/, "Esperado uma propriedade"],
        [/^Variable declaration expected\.?$/, "Esperado uma declaração de variável"],
        [/^Statement expected\.?$/, "Esperado um comando"],
        [/^Unterminated string literal\.?$/, "String não fechada"],
        [/^Unterminated template literal\.?$/, "Template literal não fechado"],
        [/^Unterminated regular expression literal\.?$/, "Expressão regular não fechada"],
        [/^\*\/' expected\.?$/, "Comentário de bloco não fechado"],
        [/^Invalid character\.?$/, "Caractere inválido"],
        [/^Unexpected token\.?$/, "Token inesperado aqui"],
        [/^Unexpected token\. Did you mean/, "Token inesperado aqui"],
        [/^Trailing comma not allowed\.?$/, "Vírgula sobrando"],
        [/^Digit expected\.?$/, "Esperado um dígito"],
        [/^Hexadecimal digit expected\.?$/, "Esperado um dígito hexadecimal"],
        [/^Cannot redeclare block-scoped variable '(.+)'\.?$/, function (m) { return 'Variável "' + m[1] + '" já declarada'; }],
        [/^Declaration expected\.?$/, "Esperado uma declaração"],
        [/^Expected corresponding JSX closing tag/, "Tag JSX sem fechamento"],
        [/^'\)' expected\.?$/, 'Esperado ")" aqui']
    ];

    function traduzir(msg) {
        for (var i = 0; i < TRADUCOES.length; i++) {
            var achado = TRADUCOES[i][0].exec(msg);
            if (achado) {
                var alvo = TRADUCOES[i][1];
                return typeof alvo === "function" ? alvo(achado) : alvo;
            }
        }
        return msg;
    }

    function comprimento(diag, texto) {
        var n = typeof diag.length === "number" ? diag.length : 0;
        if (n > 0) return Math.min(n, 60);
        var resto = texto.slice(diag.start);
        var palavra = resto.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
        return palavra ? palavra[0].length : 1;
    }

    var MAX_PROBLEMAS = 200;

    function analisarTodos(code) {
        if (!code || !code.trim()) return [];
        if (!temTypeScript()) return null;

        var sf = ts.createSourceFile("script.js", code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
        var diags = sf.parseDiagnostics || [];
        var problemas = [];

        for (var i = 0; i < diags.length && problemas.length < MAX_PROBLEMAS; i++) {
            var d = diags[i];
            if (typeof d.start !== "number") continue;

            var bruta = ts.flattenDiagnosticMessageText(d.messageText, " ");
            var lc = sf.getLineAndCharacterOfPosition(d.start);
            var codigo = d.code ? "ts(" + d.code + ")" : "";

            var matchToken = /^'(.+)' expected\.?$/.exec(bruta);

            problemas.push({
                line: lc.line + 1,
                column: lc.character,
                length: comprimento(d, code),
                message: traduzir(bruta),
                detail: bruta + (codigo ? " " + codigo : ""),
                code: d.code || 0,
                quickFixToken: d.code === 1005 && matchToken ? matchToken[1] : null
            });
        }
        return problemas;
    }

    function temPrettier() {
        return (
            typeof prettier !== "undefined" &&
            prettier &&
            typeof prettier.format === "function" &&
            typeof prettierPlugins !== "undefined" &&
            prettierPlugins &&
            prettierPlugins.babel &&
            prettierPlugins.estree
        );
    }

    async function formatarCodigo(code, opcoes) {
        if (!temPrettier()) return { ok: false, erro: "Prettier indisponível nesta sessão." };
        try {
            var formatado = await prettier.format(code, {
                parser: "babel",
                plugins: [prettierPlugins.babel, prettierPlugins.estree],
                semi: (opcoes && opcoes.semi) !== false,
                singleQuote: !!(opcoes && opcoes.singleQuote),
                tabWidth: (opcoes && opcoes.tabWidth) || 4,
                printWidth: (opcoes && opcoes.printWidth) || 120
            });
            return { ok: true, code: formatado };
        } catch (e) {
            return { ok: false, erro: e && e.message ? String(e.message).split("\n")[0] : "Erro ao formatar" };
        }
    }

    window.addEventListener("message", function (event) {
        var data = event.data;
        if (!data || typeof data !== "object" || typeof data.__sytools !== "string") return;
        var destino = event.source || window.parent;

        if (data.__sytools === "lint") {
            var resultado;
            try {
                resultado = analisarTodos(String(data.code == null ? "" : data.code));
            } catch (e) {
                resultado = null;
            }

            destino.postMessage({ __sytools: "lint-result", id: data.id, result: resultado }, "*");
            return;
        }

        if (data.__sytools === "format") {
            formatarCodigo(String(data.code == null ? "" : data.code), data.options)
                .then(function (r) {
                    destino.postMessage({ __sytools: "format-result", id: data.id, ok: r.ok, code: r.code, erro: r.erro }, "*");
                })
                .catch(function () {
                    destino.postMessage({ __sytools: "format-result", id: data.id, ok: false, erro: "Erro inesperado ao formatar" }, "*");
                });
            return;
        }
    });

    window.parent.postMessage({ __sytools: "lint-ready" }, "*");
})();
