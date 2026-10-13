import type { ReactNode } from 'react';

/**
 * Small, safe Markdown renderer. It builds React elements directly, so raw HTML in
 * a post is shown as text and can never execute. Supports headings (##, ###),
 * paragraphs, lists, blockquotes, fenced code, **bold**, *italic*, `code`,
 * [links](url) and ![images](url).
 */
export function safeUrl(url: string, { image = false } = {}): string | null {
  const u = url.trim();
  if (/^(\/(?!\/)|#)/.test(u)) return u;
  if (/^https:\/\//i.test(u)) return u;
  if (!image && /^(http:\/\/|mailto:|tel:)/i.test(u)) return u;
  return null; // javascript:, data:, protocol-relative, etc.
}

const INLINE = /(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;

export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const key = `${keyPrefix}-${n++}`;
    if (m[1]) {
      const src = safeUrl(m[3] ?? '', { image: true });
      // eslint-disable-next-line @next/next/no-img-element
      out.push(src ? <img key={key} src={src} alt={m[2] ?? ''} loading="lazy" /> : (m[2] ?? ''));
    } else if (m[4]) {
      const href = safeUrl(m[6] ?? '');
      out.push(
        href ? (
          <a key={key} href={href} rel="noopener noreferrer nofollow" target={href.startsWith('http') ? '_blank' : undefined}>
            {m[5]}
          </a>
        ) : (
          (m[5] ?? '')
        ),
      );
    } else if (m[7]) out.push(<strong key={key}>{m[8]}</strong>);
    else if (m[9]) out.push(<em key={key}>{m[10]}</em>);
    else if (m[11]) out.push(<code key={key}>{m[12]}</code>);
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b-${k++}`;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) code.push(lines[i++] ?? '');
      i++;
      blocks.push(<pre key={key()}><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const id = key();
      const content = renderInline(heading[2] ?? '', id);
      // A post's title is the page h1, so "#" and "##" both render as h2.
      blocks.push((heading[1] ?? '').length <= 2 ? <h2 key={id}>{content}</h2> : <h3 key={id}>{content}</h3>);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) quote.push((lines[i++] ?? '').replace(/^>\s?/, ''));
      const id = key();
      blocks.push(<blockquote key={id}>{renderInline(quote.join(' '), id)}</blockquote>);
      continue;
    }
    const ul = /^[-*]\s+/;
    const ol = /^\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const re = ul.test(line) ? ul : ol;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i] ?? '')) items.push((lines[i++] ?? '').replace(re, ''));
      const id = key();
      const lis = items.map((it, j) => <li key={`${id}-${j}`}>{renderInline(it, `${id}-${j}`)}</li>);
      blocks.push(re === ul ? <ul key={id}>{lis}</ul> : <ol key={id}>{lis}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? '').trim() && !/^(#{1,4}\s|>|```|[-*]\s|\d+[.)]\s)/.test(lines[i] ?? '')) {
      para.push(lines[i++] ?? '');
    }
    const id = key();
    blocks.push(<p key={id}>{renderInline(para.join(' '), id)}</p>);
  }
  return <div className="prose-ta">{blocks}</div>;
}
