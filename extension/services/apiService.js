(() => {
  class ApiError extends Error {
    constructor(message, status = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  async function request(path, options = {}) {
    const baseUrl = window.appConfig.api.baseUrl.replace(/\/$/, "");
    let response;

    try {
      response = await fetch(baseUrl + path, options);
    } catch (error) {
      throw new ApiError("GWTP API is unavailable.");
    }

    if (!response.ok) {
      throw new ApiError(
        "GWTP API request failed with status " + response.status + ".",
        response.status
      );
    }

    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : response.text();
  }

  function healthCheck() {
    return request("/api/health");
  }

  window.apiService = Object.freeze({ request, healthCheck, ApiError });
})();
