(() => {
  window.appConfig = Object.freeze({
    language: "he",
    api: Object.freeze({
      baseUrl: "http://localhost:5000"
    }),
    authentication: Object.freeze({
      iterations: 100000,
      credentials: Object.freeze({
        editor: Object.freeze({
          salt: "9ab122a913fe3abf125a7579e532e0a0",
          hash: "7b0d0e372c334b822bfa3bc5b54c781b9495850b4698e4761c86fa8e60d05e39"
        }),
        learner: Object.freeze({
          salt: "7fa3518d23d085b9470438096f4ed9de",
          hash: "c1e78be90680d5e949b398de2c746dbd49e4d97d30d25d361f51e4d645af89bb"
        })
      })
    })
  });
})();
