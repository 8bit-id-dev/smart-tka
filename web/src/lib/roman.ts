export function romanize(n: number): string {
  const map: [number, string][] = [
    [20, 'XX'], [19, 'XIX'], [18, 'XVIII'], [17, 'XVII'], [16, 'XVI'], [15, 'XV'],
    [14, 'XIV'], [13, 'XIII'], [12, 'XII'], [11, 'XI'], [10, 'X'], [9, 'IX'],
    [8, 'VIII'], [7, 'VII'], [6, 'VI'], [5, 'V'], [4, 'IV'], [3, 'III'], [2, 'II'], [1, 'I'],
  ];
  for (const [num, rom] of map) if (n >= num) return rom;
  return String(n);
}
