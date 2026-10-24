// node scripts/check-dhis.mjs — the incentive estimator's money rules.
import assert from "node:assert/strict";
import { estimateDhis } from "../src/lib/dhis.js";

const z = { major: 0, other: 0, requested: 0, supplied: 0 };
assert.equal(estimateDhis({ ...z, major: 100 }).payable, 0); // under the threshold
assert.equal(estimateDhis({ ...z, major: 150 }).payable, 500); // 50 × ₹10
assert.equal(estimateDhis({ ...z, major: 100, other: 60 }).payable, 600); // 60 ₹5s go first, then 40 ₹10s
assert.equal(estimateDhis({ ...z, other: 300, requested: 20, supplied: 10 }).payable, 1250); // (310−100)×5 + 20×10
assert.equal(estimateDhis({ ...z, major: -5 }).payable, 0);
console.log("dhis ok");
