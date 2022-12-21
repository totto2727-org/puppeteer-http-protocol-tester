export default {
  env: {
    BASE_DOMAIN: "quic.totto.page",
    LOG_DIR: "./log",
    CHROMIUM_PATH: "/usr/bin/google-chrome",
  },
  test: {
    HTTP_PROTOCOLS: ["h2", "h3"],
    TIMEOUT: 5000,
    DELAY: 10,
    REQUEST_TIMES: 100,
    MAX_CONCURRENT: 20,
  },
};
