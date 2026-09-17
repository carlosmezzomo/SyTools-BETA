function loadClassTree() {
    let _tk = getSydleToken();
    if (!_tk.token) return;
    let token = _tk.token;
    let ns = getSydleApiNamespace();
    try {
        $.ajax(`/api/1/${ns}/_system/_workspace/getClassList?accessToken=${token}&_body=%7B%22_id%22%3A%22000000000000000000000053%22%2C%22viewId%22%3A%22000000000000000000000049%22%7D`)
        .done(function (response) {
            let classTree = response.result;
            localStorage.setItem('classTree', JSON.stringify(classTree));
        });
    }
    catch(error) {}
}
