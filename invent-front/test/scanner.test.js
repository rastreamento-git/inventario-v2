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
  frameSize,
  confirmationsFor,
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
    if (fixture.offcenter) {
      const size=frameSize(image.width,image.height);
      const data=new Uint8ClampedArray(size.width*size.height*4);
      for(let y=0;y<size.height;y++) for(let x=0;x<size.width;x++) {
        const source=(Math.floor(y*image.height/size.height)*image.width+Math.floor(x*image.width/size.width))*4;
        data.set(image.data.subarray(source,source+4),(y*size.width+x)*4);
      }
      const quick=await decodePixels({...size,data},"auto",readBarcodes,"fast");
      assert.ok(quick.some(r=>r.text===fixture.text),"Fast pass must read labels away from center");
    }

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
test("confirms checksummed codes in two frames, allows one brief miss and resets ambiguity/long gaps", () => {
  const gate = confirmationGate();
  assert.equal(gate.observe([result("00123")], 0).count, 1);
  gate.observe([], 80);
  assert.equal(gate.observe([result("00123")], 160).result.text, "00123");
  assert.equal(gate.observe([result("other")], 250).count, 1);
  assert.equal(gate.observe([result("other"), result("second")], 300).ambiguous, true);
  assert.equal(gate.observe([result("other")], 350).count, 1);
  gate.observe([], 900);
  assert.equal(gate.observe([result("other")], 1000).count, 1);
  assert.equal(gate.observe([result("other")], 7000).count, 1);
});
test("non-checksummed Code39, ITF and Codabar still need three matching frames", () => {
  for (const format of ["Code39", "ITF", "Codabar"]) {
    const gate=confirmationGate();
    assert.equal(confirmationsFor(format),3);
    assert.equal(gate.observe([result("SN001",format)],0).count,1);
    assert.equal(gate.observe([result("SN001",format)],80).count,2);
    assert.equal(gate.observe([result("SN001",format)],160).result.text,"SN001");
  }
});
test("fast frames are bounded but accurate passes keep every source pixel", () => {
  assert.deepEqual(frameSize(1920,1080),{width:1280,height:720});
  assert.deepEqual(frameSize(1080,1920),{width:720,height:1280});
  assert.deepEqual(frameSize(1920,1080,"accurate"),{width:1920,height:1080});
  assert.equal(readerOptions("auto","fast").tryHarder,true);
  assert.equal(readerOptions().tryHarder,true);
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
    assert.deepEqual(qr, {x:0,y:0,width,height});
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
