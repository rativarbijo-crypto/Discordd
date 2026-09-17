import { db } from "@workspace/db";
import { adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function isSuperAdmin(discordId: string): boolean {
  const superAdminRaw = process.env["SUPER_ADMIN_ID"] ?? "";
  return superAdminRaw
    .split(",")
    .map((s) => s.trim())
    .includes(discordId);
}

export async function isAdmin(discordId: string): Promise<boolean> {
  if (isSuperAdmin(discordId)) return true;
  const [row] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.discordId, discordId))
    .limit(1);
  return !!row;
}
