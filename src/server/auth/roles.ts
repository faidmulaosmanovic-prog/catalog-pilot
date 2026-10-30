import type { MemberRole } from "@/server/db/schema/constants";

const RANK: Record<MemberRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(role: MemberRole, minimum: MemberRole) {
  return RANK[role] >= RANK[minimum];
}

export function canManageBilling(role: MemberRole) {
  return role === "owner";
}

export function canManageMembers(role: MemberRole) {
  return role === "owner" || role === "admin";
}

export function canMutateCatalog(role: MemberRole) {
  return roleAtLeast(role, "editor");
}

export function canAssignRole(actor: MemberRole, target: MemberRole) {
  if (actor === "owner") {
    return true;
  }
  if (actor === "admin") {
    return target !== "owner";
  }
  return false;
}
