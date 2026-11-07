import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthedRequest } from "../middleware/auth";
import School from "../models/School";
import User from "../models/User";
import Payment from "../models/Payment";
import { buildReceipt, ensureReceiptNo } from "../utils/receipt";
import { applyPayment, voidPayment } from "../services/paymentService";
import { ensureTrialDates, getAccessStatus, accessExpiry } from "../utils/schoolAccess";
import { clearAccountCache } from "../utils/accountCheck";
import { emailReceiptForPayment } from "../services/paymentEmail";
import { getMonthTotalsBySchool, effectiveLimit } from "../services/aiUsage";
import { AI_MODEL } from "../services/questionGenerator";
import { TERM_DAYS, MAX_TERMS_PER_PAYMENT, effectivePrice, termFee, onlinePaymentsEnabled } from "../utils/billingConfig";

const TRIAL_DAYS = 90; // ~one term -- change this one line if your terms run differently

export async function createSchool(req: AuthedRequest, res: Response) {
  try {
    const { schoolName, address, adminName, adminEmail, adminPassword } = req.body;

    const existingSchool = await School.findOne({ name: schoolName });
    if (existingSchool) return res.status(409).json({ error: "A school with this name already exists" });

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) return res.status(409).json({ error: "Email already registered" });

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const school = await School.create({ name: schoolName, address, trialEndsAt });

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await User.create({
      schoolId: school._id,
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "admin"
    });

    return res.status(201).json({
      school: { id: school._id, name: school.name, address: school.address, isActive: school.isActive, trialEndsAt: school.trialEndsAt },
      admin: { id: admin._id, name: admin.name, email: admin.email }
    });
  } catch (err) {
    return res.status(500).json({ error: "Couldn't create school" });
  }
}

export async function listSchools(_req: AuthedRequest, res: Response) {
  const schools = await School.find().sort({ createdAt: -1 });
  const aiTotals = await getMonthTotalsBySchool();
  const withDetails = await Promise.all(
    schools.map(async (s) => {
      const admins = await User.find({ schoolId: s._id, role: "admin" }).select("name email");
      const studentCount = await User.countDocuments({ schoolId: s._id, role: "student" });
      return {
        id: s._id,
        name: s.name,
        address: s.address,
        isActive: s.isActive,
        createdAt: s.createdAt,
        trialEndsAt: s.trialEndsAt,
        subscriptionStatus: s.subscriptionStatus,
        subscriptionPaidUntil: s.subscriptionPaidUntil,
        accessEndsAt: accessExpiry(s).endsAt,
        accessDaysLeft: accessExpiry(s).daysLeft,
        studentCount,
        pricePerStudent: effectivePrice(s.pricePerStudent),
        hasCustomPrice: !!s.pricePerStudent,
        termFee: termFee(studentCount, s.pricePerStudent),
        adminCount: admins.length,
        admins: admins.map((a) => ({ name: a.name, email: a.email })),
        aiLimit: effectiveLimit(s.aiMonthlyLimit),
        hasCustomAiLimit: typeof s.aiMonthlyLimit === "number",
        aiUsedThisMonth: aiTotals.get(String(s._id))?.used ?? 0,
        aiRequestsThisMonth: aiTotals.get(String(s._id))?.requests ?? 0,
        aiCostUsdThisMonth: Math.round((aiTotals.get(String(s._id))?.costUsd ?? 0) * 10000) / 10000,
        aiModel: AI_MODEL,
        termDays: TERM_DAYS,
        maxTerms: MAX_TERMS_PER_PAYMENT
      };
    })
  );
  res.json(withDetails);
}

