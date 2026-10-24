// OPD queue estimate: each step (registration, doctor, lab or pharmacy) is an
// M/M/c queue: random (Poisson) arrivals, random (exponential) service times,
// c identical servers, first come first served. Steps in a row are treated as
// independent queues (Burke's theorem: an M/M/c queue's departures are Poisson),
// so their waits add up.

/**
 * Erlang C: the probability an arrival has to wait, for offered load
 * a = λ/μ on c servers. Uses the Erlang B recursion, which stays stable for
 * large c where the factorial formula overflows. Needs a < c.
 */
export function erlangC(a, c) {
  let b = 1;
  for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
  const rho = a / c;
  return b / (1 - rho * (1 - b));
}

/**
 * @param {number} perHour arrivals per hour
 * @param {number} servers desks, rooms or counters (whole number ≥ 1)
 * @param {number} minutes average service time per patient
 * @returns {{ utilisation: number, stable: boolean, pWait: number,
 *   waitMin: number, queue: number, overMin: (t: number) => number }}
 *   wait and queue are Infinity when the step cannot keep up.
 */
export function mmc(perHour, servers, minutes) {
  const c = Math.max(1, Math.floor(servers));
  const lambda = Math.max(0, perHour) / 60; // per minute
  if (lambda === 0 || minutes <= 0) {
    return { utilisation: 0, stable: true, pWait: 0, waitMin: 0, queue: 0, overMin: () => 0 };
  }
  const mu = 1 / minutes;
  const a = lambda / mu;
  const utilisation = a / c;
  if (utilisation >= 1) {
    return { utilisation, stable: false, pWait: 1, waitMin: Infinity, queue: Infinity, overMin: () => 1 };
  }
  const pWait = erlangC(a, c);
  const drain = c * mu - lambda;
  const waitMin = pWait / drain;
  return {
    utilisation, stable: true, pWait, waitMin, queue: lambda * waitMin,
    // P(wait > t) = C · e^(−(cμ − λ)t)
    overMin: (t) => pWait * Math.exp(-drain * t),
  };
}

/**
 * The whole OPD visit.
 * @param {{ perHour: number, desks: number, regMin: number, doctors: number,
 *   consultMin: number, extraPct: number, counters: number, extraMin: number }} i
 */
export function opdVisit(i) {
  const share = Math.min(100, Math.max(0, i.extraPct)) / 100;
  const registration = mmc(i.perHour, i.desks, i.regMin);
  const doctor = mmc(i.perHour, i.doctors, i.consultMin);
  const extra = mmc(i.perHour * share, i.counters, i.extraMin);
  const steps = [registration, doctor, extra];
  const stable = steps.every((s) => s.stable);
  // Average patient: every step's wait, plus service; lab/pharmacy only for its share.
  const totalMin = stable
    ? registration.waitMin + i.regMin + doctor.waitMin + i.consultMin + share * (extra.waitMin + i.extraMin)
    : Infinity;
  return { registration, doctor, extra, stable, totalMin };
}
