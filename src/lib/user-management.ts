const levels: Record<string, number> = { usuario: 0, cajero: 1, admin: 2, master: 3 };

export function canDeactivateAccount(actorId: string, actorRole: string, targetId: string, targetRole: string): boolean {
  const actor = actorRole.toLowerCase();
  const target = targetRole.toLowerCase();
  return actorId !== targetId && (actor === "admin" || actor === "master") &&
    (levels[target] ?? -1) >= 0 && levels[actor] > levels[target];
}
