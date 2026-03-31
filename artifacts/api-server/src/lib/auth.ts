import bcrypt from "bcrypt";
import { db, accountsTable, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface AuthPayload {
  accountId?: number;
  storeId?: number;
  serviceTypeId?: number;
  role: string;
  name?: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET || "changeme";

export function createToken(payload: AuthPayload): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64");
  const sig = Buffer.from(encoded + SESSION_SECRET).toString("base64").slice(0, 16);
  return encoded + "." + sig;
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const [encoded, sig] = token.split(".");
    const expectedSig = Buffer.from(encoded + SESSION_SECRET).toString("base64").slice(0, 16);
    if (sig !== expectedSig) return null;
    const data = Buffer.from(encoded, "base64").toString("utf8");
    return JSON.parse(data) as AuthPayload;
  } catch {
    return null;
  }
}

export async function authenticateToken(
  authHeader: string | undefined
): Promise<AuthPayload | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}
