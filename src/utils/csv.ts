export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/** Gera CSV (separador ";" — padrão do Excel pt-BR) com BOM UTF-8. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(';')
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(';'))
  return '﻿' + [head, ...body].join('\r\n')
}

/** Dispara o download real de um arquivo no navegador. */
export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  downloadFile(filename, toCsv(rows, columns))
}
