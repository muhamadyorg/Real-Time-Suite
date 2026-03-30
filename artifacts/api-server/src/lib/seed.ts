import { db, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

export async function seedSudo() {
  const existing = await db.query.accountsTable.findFirst({
    where: eq(accountsTable.role, "sudo"),
  });

  if (!existing) {
    const passwordHash = await hashPassword("Muhamadyorgalshib");
    await db.insert(accountsTable).values({
      name: "SUDO",
      role: "sudo",
      username: "SUDO",
      passwordHash,
      pin: null,
      storeId: null,
    });
    logger.info("SUDO account created");
  } else {
    logger.info("SUDO account already exists");
  }
}
