(() => {
  async function request(path, options = {}) {
    const baseUrl = window.appConfig.api.baseUrl.replace(/\/$/, "");
    const response = await fetch(baseUrl + path, options);

    if (!response.ok) {
      throw new Error("GWTP API request failed with status " + response.status + ".");
    }

    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : response.text();
  }

  function healthCheck() {
    return request("/api/health");
  }

  window.apiService = Object.freeze({ request, healthCheck });
})();
