// Usage: node merge.js <projectRoot> <keysFile...>
const fs = require("fs")
const path = require("path")
const [root, ...files] = process.argv.slice(2)
function deepMerge(dst, src, trail, conflicts) {
  for (const [k, v] of Object.entries(src)) {
    const p = trail ? trail + "." + k : k
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (dst[k] === undefined) dst[k] = {}
      if (typeof dst[k] !== "object") { conflicts.push(p + " (object vs string)"); continue }
      deepMerge(dst[k], v, p, conflicts)
    } else {
      if (dst[k] !== undefined && dst[k] !== v) conflicts.push(p + ": existing=" + JSON.stringify(dst[k]) + " new=" + JSON.stringify(v))
      if (dst[k] === undefined) dst[k] = v
    }
  }
}
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => v && typeof v === "object" ? flat(v, p + k + ".") : [p + k])
for (const lang of ["ar", "en"]) {
  const mp = path.join(root, "messages", lang + ".json")
  const raw = fs.readFileSync(mp, "utf8")
  const nl = raw.includes("\r\n") ? "\r\n" : "\n"
  const msgs = JSON.parse(raw.replace(/^﻿/, ""))
  const conflicts = []
  for (const f of files) {
    const k = JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""))
    deepMerge(msgs, k[lang] || {}, "", conflicts)
  }
  if (conflicts.length) console.log(lang, "CONFLICTS (kept existing):\n " + conflicts.join("\n "))
  fs.writeFileSync(mp, JSON.stringify(msgs, null, 2).replace(/\n/g, nl) + nl)
}
const a = new Set(flat(JSON.parse(fs.readFileSync(path.join(root, "messages/ar.json"), "utf8"))))
const e = new Set(flat(JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"))))
console.log("ar keys", a.size, "en keys", e.size)
console.log("only ar:", [...a].filter((x) => !e.has(x)))
console.log("only en:", [...e].filter((x) => !a.has(x)))
