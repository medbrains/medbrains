// node scripts/check-erlang.mjs — the OPD wait calculator's queueing maths,
// against values with a closed form or a published table.
import assert from "node:assert/strict";
import { erlangC, mmc, opdVisit } from "../src/lib/erlang.js";

const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} ≠ ${want}`);

// One server: Erlang C equals utilisation, and M/M/1 waits are ρ/(μ−λ).
near(erlangC(0.5, 1), 0.5, 1e-12, "C(0.5, 1)");
const one = mmc(6, 1, 5); // 6/h, 5 min: ρ = 0.5, Wq = 5 min, Lq = 0.5
near(one.waitMin, 5, 1e-9, "M/M/1 Wq"); near(one.queue, 0.5, 1e-9, "M/M/1 Lq");
// Two servers: C = 2ρ²/(1+ρ).
near(erlangC(1.5, 2), (2 * 0.75 ** 2) / 1.75, 1e-12, "C(1.5, 2)");
// a = 2 on three servers: C = 4/9 exactly.
near(erlangC(2, 3), 4 / 9, 1e-12, "C(2, 3)");
// Call Centre Helper's worked example (callcentrehelper.com/erlang-c-formula-1608.htm):
// 10 Erlangs on 11, 12, 13, 14 agents waits with probability 0.6821, 0.4494, 0.2853,
// 0.1741; with a 3-minute handle time, 14 agents answer 88.8% within 20 seconds.
[[11, 0.6821], [12, 0.4494], [13, 0.2853], [14, 0.1741]].forEach(([n, p]) => near(erlangC(10, n), p, 5e-5, `C(10, ${n})`));
near(1 - mmc(200, 14, 3).overMin(20 / 60), 0.888, 5e-4, "service level 20 s");
// Large c stays finite (the factorial formula would overflow).
assert.ok(Number.isFinite(erlangC(180, 200)), "C(180, 200) finite");
// Waiting-time tail: P(W > 0) is C itself.
near(mmc(36, 3, 4).overMin(0), mmc(36, 3, 4).pWait, 1e-12, "tail at 0");

// Utilisation at or over 1 means the queue grows without bound.
const full = mmc(12, 1, 5);
assert.equal(full.stable, false); assert.equal(full.waitMin, Infinity);
// No lab or pharmacy share: that step adds nothing.
const v = opdVisit({ perHour: 6, desks: 1, regMin: 5, doctors: 1, consultMin: 5, extraPct: 0, counters: 1, extraMin: 10 });
near(v.totalMin, 5 + 5 + 5 + 5, 1e-9, "visit total");
// An overloaded lab counter makes the whole visit unstable.
assert.equal(opdVisit({ perHour: 6, desks: 1, regMin: 5, doctors: 1, consultMin: 5, extraPct: 100, counters: 1, extraMin: 10 }).stable, false);
console.log("erlang ok");
