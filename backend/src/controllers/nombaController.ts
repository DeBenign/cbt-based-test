import { Response, Request } from "express";
import { AuthedRequest } from "../middleware/auth";
import School from "../models/School";
import { createCheckoutOrder } from "../services/nombaClient";
import { applyPayment } from "../services/paymentService";
import { verifyNombaSignature } from "../utils/verifyNombaWebhook";
import User from "../models/User";
import { termFee, MAX_TERMS_PER_PAYMENT, onlinePaymentsEnabled } from "../utils/billingConfig";

// Admin: starts a Nomba checkout for their own school. The amount is worked out
// on the server (students x price per term x number of terms) -- never taken
// from the browser.
export async function initiatePayment(req: AuthedRequest, res: Response) {
  if (!onlinePaymentsEnabled()) {
    return res.status(503).json({ error: "Online payment isn't switched on yet. Please pay your school's fee in cash and ask the platform owner to record it." });
  }

  const terms = Number(req.body.terms);
  const email = req.body.email;
  if (!Number.isInteger(terms) || terms < 1 || terms > MAX_TERMS_PER_PAYMENT) {
    return res.status(400).json({ error: `terms must be a whole number from 1 to ${MAX_TERMS_PER_PAYMENT}` });
  }

  const school = await School.findById(req.user!.schoolId);
  if (!school) return res.status(404).json({ error: "School not found" });

  const studentCount = await User.countDocuments({ schoolId: school._id, role: "student" });
  const amount = termFee(studentCount, school.pricePerStudent) * terms;
  // The number of terms rides along in the reference so the webhook can read it back.
  const orderReference = `school-${school._id}-t${terms}-${Date.now()}`;

  try {
    const { checkoutLink } = await createCheckoutOrder({
      amountNaira: amount,
      orderReference,
      callbackUrl: `${process.env.FRONTEND_URL}/admin/billing`,
      customerEmail: email || "billing@debenign.school",
      customerId: school._id.toString()
    });
    res.json({ checkoutLink, orderReference, amount, terms });
  } catch (err: any) {
    res.status(502).json({ error: err.message || "Couldn't start payment with Nomba" });
  }
}

// Public -- called by Nomba's servers, not a logged-in user. The HMAC
// signature is what proves the request genuinely came from Nomba.
export async function handleNombaWebhook(req: Request, res: Response) {
  const signature = req.headers["nomba-signature"] as string | undefined;
  const rawBody = (req as any).rawBody as string;

  if (!verifyNombaSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const payload = req.body;
  if (payload.event_type !== "payment_success") {
    return res.status(200).json({ received: true });
  }

  const order = payload.data?.order;
  const schoolId = order?.customerId;
  const reference = order?.orderReference;
  const amount = order?.amount;

  if (!schoolId || !reference) {
    return res.status(400).json({ error: "Missing customerId or orderReference in webhook payload" });
  }

  // The number of terms isn't part of Nomba's payload -- it was put in the
  // order reference when the checkout was created ("...-t2-...").
  const termsMatch = String(reference).match(/-t(\d+)-/);
  const terms = termsMatch ? Math.min(MAX_TERMS_PER_PAYMENT, Math.max(1, Number(termsMatch[1]))) : 1;

  try {
    await applyPayment({ schoolId, amount, reference, terms, method: "nomba" });
    res.status(200).json({ received: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}