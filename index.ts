import * as fs from "fs/promises";
import puppeteer, { Browser } from "puppeteer-core";
import PuppeteerHar from "puppeteer-har";

import settings_ from "./settings.js";
import { WaitGroup } from "./src/WaitGroup.js";
import { settingsSchema } from "./src/settingsSchema.js";

const settings = settingsSchema.parse(settings_);
console.log(settings);

const { env, test } = settings;
const { BASE_DOMAIN, CHROMIUM_PATH, LOG_DIR } = env;
const { DELAY, HTTP_PROTOCOLS, MAX_CONCURRENT, REQUEST_TIMES, TIMEOUT } = test;

const url = "https://" + BASE_DOMAIN;

await runTests();

async function runTests() {
  const now = new Date(Date.now()).toISOString();

  for (const protocol of HTTP_PROTOCOLS) {
    const logDir = `${LOG_DIR}/${now}/${protocol}`;
    await fs.mkdir(logDir, { recursive: true });

    const args = [
      "--disable-setuid-sandbox",
      "--log-net-log=" + logDir + "/netlog.json",
      "--net-log-capture-mode=Everything",
    ];

    if (protocol === "h3") {
      args.push("--enable-quic");
      args.push("--origin-to-force-quic-on=" + BASE_DOMAIN + ":443");
    }
    console.info(args);

    const browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      args,
    });
    console.log("launched brouser");

    const wg = new WaitGroup({ waitIntervalMilli: DELAY });

    for (const n of [...Array(REQUEST_TIMES).keys()]) {
      await wg.wait(MAX_CONCURRENT);
      wg.add();
      console.log(wg.getWaitNumber(), n);
      runTest(wg, browser, logDir, n);
    }

    await wg.wait();

    await browser.close();
  }
}

async function runTest(wg: WaitGroup, browser: Browser, logDir: string, n = 0) {
  const log = await newPage(browser);
  await fs.writeFile(`${logDir}/${n}.json`, JSON.stringify({ number: n, log }));
  wg.done();
}

async function newPage(browser: Browser) {
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);

  const getHar = new PuppeteerHar(page);
  await getHar.start();

  try {
    await page.goto(url);
  } catch (e) {
    console.error(e);
  }

  const performances = JSON.parse(
    await page.evaluate(() =>
      //@ts-ignore
      JSON.stringify(performance.getEntriesByType("navigation"))
    )
  );

  const har = await getHar.stop();

  await page.close();

  return {
    har,
    performances,
  };
}
