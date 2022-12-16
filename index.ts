import * as fs from "fs/promises";
import puppeteer, {
  Browser,
} from "puppeteer-core";
import PuppeteerHar from 'puppeteer-har';
import { WaitGroup } from "./WaitGroup.js";

const domain = "quic.totto.page";
const url = "https://" + domain;
const LOG_DIR = "./log";
const protocol = "h3";
const executablePath = "/usr/bin/google-chrome";

const now = new Date(Date.now()).toISOString();
const logDir = `${LOG_DIR}/${protocol}-${now}`;

const args = [
  "--disable-setuid-sandbox",
  "--log-net-log=" + logDir + "/netlog.json",
  "--net-log-capture-mode=Everything",
];

if (protocol === "h3") {
  args.push("--enable-quic");
  args.push("--origin-to-force-quic-on=" + domain + ":443");
}

const timeout = 5000;
const delay = 1000;
const times = 100;
const parallel = 20;

console.info({ domain, url });
console.info(args);
console.info({ timeout, delay });
console.info({ times, parallel });

await runTests();

async function runTests() {
  await fs.mkdir(logDir, { recursive: true });

  const browser = await puppeteer.launch({ executablePath, args });
  console.log("launched brouser");

  const wg = new WaitGroup();

  for (const n of [...Array(times).keys()]) {
    await wg.wait(parallel);
    wg.add();
    console.log(wg.getWaitNumber(), n);
    runTest(wg, browser, n);
  }

  await wg.wait();

  await browser.close();
}

async function runTest(wg: WaitGroup, browser: Browser, n = 0) {
  const log = await newPage(browser);
  await fs.writeFile(
    `${logDir}/${n}.json`,
    JSON.stringify({ number: n, log }),
  );
  wg.done();
}

async function newPage(browser: Browser) {
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);

  const getHar = new PuppeteerHar(page);
  await getHar.start();

  try {
    await page.goto(url);
  } catch (e) {
    console.error(e);
  }

  const performances = JSON.parse(
    await page.evaluate(() =>
      JSON.stringify(performance.getEntriesByType("navigation"))
    ),
  );

  const har = await getHar.stop();

  await page.close();

  return {
    har,
    performances,
  };
}
