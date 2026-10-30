import { describe, expect, it } from "vitest";

import {
  canAssignRole,
  canManageBilling,
  canManageMembers,
  canMutateCatalog,
  roleAtLeast,
} from "./roles";
import { passwordError } from "./password";

describe("organization roles", () => {
  it("lets viewers read and blocks them from edits", () => {
    expect(roleAtLeast("viewer", "viewer")).toBe(true);
    expect(canMutateCatalog("viewer")).toBe(false);
    expect(canMutateCatalog("editor")).toBe(true);
    expect(canManageMembers("editor")).toBe(false);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageBilling("admin")).toBe(false);
    expect(canManageBilling("owner")).toBe(true);
  });

  it("stops an admin from assigning the owner role", () => {
    expect(canAssignRole("admin", "editor")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("viewer", "viewer")).toBe(false);
  });
});

describe("password policy", () => {
  it("requires a letter and a number", () => {
    expect(passwordError("short1")).toMatch(/8/);
    expect(passwordError("longpassword")).toMatch(/letter and a number/);
    expect(passwordError("Correct-horse-1")).toBeNull();
  });
});
