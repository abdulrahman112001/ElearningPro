const fs = require("fs")
const path = require("path")

function flattenKeys(obj, prefix = "") {
  if (!obj || typeof obj !== "object") return []
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, next))
    } else {
      keys.push(next)
    }
  }
  return keys
}

function loadJson(file) {
  const raw = fs.readFileSync(file, "utf8")
  return JSON.parse(raw)
}

const root = path.join(__dirname, "..", "messages")
const enFile = path.join(root, "en.json")
const arFile = path.join(root, "ar.json")

const en = loadJson(enFile)
const ar = loadJson(arFile)

const enKeys = new Set(flattenKeys(en))
const arKeys = new Set(flattenKeys(ar))

const missingInAr = [...enKeys].filter((k) => !arKeys.has(k)).sort()
const missingInEn = [...arKeys].filter((k) => !enKeys.has(k)).sort()

console.log("Translation key audit")
console.log("---------------------")
console.log(`en keys: ${enKeys.size}`)
console.log(`ar keys: ${arKeys.size}`)
console.log("")

if (missingInAr.length === 0 && missingInEn.length === 0) {
  console.log("✅ Keys match (no missing keys)")
  process.exit(0)
}

if (missingInAr.length) {
  console.log(`❌ Missing in ar.json (${missingInAr.length}):`)
  for (const k of missingInAr) console.log(`  - ${k}`)
  console.log("")
}

if (missingInEn.length) {
  console.log(`❌ Missing in en.json (${missingInEn.length}):`)
  for (const k of missingInEn) console.log(`  - ${k}`)
  console.log("")
}

process.exit(1)
