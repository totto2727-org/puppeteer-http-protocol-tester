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
    } catch {}
    await fs.mkdir(`${LOG_DIR}/${protocol}-har`, { recursive: true });

    try {
      await fs.rm(`${LOG_DIR}/${protocol}-performances`, { recursive: true });
    } catch {}
    await fs.mkdir(`${LOG_DIR}/${protocol}-performances`, { recursive: true });

    try {
      await fs.rm(`${LOG_DIR}/${protocol}-netlog`, { recursive: true });
    } catch {}
    await fs.mkdir(`${LOG_DIR}/${protocol}-netlog`, { recursive: true });

    const wg = new WaitGroup({ waitIntervalMilli: DELAY });

    for (const n of [...Array(REQUEST_TIMES).keys()]) {
      const args = [
        "--disable-setuid-sandbox",
        "--log-net-log=" + `${LOG_DIR}/${protocol}-netlog/${n}.json`,
        "--net-log-capture-mode=Everything",
      ];
      if (protocol === "h3") {
        args.push("--enable-quic");
        args.push("--origin-to-force-quic-on=" + BASE_DOMAIN + ":443");
      }
      console.info(args);

      wg.add();

      await wg.wait(MAX_CONCURRENT);
      console.log(wg.getWaitNumber(), n);

      runTest(LOG_DIR, protocol, n, args);

      wg.done();
    }

    await wg.wait();

    await sleep(TEST_INTERVAL);
  }
}

async function runTest(
  logDir: string,
  protocol: string,
  n: number,
  args: string[],
) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args,
  });

  const { har, performances } = await newPage(browser, n);

  await browser.close();

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
  const page = await browser.newPage();

  await sleep(1000);

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

  return {
    har,
    performances,
  };
}
