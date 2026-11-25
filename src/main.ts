import './ui/styles/tokens.css'
import './ui/styles/app.css'
import './ui/styles/screens.css'
import type { PuzzleFile } from './core/generator'
import { startRouter } from './ui/router'
import { loadSettings, purgeOldPuzzles } from './ui/storage'
import { applyTheme } from './ui/theme'

applyTheme(await loadSettings())
await purgeOldPuzzles()
const puzzles: PuzzleFile = await (await fetch(import.meta.env.BASE_URL + 'puzzles.json')).json()
startRouter(document.getElementById('app')!, puzzles)
