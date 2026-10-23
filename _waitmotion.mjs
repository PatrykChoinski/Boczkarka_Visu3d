const B = 'http://127.0.0.1:8128/api';
const res = await fetch(`${B}/events?cid=waitmotion${Date.now()}`);
const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; const t = []; let start = null;
for (;;) {
  const r = await rd.read(); if (r.done) break;
  buf += dec.decode(r.value); let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const m = buf.slice(0, i); buf = buf.slice(i + 2);
    if (!m.startsWith('data: ')) continue;
    const o = JSON.parse(m.slice(6));
    if (o.full || !o.values || !['x', 'y', 'z', 'a', 'b'].some((k) => k in o.values)) continue;
    const now = Date.now(); start ??= now; t.push(now);
  }
  if (start && Date.now() - start > 10000) break;
}
const gaps = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
console.log(`ruch: ${t.length} zmian pozycji w ${((t.at(-1) - t[0]) / 1000).toFixed(1)} s = ${(t.length / Math.max(0.1, (t.at(-1) - t[0]) / 1000)).toFixed(1)}/s; odstep mediana ${gaps[gaps.length >> 1]} ms, p90 ${gaps[Math.floor(gaps.length * 0.9)]} ms, max ${gaps.at(-1)} ms`);
process.exit(0);
