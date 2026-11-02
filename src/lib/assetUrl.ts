const base = import.meta.env.BASE_URL || '/'

export function publicUrl(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return `${base}${clean}`
}

export function seedUrl(file: string): string {
  return publicUrl(`seed/${file.replace(/^\/+/, '')}`)
}
