// Pure indicator math over a klines series. Inputs are arrays of
// `{ time, close, high, low }`. Outputs are arrays of `{ time, value }`
// (or multi-field for BB/MACD), aligned to the chart's time scale.

export interface Bar { time: number; open: number; high: number; low: number; close: number }
export interface Point { time: number; value: number }

export function sma(data: Bar[], period: number): Point[] {
  if (period <= 1 || data.length < period) return [];
  const out: Point[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) out.push({ time: data[i].time, value: sum / period });
  }
  return out;
}

export function ema(data: Bar[], period: number): Point[] {
  if (period <= 1 || data.length < period) return [];
  const out: Point[] = [];
  const k = 2 / (period + 1);
  // seed with SMA of first `period` closes
  let seed = 0;
  for (let i = 0; i < period; i++) seed += data[i].close;
  let prev = seed / period;
  out.push({ time: data[period - 1].time, value: prev });
  for (let i = period; i < data.length; i++) {
    prev = data[i].close * k + prev * (1 - k);
    out.push({ time: data[i].time, value: prev });
  }
  return out;
}

export function bollinger(data: Bar[], period = 20, mult = 2):
  { upper: Point[]; middle: Point[]; lower: Point[] } {
  const middle: Point[] = [];
  const upper: Point[] = [];
  const lower: Point[] = [];
  if (data.length < period) return { upper, middle, lower };
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    const mean = sum / period;
    let varSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = data[j].close - mean;
      varSum += d * d;
    }
    const sd = Math.sqrt(varSum / period);
    middle.push({ time: data[i].time, value: mean });
    upper.push({ time: data[i].time, value: mean + mult * sd });
    lower.push({ time: data[i].time, value: mean - mult * sd });
  }
  return { upper, middle, lower };
}

export function rsi(data: Bar[], period = 14): Point[] {
  if (data.length <= period) return [];
  const out: Point[] = [];
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  const push = (i: number) => {
    const rs = avgL === 0 ? 100 : avgG / avgL;
    out.push({ time: data[i].time, value: avgL === 0 ? 100 : 100 - 100 / (1 + rs) });
  };
  push(period);
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    push(i);
  }
  return out;
}

function emaFromSeries(values: number[], period: number, startIdx: number) {
  // returns array of { absoluteIndex, value } for indices >= startIdx
  const out: { i: number; value: number }[] = [];
  if (values.length < startIdx + period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = startIdx; i < startIdx + period; i++) seed += values[i];
  let prev = seed / period;
  out.push({ i: startIdx + period - 1, value: prev });
  for (let i = startIdx + period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push({ i, value: prev });
  }
  return out;
}

export function macd(data: Bar[], fast = 12, slow = 26, signal = 9):
  { macd: Point[]; signal: Point[]; hist: Point[] } {
  const closes = data.map((d) => d.close);
  if (closes.length < slow + signal) return { macd: [], signal: [], hist: [] };
  const fastE = emaFromSeries(closes, fast, 0); // starts at fast-1
  const slowE = emaFromSeries(closes, slow, 0); // starts at slow-1
  // map slow ema by index for quick lookup
  const slowMap = new Map<number, number>();
  for (const p of slowE) slowMap.set(p.i, p.value);
  const macdLine: Point[] = [];
  const macdValues: number[] = [];
  const macdIdx: number[] = [];
  for (const p of fastE) {
    const sv = slowMap.get(p.i);
    if (sv == null) continue;
    macdLine.push({ time: data[p.i].time, value: p.value - sv });
    macdValues.push(p.value - sv);
    macdIdx.push(p.i);
  }
  // signal = EMA of macd values
  const sig: Point[] = [];
  if (macdValues.length >= signal) {
    const k = 2 / (signal + 1);
    let seed = 0;
    for (let i = 0; i < signal; i++) seed += macdValues[i];
    let prev = seed / signal;
    sig.push({ time: data[macdIdx[signal - 1]].time, value: prev });
    for (let i = signal; i < macdValues.length; i++) {
      prev = macdValues[i] * k + prev * (1 - k);
      sig.push({ time: data[macdIdx[i]].time, value: prev });
    }
  }
  // histogram = macd - signal (aligned by index)
  const sigMap = new Map<number, number>();
  for (let i = 0; i < sig.length; i++) sigMap.set(sig[i].time as number, sig[i].value);
  const hist: Point[] = [];
  for (const p of macdLine) {
    const sv = sigMap.get(p.time as number);
    if (sv != null) hist.push({ time: p.time, value: p.value - sv });
  }
  return { macd: macdLine, signal: sig, hist };
}
