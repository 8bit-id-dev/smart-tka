import katex from 'katex';
import 'katex/dist/katex.min.css';

type Part =
  | { t: 'text'; v: string }
  | { t: 'inline'; v: string }
  | { t: 'display'; v: string };

function pecah(text: string): Part[] {
  const out: Part[] = [];

  // Mendukung:
  // $x^2$        → inline math
  // $$x^2$$      → display math
  //
  // [\s\S] juga memungkinkan display math mengandung newline.
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({
        t: 'text',
        v: text.slice(last, m.index),
      });
    }

    if (m[1] != null) {
      out.push({
        t: 'display',
        v: m[1],
      });
    } else {
      out.push({
        t: 'inline',
        v: m[2],
      });
    }

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    out.push({
      t: 'text',
      v: text.slice(last),
    });
  }

  return out.length
    ? out
    : [{ t: 'text', v: text }];
}

function renderText(text: string, keyPrefix: string) {
  const lines = text.split(/\r?\n/);

  return (
    <>
      {lines.map((line, index) => (
        <span key={`${keyPrefix}-line-${index}`}>
          {line}

          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = pecah(text || '');

  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.t === 'text') {
          return (
            <span key={i}>
              {renderText(p.v, `text-${i}`)}
            </span>
          );
        }

        try {
          const html = katex.renderToString(p.v, {
            throwOnError: false,
            displayMode: p.t === 'display',
          });

          if (p.t === 'display') {
            return (
              <div
                key={i}
                className="math-display"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }

          return (
            <span
              key={i}
              className="math-inline"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <span key={i}>
              {p.v}
            </span>
          );
        }
      })}
    </span>
  );
}