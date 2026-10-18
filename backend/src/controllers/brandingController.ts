import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import School from "../models/School";

const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export async function getMyBranding(req: AuthedRequest, res: Response) {
  if (!req.user!.schoolId) {
    return res.json({ schoolName: "Benchmark", logoUrl: null, primaryColor: null });
  }
  const school = await School.findById(req.user!.schoolId).select("name branding");
  if (!school) return res.status(404).json({ error: "School not found" });

  res.json({
    schoolName: school.name,
    logoUrl: school.branding?.logoUrl || null,
    primaryColor: school.branding?.primaryColor || null
  });
}

export async function updateBranding(req: AuthedRequest, res: Response) {
  const { logoUrl, primaryColor } = req.body;

  if (primaryColor && !HEX_COLOR.test(primaryColor)) {
    return res.status(400).json({ error: "primaryColor must be a hex color like #3D5AFE" });
  }
  if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
    return res.status(400).json({ error: "logoUrl must be a full http(s) link to an image" });
  }

  const school = await School.findByIdAndUpdate(
    req.user!.schoolId,
    { branding: { logoUrl: logoUrl || undefined, primaryColor: primaryColor || undefined } },
    { new: true }
  );
  if (!school) return res.status(404).json({ error: "School not found" });

  res.json({ schoolName: school.name, logoUrl: school.branding?.logoUrl || null, primaryColor: school.branding?.primaryColor || null });
}