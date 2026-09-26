/**
 * Resolve um arquivo estático de /public respeitando o caminho base do deploy.
 *
 * Em desenvolvimento o site roda na raiz ("/"), mas publicado ele pode ficar
 * num subcaminho (ex.: GitHub Pages em "/Zenn-OS/"). Caminhos absolutos como
 * "/brand/x.webp" quebrariam nesse caso, então prefixamos com BASE_URL.
 */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return (base.endsWith('/') ? base : `${base}/`) + path.replace(/^\/+/, '')
}
