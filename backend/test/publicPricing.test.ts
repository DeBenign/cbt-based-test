import test from "node:test";
import assert from "node:assert/strict";
import { getPublicPricing } from "../src/controllers/publicController";
import { termFee } from "../src/utils/billingConfig";

function call() {
  const headers: Record<string, string> = {};
  let body: any;
  const res: any = { set: (k: string, v: string) => { headers[k] = v; return res; }, json: (b: any) => { body = b; return res; } };
  getPublicPricing({} as any, res);
  return { headers, body };
}

test("public pricing exposes the same numbers billing charges, and nothing private", () => {
  const { headers, body } = call();
  assert.equal(body.currency, "NGN");
  assert.equal(body.trialDays, 90);
  assert.equal(termFee(0), body.minTermFee);                       // small school pays the minimum
  assert.equal(termFee(1000), 1000 * body.pricePerStudentPerTerm); // large school pays per student
  assert.deepEqual(Object.keys(body).sort(), ["currency", "maxTermsPerPayment", "minTermFee", "onlinePaymentsEnabled", "pricePerStudentPerTerm", "termDays", "trialDays"]);
  assert.match(headers["Cache-Control"], /public/);
});
