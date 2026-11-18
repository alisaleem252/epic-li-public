import "server-only"

import QRCode from "qrcode"

/** QR module matrix (true = dark) for a URL. Medium error correction, drawn by the caller as plain SVG. */
export function qrMatrix(text: string): boolean[][] {
  const code = QRCode.create(text, { errorCorrectionLevel: "M" })
  const { size, data } = code.modules
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => data[row * size + col] === 1))
}
