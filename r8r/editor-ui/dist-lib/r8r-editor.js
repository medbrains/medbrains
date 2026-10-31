import { jsx as t, jsxs as u, Fragment as Le } from "react/jsx-runtime";
import { createContext as je, useMemo as R, useContext as He, useState as k, useEffect as B, useCallback as z } from "react";
import { Modal as ke, Stack as S, Alert as _e, TextInput as I, Anchor as Ue, Text as f, Group as C, Button as P, PasswordInput as Je, Container as Ne, Title as Ce, Menu as Q, Loader as X, Card as te, Badge as ne, ActionIcon as T, Tooltip as D, Switch as K, ScrollArea as Y, UnstyledButton as Se, SegmentedControl as Ve, Table as _, Code as Ge, Select as $e, Divider as Ke, NumberInput as oe, Textarea as he, JsonInput as Xe, Box as H, Center as ze, Paper as Ye, Tabs as Z, createTheme as qe } from "@mantine/core";
import { notifications as W } from "@mantine/notifications";
import { getBezierPath as Qe, BaseEdge as Ze, EdgeLabelRenderer as et, Handle as me, Position as pe, ReactFlow as tt, Background as nt, BackgroundVariant as rt, Controls as it } from "@xyflow/react";
import { IconArrowLeft as st, IconHistory as at, IconPlayerPlay as ce, IconRefresh as ot, IconX as q, IconSearch as Te, IconCopy as lt, IconBrandGithub as ct, IconBrandSlack as dt, IconWorld as ut, IconPoint as Ee, IconPlayerPause as ht, IconCirclesRelation as mt, IconFilter as pt, IconArrowsSplit2 as ft, IconChartArrowsVertical as gt, IconArrowsSplit as wt, IconCode as yt, IconPencil as vt, IconClock as bt, IconWebhook as xt, IconWand as kt, IconArrowRight as Nt, IconTerminal2 as Ct } from "@tabler/icons-react";
class St extends Error {
  status;
  constructor(n, r) {
    super(n), this.name = "ApiError", this.status = r;
  }
}
function $t(e) {
  async function n(s, i) {
    const a = await fetch(`${e.baseUrl}${s}`, {
      ...e.fetchOptions,
      ...i,
      headers: {
        "content-type": "application/json",
        ...e.fetchOptions?.headers ?? {},
        ...i?.headers ?? {}
      }
    });
    if (!a.ok)
      throw new St(await zt(a), a.status);
    return await a.json();
  }
  const r = (s, i, a) => n(s, { method: i, body: JSON.stringify(a) });
  return {
    nodeTypes: () => n("/node-types"),
    listWorkflows: () => n("/workflows"),
    getWorkflow: (s) => n(`/workflows/${s}`),
    createWorkflow: (s) => r("/workflows", "POST", s),
    updateWorkflow: (s, i) => r(`/workflows/${s}`, "PATCH", i),
    deleteWorkflow: (s) => n(`/workflows/${s}`, { method: "DELETE" }),
    setActive: (s, i) => r(`/workflows/${s}/activate`, "PATCH", { active: i }),
    /** Run the workflow currently on the canvas, saved or not. */
    runUnsaved: (s, i, a) => r("/workflows/run", "POST", {
      workflow: s,
      startNode: i ?? null,
      input: a ?? null
    }),
    runSaved: (s, i) => r(`/workflows/${s}/run`, "POST", { input: i ?? null }),
    credentialTypes: () => n("/credential-types"),
    listCredentials: () => n("/credentials"),
    /** Secrets come back redacted; the real values never leave the server. */
    getCredential: (s) => n(`/credentials/${s}`),
    createCredential: (s) => r("/credentials", "POST", s),
    updateCredential: (s, i) => r(`/credentials/${s}`, "PATCH", i),
    deleteCredential: (s) => n(`/credentials/${s}`, { method: "DELETE" }),
    listExecutions: (s, i = 25) => n(
      `/executions?limit=${i}${s ? `&workflowId=${s}` : ""}`
    ),
    getExecution: (s) => n(`/executions/${s}`),
    deleteExecution: (s) => n(`/executions/${s}`, { method: "DELETE" })
  };
}
async function zt(e) {
  const n = await e.text();
  try {
    const r = JSON.parse(n);
    if (r.error) return r.error;
  } catch {
  }
  return n || `${e.status} ${e.statusText}`;
}
function E(e) {
  return e instanceof Error ? e.message : String(e);
}
const Ae = je(null);
function Tt({
  config: e,
  api: n,
  children: r
}) {
  const s = R(
    () => n ?? $t(e ?? { baseUrl: "/rest" }),
    [n, e]
  );
  return /* @__PURE__ */ t(Ae.Provider, { value: s, children: r });
}
function J() {
  const e = He(Ae);
  if (!e)
    throw new Error("useApi was called outside an <ApiProvider>");
  return e;
}
function de(e, n) {
  const r = e.displayOptions;
  if (!r) return !0;
  const s = (i, a) => i in n && a.some((o) => Et(o, n[i]));
  return Object.entries(r.hide ?? {}).some(([i, a]) => s(i, a)) ? !1 : Object.entries(r.show ?? {}).every(([i, a]) => s(i, a));
}
function Et(e, n) {
  return n === void 0 ? !1 : typeof e != "object" || e === null ? e === n : JSON.stringify(e) === JSON.stringify(n);
}
function At(e, n) {
  const r = n[e.name];
  return r === void 0 ? e.default : r;
}
function Ot(e, n) {
  const r = { ...n };
  let s = !1;
  for (const i of e) {
    if (!de(i, r)) continue;
    const a = r[i.name];
    if (a === void 0) {
      r[i.name] = i.default, s = !0;
      continue;
    }
    i.type === "options" && i.options && i.options.length > 0 && (i.options.some((c) => String(c.value) === String(a)) || (r[i.name] = i.default, s = !0));
  }
  return s ? r : n;
}
function F(e) {
  return typeof e == "string" ? e : e == null ? "" : JSON.stringify(e);
}
function Oe(e) {
  return e === null || typeof e != "object" || Array.isArray(e) ? [] : Object.entries(e);
}
function Ie(e) {
  return Object.fromEntries(e);
}
const Pe = "main", fe = "__r8r_unchanged__";
function De({
  opened: e,
  type: n,
  credentialId: r,
  onClose: s,
  onSaved: i
}) {
  const a = J(), [o, c] = k(""), [m, l] = k({}), [d, p] = k(!1), [v, h] = k(null);
  B(() => {
    if (!(!e || !n)) {
      if (h(null), !r) {
        c(`${n.displayName} account`), l(Object.fromEntries(n.properties.map((b) => [b.name, b.default])));
        return;
      }
      a.getCredential(r).then((b) => {
        c(b.name), l({ ...b.data });
      }).catch((b) => h(E(b)));
    }
  }, [e, n, r]);
  const w = async () => {
    if (n) {
      p(!0), h(null);
      try {
        const b = r ? await a.updateCredential(r, { name: o, data: m }) : await a.createCredential({ name: o, type: n.name, data: m });
        i(b.id), s();
      } catch (b) {
        h(E(b));
      } finally {
        p(!1);
      }
    }
  };
  return /* @__PURE__ */ t(
    ke,
    {
      opened: e,
      onClose: s,
      title: r ? `Edit ${n?.displayName} credential` : `New ${n?.displayName} credential`,
      centered: !0,
      children: /* @__PURE__ */ u(S, { gap: "sm", children: [
        v && /* @__PURE__ */ t(_e, { color: "red", variant: "light", children: v }),
        /* @__PURE__ */ t(
          I,
          {
            label: "Name",
            value: o,
            onChange: (b) => c(b.currentTarget.value),
            description: "How this credential appears when picking it on a node"
          }
        ),
        n?.properties.map((b) => /* @__PURE__ */ t(
          It,
          {
            property: b,
            value: m[b.name] ?? b.default,
            onChange: (L) => l((A) => ({ ...A, [b.name]: L }))
          },
          b.name
        )),
        n?.documentationUrl && /* @__PURE__ */ t(Ue, { href: n.documentationUrl, target: "_blank", rel: "noreferrer", size: "xs", children: "Where do I find this?" }),
        /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", children: "Stored encrypted. Secrets are never sent back to this page." }),
        /* @__PURE__ */ u(C, { justify: "flex-end", gap: "xs", children: [
          /* @__PURE__ */ t(P, { variant: "default", onClick: s, children: "Cancel" }),
          /* @__PURE__ */ t(P, { onClick: () => {
            w();
          }, loading: d, children: "Save" })
        ] })
      ] })
    }
  );
}
function It({
  property: e,
  value: n,
  onChange: r
}) {
  const s = {
    label: e.displayName,
    description: e.description,
    withAsterisk: e.required,
    placeholder: e.placeholder
  };
  if (e.password) {
    const i = n === fe;
    return /* @__PURE__ */ t(
      Je,
      {
        ...s,
        "aria-label": e.displayName,
        value: i ? "" : F(n),
        placeholder: i ? "unchanged — type to replace" : e.placeholder,
        onChange: (a) => r(a.currentTarget.value),
        onBlur: (a) => {
          a.currentTarget.value === "" && r(fe);
        }
      }
    );
  }
  return /* @__PURE__ */ t(
    I,
    {
      ...s,
      "aria-label": e.displayName,
      value: F(n),
      onChange: (i) => r(i.currentTarget.value)
    }
  );
}
function Pt({
  credentialTypes: e
}) {
  const n = J(), [r, s] = k(null), [i, a] = k(null), o = z(async () => {
    try {
      s(await n.listCredentials());
    } catch (l) {
      s([]), W.show({ color: "red", message: E(l) });
    }
  }, []);
  B(() => {
    o();
  }, [o]);
  const c = async (l) => {
    if (confirm(`Delete "${l.name}"? Nodes using it will stop working.`))
      try {
        await n.deleteCredential(l.id), W.show({ message: `Deleted ${l.name}` }), o();
      } catch (d) {
        W.show({ color: "red", message: E(d) });
      }
  }, m = (l) => e.find((d) => d.name === l)?.displayName ?? l;
  return /* @__PURE__ */ u(Ne, { size: "md", py: 40, children: [
    /* @__PURE__ */ u(C, { justify: "space-between", align: "flex-end", mb: "lg", children: [
      /* @__PURE__ */ u("div", { children: [
        /* @__PURE__ */ t(Ce, { order: 2, children: "Credentials" }),
        /* @__PURE__ */ t(f, { c: "dimmed", size: "sm", children: "Stored encrypted, and never sent back to the browser." })
      ] }),
      /* @__PURE__ */ u(Q, { children: [
        /* @__PURE__ */ t(Q.Target, { children: /* @__PURE__ */ t(P, { children: "New credential" }) }),
        /* @__PURE__ */ t(Q.Dropdown, { children: e.map((l) => /* @__PURE__ */ t(Q.Item, { onClick: () => a({ type: l.name }), children: l.displayName }, l.name)) })
      ] })
    ] }),
    r === null && /* @__PURE__ */ t(X, { size: "sm" }),
    r?.length === 0 && /* @__PURE__ */ t(te, { withBorder: !0, padding: "xl", children: /* @__PURE__ */ t(f, { ta: "center", c: "dimmed", children: "No credentials yet. Add one to use the Slack or GitHub nodes." }) }),
    /* @__PURE__ */ t(S, { gap: "xs", children: r?.map((l) => /* @__PURE__ */ t(te, { withBorder: !0, padding: "md", children: /* @__PURE__ */ u(C, { wrap: "nowrap", children: [
      /* @__PURE__ */ u("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ t(f, { fw: 600, truncate: !0, children: l.name }),
        /* @__PURE__ */ u(f, { size: "xs", c: "dimmed", children: [
          "updated ",
          new Date(l.updatedAt).toLocaleString()
        ] })
      ] }),
      /* @__PURE__ */ u(C, { ml: "auto", gap: "xs", wrap: "nowrap", children: [
        /* @__PURE__ */ t(ne, { variant: "light", children: m(l.type) }),
        /* @__PURE__ */ t(
          T,
          {
            variant: "subtle",
            color: "gray",
            "aria-label": `Edit ${l.name}`,
            onClick: () => a({ type: l.type, id: l.id }),
            children: "✎"
          }
        ),
        /* @__PURE__ */ t(
          T,
          {
            variant: "subtle",
            color: "red",
            "aria-label": `Delete ${l.name}`,
            onClick: () => {
              c(l);
            },
            children: "✕"
          }
        )
      ] })
    ] }) }, l.id)) }),
    /* @__PURE__ */ t(
      De,
      {
        opened: i !== null,
        type: e.find((l) => l.name === i?.type),
        credentialId: i?.id,
        onClose: () => a(null),
        onSaved: () => {
          o();
        }
      }
    )
  ] });
}
function le(e) {
  return `${e.from}|${e.port}|${e.to}`;
}
function Me(e) {
  return JSON.stringify({
    name: e.name,
    active: e.active,
    nodes: e.nodes,
    connections: e.connections
  });
}
function ge(e, n) {
  return e !== null && Me(e) !== n;
}
function Dt(e) {
  const n = {};
  for (const r of e.properties)
    de(r, n) && (n[r.name] = r.default);
  return n;
}
function Mt(e, n) {
  const r = new Set(n.map((i) => i.name));
  if (!r.has(e)) return e;
  let s = 1;
  for (; r.has(`${e} ${s}`); ) s += 1;
  return `${e} ${s}`;
}
function Bt(e) {
  return e.length === 0 ? [80, 160] : [e.reduce((r, s) => Math.max(r, s.position[0]), 0) + 260, 160];
}
function Rt(e) {
  return e.nodes.some((n) => n.type === "webhook" || n.type === "schedule");
}
function Wt(e, n) {
  const r = le(n);
  return e.some((s) => le(s) === r) ? [...e] : [...e, n];
}
function Ft(e, n) {
  return !!e && !!n && e !== n;
}
function we(e, n) {
  return {
    ...e,
    nodes: e.nodes.filter((r) => r.id !== n),
    connections: e.connections.filter(
      (r) => r.from !== n && r.to !== n
    )
  };
}
function Lt(e, n, r) {
  return {
    id: r,
    type: e.name,
    name: Mt(e.displayName, n),
    parameters: Dt(e),
    position: Bt(n)
  };
}
function jt(e, n, r) {
  return { from: e, to: n, port: r ?? Pe };
}
function Ht(e) {
  return new Map((e?.runs ?? []).map((n) => [n.nodeId, n]));
}
function _t(e, n, r = Pe) {
  return e.get(n)?.output[r] ?? [];
}
function Ut(e, n, r) {
  return e.connections.filter((s) => s.to === r).flatMap((s) => _t(n, s.from, s.port));
}
function Jt(e, n) {
  const r = e.get(n.from);
  if (!(!r || r.status === "skipped"))
    return r.output[n.port]?.length;
}
function Vt(e) {
  const n = e.runs.filter((r) => r.status !== "skipped");
  return {
    status: e.status,
    ran: n.length,
    skipped: e.runs.length - n.length,
    failed: e.runs.filter((r) => r.status === "error").length,
    totalMs: n.reduce((r, s) => r + s.ms, 0),
    error: e.error
  };
}
function U(e) {
  return e < 1e3 ? `${e}ms` : e < 6e4 ? `${(e / 1e3).toFixed(e < 1e4 ? 2 : 1)}s` : `${Math.floor(e / 6e4)}m ${Math.round(e % 6e4 / 1e3)}s`;
}
function Be(e, n) {
  return `${e} ${n}${e === 1 ? "" : "s"}`;
}
const Gt = 4, ye = 200;
function Kt(e) {
  const n = [], r = /* @__PURE__ */ new Set(), s = (a, o, c) => {
    if (!(n.length >= ye) && a !== null && typeof a == "object" && !Array.isArray(a)) {
      if (c >= Gt) return;
      for (const [m, l] of Object.entries(a)) {
        const d = o ? `${o}.${m}` : m;
        l !== null && typeof l == "object" && !Array.isArray(l) ? (i(d, l), s(l, d, c + 1)) : i(d, l);
      }
      return;
    }
  }, i = (a, o) => {
    r.has(a) || n.length >= ye || (r.add(a), n.push({ path: a, sample: o, kind: Xt(o) }));
  };
  for (const a of e.slice(0, 5))
    s(a, "", 0);
  return n;
}
function Xt(e) {
  return e == null ? "empty" : Array.isArray(e) ? "list" : typeof e;
}
function Yt(e, n, r) {
  const s = e.connections.filter((a) => a.from === n).map((a) => e.nodes.find((o) => o.id === a.to)).filter((a) => a !== void 0), i = [];
  for (const a of s) {
    const o = r.find((c) => c.name === a.type);
    if (o)
      for (const c of o.properties)
        c.name === "resource" || c.name === "operation" || i.includes(c.name) || i.push(c.name);
  }
  return i;
}
function ee(e) {
  return (e.split(".").at(-1) ?? e).replace(/[\s_\-]+/g, "").toLowerCase();
}
function qt(e, n) {
  const r = /* @__PURE__ */ new Set(), s = [], i = (o, c, m) => {
    r.add(m.path), s.push({ destination: o, source: m.path, confidence: c });
  }, a = () => n.filter((o) => !r.has(o.path));
  for (const o of e) {
    const c = ee(o), m = a().find((l) => ee(l.path) === c);
    m && i(o, "exact", m);
  }
  for (const o of e) {
    if (s.some((l) => l.destination === o)) continue;
    const c = ee(o), m = a().find((l) => {
      const d = ee(l.path);
      return d.includes(c) || c.includes(d);
    });
    m && i(o, "similar", m);
  }
  return s;
}
function Qt(e, n) {
  const r = { ...e };
  for (const s of n) {
    const i = r[s.destination];
    (i === void 0 || i === "") && (r[s.destination] = s.source);
  }
  return r;
}
function Zt() {
  return globalThis.crypto?.randomUUID?.() ?? `n${Date.now()}${Math.random().toString(16).slice(2)}`;
}
function en(e) {
  const n = J(), [r, s] = k(null), [i, a] = k(""), [o, c] = k(null), [m, l] = k(null), [d, p] = k("loading"), [v, h] = k(null), w = z((x) => {
    s(x), a(Me(x));
  }, []);
  B(() => {
    let x = !1;
    return p("loading"), n.getWorkflow(e).then((y) => {
      x || (w(y), p(null));
    }).catch((y) => {
      x || (h(E(y)), p(null));
    }), () => {
      x = !0;
    };
  }, [e, w]);
  const b = z((x) => {
    s((y) => y === null ? y : { ...y, name: x });
  }, []), L = z((x, y) => {
    s(
      (N) => N === null ? N : {
        ...N,
        nodes: N.nodes.map(($) => $.id === x ? { ...$, ...y } : $)
      }
    );
  }, []), A = z((x) => {
    s((y) => y === null ? y : we(y, x)), c((y) => y === x ? null : y);
  }, []), V = z((x) => {
    const y = Zt();
    return s(
      (N) => N === null ? N : { ...N, nodes: [...N.nodes, Lt(x, N.nodes, y)] }
    ), c(y), y;
  }, []), j = z((x) => {
    s((y) => {
      if (y === null) return y;
      let N = y;
      for (const $ of x)
        if ($.type === "position" && $.position) {
          const { x: G, y: Fe } = $.position;
          N = {
            ...N,
            nodes: N.nodes.map(
              (se) => se.id === $.id ? { ...se, position: [G, Fe] } : se
            )
          };
        } else $.type === "remove" && (N = we(N, $.id));
      return N;
    });
  }, []), re = z((x) => {
    const y = x.filter((N) => N.type === "remove").map((N) => N.id);
    y.length !== 0 && s((N) => {
      if (N === null) return N;
      const $ = N.connections.filter(
        (G) => !y.includes(`${G.from}|${G.port}|${G.to}`)
      );
      return { ...N, connections: $ };
    });
  }, []), ie = z(
    (x, y, N) => {
      !Ft(x, y) || x === null || y === null || s(
        ($) => $ === null ? $ : {
          ...$,
          connections: Wt(
            $.connections,
            jt(x, y, N)
          )
        }
      );
    },
    []
  ), M = z(async () => {
    if (r !== null) {
      p("saving");
      try {
        w(await n.updateWorkflow(r.id, r)), h(null);
      } catch (x) {
        h(E(x));
      } finally {
        p(null);
      }
    }
  }, [r, w]), g = z(async () => {
    if (r !== null) {
      p("running"), l(null);
      try {
        const x = await n.runUnsaved(r);
        l(x.result), h(x.result.status === "error" ? x.result.error ?? null : null);
      } catch (x) {
        h(E(x));
      } finally {
        p(null);
      }
    }
  }, [r]), O = z(async (x) => {
    try {
      const y = await n.getExecution(x);
      l(y.data), h(null);
    } catch (y) {
      h(E(y));
    }
  }, []), We = z(
    async (x) => {
      if (r !== null)
        try {
          ge(r, i) && await n.updateWorkflow(r.id, r), w(await n.setActive(r.id, x)), h(null);
        } catch (y) {
          h(E(y));
        }
    },
    [r, i, w]
  );
  return {
    workflow: r,
    selectedId: o,
    result: m,
    busy: d,
    dirty: ge(r, i),
    error: v,
    select: c,
    rename: b,
    addNode: V,
    patchNode: L,
    removeNode: A,
    applyNodeChanges: j,
    applyEdgeChanges: re,
    connect: ie,
    save: M,
    run: g,
    loadExecution: O,
    setActive: We,
    clearResult: () => l(null)
  };
}
function tn({
  workflow: e,
  dirty: n,
  busy: r,
  onBack: s,
  onRename: i,
  onSave: a,
  onRun: o,
  onSetActive: c,
  runsOpen: m,
  onToggleRuns: l
}) {
  const d = Rt(e);
  return /* @__PURE__ */ u(C, { px: "sm", py: 8, gap: "sm", wrap: "nowrap", className: "toolbar", children: [
    /* @__PURE__ */ t(T, { variant: "subtle", color: "gray", onClick: s, "aria-label": "Back to workflows", children: /* @__PURE__ */ t(st, { size: 16, stroke: 1.8 }) }),
    /* @__PURE__ */ u(C, { gap: 6, wrap: "nowrap", children: [
      /* @__PURE__ */ t(f, { size: "sm", c: "dimmed", children: "Workflows" }),
      /* @__PURE__ */ t(f, { size: "sm", c: "dimmed", children: "/" }),
      /* @__PURE__ */ t(
        I,
        {
          "aria-label": "Workflow name",
          variant: "unstyled",
          value: e.name,
          onChange: (p) => i(p.currentTarget.value),
          styles: { input: { fontSize: 13.5, fontWeight: 600, height: 24, minHeight: 24 } },
          w: 220
        }
      )
    ] }),
    n && /* @__PURE__ */ t(ne, { variant: "light", color: "yellow", size: "xs", children: "unsaved" }),
    /* @__PURE__ */ u(C, { gap: "sm", ml: "auto", wrap: "nowrap", children: [
      /* @__PURE__ */ t(D, { label: "Previous runs", children: /* @__PURE__ */ t(
        T,
        {
          variant: m ? "light" : "subtle",
          color: "gray",
          "aria-label": "Previous runs",
          onClick: l,
          children: /* @__PURE__ */ t(at, { size: 16, stroke: 1.8 })
        }
      ) }),
      /* @__PURE__ */ t(
        D,
        {
          label: "Add a Webhook or Schedule trigger to run this without you",
          disabled: d,
          children: /* @__PURE__ */ t("span", { children: /* @__PURE__ */ t(
            K,
            {
              label: "Active",
              labelPosition: "left",
              checked: e.active,
              disabled: !d,
              onChange: (p) => c(p.currentTarget.checked)
            }
          ) })
        }
      ),
      /* @__PURE__ */ t(P, { variant: "default", onClick: a, loading: r === "saving", disabled: !n, children: "Save" }),
      /* @__PURE__ */ t(
        P,
        {
          onClick: o,
          loading: r === "running",
          leftSection: /* @__PURE__ */ t(ce, { size: 13, stroke: 2 }),
          children: "Execute"
        }
      )
    ] })
  ] });
}
function nn({
  workflowId: e,
  selectedId: n,
  onOpen: r,
  onClose: s
}) {
  const i = J(), [a, o] = k(null), [c, m] = k(null), l = z(async () => {
    try {
      o(await i.listExecutions(e, 50)), m(null);
    } catch (d) {
      o([]), m(E(d));
    }
  }, [e]);
  return B(() => {
    l();
  }, [l]), /* @__PURE__ */ u(S, { gap: 0, h: "100%", className: "executions-panel", children: [
    /* @__PURE__ */ u(C, { px: "sm", py: 9, gap: "xs", style: { borderBottom: "1px solid var(--line)" }, children: [
      /* @__PURE__ */ t(f, { className: "eyebrow", children: "Previous runs" }),
      /* @__PURE__ */ t(D, { label: "Refresh", children: /* @__PURE__ */ t(T, { variant: "subtle", color: "gray", size: "sm", ml: "auto", "aria-label": "Refresh runs", onClick: () => {
        l();
      }, children: /* @__PURE__ */ t(ot, { size: 13, stroke: 1.8 }) }) }),
      /* @__PURE__ */ t(T, { variant: "subtle", color: "gray", size: "sm", "aria-label": "Close previous runs", onClick: s, children: /* @__PURE__ */ t(q, { size: 13, stroke: 1.8 }) })
    ] }),
    /* @__PURE__ */ u(Y, { style: { flex: 1 }, p: 6, children: [
      a === null && /* @__PURE__ */ t(X, { size: "xs", m: "sm" }),
      c && /* @__PURE__ */ t(f, { size: "xs", c: "red.5", p: "sm", children: c }),
      a?.length === 0 && !c && /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", p: "sm", children: "No runs yet. Press Execute, or activate the workflow and let a trigger fire it." }),
      /* @__PURE__ */ t(S, { gap: 2, children: a?.map((d) => /* @__PURE__ */ u(
        Se,
        {
          className: `execution-row${d.id === n ? " is-open" : ""}`,
          onClick: () => r(d.id),
          children: [
            /* @__PURE__ */ u(C, { gap: 7, wrap: "nowrap", children: [
              /* @__PURE__ */ t(
                "span",
                {
                  className: `status-dot ${d.status === "error" ? "is-error" : "is-ok"}`
                }
              ),
              /* @__PURE__ */ t(f, { size: "xs", fw: 500, children: rn(d.startedAt) }),
              /* @__PURE__ */ t(f, { size: "10px", c: "dimmed", tt: "uppercase", children: d.mode }),
              /* @__PURE__ */ t(f, { size: "xs", className: "metric", c: "dimmed", ml: "auto", children: U(d.ms) })
            ] }),
            d.error && /* @__PURE__ */ t(f, { size: "10px", c: "red.5", truncate: !0, mt: 2, children: d.error })
          ]
        },
        d.id
      )) })
    ] })
  ] });
}
function rn(e) {
  const n = (Date.now() - new Date(e).getTime()) / 1e3;
  return n < 60 ? "just now" : n < 3600 ? `${Math.floor(n / 60)}m ago` : n < 86400 ? `${Math.floor(n / 3600)}h ago` : new Date(e).toLocaleString();
}
const ve = 4e3;
function sn(e, n, r = {}) {
  const s = [];
  let i = 0;
  s.push({
    elapsedMs: 0,
    level: "info",
    scope: "execution",
    message: `started · ${r.mode ?? "manual"} · ${e.nodes.length} nodes`
  });
  for (const a of n.runs)
    s.push(...an(a, i)), i += a.ms;
  return s.push(
    n.status === "error" ? {
      elapsedMs: i,
      level: "error",
      scope: "execution",
      message: `failed after ${U(i)}`,
      detail: n.error
    } : {
      elapsedMs: i,
      level: "info",
      scope: "execution",
      message: `finished in ${U(i)} · ${n.last.length} items out`
    }
  ), s;
}
function an(e, n) {
  const r = e.name || e.type;
  if (e.status === "skipped")
    return [
      { elapsedMs: n, level: "debug", scope: r, message: "skipped · nothing reached it" }
    ];
  if (e.status === "error")
    return [
      {
        elapsedMs: n + e.ms,
        level: "error",
        scope: r,
        message: `failed after ${U(e.ms)}${be(e)}`,
        detail: e.error
      }
    ];
  const s = Object.entries(e.output), i = e.output.main?.length ?? 0, a = [
    {
      elapsedMs: n + e.ms,
      level: "info",
      scope: r,
      message: `ok · ${i} item${i === 1 ? "" : "s"} · ${U(e.ms)}${be(e)}`
    }
  ];
  for (const [o, c] of s)
    a.push({
      elapsedMs: n + e.ms,
      level: "debug",
      scope: r,
      message: `${o === "main" ? "output" : `${o} branch`} · ${c.length} items`,
      detail: on(JSON.stringify(c, null, 2))
    });
  return a;
}
function be(e) {
  return e.tries > 1 ? ` · ${e.tries} tries` : "";
}
function on(e) {
  return e.length <= ve ? e : `${e.slice(0, ve)}
… truncated`;
}
function ln(e, { levels: n, query: r }) {
  const s = r.trim().toLowerCase();
  return e.filter((i) => n.has(i.level) ? s ? `${i.scope} ${i.message} ${i.detail ?? ""}`.toLowerCase().includes(s) : !0 : !1);
}
function cn(e) {
  return e.map((n) => {
    const s = `${`+${String(n.elapsedMs).padStart(5, " ")}ms`} ${n.level.toUpperCase().padEnd(5)} ${n.scope}  ${n.message}`;
    return n.detail ? `${s}
${n.detail}` : s;
  }).join(`
`);
}
const dn = ["info", "warn", "error", "debug"];
function un({
  workflow: e,
  result: n,
  mode: r,
  onClose: s
}) {
  const [i, a] = k(""), [o, c] = k(
    // Debug lines carry the payloads; off until asked for, or the console is
    // unreadable at a glance.
    /* @__PURE__ */ new Set(["info", "warn", "error"])
  ), [m, l] = k(/* @__PURE__ */ new Set()), d = R(() => sn(e, n, { mode: r }), [e, n, r]), p = R(
    () => ln(d, { levels: o, query: i }),
    [d, o, i]
  ), v = (h) => c((w) => {
    const b = new Set(w);
    return b.has(h) ? b.delete(h) : b.add(h), b;
  });
  return /* @__PURE__ */ u("div", { className: "log-console", "data-testid": "log-console", children: [
    /* @__PURE__ */ u(C, { px: "sm", py: 6, gap: "xs", wrap: "nowrap", className: "log-console-bar", children: [
      /* @__PURE__ */ t(f, { className: "eyebrow", children: "Console" }),
      /* @__PURE__ */ t(C, { gap: 4, wrap: "nowrap", children: dn.map((h) => /* @__PURE__ */ t(
        "button",
        {
          type: "button",
          className: `log-level-toggle level-${h}${o.has(h) ? " is-on" : ""}`,
          "aria-pressed": o.has(h),
          onClick: () => v(h),
          children: h
        },
        h
      )) }),
      /* @__PURE__ */ t(
        I,
        {
          "aria-label": "Filter log",
          placeholder: "Filter",
          size: "xs",
          w: 190,
          leftSection: /* @__PURE__ */ t(Te, { size: 12, stroke: 1.8 }),
          value: i,
          onChange: (h) => a(h.currentTarget.value)
        }
      ),
      /* @__PURE__ */ u(f, { size: "xs", c: "dimmed", className: "metric", children: [
        p.length,
        "/",
        d.length
      ] }),
      /* @__PURE__ */ u(C, { gap: 2, ml: "auto", wrap: "nowrap", children: [
        /* @__PURE__ */ t(D, { label: "Copy the console", children: /* @__PURE__ */ t(
          T,
          {
            variant: "subtle",
            color: "gray",
            size: "sm",
            "aria-label": "Copy log",
            onClick: () => {
              navigator.clipboard?.writeText(cn(p));
            },
            children: /* @__PURE__ */ t(lt, { size: 13, stroke: 1.8 })
          }
        ) }),
        /* @__PURE__ */ t(
          T,
          {
            variant: "subtle",
            color: "gray",
            size: "sm",
            "aria-label": "Close console",
            onClick: s,
            children: /* @__PURE__ */ t(q, { size: 13, stroke: 1.8 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ t("div", { className: "log-scroll", children: /* @__PURE__ */ u("div", { className: "log-lines", children: [
      p.length === 0 && /* @__PURE__ */ t("div", { className: "log-empty", children: "Nothing matches the current filter." }),
      p.map((h, w) => {
        const b = m.has(w);
        return /* @__PURE__ */ u("div", { className: `log-line level-${h.level}`, children: [
          /* @__PURE__ */ u(
            "button",
            {
              type: "button",
              className: "log-line-head",
              disabled: !h.detail,
              onClick: () => l((L) => {
                const A = new Set(L);
                return A.has(w) ? A.delete(w) : A.add(w), A;
              }),
              children: [
                /* @__PURE__ */ u("span", { className: "stamp", children: [
                  "+",
                  h.elapsedMs,
                  "ms"
                ] }),
                /* @__PURE__ */ t("span", { className: "level", children: h.level }),
                /* @__PURE__ */ t("span", { className: "scope", children: h.scope }),
                /* @__PURE__ */ t("span", { className: "message", children: h.message }),
                h.detail && /* @__PURE__ */ t("span", { className: "chevron", children: b ? "▾" : "▸" })
              ]
            }
          ),
          b && h.detail && /* @__PURE__ */ t("pre", { className: "log-detail", children: h.detail })
        ] }, w);
      })
    ] }) })
  ] });
}
function hn({
  id: e,
  sourceX: n,
  sourceY: r,
  sourcePosition: s,
  targetX: i,
  targetY: a,
  targetPosition: o,
  data: c,
  selected: m
}) {
  const [l, d, p] = Qe({
    sourceX: n,
    sourceY: r,
    sourcePosition: s,
    targetX: i,
    targetY: a,
    targetPosition: o,
    curvature: 0.35
  }), v = c?.items, h = v !== void 0 && v > 0;
  return /* @__PURE__ */ u(Le, { children: [
    /* @__PURE__ */ t(Ze, { id: e, path: l, className: h ? "wire-live" : void 0 }),
    h && c?.pulse && // Drawn on top of the wire so the dash reads as travelling along it.
    /* @__PURE__ */ t("path", { d: l, fill: "none", className: "wire-pulse" }),
    h && !m && /* @__PURE__ */ t(et, { children: /* @__PURE__ */ t(
      "div",
      {
        className: "wire-badge",
        style: { transform: `translate(-50%, -50%) translate(${d}px, ${p}px)` },
        children: v
      }
    ) })
  ] });
}
const mn = {
  manual: ce,
  webhook: xt,
  schedule: bt,
  set: vt,
  code: yt,
  splitOut: wt,
  aggregate: gt,
  if: ft,
  filter: pt,
  merge: mt,
  wait: ht,
  noOp: Ee,
  httpRequest: ut,
  slack: dt,
  github: ct
};
function ue(e) {
  return mn[e] ?? Ee;
}
const pn = /* @__PURE__ */ new Set(["noOp", "wait"]);
function fn(e, n) {
  return n?.group === "trigger" ? "trigger" : pn.has(e.type) ? "utility" : n?.group === "flow" ? "branch" : "card";
}
const gn = {
  trigger: { width: 150, height: 60 },
  utility: { width: 60, height: 60 },
  branch: { width: 150, height: 60 },
  card: { width: 210, height: 60 }
};
function Re(e, n) {
  const r = (s) => {
    const i = e.parameters[s];
    return typeof i == "string" ? i : i == null ? "" : String(i);
  };
  switch (e.type) {
    case "httpRequest":
      return [r("method") || "GET", yn(r("url"))].filter(Boolean).join(" ");
    case "webhook":
      return `${r("method") || "POST"} /${r("path").replace(/^\/+/, "")}`;
    case "schedule":
      return r("cron");
    case "code":
      return r("mode") === "allItems" ? "all items" : "each item";
    case "set":
      return wn(e);
    case "if":
    case "filter":
      return r("condition");
    case "splitOut":
    case "aggregate":
      return r("field");
    case "wait":
      return `${r("ms") || 0}ms`;
    default:
      return n?.credentials?.length ? [r("resource"), r("operation")].filter(Boolean).join(" · ") : "";
  }
}
function wn(e) {
  if (e.parameters.mode === "json") return "raw JSON";
  const n = e.parameters.fields, r = n && typeof n == "object" && !Array.isArray(n) ? Object.keys(n).length : 0;
  return r === 1 ? "1 field" : `${r} fields`;
}
function yn(e) {
  if (!e) return "";
  const n = e.replace(/^https?:\/\//, "");
  return (n.split(/[/?#]/)[0] ?? "") || n;
}
function vn(e, n) {
  return {
    title: e.name || e.type,
    description: n?.description ?? e.type,
    detail: Re(e, n)
  };
}
function bn({ data: e, selected: n }) {
  const { node: r, description: s, run: i } = e, a = ue(r.type), o = fn(r, s), c = gn[o], m = s?.color ?? "#4a5a72", l = s?.outputs ?? ["main"], d = (s?.inputs ?? ["main"]).length > 0, p = Re(r, s), v = vn(r, s);
  return /* @__PURE__ */ u("div", { className: "flow-node-wrap", style: { width: c.width }, children: [
    /* @__PURE__ */ t(
      D,
      {
        openDelay: 450,
        closeDelay: 80,
        withArrow: !0,
        position: "top",
        label: /* @__PURE__ */ u("span", { className: "node-tip", children: [
          /* @__PURE__ */ t("strong", { children: v.title }),
          /* @__PURE__ */ t("span", { children: v.description }),
          v.detail && /* @__PURE__ */ t("code", { children: v.detail })
        ] }),
        children: /* @__PURE__ */ u(
          "div",
          {
            className: [
              "flow-node",
              `shape-${o}`,
              n ? "selected" : "",
              r.disabled ? "disabled" : "",
              i ? `status-${i.status}` : ""
            ].filter(Boolean).join(" "),
            style: { height: c.height },
            "data-testid": `node-${r.id}`,
            children: [
              d && /* @__PURE__ */ t(me, { type: "target", position: pe.Left }),
              /* @__PURE__ */ t("span", { className: "flow-node-tile", style: { color: m }, children: /* @__PURE__ */ t(a, { size: o === "utility" ? 20 : 18, stroke: 1.7 }) }),
              o !== "utility" && p && /* @__PURE__ */ t("span", { className: "flow-node-detail", title: p, children: p }),
              l.map((h, w) => /* @__PURE__ */ t(
                me,
                {
                  id: h,
                  type: "source",
                  position: pe.Right,
                  style: { top: `${xe(l.length, w)}%` }
                },
                h
              ))
            ]
          }
        )
      }
    ),
    l.length > 1 && l.map((h, w) => /* @__PURE__ */ t(
      "span",
      {
        className: "port-label",
        style: { top: `calc(${xe(l.length, w)}% - 21px)` },
        children: h === "main" ? "true" : h
      },
      h
    )),
    /* @__PURE__ */ t("div", { className: "flow-node-name", title: r.name, children: r.name || r.type }),
    i && /* @__PURE__ */ t(xn, { run: i })
  ] });
}
function xe(e, n) {
  return e === 1 ? 50 : 30 + n * 40;
}
function xn({ run: e }) {
  if (e.status === "skipped")
    return /* @__PURE__ */ t("div", { className: "flow-node-readout is-skipped", children: "not reached" });
  if (e.status === "error")
    return /* @__PURE__ */ t("div", { className: "flow-node-readout is-error", title: e.error, children: e.error ?? "failed" });
  const n = e.output.main?.length ?? 0;
  return /* @__PURE__ */ u("div", { className: "flow-node-readout", children: [
    /* @__PURE__ */ t("span", { className: "metric", children: n }),
    /* @__PURE__ */ t("span", { className: "muted", children: n === 1 ? "item" : "items" }),
    /* @__PURE__ */ t("span", { className: "muted", children: "·" }),
    /* @__PURE__ */ t("span", { className: "metric", children: e.ms }),
    /* @__PURE__ */ t("span", { className: "muted", children: "ms" })
  ] });
}
function ae({
  items: e,
  empty: n,
  label: r
}) {
  const [s, i] = k("table"), a = kn(e), o = a.length > 0 && a.length <= 12;
  return /* @__PURE__ */ u(S, { gap: 6, h: "100%", style: { minHeight: 0 }, children: [
    /* @__PURE__ */ u(C, { gap: "xs", wrap: "nowrap", children: [
      /* @__PURE__ */ t(f, { className: "eyebrow", children: r }),
      /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", className: "metric", children: Be(e.length, "item") }),
      o && /* @__PURE__ */ t(
        Ve,
        {
          size: "xs",
          ml: "auto",
          value: s,
          onChange: (c) => i(c),
          data: [
            { value: "table", label: "Table" },
            { value: "json", label: "JSON" }
          ]
        }
      )
    ] }),
    e.length === 0 ? /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", py: "md", children: n }) : /* @__PURE__ */ u(Y, { style: { flex: 1, minHeight: 0 }, children: [
      o && s === "table" ? /* @__PURE__ */ u(_, { striped: !0, withTableBorder: !0, highlightOnHover: !0, fz: "xs", horizontalSpacing: 8, children: [
        /* @__PURE__ */ t(_.Thead, { children: /* @__PURE__ */ t(_.Tr, { children: a.map((c) => /* @__PURE__ */ t(_.Th, { style: { whiteSpace: "nowrap" }, children: c }, c)) }) }),
        /* @__PURE__ */ t(_.Tbody, { children: e.slice(0, 50).map((c, m) => (
          // Items have no identity of their own; position is the key.
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
          /* @__PURE__ */ t(_.Tr, { children: a.map((l) => /* @__PURE__ */ t(_.Td, { className: "cell", children: Nn(c[l]) }, l)) }, m)
        )) })
      ] }) : /* @__PURE__ */ t(Ge, { block: !0, fz: 11, children: JSON.stringify(e, null, 2) }),
      e.length > 50 && /* @__PURE__ */ u(f, { size: "xs", c: "dimmed", pt: 6, children: [
        "Showing the first 50 of ",
        e.length,
        "."
      ] })
    ] })
  ] });
}
function kn(e) {
  const n = /* @__PURE__ */ new Set();
  for (const r of e.slice(0, 50))
    for (const s of Object.keys(r)) n.add(s);
  return [...n];
}
function Nn(e) {
  return e == null ? "—" : typeof e == "string" ? e : JSON.stringify(e);
}
function Cn({
  requirement: e,
  credentialTypes: n,
  selectedId: r,
  onSelect: s
}) {
  const i = J(), [a, o] = k([]), [c, m] = k(null), [l, d] = k(null), p = n.find((w) => w.name === e.name), v = z(async () => {
    try {
      const w = await i.listCredentials();
      o(w.filter((b) => b.type === e.name)), d(null);
    } catch (w) {
      d(E(w));
    }
  }, [e.name]);
  B(() => {
    v();
  }, [v]);
  const h = p?.displayName ?? e.name;
  return /* @__PURE__ */ u(S, { gap: 6, children: [
    /* @__PURE__ */ u(C, { gap: 6, align: "flex-end", wrap: "nowrap", children: [
      /* @__PURE__ */ t(
        $e,
        {
          style: { flex: 1 },
          label: `${h} credential`,
          withAsterisk: e.required,
          placeholder: a.length === 0 ? "None saved yet" : "Select…",
          data: a.map((w) => ({
            value: w.id,
            label: w.name
          })),
          value: r ?? null,
          onChange: (w) => s(w ?? void 0),
          nothingFoundMessage: "Create one with +"
        }
      ),
      r && /* @__PURE__ */ t(D, { label: "Edit this credential", children: /* @__PURE__ */ t(
        T,
        {
          variant: "default",
          size: "lg",
          "aria-label": "Edit credential",
          onClick: () => m("existing"),
          children: "✎"
        }
      ) }),
      /* @__PURE__ */ t(D, { label: `New ${h} credential`, children: /* @__PURE__ */ t(
        T,
        {
          variant: "default",
          size: "lg",
          "aria-label": "New credential",
          onClick: () => m("new"),
          children: "+"
        }
      ) })
    ] }),
    l && /* @__PURE__ */ t(f, { size: "xs", c: "red.5", children: l }),
    /* @__PURE__ */ t(
      De,
      {
        opened: c !== null,
        type: p,
        credentialId: c === "existing" ? r : void 0,
        onClose: () => m(null),
        onSaved: (w) => {
          s(w), v();
        }
      }
    )
  ] });
}
function Sn({
  value: e,
  input: n,
  destinations: r,
  onChange: s
}) {
  const i = Oe(e), a = R(() => Kt(n), [n]), o = (l) => s(Ie(l)), c = () => {
    const l = [.../* @__PURE__ */ new Set([...r, ...i.map(([d]) => d)])];
    s(Qt(Object.fromEntries(i), qt(l, a)));
  }, m = r.filter((l) => !i.some(([d]) => d === l));
  return /* @__PURE__ */ u(S, { gap: 8, children: [
    /* @__PURE__ */ u(C, { gap: "xs", wrap: "nowrap", children: [
      /* @__PURE__ */ t(f, { size: "xs", fw: 500, children: "Field Mappings" }),
      /* @__PURE__ */ t(
        D,
        {
          label: a.length === 0 ? "Run the workflow first so there are incoming fields to match" : "Fill in every row whose names match",
          children: /* @__PURE__ */ t("span", { style: { marginLeft: "auto" }, children: /* @__PURE__ */ t(
            P,
            {
              variant: "default",
              size: "compact-xs",
              leftSection: /* @__PURE__ */ t(kt, { size: 12, stroke: 1.8 }),
              disabled: a.length === 0,
              onClick: c,
              children: "Auto-map"
            }
          ) })
        }
      )
    ] }),
    /* @__PURE__ */ u("div", { className: "mapper-head", children: [
      /* @__PURE__ */ t(f, { className: "eyebrow", children: "Destination" }),
      /* @__PURE__ */ t("span", {}),
      /* @__PURE__ */ t(f, { className: "eyebrow", children: "Source" }),
      /* @__PURE__ */ t("span", {})
    ] }),
    i.map(([l, d], p) => (
      // Rows are positional: a destination may be blank while being typed.
      // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
      /* @__PURE__ */ u("div", { className: "mapper-row", children: [
        /* @__PURE__ */ t(
          I,
          {
            "aria-label": `Destination ${p + 1}`,
            placeholder: "customer.name",
            value: l,
            onChange: (v) => {
              const h = [...i];
              h[p] = [v.currentTarget.value, d], o(h);
            }
          }
        ),
        /* @__PURE__ */ t(Nt, { size: 13, stroke: 1.6, className: "mapper-arrow" }),
        /* @__PURE__ */ t(
          I,
          {
            "aria-label": `Source ${p + 1}`,
            placeholder: "full_name or {{ expression }}",
            value: F(d),
            onChange: (v) => {
              const h = [...i];
              h[p] = [l, v.currentTarget.value], o(h);
            }
          }
        ),
        /* @__PURE__ */ t(
          T,
          {
            variant: "subtle",
            color: "gray",
            "aria-label": `Remove mapping ${p + 1}`,
            onClick: () => o(i.filter((v, h) => h !== p)),
            children: /* @__PURE__ */ t(q, { size: 13, stroke: 1.8 })
          }
        )
      ] }, p)
    )),
    /* @__PURE__ */ t(P, { variant: "default", size: "compact-xs", onClick: () => o([...i, ["", ""]]), children: "+ Add mapping" }),
    m.length > 0 && /* @__PURE__ */ u(S, { gap: 4, children: [
      /* @__PURE__ */ t(f, { className: "eyebrow", children: "Expected by the next node" }),
      /* @__PURE__ */ t(C, { gap: 4, children: m.map((l) => /* @__PURE__ */ u(
        ne,
        {
          variant: "default",
          size: "xs",
          style: { cursor: "pointer" },
          onClick: () => o([...i, [l, ""]]),
          children: [
            "+ ",
            l
          ]
        },
        l
      )) })
    ] }),
    /* @__PURE__ */ u(S, { gap: 4, children: [
      /* @__PURE__ */ t(f, { className: "eyebrow", children: "Available from the previous node" }),
      a.length === 0 ? /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", children: "Run the workflow to see what reaches this node." }) : /* @__PURE__ */ t(Y.Autosize, { mah: 180, children: /* @__PURE__ */ t(S, { gap: 1, children: a.map((l) => /* @__PURE__ */ u(
        "button",
        {
          type: "button",
          className: "source-field",
          onClick: () => o([...i, ["", l.path]]),
          children: [
            /* @__PURE__ */ t("span", { className: "path", children: l.path }),
            /* @__PURE__ */ t("span", { className: "kind", children: l.kind }),
            /* @__PURE__ */ t("span", { className: "sample", children: $n(l.sample) })
          ]
        },
        l.path
      )) }) })
    ] })
  ] });
}
function $n(e) {
  const n = F(e);
  return n.length > 28 ? `${n.slice(0, 28)}…` : n;
}
function zn({
  node: e,
  description: n,
  credentialTypes: r,
  input: s,
  destinations: i,
  onPatch: a,
  onDelete: o
}) {
  const c = n?.properties ?? [], m = (d, p) => a({
    parameters: Ot(c, { ...e.parameters, [d]: p })
  }), l = (d, p) => {
    const v = { ...e.credentials ?? {} };
    p ? v[d] = p : delete v[d], a({ credentials: v });
  };
  return /* @__PURE__ */ t(Y, { h: "100%", px: "md", py: "sm", children: /* @__PURE__ */ u(S, { gap: "sm", children: [
    n?.credentials?.map((d) => /* @__PURE__ */ t(
      Cn,
      {
        requirement: d,
        credentialTypes: r,
        selectedId: e.credentials?.[d.name],
        onSelect: (p) => l(d.name, p)
      },
      d.name
    )),
    c.map(
      (d) => de(d, e.parameters) ? /* @__PURE__ */ t(
        Tn,
        {
          property: d,
          value: At(d, e.parameters),
          input: s,
          destinations: i,
          onChange: (p) => m(d.name, p)
        },
        d.name
      ) : null
    ),
    c.length === 0 && /* @__PURE__ */ t(f, { size: "sm", c: "dimmed", ta: "center", py: "lg", children: "This node has nothing to configure." }),
    /* @__PURE__ */ t(Ke, { label: "Settings", labelPosition: "left", mt: "xs" }),
    /* @__PURE__ */ t(
      K,
      {
        label: "Continue when this node fails",
        description: "Emit an error item downstream instead of stopping the run",
        checked: e.onError === "continue",
        onChange: (d) => a({ onError: d.currentTarget.checked ? "continue" : null })
      }
    ),
    /* @__PURE__ */ t(
      K,
      {
        label: "Retry on failure",
        checked: !!e.retryOnFail,
        onChange: (d) => a({ retryOnFail: d.currentTarget.checked })
      }
    ),
    e.retryOnFail && /* @__PURE__ */ u(C, { grow: !0, gap: "xs", children: [
      /* @__PURE__ */ t(
        oe,
        {
          label: "Max tries",
          min: 1,
          max: 10,
          value: e.maxTries ?? 3,
          onChange: (d) => a({ maxTries: Number(d) || 3 })
        }
      ),
      /* @__PURE__ */ t(
        oe,
        {
          label: "Wait between (ms)",
          min: 0,
          step: 500,
          value: e.waitBetweenTriesMs ?? 1e3,
          onChange: (d) => a({ waitBetweenTriesMs: Number(d) || 0 })
        }
      )
    ] }),
    /* @__PURE__ */ t(
      K,
      {
        label: "Disabled",
        description: "Skip this node without removing it",
        checked: !!e.disabled,
        onChange: (d) => a({ disabled: d.currentTarget.checked })
      }
    ),
    /* @__PURE__ */ t(P, { color: "red", variant: "light", onClick: o, mt: "xs", children: "Delete node" })
  ] }) });
}
function Tn({
  property: e,
  value: n,
  input: r,
  destinations: s,
  onChange: i
}) {
  const a = {
    label: e.displayName,
    description: e.description,
    withAsterisk: e.required,
    placeholder: e.placeholder
  };
  switch (e.type) {
    case "boolean":
      return /* @__PURE__ */ t(
        K,
        {
          label: e.displayName,
          description: e.description,
          checked: !!n,
          onChange: (o) => i(o.currentTarget.checked)
        }
      );
    case "number":
      return /* @__PURE__ */ t(
        oe,
        {
          ...a,
          value: Number(n ?? 0),
          onChange: (o) => i(Number(o) || 0)
        }
      );
    case "options": {
      const o = e.options?.find((c) => String(c.value) === String(n));
      return /* @__PURE__ */ t(
        $e,
        {
          ...a,
          description: o?.action ?? e.description,
          data: (e.options ?? []).map((c) => ({
            value: String(c.value),
            label: c.name
          })),
          value: String(n ?? ""),
          allowDeselect: !1,
          onChange: (c) => i(c ?? "")
        }
      );
    }
    case "json":
      return /* @__PURE__ */ t(
        Xe,
        {
          ...a,
          autosize: !0,
          minRows: 4,
          formatOnBlur: !0,
          validationError: "Not valid JSON",
          value: F(n),
          onChange: i
        }
      );
    case "code":
      return /* @__PURE__ */ t(
        he,
        {
          ...a,
          autosize: !0,
          minRows: 6,
          maxRows: 18,
          spellCheck: !1,
          styles: {
            input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12.5 }
          },
          value: F(n),
          onChange: (o) => i(o.currentTarget.value)
        }
      );
    case "multilineString":
      return /* @__PURE__ */ t(
        he,
        {
          ...a,
          autosize: !0,
          minRows: 3,
          value: F(n),
          onChange: (o) => i(o.currentTarget.value)
        }
      );
    case "fieldMapper":
      return /* @__PURE__ */ t(
        Sn,
        {
          value: n,
          input: r,
          destinations: s,
          onChange: i
        }
      );
    case "keyValue":
      return /* @__PURE__ */ t(En, { property: e, value: n, onChange: i });
    default:
      return /* @__PURE__ */ t(
        I,
        {
          ...a,
          value: F(n),
          onChange: (o) => i(o.currentTarget.value)
        }
      );
  }
}
function En({
  property: e,
  value: n,
  onChange: r
}) {
  const s = Oe(n), i = (a) => r(Ie(a));
  return /* @__PURE__ */ u(S, { gap: 6, children: [
    /* @__PURE__ */ u(f, { size: "xs", fw: 500, children: [
      e.displayName,
      e.required && /* @__PURE__ */ t("span", { style: { color: "var(--mantine-color-red-5)" }, children: " *" })
    ] }),
    s.map(([a, o], c) => (
      // Index is the identity here: keys are edited in place and may repeat
      // or be blank while the user is typing.
      // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
      /* @__PURE__ */ u(C, { gap: 6, wrap: "nowrap", children: [
        /* @__PURE__ */ t(
          I,
          {
            "aria-label": `${e.displayName} key ${c + 1}`,
            placeholder: "key",
            style: { flex: "0 0 38%" },
            value: a,
            onChange: (m) => {
              const l = [...s];
              l[c] = [m.currentTarget.value, o], i(l);
            }
          }
        ),
        /* @__PURE__ */ t(
          I,
          {
            "aria-label": `${e.displayName} value ${c + 1}`,
            placeholder: "value or {{ expression }}",
            style: { flex: 1 },
            value: F(o),
            onChange: (m) => {
              const l = [...s];
              l[c] = [a, m.currentTarget.value], i(l);
            }
          }
        ),
        /* @__PURE__ */ t(
          T,
          {
            variant: "subtle",
            color: "gray",
            "aria-label": `Remove ${e.displayName} row ${c + 1}`,
            onClick: () => i(s.filter((m, l) => l !== c)),
            children: "✕"
          }
        )
      ] }, c)
    )),
    /* @__PURE__ */ t(P, { variant: "default", size: "compact-xs", onClick: () => i([...s, ["", ""]]), children: "+ Add" }),
    e.description && /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", children: e.description })
  ] });
}
function An({
  node: e,
  description: n,
  credentialTypes: r,
  input: s,
  destinations: i,
  run: a,
  onPatch: o,
  onDelete: c,
  onClose: m,
  onExecute: l,
  executing: d
}) {
  const p = ue(e.type), v = a?.output.main ?? [], h = Object.entries(a?.output ?? {}).filter(([w]) => w !== "main");
  return /* @__PURE__ */ u(
    ke,
    {
      opened: !0,
      onClose: m,
      size: "min(1180px, 94vw)",
      padding: 0,
      withCloseButton: !1,
      centered: !0,
      styles: { body: { height: "min(720px, 84vh)", display: "flex", flexDirection: "column" } },
      children: [
        /* @__PURE__ */ u(
          C,
          {
            px: "md",
            py: 10,
            gap: "sm",
            wrap: "nowrap",
            style: { borderBottom: "1px solid var(--line)", flex: "0 0 auto" },
            children: [
              /* @__PURE__ */ t("span", { className: "flow-node-tile", style: { color: n?.color, width: 30, height: 30 }, children: /* @__PURE__ */ t(p, { size: 17, stroke: 1.7 }) }),
              /* @__PURE__ */ t(
                I,
                {
                  "aria-label": "Node name",
                  variant: "unstyled",
                  value: e.name,
                  placeholder: n?.displayName,
                  onChange: (w) => o({ name: w.currentTarget.value }),
                  styles: { input: { fontSize: 15, fontWeight: 600, height: 24, minHeight: 24 } },
                  w: 280
                }
              ),
              /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", children: n?.displayName ?? e.type }),
              /* @__PURE__ */ u(C, { gap: "xs", ml: "auto", wrap: "nowrap", children: [
                a && /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", className: "metric", children: U(a.ms) }),
                /* @__PURE__ */ t(D, { label: "Run the workflow", children: /* @__PURE__ */ t(
                  T,
                  {
                    variant: "default",
                    size: "md",
                    "aria-label": "Execute node",
                    loading: d,
                    onClick: l,
                    children: /* @__PURE__ */ t(ce, { size: 14, stroke: 1.8 })
                  }
                ) }),
                /* @__PURE__ */ t(T, { variant: "subtle", color: "gray", size: "md", "aria-label": "Close", onClick: m, children: /* @__PURE__ */ t(q, { size: 16, stroke: 1.8 }) })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ u(H, { className: "ndv-panes", children: [
          /* @__PURE__ */ t(H, { className: "ndv-pane", children: /* @__PURE__ */ t(
            ae,
            {
              label: "Input",
              items: s,
              empty: n?.group === "trigger" ? "A trigger starts the run, so nothing comes in." : "Run the workflow to see what reaches this node."
            }
          ) }),
          /* @__PURE__ */ t(H, { className: "ndv-pane ndv-pane-form", children: /* @__PURE__ */ t(
            zn,
            {
              node: e,
              description: n,
              credentialTypes: r,
              input: s,
              destinations: i,
              onPatch: o,
              onDelete: c
            }
          ) }),
          /* @__PURE__ */ t(H, { className: "ndv-pane", children: a?.status === "error" ? /* @__PURE__ */ u(S, { gap: 6, children: [
            /* @__PURE__ */ t(f, { className: "eyebrow", children: "Output" }),
            /* @__PURE__ */ t(f, { size: "xs", c: "red.5", style: { wordBreak: "break-word" }, children: a.error })
          ] }) : /* @__PURE__ */ u(S, { gap: "sm", h: "100%", style: { minHeight: 0 }, children: [
            /* @__PURE__ */ t(
              ae,
              {
                label: "Output",
                items: v,
                empty: a ? "This node produced nothing." : "Run the workflow to see the result."
              }
            ),
            h.map(([w, b]) => /* @__PURE__ */ t(
              ae,
              {
                label: `${w} branch`,
                items: b,
                empty: "Nothing took this branch."
              },
              w
            ))
          ] }) })
        ] })
      ]
    }
  );
}
const On = ["trigger", "input", "transform", "flow", "output"], In = {
  trigger: "Start with",
  input: "Fetch",
  transform: "Change",
  flow: "Route",
  output: "Send to"
};
function Pn({
  nodeTypes: e,
  onAdd: n
}) {
  const [r, s] = k(""), i = R(() => {
    const a = r.trim().toLowerCase();
    return a ? e.filter(
      (o) => `${o.displayName} ${o.name} ${o.description}`.toLowerCase().includes(a)
    ) : e;
  }, [e, r]);
  return /* @__PURE__ */ u(S, { gap: 0, h: "100%", children: [
    /* @__PURE__ */ t("div", { style: { padding: 10, borderBottom: "1px solid var(--line)" }, children: /* @__PURE__ */ t(
      I,
      {
        "aria-label": "Search nodes",
        placeholder: "Search nodes",
        leftSection: /* @__PURE__ */ t(Te, { size: 13, stroke: 1.8 }),
        value: r,
        onChange: (a) => s(a.currentTarget.value)
      }
    ) }),
    /* @__PURE__ */ u(Y, { style: { flex: 1 }, p: 8, children: [
      i.length === 0 && /* @__PURE__ */ u(f, { size: "xs", c: "dimmed", ta: "center", py: "lg", children: [
        "No node matches “",
        r,
        "”."
      ] }),
      /* @__PURE__ */ t(S, { gap: "md", children: On.map((a) => {
        const o = i.filter((c) => c.group === a);
        return o.length === 0 ? null : /* @__PURE__ */ u(S, { gap: 2, children: [
          /* @__PURE__ */ t(f, { className: "eyebrow", px: 8, pb: 2, children: In[a] }),
          o.map((c) => /* @__PURE__ */ t(Dn, { type: c, onAdd: n }, c.name))
        ] }, a);
      }) })
    ] })
  ] });
}
function Dn({
  type: e,
  onAdd: n
}) {
  const r = ue(e.name);
  return /* @__PURE__ */ t(
    D,
    {
      label: e.description,
      position: "right",
      openDelay: 500,
      withArrow: !0,
      multiline: !0,
      w: 220,
      children: /* @__PURE__ */ t(Se, { className: "palette-item", onClick: () => n(e), children: /* @__PURE__ */ u(C, { gap: 9, wrap: "nowrap", children: [
        /* @__PURE__ */ t(
          "span",
          {
            style: {
              color: e.color,
              display: "grid",
              placeItems: "center",
              width: 22,
              height: 22,
              flex: "0 0 auto"
            },
            children: /* @__PURE__ */ t(r, { size: 16, stroke: 1.7 })
          }
        ),
        /* @__PURE__ */ t(f, { size: "sm", truncate: !0, children: e.displayName }),
        e.credentials?.length ? /* @__PURE__ */ t(f, { size: "10px", c: "dimmed", ml: "auto", style: { flex: "0 0 auto" }, children: "auth" }) : null
      ] }) })
    }
  );
}
function Mn({
  result: e,
  consoleOpen: n,
  onToggleConsole: r,
  onClose: s
}) {
  const i = Vt(e), a = i.status === "error";
  return /* @__PURE__ */ u(C, { px: "md", py: 7, gap: "md", wrap: "nowrap", className: "run-summary", "data-testid": "run-summary", children: [
    /* @__PURE__ */ u(C, { gap: 7, wrap: "nowrap", children: [
      /* @__PURE__ */ t("span", { className: `status-dot ${a ? "is-error" : "is-ok"}` }),
      /* @__PURE__ */ t(f, { size: "xs", fw: 600, c: a ? "red.5" : "teal.4", children: a ? "Failed" : "Succeeded" })
    ] }),
    /* @__PURE__ */ u(f, { size: "xs", c: "dimmed", children: [
      Be(i.ran, "node"),
      " ran",
      i.skipped > 0 && ` · ${i.skipped} not reached`
    ] }),
    /* @__PURE__ */ t(D, { label: "Total time across every node that ran", children: /* @__PURE__ */ t(f, { size: "xs", className: "metric", c: "signal.4", children: U(i.totalMs) }) }),
    i.error && /* @__PURE__ */ t(f, { size: "xs", c: "red.5", truncate: !0, style: { minWidth: 0 }, children: i.error }),
    /* @__PURE__ */ t(
      P,
      {
        variant: n ? "light" : "default",
        size: "compact-xs",
        ml: "auto",
        leftSection: /* @__PURE__ */ t(Ct, { size: 12, stroke: 1.8 }),
        onClick: r,
        children: "Console"
      }
    ),
    /* @__PURE__ */ t(
      T,
      {
        variant: "subtle",
        color: "gray",
        size: "sm",
        "aria-label": "Dismiss run summary",
        onClick: s,
        children: /* @__PURE__ */ t(q, { size: 13, stroke: 1.8 })
      }
    )
  ] });
}
const Bn = { r8r: bn }, Rn = { wire: hn }, Wn = 1100;
function Fn({
  workflowId: e,
  nodeTypes: n,
  credentialTypes: r,
  onBack: s
}) {
  const i = en(e), { workflow: a, result: o, selectedId: c } = i, [m, l] = k(null), [d, p] = k(!1), [v, h] = k(!1), [w, b] = k(), [L, A] = k(!1), V = R(() => new Map(n.map((g) => [g.name, g])), [n]), j = R(() => Ht(o), [o]);
  B(() => {
    i.error && W.show({ color: "red", message: i.error });
  }, [i.error]), B(() => {
    if (!o) return;
    p(!0);
    const g = window.setTimeout(() => p(!1), Wn);
    return () => window.clearTimeout(g);
  }, [o]), B(() => {
    const g = (O) => {
      (O.metaKey || O.ctrlKey) && O.key === "s" && (O.preventDefault(), i.save());
    };
    return window.addEventListener("keydown", g), () => window.removeEventListener("keydown", g);
  }, [i.save]);
  const re = R(
    () => (a?.nodes ?? []).map((g) => ({
      id: g.id,
      type: "r8r",
      position: { x: g.position[0], y: g.position[1] },
      selected: g.id === c,
      data: { node: g, description: V.get(g.type), run: j.get(g.id) }
    })),
    [a?.nodes, c, V, j]
  ), ie = R(
    () => (a?.connections ?? []).map((g) => ({
      id: le(g),
      type: "wire",
      source: g.from,
      target: g.to,
      sourceHandle: g.port,
      data: { items: Jt(j, g), pulse: d }
    })),
    [a?.connections, j, d]
  );
  if (a === null)
    return /* @__PURE__ */ t(ze, { h: "100%", children: i.busy === "loading" ? /* @__PURE__ */ t(X, { size: "sm" }) : /* @__PURE__ */ t(f, { c: "dimmed", children: "Not found." }) });
  const M = a.nodes.find((g) => g.id === m);
  return /* @__PURE__ */ u(H, { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [
    /* @__PURE__ */ t(
      tn,
      {
        workflow: a,
        dirty: i.dirty,
        busy: i.busy,
        onBack: s,
        onRename: i.rename,
        onSave: () => {
          i.save();
        },
        onRun: () => {
          i.run();
        },
        onSetActive: (g) => {
          i.setActive(g);
        },
        runsOpen: v,
        onToggleRuns: () => h((g) => !g)
      }
    ),
    /* @__PURE__ */ u(H, { style: { display: "flex", flex: 1, minHeight: 0 }, children: [
      /* @__PURE__ */ t(Ye, { w: 220, radius: 0, className: "palette-rail", children: /* @__PURE__ */ t(
        Pn,
        {
          nodeTypes: n,
          onAdd: (g) => {
            const O = i.addNode(g);
            l(O);
          }
        }
      ) }),
      /* @__PURE__ */ u("div", { className: "canvas-wrap", "data-testid": "canvas", children: [
        /* @__PURE__ */ u(
          tt,
          {
            nodes: re,
            edges: ie,
            nodeTypes: Bn,
            edgeTypes: Rn,
            onNodesChange: i.applyNodeChanges,
            onEdgesChange: i.applyEdgeChanges,
            onConnect: (g) => i.connect(g.source, g.target, g.sourceHandle),
            onNodeClick: (g, O) => i.select(O.id),
            onNodeDoubleClick: (g, O) => l(O.id),
            onPaneClick: () => i.select(null),
            fitView: !0,
            fitViewOptions: { padding: 0.25, maxZoom: 1 },
            proOptions: { hideAttribution: !0 },
            deleteKeyCode: ["Backspace", "Delete"],
            colorMode: "dark",
            children: [
              /* @__PURE__ */ t(nt, { variant: rt.Dots, gap: 20, size: 1, color: "#1c2430" }),
              /* @__PURE__ */ t(it, { showInteractive: !1, position: "bottom-left" })
            ]
          }
        ),
        a.nodes.length === 0 && /* @__PURE__ */ u("div", { className: "canvas-empty", children: [
          /* @__PURE__ */ t(f, { size: "sm", fw: 600, children: "Start with a trigger" }),
          /* @__PURE__ */ t(f, { size: "xs", c: "dimmed", children: "Pick one from the left, then chain nodes onto it." })
        ] })
      ] }),
      v && /* @__PURE__ */ t(
        nn,
        {
          workflowId: e,
          selectedId: w,
          onOpen: (g) => {
            b(g), i.loadExecution(g);
          },
          onClose: () => h(!1)
        }
      )
    ] }),
    o && /* @__PURE__ */ t(
      Mn,
      {
        result: o,
        consoleOpen: L,
        onToggleConsole: () => A((g) => !g),
        onClose: () => {
          i.clearResult(), A(!1);
        }
      }
    ),
    o && L && /* @__PURE__ */ t(
      un,
      {
        workflow: a,
        result: o,
        onClose: () => A(!1)
      }
    ),
    M && /* @__PURE__ */ t(
      An,
      {
        node: M,
        description: V.get(M.type),
        credentialTypes: r,
        input: Ut(a, j, M.id),
        destinations: Yt(a, M.id, n),
        run: j.get(M.id),
        executing: i.busy === "running",
        onPatch: (g) => i.patchNode(M.id, g),
        onDelete: () => {
          i.removeNode(M.id), l(null);
        },
        onExecute: () => {
          i.run();
        },
        onClose: () => l(null)
      }
    )
  ] });
}
function Ln({ onOpen: e }) {
  const n = J(), [r, s] = k(null), i = () => n.listWorkflows().then(s).catch((c) => {
    s([]), W.show({ color: "red", message: E(c) });
  });
  B(() => {
    i();
  }, []);
  const a = async () => {
    try {
      const c = await n.createWorkflow({
        name: "My workflow",
        nodes: [
          {
            id: crypto.randomUUID(),
            type: "manual",
            name: "When clicking Execute",
            parameters: {},
            position: [80, 160]
          }
        ],
        connections: []
      });
      e(c.id);
    } catch (c) {
      W.show({ color: "red", message: E(c) });
    }
  }, o = async (c, m) => {
    if (c.stopPropagation(), !!confirm(`Delete "${m.name}" and its execution history?`))
      try {
        await n.deleteWorkflow(m.id), W.show({ message: `Deleted ${m.name}` }), i();
      } catch (l) {
        W.show({ color: "red", message: E(l) });
      }
  };
  return /* @__PURE__ */ u(Ne, { size: "md", py: 40, children: [
    /* @__PURE__ */ u(C, { justify: "space-between", align: "flex-end", mb: "lg", children: [
      /* @__PURE__ */ u("div", { children: [
        /* @__PURE__ */ t(Ce, { order: 2, children: "Workflows" }),
        /* @__PURE__ */ t(f, { c: "dimmed", size: "sm", children: "Build a graph, wire a trigger, activate it." })
      ] }),
      /* @__PURE__ */ t(P, { onClick: a, children: "New workflow" })
    ] }),
    r === null && /* @__PURE__ */ t(X, { size: "sm" }),
    r?.length === 0 && /* @__PURE__ */ t(te, { withBorder: !0, padding: "xl", children: /* @__PURE__ */ t(f, { ta: "center", c: "dimmed", children: "Nothing here yet. Create your first workflow." }) }),
    /* @__PURE__ */ t(S, { gap: "xs", children: r?.map((c) => /* @__PURE__ */ t(
      te,
      {
        withBorder: !0,
        padding: "md",
        onClick: () => e(c.id),
        style: { cursor: "pointer" },
        children: /* @__PURE__ */ u(C, { wrap: "nowrap", children: [
          /* @__PURE__ */ u("div", { style: { minWidth: 0 }, children: [
            /* @__PURE__ */ t(f, { fw: 600, truncate: !0, children: c.name }),
            /* @__PURE__ */ u(f, { size: "xs", c: "dimmed", children: [
              c.nodes.length,
              " node",
              c.nodes.length === 1 ? "" : "s",
              " · updated",
              " ",
              jn(c.updatedAt)
            ] })
          ] }),
          /* @__PURE__ */ u(C, { ml: "auto", gap: "xs", wrap: "nowrap", children: [
            /* @__PURE__ */ t(ne, { variant: "light", color: c.active ? "teal" : "gray", children: c.active ? "active" : "inactive" }),
            /* @__PURE__ */ t(
              T,
              {
                variant: "subtle",
                color: "red",
                "aria-label": "Delete",
                onClick: (m) => o(m, c),
                children: "✕"
              }
            )
          ] })
        ] })
      },
      c.id
    )) })
  ] });
}
function jn(e) {
  if (!e) return "never";
  const n = (Date.now() - new Date(e).getTime()) / 1e3;
  return n < 60 ? "just now" : n < 3600 ? `${Math.floor(n / 60)}m ago` : n < 86400 ? `${Math.floor(n / 3600)}h ago` : new Date(e).toLocaleDateString();
}
function qn({
  apiBase: e = "/rest",
  fetchOptions: n,
  api: r,
  route: s,
  onRouteChange: i,
  withChrome: a = !0
}) {
  return /* @__PURE__ */ t(Tt, { config: { baseUrl: e, fetchOptions: n }, api: r, children: /* @__PURE__ */ t(Hn, { route: s, onRouteChange: i, withChrome: a }) });
}
function Hn({
  route: e,
  onRouteChange: n,
  withChrome: r
}) {
  const s = J(), [i, a] = k({ view: "workflows" }), [o, c] = k(null), m = e ?? i, l = z(
    (d) => {
      a(d), n?.(d);
    },
    [n]
  );
  return B(() => {
    let d = !1;
    return Promise.all([s.nodeTypes(), s.credentialTypes()]).then(([p, v]) => {
      d || c({ nodeTypes: p, credentialTypes: v });
    }).catch((p) => {
      d || (c({ nodeTypes: [], credentialTypes: [] }), W.show({
        color: "red",
        title: "Could not reach the automation server",
        message: E(p)
      }));
    }), () => {
      d = !0;
    };
  }, [s]), o === null ? /* @__PURE__ */ t(ze, { h: "100%", children: /* @__PURE__ */ t(X, { size: "sm" }) }) : m.view === "editor" ? /* @__PURE__ */ t(
    Fn,
    {
      workflowId: m.workflowId,
      nodeTypes: o.nodeTypes,
      credentialTypes: o.credentialTypes,
      onBack: () => l({ view: "workflows" })
    }
  ) : /* @__PURE__ */ u(H, { style: { display: "flex", flexDirection: "column", height: "100%" }, children: [
    r && /* @__PURE__ */ u(
      C,
      {
        px: "md",
        pt: 10,
        gap: "md",
        align: "flex-end",
        style: { borderBottom: "1px solid var(--line)", flex: "0 0 auto" },
        children: [
          /* @__PURE__ */ t(
            Z,
            {
              value: m.view,
              onChange: (d) => l(d === "credentials" ? { view: "credentials" } : { view: "workflows" }),
              styles: { root: { border: 0 }, list: { border: 0 } },
              children: /* @__PURE__ */ u(Z.List, { children: [
                /* @__PURE__ */ t(Z.Tab, { value: "workflows", children: "Workflows" }),
                /* @__PURE__ */ t(Z.Tab, { value: "credentials", children: "Credentials" })
              ] })
            }
          ),
          /* @__PURE__ */ u(f, { size: "xs", c: "dimmed", ml: "auto", pb: 12, children: [
            o.nodeTypes.length,
            " nodes · ",
            o.credentialTypes.length,
            " credential types"
          ] })
        ]
      }
    ),
    /* @__PURE__ */ t(H, { style: { flex: 1, minHeight: 0, overflow: "auto" }, children: m.view === "workflows" ? /* @__PURE__ */ t(Ln, { onOpen: (d) => l({ view: "editor", workflowId: d }) }) : /* @__PURE__ */ t(Pt, { credentialTypes: o.credentialTypes }) })
  ] });
}
const _n = [
  "#e6fbfa",
  "#c8f5f3",
  "#98ece9",
  "#63e2de",
  "#3ddbd9",
  "#22c9c7",
  "#17a5a4",
  "#137f7f",
  "#125f60",
  "#0f4547"
], Un = [
  "#e6edf7",
  "#c3ccdb",
  "#8898ae",
  "#66768f",
  "#333f52",
  "#232d3c",
  "#1c2430",
  "#141a23",
  "#0f141c",
  "#0a0e14"
], Qn = qe({
  primaryColor: "signal",
  colors: { signal: _n, dark: Un },
  primaryShade: { light: 6, dark: 5 },
  // Cyan on dark needs dark text to stay legible; let Mantine work it out.
  autoContrast: !0,
  luminanceThreshold: 0.4,
  defaultRadius: "sm",
  white: "#ffffff",
  black: "#0a0e14",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  headings: {
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "1.5rem", lineHeight: "1.25" },
      h2: { fontSize: "1.25rem", lineHeight: "1.3" },
      h3: { fontSize: "1rem", lineHeight: "1.4" }
    }
  },
  // Tight, functional scale — this is a dense tool, not a landing page.
  fontSizes: {
    xs: "11px",
    sm: "12.5px",
    md: "13.5px",
    lg: "15px",
    xl: "18px"
  },
  components: {
    Button: { defaultProps: { size: "xs" } },
    TextInput: { defaultProps: { size: "xs" } },
    Textarea: { defaultProps: { size: "xs" } },
    NumberInput: { defaultProps: { size: "xs" } },
    Select: { defaultProps: { size: "xs" } },
    JsonInput: { defaultProps: { size: "xs" } },
    PasswordInput: { defaultProps: { size: "xs" } },
    Switch: { defaultProps: { size: "sm" } },
    Badge: { defaultProps: { radius: "sm" } },
    Modal: { defaultProps: { radius: "md" } }
  }
});
export {
  St as ApiError,
  Tt as ApiProvider,
  qn as AutomationEditor,
  $t as createApi,
  E as describeError,
  Qn as r8rTheme,
  J as useApi
};
