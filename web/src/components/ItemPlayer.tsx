import { useState } from 'react';
import { MathText } from './MathText';
import { LETTERS, optionsOf, parseKey, sameSet, type DbItem } from '../lib/soal';

type Props = {
  item: DbItem;
  showBahas: boolean;
  hideKeys: boolean;
  onLocked?: (correct: boolean) => void;
  onUpdate?: (info: { answer: string; correct: boolean }) => void;
};

export function ItemPlayer({ item, showBahas, hideKeys, onLocked, onUpdate }: Props) {
  const [locked, setLocked] = useState(false);
  const [pg, setPg] = useState<string | null>(null);
  const [kom, setKom] = useState<string[]>([]);
  const [bs, setBs] = useState<('B' | 'S' | null)[]>(() =>
    item.item_type === 'pernyataan_bs' ? optionsOf(item).map(() => null) : [],
  );

  const opts = optionsOf(item);
  const key = parseKey(item);
  const reveal = showBahas && locked && !hideKeys;

  function correct() {
    if (item.item_type === 'pg') return pg === key;
    if (item.item_type === 'pg_kompleks' && Array.isArray(key)) return sameSet(kom, key);
    if (item.item_type === 'pernyataan_bs' && Array.isArray(key)) return key.every((k, i) => bs[i] === k);
    return false;
  }

  function pushUpdate(nextPg: string | null, nextKom: string[], nextBs: ('B' | 'S' | null)[]) {
    let ok = false;
    let ans = '';
    if (item.item_type === 'pg') {
      ok = nextPg === key;
      ans = nextPg || '';
    } else if (item.item_type === 'pg_kompleks' && Array.isArray(key)) {
      ok = sameSet(nextKom, key);
      ans = JSON.stringify(nextKom);
    } else if (item.item_type === 'pernyataan_bs' && Array.isArray(key)) {
      ok = key.every((k, i) => nextBs[i] === k);
      ans = JSON.stringify(nextBs);
    }
    onUpdate?.({ answer: ans, correct: ok });
  }

  function canLock() {
    if (item.item_type === 'pg') return pg != null;
    if (item.item_type === 'pg_kompleks') return kom.length > 0;
    return bs.length > 0 && bs.every((x) => x != null);
  }

  function lock() {
    setLocked(true);
    onLocked?.(correct());
  }

  return (
    <div>
      {item.stimulus && (
        <p className="meta">
          <MathText text={item.stimulus} />
        </p>
      )}
      <p style={{ fontSize: 18, lineHeight: 1.5 }}>
        <MathText text={item.stem} />
      </p>

      {(item.item_type === 'pg' || item.item_type === 'single') && (
        <div className="choices">
          {opts.map((t, idx) => {
            const L = LETTERS[idx];
            return (
              <button
                key={L}
                type="button"
                disabled={locked && showBahas}
                className={`choice ${pg === L ? 'sel' : ''} ${reveal && L === key ? 'ok' : ''} ${reveal && pg === L && pg !== key ? 'bad' : ''}`}
                onClick={() => {
                  setPg(L);
                  pushUpdate(L, kom, bs);
                }}
              >
                <strong>{L}.</strong> <MathText text={t} />
              </button>
            );
          })}
        </div>
      )}

      {item.item_type === 'pg_kompleks' && (
        <div className="choices">
          <p className="type-lab">Centang semua yang benar.</p>
          {opts.map((t, idx) => {
            const L = LETTERS[idx];
            const on = kom.includes(L);
            const keys = Array.isArray(key) ? key : [];
            return (
              <button
                key={L}
                type="button"
                disabled={locked && showBahas}
                className={`choice ${on ? 'sel' : ''} ${reveal && keys.includes(L) ? 'ok' : ''} ${reveal && on && !keys.includes(L) ? 'bad' : ''}`}
                onClick={() => {
                  const next = kom.includes(L) ? kom.filter((x) => x !== L) : [...kom, L];
                  setKom(next);
                  pushUpdate(pg, next, bs);
                }}
              >
                <span className={`box ${on ? 'on' : ''}`} />
                <strong>{L}.</strong> <MathText text={t} />
              </button>
            );
          })}
        </div>
      )}

      {item.item_type === 'pernyataan_bs' && (
        <div className="bs-list">
          {opts.map((s, idx) => (
            <div key={idx} className="bs-row">
              <p>
                {idx + 1}. <MathText text={s} />
              </p>
              <div className="bs-btns">
                {(['B', 'S'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={locked && showBahas}
                    className={`choice bs ${bs[idx] === v ? 'sel' : ''} ${reveal && Array.isArray(key) && key[idx] === v ? 'ok' : ''}`}
                    onClick={() => {
                      const next = bs.map((x, i) => (i === idx ? v : x));
                      setBs(next);
                      pushUpdate(pg, kom, next);
                    }}
                  >
                    {v === 'B' ? 'Benar' : 'Salah'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBahas && !locked && (
        <button className="btn" type="button" disabled={!canLock()} onClick={lock} style={{ marginTop: 16 }}>
          Kunci jawaban
        </button>
      )}

      {reveal && (
        <div className={`bahas ${correct() ? 'ok' : 'bad'}`}>
          <strong>{correct() ? 'Benar' : 'Belum tepat'}.</strong>
          <p>{item.rationale}</p>
        </div>
      )}
    </div>
  );
}
