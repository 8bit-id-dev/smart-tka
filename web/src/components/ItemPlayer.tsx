import { useEffect, useState } from 'react';
import { MathText } from './MathText';
import { LETTERS, optionsOf, parseKey, parseMatchPairs, sameSet, type DbItem } from '../lib/soal';
import { evalUraianAI, type KoreksiUraianResult } from '../lib/aiSoal';

type Props = {
  item: DbItem;
  showBahas: boolean;
  hideKeys: boolean;
  onLocked?: (correct: boolean) => void;
  onUpdate?: (info: { answer: string; correct: boolean }) => void;
  review?: boolean;
  answer?: string;
};

export function ItemPlayer({ item, showBahas, hideKeys, onLocked, onUpdate, review = false, answer }: Props) {
  const [locked, setLocked] = useState(false);
  const [pg, setPg] = useState<string | null>(null);
  const [kom, setKom] = useState<string[]>([]);
  const isPernyataan = item.item_type === 'pernyataan_bs';
  const [bs, setBs] = useState<('B' | 'S' | null)[]>(() => {
    if (!isPernyataan) return [];
    const o = optionsOf(item);
    return Array.isArray(o) ? o.map(() => null) : [];
  });
  const statements: string[] = isPernyataan
    ? (() => { const o = optionsOf(item); return Array.isArray(o) ? [...o] : []; })()
    : [];

  // State for matching (mencocokkan) and essay (uraian)
  const [matchAns, setMatchAns] = useState<Record<number, string>>({});
  const [essayAns, setEssayAns] = useState<string>('');

  // AI essay grading state
  const [aiEval, setAiEval] = useState<KoreksiUraianResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState('');

  const opts = optionsOf(item);
  const key = parseKey(item);
  const matchPairs = parseMatchPairs(item);
  const reveal = (showBahas || review) && !hideKeys;

  const pgKompleksSortedIdx = reveal && item.item_type === 'pg_kompleks' && Array.isArray(key)
    ? [...opts.map((_, i) => i)].sort((a, b) => {
        const aOk = key.includes(LETTERS[a]);
        const bOk = key.includes(LETTERS[b]);
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return a - b;
      })
    : opts.map((_, i) => i);

  const pernyataanSortedIdx = reveal && item.item_type === 'pernyataan_bs' && Array.isArray(key)
    ? [...statements.map((_, i) => i)].sort((a, b) => {
        const aOk = bs[a] === key[a];
        const bOk = bs[b] === key[b];
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return a - b;
      })
    : statements.map((_, i) => i);

  // Review mode: re-show the student's previously saved answer so reveal
  // highlight (benar/salah) reflects what they actually chose.
  useEffect(() => {
    if (!review || !answer) return;
    try {
      if (item.item_type === 'pg' || item.item_type === 'single') setPg(answer);
      else if (item.item_type === 'pg_kompleks') setKom(JSON.parse(answer));
      else if (item.item_type === 'pernyataan_bs') setBs(JSON.parse(answer));
      else if (item.item_type === 'mencocokkan') {
        const parsed = JSON.parse(answer);
        setMatchAns(Array.isArray(parsed) ? Object.fromEntries(parsed.map((v: string, i: number) => [i, v])) : parsed);
      } else if (item.item_type === 'uraian') setEssayAns(answer);
    } catch { /* ignore malformed stored answer */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, answer]);

  async function mintaKoreksiAI() {
    if (!essayAns.trim()) return;
    setAiLoading(true);
    setAiErr('');
    const res = await evalUraianAI({
      stem: item.stem,
      jawabanSiswa: essayAns,
      kunciAcuan: typeof key === 'string' ? key : '',
      pembahasan: item.rationale,
    });
    setAiLoading(false);
    if ('error' in res) {
      setAiErr(res.error);
    } else {
      setAiEval(res);
      onUpdate?.({ answer: essayAns, correct: res.isCorrect });
    }
  }

  function correct(): boolean {
    if (item.item_type === 'pg' || item.item_type === 'single') return pg === key;
    if (item.item_type === 'pg_kompleks' && Array.isArray(key)) return sameSet(kom, key);
    if (item.item_type === 'pernyataan_bs' && Array.isArray(key)) return key.every((k, i) => bs[i] === k);

    if (item.item_type === 'mencocokkan') {
      const targetMap = typeof key === 'object' && key !== null && !Array.isArray(key) ? (key as Record<string, string>) : {};
      const targetArr = Array.isArray(key) ? key : null;
      if (matchPairs.kiri.length === 0) return false;
      return matchPairs.kiri.every((_, i) => {
        const expected = targetArr ? targetArr[i] : targetMap[String(i)] ?? matchPairs.kanan[i];
        return (matchAns[i] || '').trim().toLowerCase() === (expected || '').trim().toLowerCase();
      });
    }

    if (item.item_type === 'uraian') {
      if (aiEval) return aiEval.isCorrect;
      if (!essayAns.trim()) return false;
      if (typeof key === 'string' && key.trim()) {
        return essayAns.trim().toLowerCase().includes(key.trim().toLowerCase());
      }
      return true;
    }

    return false;
  }

  function pushUpdate(
    nextPg: string | null,
    nextKom: string[],
    nextBs: ('B' | 'S' | null)[],
    nextMatch: Record<number, string>,
    nextEssay: string,
  ) {
    let ok = false;
    let ans = '';

    if (item.item_type === 'pg' || item.item_type === 'single') {
      ok = nextPg === key;
      ans = nextPg || '';
    } else if (item.item_type === 'pg_kompleks' && Array.isArray(key)) {
      ok = sameSet(nextKom, key);
      ans = JSON.stringify(nextKom);
    } else if (item.item_type === 'pernyataan_bs' && Array.isArray(key)) {
      ok = key.every((k, i) => nextBs[i] === k);
      ans = JSON.stringify(nextBs);
    } else if (item.item_type === 'mencocokkan') {
      const targetMap = typeof key === 'object' && key !== null && !Array.isArray(key) ? (key as Record<string, string>) : {};
      const targetArr = Array.isArray(key) ? key : null;
      ok =
        matchPairs.kiri.length > 0 &&
        matchPairs.kiri.every((_, i) => {
          const expected = targetArr ? targetArr[i] : targetMap[String(i)] ?? matchPairs.kanan[i];
          return (nextMatch[i] || '').trim().toLowerCase() === (expected || '').trim().toLowerCase();
        });
      ans = JSON.stringify(nextMatch);
    } else if (item.item_type === 'uraian') {
      ok = aiEval
        ? aiEval.isCorrect
        : !nextEssay.trim()
        ? false
        : typeof key === 'string' && key.trim()
        ? nextEssay.trim().toLowerCase().includes(key.trim().toLowerCase())
        : true;
      ans = nextEssay;
    }

    onUpdate?.({ answer: ans, correct: ok });
  }

  function canLock() {
    if (item.item_type === 'pg' || item.item_type === 'single') return pg != null;
    if (item.item_type === 'pg_kompleks') return kom.length > 0;
    if (item.item_type === 'pernyataan_bs') return bs.length > 0 && bs.every((x) => x != null);
    if (item.item_type === 'mencocokkan') return matchPairs.kiri.length > 0 && matchPairs.kiri.every((_, i) => Boolean(matchAns[i]));
    if (item.item_type === 'uraian') return Boolean(essayAns.trim());
    return false;
  }

  function lock() {
    setLocked(true);
    onLocked?.(correct());
  }

  function pickBs(idx: number, v: 'B' | 'S') {
    const next = bs.map((x, i) => (i === idx ? v : x));
    setBs(next);
    pushUpdate(pg, kom, next, matchAns, essayAns);
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
                disabled={locked && (showBahas || review)}
                className={`choice ${pg === L ? 'sel x-mark' : ''} ${reveal && L === key ? 'ok' : ''} ${reveal && pg === L && pg !== key ? 'bad' : ''}`}
                onClick={() => {
                  setPg(L);
                  pushUpdate(L, kom, bs, matchAns, essayAns);
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
          <p className="type-lab">Centang semua yang benar.{reveal && ' (Diurutkan: benar duluan)'}</p>
          {pgKompleksSortedIdx.map((sortedIdx) => {
            const t = opts[sortedIdx];
            const L = LETTERS[sortedIdx];
            const on = kom.includes(L);
            const keys = Array.isArray(key) ? key : [];
            return (
              <button
                key={L}
                type="button"
                disabled={locked && (showBahas || review)}
                className={`choice ${on ? 'sel' : ''} ${reveal && keys.includes(L) ? 'ok' : ''} ${reveal && on && !keys.includes(L) ? 'bad' : ''}`}
                onClick={() => {
                  const next = kom.includes(L) ? kom.filter((x) => x !== L) : [...kom, L];
                  setKom(next);
                  pushUpdate(pg, next, bs, matchAns, essayAns);
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
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="pernyataan-table">
            <thead>
              <tr>
                <th className="center">#</th>
                <th>Pernyataan</th>
                <th className="center">Benar</th>
                <th className="center">Salah</th>
                {reveal && <th className="center">Hasil</th>}
              </tr>
            </thead>
            <tbody>
              {pernyataanSortedIdx.map((origIdx, displayIdx) => {
                const s = statements[origIdx];
                const chosen = bs[origIdx];
                const rowKey = Array.isArray(key) && origIdx < key.length ? key[origIdx] : undefined;
                const correctRow = rowKey !== undefined;
                const isWrong = correctRow && chosen != null && chosen !== rowKey;
                return (
                  <tr key={origIdx}>
                    <td className="center" style={{ paddingTop: 10 }}>{displayIdx + 1}</td>
                    <td>
                      <MathText text={(s && s.trim()) ? s : ((opts[origIdx] as string) || '')} />
                      {reveal && isWrong && <span className="type-lab" style={{ color: '#dc2626', marginLeft: 6 }}>salah</span>}
                    </td>
                    <td className="center" style={{ paddingTop: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`bs-${origIdx}`}
                          value="B"
                          checked={chosen === 'B'}
                          disabled={locked && (showBahas || review)}
                          onChange={() => pickBs(origIdx, 'B')}
                        />
                        <span>Benar</span>
                      </label>
                    </td>
                    <td className="center" style={{ paddingTop: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`bs-${origIdx}`}
                          value="S"
                          checked={chosen === 'S'}
                          disabled={locked && (showBahas || review)}
                          onChange={() => pickBs(origIdx, 'S')}
                        />
                        <span>Salah</span>
                      </label>
                    </td>
                    {correctRow && reveal && (
                      <td className="center" style={{ paddingTop: 8 }}>
                        <span className={`chip ${chosen === rowKey ? 'chip-ok' : 'chip-bad'}`} style={{ fontSize: 10 }}>
                          {chosen === rowKey ? 'benar' : chosen == null ? '-' : 'salah'}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {item.item_type === 'mencocokkan' && (
        <div className="bs-list">
          <p className="type-lab">Pasangkan item di sebelah kiri dengan jawaban di sebelah kanan yang tepat.</p>
          {matchPairs.kiri.map((kiriText, idx) => {
            const selectedVal = matchAns[idx] || '';
            const targetMap = typeof key === 'object' && key !== null && !Array.isArray(key) ? (key as Record<string, string>) : {};
            const targetArr = Array.isArray(key) ? key : null;
            const expectedVal = targetArr ? targetArr[idx] : targetMap[String(idx)] ?? matchPairs.kanan[idx];
            const isPairCorrect = (selectedVal || '').trim().toLowerCase() === (expectedVal || '').trim().toLowerCase();

            return (
              <div key={idx} className="bs-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, marginBottom: 12 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>
                  {idx + 1}. <MathText text={kiriText} />
                </p>
                <select
                  className="sel-input"
                  disabled={locked && (showBahas || review)}
                  value={selectedVal}
                  style={{
                    borderColor: reveal ? (isPairCorrect ? '#2f9e6b' : '#dc2626') : undefined,
                    backgroundColor: reveal ? (isPairCorrect ? '#f0fdf4' : '#fef2f2') : undefined,
                  }}
                  onChange={(e) => {
                    const nextMatch = { ...matchAns, [idx]: e.target.value };
                    setMatchAns(nextMatch);
                    pushUpdate(pg, kom, bs, nextMatch, essayAns);
                  }}
                >
                  <option value="">-- Pilih Pasangan --</option>
                  {matchPairs.kanan.map((kananText, kIdx) => (
                    <option key={kIdx} value={kananText}>
                      {kananText}
                    </option>
                  ))}
                </select>
                {reveal && !isPairCorrect && (
                  <p className="type-lab" style={{ color: '#dc2626', margin: 0 }}>
                    Kunci tepat: <strong>{expectedVal}</strong>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {item.item_type === 'uraian' && (
        <div style={{ marginTop: 12 }}>
          <p className="type-lab">Tuliskan jawaban atau uraian Anda secara rinci:</p>
          <textarea
            className="sel-input"
            rows={4}
            disabled={locked && (showBahas || review)}
            value={essayAns}
            placeholder="Tuliskan jawaban Anda di sini…"
            style={{ width: '100%', resize: 'vertical' }}
            onChange={(e) => {
              const val = e.target.value;
              setEssayAns(val);
              pushUpdate(pg, kom, bs, matchAns, val);
            }}
          />

          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={aiLoading || !essayAns.trim()}
              onClick={() => void mintaKoreksiAI()}
            >
              {aiLoading ? 'AI sedang menilai & mengoreksi…' : '✨ Koreksi & Beri Nilai dengan AI'}
            </button>
          </div>

          {aiErr && <p className="auth-msg" style={{ marginTop: 8 }}>{aiErr}</p>}

          {aiEval && (
            <div
              className="card"
              style={{
                marginTop: 12,
                boxShadow: 'none',
                borderLeft: `4px solid ${aiEval.isCorrect ? '#2f9e6b' : '#d97706'}`,
                backgroundColor: aiEval.isCorrect ? '#f0fdf4' : '#fffbeb',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: aiEval.isCorrect ? '#2f9e6b' : '#d97706', fontSize: 16 }}>
                  Penilaian AI: {aiEval.skor} / 100
                </strong>
                <span className="chip chip-sedang">{aiEval.isCorrect ? 'Memenuhi' : 'Perlu Diperbaiki'}</span>
              </div>
              <p className="type-lab" style={{ marginTop: 6, marginBottom: 0, color: 'var(--text, #1c1917)' }}>
                {aiEval.feedback}
              </p>
            </div>
          )}
        </div>
      )}

      {showBahas && !locked && (
        <button className="btn" type="button" disabled={!canLock()} onClick={lock} style={{ marginTop: 16 }}>
          Kunci jawaban
        </button>
      )}

      {reveal && (
        <div className={`bahas ${correct() ? 'ok' : 'bad'}`}>
          <strong>{correct() ? 'Benar' : item.item_type === 'uraian' ? 'Jawaban Terkumpul' : 'Belum tepat'}.</strong>
          {typeof key === 'string' && key.trim() && item.item_type === 'uraian' && (
            <p style={{ marginTop: 4 }}>
              <strong>Kunci Acuan Guru:</strong> <MathText text={key} />
            </p>
          )}
          <p className="type-lab" style={{ marginTop: 4 }}>
            Pembahasan: <MathText text={item.rationale || ''} />
          </p>
        </div>
      )}
    </div>
  );
}
