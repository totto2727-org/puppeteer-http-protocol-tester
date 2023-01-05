import h2Performances from "../log/h2-performances.json" assert {
  type: "json",
};
import h2Har from "../log/h2-har.json" assert {
  type: "json",
};
import h3Performances from "../log/h3-performances.json" assert {
  type: "json",
};
import h3Har from "../log/h3-har.json" assert {
  type: "json",
};
import setting from "../setting.json" assert { type: "json" };
import * as path from "https://deno.land/std@0.170.0/path/mod.ts";

const preprocessingData = (
  performnces: typeof h2Performances,
  har: typeof h2Har,
) => {
  const statusMap = new Map<string, number>();

  har.forEach(({ number, har }) =>
    har.log.entries.map(({ request: { url }, response: { status } }) => {
      statusMap.set(number + url, status);
    })
  );

  return performnces.flatMap((p) =>
    p.entries.map((e) => {
      return {
        n: p.number,
        protocol: e.nextHopProtocol,
        url: e.name,
        status: statusMap.get(p.number + e.name) ?? 404,
        baseUnixTime: Math.floor(p.start),
        startMili: Math.floor(e.connectStart),
        endMili: Math.floor(e.responseEnd),
        durationMili: Math.floor(e.responseEnd - e.connectStart),
      };
    })
  );
};

const LOG_DIR = path.isAbsolute(setting.env.LOG_DIR)
  ? setting.env.LOG_DIR
  : path.resolve(setting.env.LOG_DIR);

console.info(LOG_DIR);

const h2Json = preprocessingData(h2Performances, h2Har);
await Deno.writeTextFile(
  `${LOG_DIR}/h2-performances-processed.json`,
  JSON.stringify(h2Json),
);

const h3Json = preprocessingData(h3Performances, h3Har);
await Deno.writeTextFile(
  `${LOG_DIR}/h3-performances-prosessed.json`,
  JSON.stringify(h3Json),
);
