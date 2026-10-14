import { test } from "node:test";
import { PNG } from "pngjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import {
  decodePixels,
  confirmationGate,
  validResults,
  scanRegion,
  readerOptions,
  cameraConstraints,
  stopStream,
  tuneCamera,
} from "../src/lib/scanner.js";
import { apiBaseUrl } from "../src/lib/api-url.js";

await prepareZXingModule({
  overrides: {
    wasmBinary: new Uint8Array(
      await readFile(
        new URL(
          "../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
          import.meta.url,
        ),
      ),
    ),
  },
  fireImmediately: true,
});
const fixtures = JSON.parse(
  await readFile(new URL("./fixtures/manifest.json", import.meta.url)),
);
for (const fixture of fixtures) {
  test(`decodes independent fixture: ${fixture.file}`, async () => {
    const bytes = await readFile(
      new URL(`./fixtures/${fixture.file}`, import.meta.url),
    );
    const png = PNG.sync.read(bytes);
    const image = {
      data: new Uint8ClampedArray(png.data),
      width: png.width,
      height: png.height,
    };
    const results = await decodePixels(image, "auto", readBarcodes);
    if (fixture.texts) {
      assert.deepEqual(
        results.map((r) => r.text).sort(),
        fixture.texts.toSorted(),
      );
      assert.equal(confirmationGate().observe(results, 0).ambiguous, true);
      return;
    }
    if (fixture.text === null) return assert.equal(results.length, 0);
    assert.ok(
      results.some((r) => r.isValid && r.text === fixture.text),
      JSON.stringify(results.map((r) => ({ text: r.text, format: r.format }))),
    );
    // Fixtures record the decoder convention for UPC-A (EAN13 with leading zero).
  });
}
const result = (text, format = "Code128") => ({ text, format, isValid: true });
test("confirms only consistent reads and resets on missing, changing, ambiguous or old candidates", () => {
  const gate = confirmationGate();
  assert.equal(gate.observe([result("00123")], 0).count, 1);
  assert.equal(gate.observe([result("00123")], 125).count, 2);
  assert.equal(gate.observe([result("00123")], 250).result.text, "00123");
  gate.observe([], 400);
  assert.equal(gate.observe([result("00123")], 500).count, 1);
  assert.equal(gate.observe([result("other")], 600).count, 1);
  assert.equal(
    gate.observe([result("other"), result("second")], 700).ambiguous,
    true,
  );
  assert.equal(gate.observe([result("other")], 800).count, 1);
  assert.equal(gate.observe([result("other")], 7000).count, 1);
});
test("rejects invalid/checksum-error/control payloads and preserves leading zeros", () => {
  assert.deepEqual(
    validResults([
      result("00123"),
      result("00123"),
      result("x".repeat(129)),
      result("x\u0000"),
      { ...result("bad"), error: "Checksum" },
      { ...result("bad"), isValid: false },
    ]).map((r) => r.text),
    ["00123"],
  );
});
test("scan regions support square QR codes and stay inside portrait/landscape source pixels", () => {
  for (const [width, height] of [
    [1920, 1080],
    [1080, 1920],
    [320, 240],
  ]) {
    assert.deepEqual(scanRegion(width, height), { x: 0, y: 0, width, height });
    const qr = scanRegion(width, height, "qr");
    assert.equal(qr.width, qr.height);
    for (const mode of ["qr", "barcode"]) {
      const r = scanRegion(width, height, mode);
      assert.ok(
        r.x >= 0 &&
          r.y >= 0 &&
          r.x + r.width <= width &&
          r.y + r.height <= height,
      );
    }
  }
});
test("resolution is ideal, selected camera is exact, stop closes every track, optional focus failures do not prevent capture", async () => {
  assert.equal(cameraConstraints("device").video.deviceId.exact, "device");
  assert.equal(cameraConstraints().video.width.ideal, 1920);
  let stopped = 0;
  stopStream({
    getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }],
  });
  assert.equal(stopped, 2);
  let focused = false;
  await tuneCamera({
    getCapabilities: () => ({ focusMode: ["continuous"] }),
    applyConstraints: async () => {
      focused = true;
      throw Error("unsupported");
    },
  });
  assert.equal(focused, true);
});
test("API base URLs have a single api prefix for Vite, Render and path prefixes", () => {
  for (const root of ["", undefined, " /api/ "])
    assert.equal(apiBaseUrl(root), "/api");
  for (const root of [
    "https://example.test",
    "https://example.test/",
    "https://example.test/api/",
  ])
    assert.equal(apiBaseUrl(root), "https://example.test/api");
  assert.equal(
    apiBaseUrl("https://example.test/inventory/api"),
    "https://example.test/inventory/api",
  );
});
