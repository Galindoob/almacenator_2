export function hasCashClosingPrivilege(role: string): boolean {
  return ["admin", "master"].includes(role.trim().toLowerCase());
}

export function canCloseCashRegister(userId: string, role: string, openerId: string): boolean {
  return userId === openerId || hasCashClosingPrivilege(role);
}
