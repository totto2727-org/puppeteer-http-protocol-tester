import * as fs from "fs/promises";
import puppeteer, { Browser } from "puppeteer-core";
import PuppeteerHar from "puppeteer-har";
import * as path from "path";

import setting from "../setting.json" assert { type: "json" };
import { sleep, WaitGroup } from "./src/WaitGroup.js";

const { env, test } = setting;
const { BASE_DOMAIN, PATH, CHROMIUM_PATH, LOG_DIR: LOG_DIR_ } = env;
const {
  DELAY,
  TEST_INTERVAL,
  HTTP_PROTOCOLS,
  MAX_CONCURRENT,
  REQUEST_TIMES,
  TIMEOUT,
  REUSE,
  LAUNCH_DELAY,
} = test;

const LOG_DIR = path.isAbsolute(LOG_DIR_)
  ? LOG_DIR_
  : path.resolve(path.join("..", LOG_DIR_));
console.info(LOG_DIR);

const url = "https://" + BASE_DOMAIN + "/" + PATH;
console.info(url);

await runTests();

async function runTests(): Promise<void> {
  for (const protocol of HTTP_PROTOCOLS) {
    try {
      await fs.rm(`${LOG_DIR}/${protocol}-har`, { recursive: true });
    } catch { }
    await fs.mkdir(`${LOG_DIR}/${protocol}-har`, { recursive: true });

    try {
      await fs.rm(`${LOG_DIR}/${protocol}-performances`, { recursive: true });
    } catch { }
    await fs.mkdir(`${LOG_DIR}/${protocol}-performances`, { recursive: true });

    try {
      await fs.rm(`${LOG_DIR}/${protocol}-netlog`, { recursive: true });
    } catch { }
    await fs.mkdir(`${LOG_DIR}/${protocol}-netlog`, { recursive: true });

    const wg = new WaitGroup({ waitIntervalMilli: DELAY });

    const args = [
      "--disable-setuid-sandbox",
      "--net-log-capture-mode=Everything",
    ];
    if (protocol === "h3") {
      args.push("--enable-quic");
      args.push("--origin-to-force-quic-on=" + BASE_DOMAIN + ":443");
    }

    const browser = REUSE
      ? await puppeteer.launch({
        executablePath: CHROMIUM_PATH,
        args,
      })
      : undefined;
    REUSE && await sleep(LAUNCH_DELAY);

    for (const n of [...Array(REQUEST_TIMES).keys()]) {
      const args = [
        "--disable-setuid-sandbox",
        "--log-net-log=" + `${LOG_DIR}/${protocol}-netlog/${n}.json`,
        "--net-log-capture-mode=Everything",
        "--disable-gpu",
      ];
      if (protocol === "h3") {
        args.push("--enable-quic");
        args.push("--origin-to-force-quic-on=" + BASE_DOMAIN + ":443");
      }
      await wg.wait(MAX_CONCURRENT);

      wg.add();

      console.log(wg.getWaitNumber(), n);

      runTest(
        wg,
        LOG_DIR,
        protocol,
        n,
        args,
        browser,
      );
    }

    await wg.wait();

    REUSE && browser && await browser.close();
    await sleep(TEST_INTERVAL);
  }
}

async function runTest(
  wg: WaitGroup,
  logDir: string,
  protocol: string,
  n: number,
  args: string[],
  browser_?: Browser,
) {
  const browser = browser_ || await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args,
  });

  const { har, performances } = await newPage(browser, n);

  REUSE || await browser.close();
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

async function newPage(browser: Browser, n: number) {
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  const client = await page.target().createCDPSession();
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 20,
    downloadThroughput: 10 * 1024 * 1024 / 8,
    uploadThroughput: 10 * 1024 * 1024 / 8,
  });

  const getHar = new PuppeteerHar(page);
  await getHar.start();

  try {
    await page.goto(url, { waitUntil: "load", timeout: TIMEOUT });
  } catch (e) {
    console.error(`${n} ${JSON.stringify(e)}`);
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
  await context.close();

  return {
    har,
    performances,
  };
}
