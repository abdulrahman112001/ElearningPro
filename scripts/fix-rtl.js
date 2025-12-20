#!/usr/bin/env node

/**
 * RTL Fix Script
 * This script converts all ml-/mr- classes to me-/ms- for better RTL support
 * Run: node scripts/fix-rtl.js
 */

const fs = require("fs")
const path = require("path")

// Simple recursive file finder
function findFiles(dir, extensions, ignore = []) {
  let results = []
  const files = fs.readdirSync(dir)

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      if (!ignore.includes(file)) {
        results = results.concat(findFiles(filePath, extensions, ignore))
      }
    } else {
      const ext = path.extname(file)
      if (extensions.includes(ext)) {
        results.push(filePath)
      }
    }
  }

  return results
}

const replacements = [
  // Margin classes
  {
    from: /className="([^"]*)\bml-(\d+)\b([^"]*)"/g,
    to: 'className="$1ms-$2$3"',
  },
  {
    from: /className="([^"]*)\bmr-(\d+)\b([^"]*)"/g,
    to: 'className="$1me-$2$3"',
  },
  {
    from: /className="([^"]*)\bml-auto\b([^"]*)"/g,
    to: 'className="$1ms-auto$2"',
  },
  {
    from: /className="([^"]*)\bmr-auto\b([^"]*)"/g,
    to: 'className="$1me-auto$2"',
  },

  // Padding classes
  {
    from: /className="([^"]*)\bpl-(\d+)\b([^"]*)"/g,
    to: 'className="$1ps-$2$3"',
  },
  {
    from: /className="([^"]*)\bpr-(\d+)\b([^"]*)"/g,
    to: 'className="$1pe-$2$3"',
  },

  // Position classes
  {
    from: /className="([^"]*)\bleft-(\d+)\b([^"]*)"/g,
    to: 'className="$1start-$2$3"',
  },
  {
    from: /className="([^"]*)\bright-(\d+)\b([^"]*)"/g,
    to: 'className="$1end-$2$3"',
  },

  // Text alignment
  {
    from: /className="([^"]*)\btext-left\b([^"]*)"/g,
    to: 'className="$1text-start$2"',
  },
  {
    from: /className="([^"]*)\btext-right\b([^"]*)"/g,
    to: 'className="$1text-end$2"',
  },

  // Border radius
  {
    from: /className="([^"]*)\brounded-l-(\w+)\b([^"]*)"/g,
    to: 'className="$1rounded-s-$2$3"',
  },
  {
    from: /className="([^"]*)\brounded-r-(\w+)\b([^"]*)"/g,
    to: 'className="$1rounded-e-$2$3"',
  },
]

async function fixRTL() {
  const projectDir = process.cwd()
  const files = findFiles(
    projectDir,
    [".tsx", ".jsx"],
    ["node_modules", ".next", "dist", "build"]
  )

  console.log(`Found ${files.length} files to process...`)

  let totalChanges = 0
  let modifiedFiles = 0

  files.forEach((filePath) => {
    let content = fs.readFileSync(filePath, "utf8")
    let originalContent = content
    let fileChanges = 0

    replacements.forEach(({ from, to }) => {
      const matches = content.match(from)
      if (matches) {
        fileChanges += matches.length
        content = content.replace(from, to)
      }
    })

    if (fileChanges > 0) {
      fs.writeFileSync(filePath, content, "utf8")
      const relativePath = path.relative(process.cwd(), filePath)
      console.log(`✓ Fixed ${fileChanges} RTL issues in ${relativePath}`)
      totalChanges += fileChanges
      modifiedFiles++
    }
  })

  console.log(
    `\n✅ Done! Fixed ${totalChanges} RTL issues in ${modifiedFiles} files.`
  )
}

fixRTL().catch(console.error)
