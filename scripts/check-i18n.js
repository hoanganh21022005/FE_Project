#!/usr/bin/env node
/**
 * scripts/check-i18n.js
 * Checks for:
 *   (a) keys used in code via t('...') / t("...") missing from vi or en
 *   (b) keys present in vi but missing in en, and vice versa
 *
 * Usage: node scripts/check-i18n.js
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TRANSLATIONS_PATH = resolve(__dirname, '../src/locales/translations.js')
const SRC_DIR = resolve(__dirname, '../src')

// --- 1. Load translations by converting ESM export to CJS temporarily ---
function loadTranslations() {
  const raw = readFileSync(TRANSLATIONS_PATH, 'utf8')
  // Convert ESM export to CommonJS
  const cjs = raw
    .replace(/export\s+const\s+translations\s*=/, 'const translations =')
    .replace(/^export\s+/gm, '')
    + '\nmodule.exports = translations;\n'
  const tmpFile = join(__dirname, '_tmp_check.cjs')
  writeFileSync(tmpFile, cjs, 'utf8')
  try {
    const require = createRequire(import.meta.url)
    // Clear require cache to force reload
    delete require.cache[require.resolve(tmpFile)]
    return require(tmpFile)
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

// --- 2. Scan source files for t('key') usages ---
function scanUsedKeys(srcDir) {
  const usedKeys = new Map() // key -> [files]
  const fileExts = ['.jsx', '.js', '.tsx', '.ts']
  const skipDirs = new Set(['node_modules', 'dist', '.git', 'scripts', '.vite'])

  function walk(dir) {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(full)
      } else if (fileExts.some(ext => entry.name.endsWith(ext))) {
        let content
        try { content = readFileSync(full, 'utf8') } catch { continue }
        const regex = /\bt\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.]*?)['"`]\s*\)/g
        let m
        while ((m = regex.exec(content)) !== null) {
          const key = m[1]
          if (!usedKeys.has(key)) usedKeys.set(key, [])
          usedKeys.get(key).push(entry.name)
        }
      }
    }
  }

  walk(srcDir)
  return usedKeys
}

// --- Main ---
const translations = loadTranslations()
const vi = translations?.vi || {}
const en = translations?.en || {}
const viKeys = new Set(Object.keys(vi))
const enKeys = new Set(Object.keys(en))

console.log(`\n📖 Translations: ${viKeys.size} VI keys, ${enKeys.size} EN keys\n`)

const missingInEn = [...viKeys].filter(k => !enKeys.has(k)).sort()
const missingInVi = [...enKeys].filter(k => !viKeys.has(k)).sort()

console.log('🔍 Scanning source files for t() usages...')
const usedKeysMap = scanUsedKeys(SRC_DIR)
const usedKeys = new Set(usedKeysMap.keys())
console.log(`   Found ${usedKeys.size} unique keys used in code.\n`)

const missingFromVi = [...usedKeys].filter(k => !viKeys.has(k)).sort()
const missingFromEn = [...usedKeys].filter(k => !enKeys.has(k)).sort()
const onlyMissingEn = missingFromEn.filter(k => viKeys.has(k))

let hasErrors = false

if (missingInEn.length > 0) {
  console.log(`⚠️  ${missingInEn.length} keys in VI but missing in EN:`)
  missingInEn.slice(0, 40).forEach(k => console.log(`     ${k}`))
  if (missingInEn.length > 40) console.log(`     ... and ${missingInEn.length - 40} more`)
  hasErrors = true
  console.log()
}

if (missingInVi.length > 0) {
  console.log(`⚠️  ${missingInVi.length} keys in EN but missing in VI:`)
  missingInVi.slice(0, 20).forEach(k => console.log(`     ${k}`))
  if (missingInVi.length > 20) console.log(`     ... and ${missingInVi.length - 20} more`)
  hasErrors = true
  console.log()
}

if (missingFromVi.length > 0) {
  console.log(`❌ ${missingFromVi.length} keys used in code but MISSING from VI:`)
  missingFromVi.forEach(k => {
    const files = [...new Set(usedKeysMap.get(k))].join(', ')
    console.log(`     ${k}  (in: ${files})`)
  })
  hasErrors = true
  console.log()
}

if (onlyMissingEn.length > 0) {
  console.log(`❌ ${onlyMissingEn.length} keys used, present in VI but MISSING from EN:`)
  onlyMissingEn.slice(0, 30).forEach(k => console.log(`     ${k}`))
  if (onlyMissingEn.length > 30) console.log(`     ... and ${onlyMissingEn.length - 30} more`)
  hasErrors = true
  console.log()
}

if (!hasErrors) {
  console.log('✅ All i18n keys are consistent!\n')
}

const report = { viKeyCount: viKeys.size, enKeyCount: enKeys.size, usedKeyCount: usedKeys.size, missingInEn, missingInVi, missingFromVi, onlyMissingEn }
writeFileSync(join(__dirname, 'i18n-report.json'), JSON.stringify(report, null, 2), 'utf8')
console.log('📄 Full report → scripts/i18n-report.json\n')
process.exit(hasErrors ? 1 : 0)
