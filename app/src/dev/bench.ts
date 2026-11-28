/**
 * Optional diagnostics bridge for the V3 benchmark harness.
 * Import from source files only while `?bench=1` is present.
 * No camera frames, landmarks, photos or user content are recorded.
 */
export type BenchSnapshot = {
  samples: Record<string, number[]>;
  counters: Record<string, number>;
};

declare global {
  interface Window {
    __auroraBench?: {
      record(name: string, value: number): void;
      count(name: string, amount?: number): void;
      snapshot(): BenchSnapshot;
      reset(): void;
    };
  }
}

const enabled = new URLSearchParams(location.search).has('bench');
const samples: Record<string, number[]> = Object.create(null);
const counters: Record<string, number> = Object.create(null);

if (enabled) {
  window.__auroraBench = {
    record(name, value) {
      if (!Number.isFinite(value)) return;
      (samples[name] ??= []).push(value);
    },
    count(name, amount = 1) {
      counters[name] = (counters[name] ?? 0) + amount;
    },
    snapshot() {
      return JSON.parse(JSON.stringify({ samples, counters })) as BenchSnapshot;
    },
    reset() {
      for (const key of Object.keys(samples)) delete samples[key];
      for (const key of Object.keys(counters)) delete counters[key];
    }
  };
}

export function benchRecord(name: string, value: number): void {
  if (enabled) window.__auroraBench?.record(name, value);
}
export function benchCount(name: string, amount = 1): void {
  if (enabled) window.__auroraBench?.count(name, amount);
}
