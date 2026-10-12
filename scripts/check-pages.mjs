import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import vm from "node:vm";
import { templates } from "../lib/templates.ts";

const output = new URL("../dist-pages/", import.meta.url);
const html = await readFile(new URL("index.html", output), "utf8");
const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
assert(assetPaths.length >= 3, "Expected JavaScript, CSS and favicon links");
for (const path of assetPaths) {
  assert(path.startsWith("/copperpilot/"), `Incorrect GitHub Pages asset path: ${path}`);
  assert((await stat(new URL(path.slice("/copperpilot/".length), output))).isFile());
}

// Exercise the production compiler with Web Worker globals and no Node APIs.
// This catches missing browser globals and accidental network dependencies.
// It does not replace full browser interaction testing.
const assets = new URL("assets/", output);
const worker = (await readdir(assets)).find(name => /^circuit\.worker-.*\.js$/.test(name));
assert(worker, "The circuit worker was not included in the Pages build");
let deliver;
const result = new Promise(resolve => { deliver = resolve; });
const context = vm.createContext({
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  TextEncoder, TextDecoder, URL, URLSearchParams, Blob, AbortController, AbortSignal,
  performance, structuredClone, crypto: globalThis.crypto,
  fetch: () => { throw new Error("The local compiler attempted a network request"); },
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  postMessage: deliver,
});
context.self = context;
try {
  vm.runInContext(await readFile(new URL(worker, assets), "utf8"), context, { timeout: 20000 });
} catch (error) {
  throw new Error(`Production worker initialization failed: ${error.message}`);
}
const timeout = setTimeout(() => {
  console.error("The production circuit worker exceeded 45 seconds");
  process.exit(1);
}, 45000);
try {
  await context.onmessage({ data: templates[0].design });
  const message = await result;
  assert(!message.error, message.error);
  assert(!message.result.issues.some(issue => issue.level === "error"));
  assert(message.result.traceCount >= templates[0].design.connections.length);
  assert(Object.keys(message.result.gerbers).length > 0);
  console.log(`GitHub Pages assets verified; production worker generated ${message.result.traceCount} PCB traces and ${Object.keys(message.result.gerbers).length} fabrication files without network access.`);
} finally {
  clearTimeout(timeout);
}
