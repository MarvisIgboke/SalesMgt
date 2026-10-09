import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const PRIMARY = [124, 92, 252] // #7c5cfc
const ACCENT = [56, 189, 248] // #38bdf8
const BG = [10, 10, 11]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function pixel(size, x, y, corner, inset = 0, padded = true) {
  const px = x / size
  const py = y / size

  const radius = corner
  const min = padded ? inset : 0

  // Outside shape = dark background tile (full-bleed, rounded to canvas for maskable)
  const inCanvas = x >= min && x < size - min && y >= min && y < size - min
  if (!inCanvas) return [...BG, 0]

  // Rounded gradient square (brand mark)
  const innerInset = inset + size * 0.05
  const left = innerInset
  const right = size - innerInset
  const top = innerInset
  const bottom = size - innerInset
  const rr = (right - left) * (radius === 'full' ? 0.5 : 0.13)

  const cx = Math.max(left + rr, Math.min(x, right - rr))
  const cy = Math.max(top + rr, Math.min(y, bottom - rr))
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const inside = dist <= rr

  let color = [...BG, 255]
  if (inside) {
    // gradient: primary top-left -> accent bottom-right
    const t = (px + py) / 2
    const r = Math.round(lerp(PRIMARY[0], ACCENT[0], t))
    const g = Math.round(lerp(PRIMARY[1], ACCENT[1], t))
    const b = Math.round(lerp(PRIMARY[2], ACCENT[2], t))
    color = [r, g, b, 255]

    // simple white "S" band-ish glyph: two bright horizontal bars with a diagonal
    const band = 0.055 * size
    const gap = 0.03 * size
    const x0 = size * 0.3
    const x1 = size * 0.7
    const inBand =
      ((y >= top + (bottom - top) * 0.32 - band && y <= top + (bottom - top) * 0.32 + band) &&
        x >= x0 + (y - top) * 0.18 &&
        x <= x1 - (y - top) * 0.18 + band * 2) ||
      ((y <= bottom - (bottom - top) * 0.36 + band && y >= bottom - (bottom - top) * 0.36 - band) &&
        x >= x0 + band &&
        x <= x1)
    if (inBand) color = [255, 255, 255, 255]
  }

  // 1px subtle edge
  if (inside) {
    const edge = dist > rr - (paddingSafe(size)) ? 1 : 0
    if (edge) color = [10, 10, 11, 255]
  }

  return color
}

function paddingSafe(size) {
  return Math.max(0.75, size * 0.006)
}

function encodePng(size, corner, inset = 0, padded = true) {
  const stride = size * 4
  const raw = Buffer.alloc(stride * (size + 1))

  for (let y = 0; y < size; y++) {
    const rowOffset = y * stride
    raw[rowOffset] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(size, x, y, corner, inset, padded)
      const o = rowOffset + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a === 0 ? 0 : 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw)

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.concat([typeBuf, data])
    const crc = crc32(crcBuf)
    const crcOut = Buffer.alloc(4)
    crcOut.writeUInt32BE(crc >>> 0, 0)
    return Buffer.concat([len, typeBuf, data, crcOut])
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const CRC_TABLE = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return c ^ 0xffffffff
}

// Standard app icons: rounded gradient square centered in transparent tile
// Maskable icon: full-bleed brand tile (safe zone respected by shape radius)
const icon192 = encodePng(192, 'round', 192 * 0.02, true)
const icon512 = encodePng(512, 'round', 512 * 0.02, true)
const maskable = encodePng(512, 'full', 0, false)

writeFileSync(join(outDir, 'icon-192.png'), icon192)
writeFileSync(join(outDir, 'icon-512.png'), icon512)
writeFileSync(join(outDir, 'maskable-512.png'), maskable)

console.log('Icons generated in', outDir)