import * as fs from "fs/promises";
import puppeteer, { Browser } from "puppeteer-core";
import PuppeteerHar from "puppeteer-har";
import * as path from "path";

import setting from "../setting.json" assert { type: "json" };
import { sleep, WaitGroup } from "./src/WaitGroup.js";

// 設定値
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
  BROWSER_SESSIONS,
} = test;

// ログのパスの算出
const LOG_DIR = path.isAbsolute(LOG_DIR_)
  ? LOG_DIR_
  : path.resolve(path.join("..", LOG_DIR_));
console.info(LOG_DIR);

const url = "https://" + BASE_DOMAIN + "/" + PATH;
console.info(url);

// テストの実行
await runTests();

async function runTests(): Promise<void> {
  // プロトコルごとの実行
  for (const protocol of HTTP_PROTOCOLS) {
    console.log(`${protocol} start`);

    // ログディレクトリの初期化
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

    const args_base = [
      "--disable-setuid-sandbox",
      "--disable-gpu",
    ];
    if (protocol === "h3") {
      args_base.push("--enable-quic");
      args_base.push("--origin-to-force-quic-on=" + BASE_DOMAIN + ":443");
    }
    if (REUSE) {
      args_base.push("--net-log-capture-mode=Everything");
    }

    /*
     * REUSEが真の時事前に生成したブラウザセッションを利用する(並列実行数はブラウザで等分)
     * REUSEが偽の時並列数までブラウザを同時に起動する
     */
    const browsers: Browser[] = [];
    if (REUSE) {
      for (const _ of [...Array(BROWSER_SESSIONS).keys()]) {
        const args = [
          ...args_base,
        ];

        const browser = await puppeteer.launch({
          executablePath: CHROMIUM_PATH,
          args,
        });
        browsers.push(browser);
        await sleep(LAUNCH_DELAY);
      }
    }

    // 目標回数まで計測
    for (const n of [...Array(REQUEST_TIMES).keys()]) {
      // 並列数を監視して待機
      await wg.wait(MAX_CONCURRENT);

      // 実行前に並列数の加算
      wg.add();
      console.log(wg.getWaitNumber(), n);

      const args = [
        ...args_base,
        "--log-net-log=" + `${LOG_DIR}/${protocol}-netlog/${n}.json`,
      ];
      // 再利用しないならば生成
      const browser = REUSE
        ? browsers[n % BROWSER_SESSIONS]
        : await puppeteer.launch({
          executablePath: CHROMIUM_PATH,
          args,
        });
      if (!REUSE) {
        await sleep(LAUNCH_DELAY);
      }

      runTest(
        wg,
        browser,
        REUSE,
        LOG_DIR,
        protocol,
        n,
      );
      // 1プロトコルのテスト終了
    }

    // 全て完了するまで待機
    await wg.wait();

    // 起動しているブラウザの終了
    if (REUSE) {
      for (const browser of browsers) {
        browser.close();
      }
    }

    console.info(`${protocol} finish`);
    // プロトコル間の待機時間
    await sleep(TEST_INTERVAL);
  }
}

async function runTest(
  wg: WaitGroup,
  browser: Browser,
  isBrowserReuse: boolean,
  logDir: string,
  protocol: string,
  n: number,
) {
  const { har, performances } = await newPage(browser, n);

  if (!isBrowserReuse) {
    await browser.close();
  }

  // 並列数の削減
  wg.done();

  // 結果の書き込み
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
  // プライベートなセッションの作成
  const context = await browser.createIncognitoBrowserContext();

  // 新規タブの生成
  const page = await context.newPage();

  // Dev Toolsの起動
  const client = await page.target().createCDPSession();
  // 通信速度の制限
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 20, // 20ms
    downloadThroughput: 10 * 1024 * 1024 / 8, // 10Mbps
    uploadThroughput: 10 * 1024 * 1024 / 8, // 10Mbps
  });

  // harファイルの設定
  const getHar = new PuppeteerHar(page);
  await getHar.start();

  // ページ遷移
  try {
    await page.goto(url, { waitUntil: "load", timeout: TIMEOUT });
  } catch (e) {
    console.error(`${n} ${JSON.stringify(e)}`);
  }

  // パフォーマンスAPIの実行
  const performances = JSON.parse(
    await page.evaluate(() =>
      JSON.stringify({
        start: performance.timeOrigin,
        entries: performance.getEntriesByType("navigation").concat(
          performance.getEntriesByType("resource"),
        ),
      })
    ),
  );

  const har = await getHar.stop();

  // セッションの終了(メモリリークの原因となるため必須)
  await page.close();
  await context.close();

  return {
    har,
    performances,
  };
}
