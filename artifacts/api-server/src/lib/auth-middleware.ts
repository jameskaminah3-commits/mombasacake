import { type Request, type Response, type NextFunction } from "express";
import { resolveAdminFromBearerToken, type AdminAuthPayload } from "./admin-auth";

export type AuthPayload = AdminAuthPayload;

declare global {
  namespace Express {
    interface Request {
      admin?: AuthPayload;
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  resolveAdminFromBearerToken(authHeader.slice(7))
    .then((admin) => {
      if (!admin) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      req.admin = admin;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: "Invalid or expired token" });
    });
}
