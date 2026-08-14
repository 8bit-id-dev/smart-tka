import katex from 'katex';
import 'katex/dist/katex.min.css';

function pecah(text: string) {
  const out: { t: 't' | 'i' | 'd'; v: string }[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 't', v: text.slice(last, m.index) });
    if (m[1] != null) out.push({ t: 'd', v: m[1] });
    else out.push({ t: 'i', v: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 't', v: text.slice(last) });
  return out.length ? out : [{ t: 't' as const, v: text }];
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = pecah(text || '');
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.t === 't') return <span key={i}>{p.v}</span>;
        try {
          const html = katex.renderToString(p.v, { throwOnError: false, displayMode: p.t === 'd' });
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch {
          return <span key={i}>{p.v}</span>;
        }
      })}
    </span>
  );
}
