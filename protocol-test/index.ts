import * as fs from "fs/promises";
import puppeteer, { Browser } from "puppeteer-core";
import PuppeteerHar from "puppeteer-har";
import * as path from "path";

import setting from "../setting.json" assert { type: "json" };
import { sleep, WaitGroup } from "./src/WaitGroup.js";

const { env, test } = setting;
const { BASE_DOMAIN, CHROMIUM_PATH, LOG_DIR: LOG_DIR_ } = env;
const {
  DELAY,
  TEST_INTERVAL,
  HTTP_PROTOCOLS,
  MAX_CONCURRENT,
  REQUEST_TIMES,
  TIMEOUT,
} = test;

const LOG_DIR = path.isAbsolute(LOG_DIR_)
  ? LOG_DIR_
  : path.resolve(path.join("..", LOG_DIR_));
console.info(LOG_DIR);

const url = "https://" + BASE_DOMAIN;
console.info(url);

await runTests();

async function runTests(): Promise<void> {
  for (const protocol of HTTP_PROTOCOLS) {
    await fs.mkdir(`${LOG_DIR}/${protocol}-har`, { recursive: true });
    await fs.mkdir(`${LOG_DIR}/${protocol}-performances`, { recursive: true });

    const args = [
      "--disable-setuid-sandbox",
      "--log-net-log=" + `${LOG_DIR}/${protocol}-netlog.json`,
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
      runTest(wg, browser, LOG_DIR, protocol, n);
    }

    await wg.wait();

    await browser.close();

    await sleep(TEST_INTERVAL);
  }
}

async function runTest(
  wg: WaitGroup,
  browser: Browser,
  logDir: string,
  protocol: string,
  n = 0,
) {
  const { har, performances } = await newPage(browser);
  wg.done();
  await fs.writeFile(
    `${logDir}/${protocol}-har/${n}.json`,
    JSON.stringify({ number: n, har }),
  );
  await fs.writeFile(
    `${logDir}/${protocol}-performances/${n}.json`,
    JSON.stringify({ number: n, ...performances }),
  );
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
      JSON.stringify({
        start: performance.timeOrigin,
        entries: performance.getEntriesByType("navigation").concat(
          performance.getEntriesByType("resource"),
        ),
      })
    ),
  );

  const har = await getHar.stop();

  await page.close();

  return {
    har,
    performances,
  };
}
