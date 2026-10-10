import * as React from "react"

/**
 * Renders the small markdown subset the tutor is asked to use (paragraphs,
 * "-"/"1." lists, **bold**, `code` and fenced code blocks) as React elements.
 * Model output is never injected as HTML.
 */
export function MarkdownLite({ text }: { text: string }) {
  const blocks: React.ReactNode[] = []
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      i++ // closing fence (or end)
      blocks.push(
        <pre key={key++} dir="ltr" className="overflow-x-auto rounded-md bg-muted p-3 text-start text-xs leading-relaxed">
          <code>{code.join("\n")}</code>
        </pre>
      )
      continue
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""))
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 ps-5">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>
      )
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""))
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 ps-5">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ol>
      )
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      para.push(lines[i++].replace(/^#{1,6}\s+/, ""))
    }
    blocks.push(
      <p key={key++} className="whitespace-pre-line">
        {inline(para.join("\n"))}
      </p>
    )
  }
  return <div className="space-y-2 break-words">{blocks}</div>
}

function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith("`")) {
      out.push(
        <code key={k++} dir="ltr" className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      )
    } else {
      out.push(<strong key={k++}>{token.slice(2, -2)}</strong>)
    }
    last = m.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
