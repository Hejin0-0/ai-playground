'use strict';
// Node-only: used by the asset generator, never shipped to the browser.
// Encodes RGBA pixels as a PNG using built-in zlib — no dependencies.

const zlib = require('zlib');

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// rgba: Buffer of width*height*4 bytes, row-major.
function encodePNG(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`invalid dimensions ${width}x${height}: width/height must be >= 1`);
  }
  if (rgba.length !== width * height * 4) {
    throw new Error(`rgba length ${rgba.length} != ${width}x${height}x4`);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // bytes 10-12: compression/filter/interlace = 0

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height); // filter byte 0 (None) per scanline
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { encodePNG, crc32 };

// ---------------------------------------------------------------------------
// Self-check: encode -> decode round-trip. Run with `node src/assets/pngEncoder.js`.
// The decoder below exists only to prove the encoder emits spec-valid PNGs:
// signature, chunk layout, CRCs, IHDR fields, and exact pixel recovery.
// ---------------------------------------------------------------------------
if (require.main === module) {
  const assert = require('assert');

  function decodePNG(buf) {
    const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert(buf.subarray(0, 8).equals(SIG), 'bad signature');
    let off = 8;
    const chunks = [];
    while (off < buf.length) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString('ascii', off + 4, off + 8);
      const data = buf.subarray(off + 8, off + 8 + len);
      const crc = buf.readUInt32BE(off + 8 + len);
      assert.strictEqual(crc, crc32(buf.subarray(off + 4, off + 8 + len)),
        `bad CRC on ${type}`);
      chunks.push({ type, data });
      off += 12 + len;
    }
    assert.strictEqual(chunks[0].type, 'IHDR', 'first chunk must be IHDR');
    assert.strictEqual(chunks[chunks.length - 1].type, 'IEND', 'last chunk must be IEND');
    const ihdr = chunks[0].data;
    const width = ihdr.readUInt32BE(0);
    const height = ihdr.readUInt32BE(4);
    assert.strictEqual(ihdr[8], 8, 'bit depth must be 8');
    assert.strictEqual(ihdr[9], 6, 'color type must be 6 (RGBA)');
    assert.strictEqual(ihdr[10], 0, 'compression must be 0');
    assert.strictEqual(ihdr[11], 0, 'filter method must be 0');
    assert.strictEqual(ihdr[12], 0, 'interlace must be 0');
    const idat = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
    const raw = zlib.inflateSync(idat);
    assert.strictEqual(raw.length, height * (1 + width * 4), 'bad scanline data length');
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      assert.strictEqual(raw[y * (1 + width * 4)], 0, 'filter type must be 0 (None)');
      raw.copy(pixels, y * width * 4, y * (1 + width * 4) + 1, (y + 1) * (1 + width * 4));
    }
    return { width, height, pixels };
  }

  // 1x1 opaque red
  const one = Buffer.from([255, 0, 0, 255]);
  let d = decodePNG(encodePNG(1, 1, one));
  assert.strictEqual(d.width, 1);
  assert.strictEqual(d.height, 1);
  assert(d.pixels.equals(one), '1x1 pixel round-trip');

  // 3x2 with distinct channel values incl. transparency
  const px = Buffer.from([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    0, 0, 0, 0, 255, 255, 255, 255, 128, 64, 32, 200,
  ]);
  d = decodePNG(encodePNG(3, 2, px));
  assert.strictEqual(d.width, 3);
  assert.strictEqual(d.height, 2);
  assert(d.pixels.equals(px), '3x2 pixel round-trip');

  // PNG spec 11.2.2: zero width/height is invalid — encoder must refuse
  assert.throws(() => encodePNG(0, 0, Buffer.alloc(0)), /width|height/i);
  assert.throws(() => encodePNG(1, 0, Buffer.alloc(0)), /width|height/i);

  console.log('pngEncoder self-check OK');
}