// Superadmin sets how many AI questions one school may keep per month.
// limit = null puts the school back on the platform default; 0 switches AI off for it.
export async function setSchoolAiLimit(req: AuthedRequest, res: Response) {
  const { limit } = req.body as { limit?: number | null };
  let update: Record<string, unknown>;
  if (limit === null || limit === undefined) {
    update = { $unset: { aiMonthlyLimit: 1 } };
  } else if (Number.isInteger(limit) && limit >= 0 && limit <= 100000) {
    update = { $set: { aiMonthlyLimit: limit } };
  } else {
    return res.status(400).json({ error: "The limit must be a whole number from 0 to 100,000, or empty for the default." });
  }
  const school = await School.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!school) return res.status(404).json({ error: "School not found" });
  res.json({ aiLimit: effectiveLimit(school.aiMonthlyLimit), hasCustomAiLimit: typeof school.aiMonthlyLimit === "number" });
}

export async function setSchoolActive(req: AuthedRequest, res: Response) {
  const { isActive } = req.body;
  const school = await School.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!school) return res.status(404).json({ error: "School not found" });
  clearAccountCache();
  res.json(school);
}

// Superadmin confirms a payment was received (cash, today). The Nomba webhook
// calls the same applyPayment, just automatically instead of by hand.
// One payment covers one or more school TERMS (not months).
export async function recordPayment(req: AuthedRequest, res: Response) {
  const { amount, reference, terms, termLabel } = req.body;
  const amountNum = Number(amount);
  const termsNum = Number(terms);

  if (!amountNum || amountNum <= 0 || !reference || !String(reference).trim()) {
    return res.status(400).json({ error: "amount and reference are required" });
  }
  if (!Number.isInteger(termsNum) || termsNum < 1 || termsNum > MAX_TERMS_PER_PAYMENT) {
    return res.status(400).json({ error: `terms must be a whole number from 1 to ${MAX_TERMS_PER_PAYMENT}` });
  }

  try {
    const result = await applyPayment({
      schoolId: req.params.id,
      amount: amountNum,
      reference: String(reference).trim(),
      terms: termsNum,
      termLabel: termLabel ? String(termLabel).trim() : undefined,
      method: "manual",
      confirmedBy: req.user!.userId
    });
    if ("alreadyProcessed" in result) {
      return res.status(409).json({ error: "A payment with this reference already exists" });
    }
    res.json({
      message: "Payment recorded",
      subscriptionPaidUntil: result.subscriptionPaidUntil,
      daysLeft: Math.ceil((result.subscriptionPaidUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      paymentId: result.paymentId,
      receiptNo: result.receiptNo,
      receiptEmail: result.receiptEmail
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// Superadmin sets (or clears) a school's own per-student term price.
export async function setSchoolPricing(req: AuthedRequest, res: Response) {
  const raw = req.body.pricePerStudent;
  const clear = raw === null || raw === "" || raw === undefined;
  const price = Number(raw);
  if (!clear && (!isFinite(price) || price <= 0)) {
    return res.status(400).json({ error: "pricePerStudent must be a positive number, or empty to use the default" });
  }
  const school = await School.findByIdAndUpdate(
    req.params.id,
    clear ? { $unset: { pricePerStudent: 1 } } : { pricePerStudent: price },
    { new: true }
  );
  if (!school) return res.status(404).json({ error: "School not found" });
  res.json({ pricePerStudent: effectivePrice(school.pricePerStudent), hasCustomPrice: !!school.pricePerStudent });
}

// Admin: their own school's trial/subscription status + payment history.
export async function getBillingStatus(req: AuthedRequest, res: Response) {
  const school = await School.findById(req.user!.schoolId);
  if (!school) return res.status(404).json({ error: "School not found" });

  await ensureTrialDates(school);
  const { trialActive, paidActive } = getAccessStatus(school);

  const payments = await Payment.find({ schoolId: school._id }).sort({ confirmedAt: -1 });
  const studentCount = await User.countDocuments({ schoolId: school._id, role: "student" });
  const now = Date.now();
  const trialDaysLeft = Math.max(0, Math.ceil((school.trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)));

  res.json({
    subscriptionStatus: school.subscriptionStatus,
    trialEndsAt: school.trialEndsAt,
    trialDaysLeft,
    isTrialActive: trialActive,
    subscriptionPaidUntil: school.subscriptionPaidUntil,
    isPaidActive: paidActive,
    accessBlocked: !trialActive && !paidActive,
    studentCount,
    pricePerStudent: effectivePrice(school.pricePerStudent),
    termFee: termFee(studentCount, school.pricePerStudent),
    termDays: TERM_DAYS,
    onlinePaymentsEnabled: onlinePaymentsEnabled(),
    accessEndsAt: accessExpiry(school).endsAt,
    accessDaysLeft: accessExpiry(school).daysLeft,
    payments: payments.map((p) => ({
      id: p._id,
      status: p.status,
      receiptNo: p.receiptNo ?? null,
      amount: p.amount,
      reference: p.status === "voided" ? p.originalReference || p.reference : p.reference,
      method: p.method,
      terms: p.terms ?? null,
      termLabel: p.termLabel ?? null,
      periodMonths: p.periodMonths ?? null, // only on payments recorded before per-term billing
      confirmedAt: p.confirmedAt
    }))
  });
}

// ---- payment history, undo and receipts ----

// Superadmin: one school's payments (voided ones included, marked as such).
export async function listSchoolPayments(req: AuthedRequest, res: Response) {
  const payments = await Payment.find({ schoolId: req.params.id }).sort({ confirmedAt: -1, _id: -1 });
  const latest = payments.find((p) => p.status !== "voided");
  res.json(
    payments.map((p) => ({
      id: p._id,
      status: p.status,
      receiptNo: p.receiptNo ?? null,
      amount: p.amount,
      reference: p.status === "voided" ? p.originalReference || p.reference : p.reference,
      method: p.method,
      terms: p.terms ?? null,
      termLabel: p.termLabel ?? null,
      confirmedAt: p.confirmedAt,
      voidedAt: p.voidedAt ?? null,
      voidReason: p.voidReason ?? null,
      // The only one that can be undone is the newest, manual one (the server re-checks).
      canVoid: p.status !== "voided" && p.method === "manual" && !!p.paidUntilAfter && !!latest && latest._id.equals(p._id)
    }))
  );
}

// Superadmin: undo a wrongly recorded cash payment (needs a written reason).
export async function voidSchoolPayment(req: AuthedRequest, res: Response) {
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) return res.status(400).json({ error: "Give a reason (at least a few words)." });

  const result = await voidPayment({
    schoolId: req.params.id,
    paymentId: req.params.paymentId,
    reason,
    voidedBy: req.user!.userId
  });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  res.json({ message: "Payment cancelled. The school's access date has been restored.", subscriptionPaidUntil: result.subscriptionPaidUntil });
}

async function sendReceipt(schoolId: string, paymentId: string, includeVoidReason: boolean, res: Response) {
  const [school, payment] = await Promise.all([
    School.findById(schoolId).select("name address"),
    Payment.findOne({ _id: paymentId, schoolId })
  ]);
  if (!school || !payment) return res.status(404).json({ error: "Receipt not found" });
  await ensureReceiptNo(payment);
  res.json(buildReceipt(payment, school, { includeVoidReason }));
}

// Superadmin: (re)send a payment's receipt to the school's admins.
export async function emailSchoolReceipt(req: AuthedRequest, res: Response) {
  const result = await emailReceiptForPayment(req.params.id, req.params.paymentId);
  if ("status" in result) return res.status(result.status).json({ error: result.error });
  res.json({ receiptEmail: result });
}

// School admin: email this receipt to myself.
export async function emailMyReceipt(req: AuthedRequest, res: Response) {
  const result = await emailReceiptForPayment(req.user!.schoolId, req.params.paymentId, req.user!.userId);
  if ("status" in result) return res.status(result.status).json({ error: result.error });
  const { error: _technicalReason, ...safe } = result; // the SMTP reason is for the platform owner, not a school
  res.json({ receiptEmail: safe });
}

export async function getSchoolReceipt(req: AuthedRequest, res: Response) {
  return sendReceipt(req.params.id, req.params.paymentId, true, res);
}

// School admin: receipts for their own school only (the school comes from the token).
export async function getMyReceipt(req: AuthedRequest, res: Response) {
  return sendReceipt(req.user!.schoolId, req.params.paymentId, false, res);
}