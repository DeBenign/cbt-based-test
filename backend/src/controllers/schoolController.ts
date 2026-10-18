import { Response } from "express";
import bcrypt from "bcryptjs";
import { AuthedRequest } from "../middleware/auth";
import School from "../models/School";
import User from "../models/User";
import Payment from "../models/Payment";
import { applyPayment } from "../services/paymentService";
import { ensureTrialDates, getAccessStatus } from "../utils/schoolAccess";
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
        studentCount,
        pricePerStudent: effectivePrice(s.pricePerStudent),
        hasCustomPrice: !!s.pricePerStudent,
        termFee: termFee(studentCount, s.pricePerStudent),
        adminCount: admins.length,
        admins: admins.map((a) => ({ name: a.name, email: a.email }))
      };
    })
  );
  res.json(withDetails);
}

export async function setSchoolActive(req: AuthedRequest, res: Response) {
  const { isActive } = req.body;
  const school = await School.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
  if (!school) return res.status(404).json({ error: "School not found" });
  res.json(school);
}

// Superadmin confirms a payment was received (cash, today). The Nomba webhook
// calls the same applyPayment, just automatically instead of by hand.
// One payment covers one or more school TERMS (not months).
export async function recordPayment(req: AuthedRequest, res: Response) {
  const { amount, reference, terms, termLabel, paidUntil } = req.body;
  const amountNum = Number(amount);
  const termsNum = Number(terms);

  if (!amountNum || amountNum <= 0 || !reference || !String(reference).trim()) {
    return res.status(400).json({ error: "amount and reference are required" });
  }
  if (!Number.isInteger(termsNum) || termsNum < 1 || termsNum > MAX_TERMS_PER_PAYMENT) {
    return res.status(400).json({ error: `terms must be a whole number from 1 to ${MAX_TERMS_PER_PAYMENT}` });
  }
  let paidUntilDate: Date | undefined;
  if (paidUntil) {
    paidUntilDate = new Date(paidUntil);
    if (isNaN(paidUntilDate.getTime())) return res.status(400).json({ error: "paidUntil is not a valid date" });
  }

  try {
    const result = await applyPayment({
      schoolId: req.params.id,
      amount: amountNum,
      reference: String(reference).trim(),
      terms: termsNum,
      termLabel: termLabel ? String(termLabel).trim() : undefined,
      paidUntil: paidUntilDate,
      method: "manual",
      confirmedBy: req.user!.userId
    });
    if ("alreadyProcessed" in result) {
      return res.status(409).json({ error: "A payment with this reference already exists" });
    }
    res.json({ message: "Payment recorded", subscriptionPaidUntil: result.subscriptionPaidUntil });
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
    payments: payments.map((p) => ({
      amount: p.amount,
      reference: p.reference,
      method: p.method,
      terms: p.terms ?? null,
      termLabel: p.termLabel ?? null,
      periodMonths: p.periodMonths ?? null, // only on payments recorded before per-term billing
      confirmedAt: p.confirmedAt
    }))
  });
}