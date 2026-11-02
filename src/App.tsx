import { useEffect } from 'react'
import { Shell } from './components/Shell'
import { useApp } from './lib/store'
import { loadStoredAssets, loadStoredFonts } from './lib/imageStore'
import { Dashboard } from './pages/Dashboard'
import { Studio } from './pages/Studio'
import { ArtDirector } from './pages/ArtDirector'
import { StyleLibrary } from './pages/StyleLibrary'
import { Archive } from './pages/Archive'
import { Darkroom } from './pages/Darkroom'
import { Editorial } from './pages/Editorial'
import { Campaigns } from './pages/Campaigns'
import { TumblrMachine } from './pages/TumblrMachine'
import { BrandLab } from './pages/BrandLab'
import { ZineStudio } from './pages/ZineStudio'
import { ContactSheets } from './pages/ContactSheets'
import { TypographyArchive } from './pages/TypographyArchive'
import { ExportRoom } from './pages/ExportRoom'
import { SettingsPage } from './pages/Settings'

const PAGES = {
  dashboard: Dashboard,
  studio: Studio,
  director: ArtDirector,
  styles: StyleLibrary,
  archive: Archive,
  darkroom: Darkroom,
  editorial: Editorial,
  campaigns: Campaigns,
  tumblr: TumblrMachine,
  brandlab: BrandLab,
  zine: ZineStudio,
  contactsheets: ContactSheets,
  typography: TypographyArchive,
  export: ExportRoom,
  settings: SettingsPage,
} as const

export default function App() {
  const route = useApp((s) => s.route)
  const Page = PAGES[route] ?? Dashboard

  useEffect(() => {
    let cancelled = false
    loadStoredAssets().then((stored) => {
      if (!cancelled && stored.length) useApp.getState().hydrateAssets(stored)
    })
    loadStoredFonts().then(async (fonts) => {
      if (cancelled) return
      for (const f of fonts) {
        try {
          const face = new FontFace(f.name, f.buffer)
          await face.load()
          document.fonts.add(face)
        } catch {
          /* ignore malformed stored fonts */
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Shell>
      <Page key={route} />
    </Shell>
  )
}
