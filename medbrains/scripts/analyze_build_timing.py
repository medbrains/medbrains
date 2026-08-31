#!/usr/bin/env python3
"""Read a `cargo build --timings` report and say where the time went.

    python3 scripts/analyze_build_timing.py [report.html] [--top N]

Defaults to the newest report in target/cargo-timings/.

Three numbers matter and they answer different questions:

  total CPU       how much work there is. Reduce it by compiling less
                  (fewer crates, fewer features, sccache).
  critical path   the floor if you had infinite cores. Reduce it by
                  breaking the longest dependency chain.
  parallelism     total CPU / wall. Near your core count means you are
                  throughput-bound, so only less work helps. Far below it
                  means you are path-bound, so the chain is the problem.

Wall clock is NOT in the report; pass --wall MM:SS to get parallelism.
Do not compare two runs unless both had an idle machine -- a build taken
under load measures the load, not the change.
"""
import json, re, sys, glob, os

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = {a.split('=')[0]: (a.split('=')[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
top = int(opts.get('--top', 15))

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = args[0] if args else max(glob.glob(f'{here}/target/cargo-timings/cargo-timing-2*.html'), key=os.path.getmtime)
units = json.loads(re.search(r'const UNIT_DATA = (\[.*?\]);', open(path, errors='ignore').read(), re.S).group(1))

by = {u['i']: u for u in units}
succ = {u['i']: u.get('unblocked_units', []) for u in units}
sys.setrecursionlimit(50000)
memo = {}
def longest(i):
    if i in memo: return memo[i]
    best = (by[i]['duration'], [i])
    for j in succ.get(i, []):
        d, p = longest(j)
        if by[i]['duration'] + d > best[0]:
            best = (by[i]['duration'] + d, [i] + p)
    memo[i] = best
    return best

cpu = sum(u['duration'] for u in units)
cp = max((longest(u['i']) for u in units), key=lambda r: r[0])
ours = lambda u: u['name'].startswith(('medbrains-', 'r8r-'))
mine = sum(u['duration'] for u in units if ours(u))

print(f"report: {os.path.basename(path)}")
print(f"  units          {len(units)}")
print(f"  total CPU      {cpu/60:.1f} min   (workspace {mine/60:.1f} | deps {(cpu-mine)/60:.1f})")
print(f"  critical path  {cp[0]/60:.2f} min  <- floor, however many cores")
if '--wall' in opts:
    m, s = opts['--wall'].split(':')
    wall = int(m) * 60 + int(s)
    cores = os.cpu_count() or 1
    print(f"  wall           {wall/60:.2f} min   parallelism {cpu/wall:.1f}x on {cores} cores"
          f" ({100*cpu/wall/cores:.0f}% utilised)")
    print(f"  path is {100*cp[0]/wall:.0f}% of wall")
    # No verdict: both levers usually apply at once, and a confident
    # one-word answer here would be wrong as often as right. High
    # utilisation means less work helps; a path near wall means the chain
    # helps. Read both numbers.

print(f"\ncritical path ({len([i for i in cp[1] if by[i]['duration']>1])} units over 1s):")
for i in cp[1]:
    if by[i]['duration'] > 1:
        print(f"  {by[i]['duration']:7.1f}s  {by[i]['name']} [{by[i]['mode']}]")

print(f"\ntop {top} by duration:")
for u in sorted(units, key=lambda z: -z['duration'])[:top]:
    print(f"  {u['duration']:7.1f}s  {u['name']} {u.get('version','')}{'   <- workspace' if ours(u) else ''}")
