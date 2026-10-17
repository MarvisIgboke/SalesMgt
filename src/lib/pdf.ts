export interface PdfOptions {
  pageWidth?: number
  pageHeight?: number
  margin?: number
  fontSize?: number
  leading?: number
  font?: string
}

const A4 = { width: 595.28, height: 841.89 }

function toLatin1(input: string): string {
  return input
    .replace(/\u20a6/g, 'NGN')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\u0020-\u007e]/g, '?')
}

function escapeText(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapLine(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line]
  const wrapped: string[] = []
  let rest = line
  while (rest.length > maxChars) {
    wrapped.push(rest.slice(0, maxChars))
    rest = rest.slice(maxChars)
  }
  wrapped.push(rest)
  return wrapped
}

export function buildPdf(lines: string[], options: PdfOptions = {}): Uint8Array {
  const pageWidth = options.pageWidth ?? A4.width
  const pageHeight = options.pageHeight ?? A4.height
  const margin = options.margin ?? 48
  const fontSize = options.fontSize ?? 9.5
  const leading = options.leading ?? fontSize * 1.4
  const fontName = (options.font ?? 'Helvetica').replace(/[^\w]/g, '')

  const maxChars = Math.max(20, Math.floor((pageWidth - margin * 2) / (fontSize * 0.5)))

  const sanitized = lines.map((line) => toLatin1(line.replace(/\t/g, '  ')))
  const wrapped = sanitized.flatMap((line) => wrapLine(line, maxChars))

  const perPage = Math.max(1, Math.floor((pageHeight - margin * 2) / leading))
  const pages: string[][] = []
  for (let i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage))
  if (pages.length === 0) pages.push([])

  const pageCount = pages.length
  const firstPageObj = 3
  const firstContentObj = 3 + pageCount
  const fontObjNum = 3 + pageCount * 2

  const contentStream = (pageLines: string[]): string => {
    const parts = ['BT', `/${fontName} ${fontSize} Tf`, `${leading.toFixed(2)} TL`]
    parts.push(`${margin} ${(pageHeight - margin - fontSize).toFixed(2)} Td`)
    pageLines.forEach((line, index) => {
      if (index > 0) parts.push('T*')
      parts.push(`(${escapeText(line)}) Tj`)
    })
    parts.push('ET')
    return parts.join('\n')
  }

  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')

  const kids = pages.map((_, index) => `${firstPageObj + index} 0 R`).join(' ')
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`)

  pages.forEach((_, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${firstContentObj + index} 0 R >>`,
    )
  })

  pages.forEach((pageLines) => {
    const content = contentStream(pageLines)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  objects.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /${fontName} /Encoding /WinAnsiEncoding >>`,
  )

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefStart}\n%%EOF\n`

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff
  return bytes
}

export function downloadPdf(lines: string[], filename: string, options: PdfOptions = {}): void {
  const bytes = buildPdf(lines, options)
  const blob = new Blob([bytes.buffer as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
