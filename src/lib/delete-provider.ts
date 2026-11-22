import type { Prisma } from "@/generated/prisma/client";

export async function deleteProvider(tx: Prisma.TransactionClient, id: string, confirmedIds: string[]) {
  const locked = await tx.$queryRaw<{ id_proveedor: string }[]>`SELECT id_proveedor FROM proveedores WHERE id_proveedor = ${id}::uuid FOR UPDATE`;
  if (!locked.length) return { status: "not_found" as const };
  const products = await tx.producto.findMany({ where: { id_proveedor: id }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } });
  const confirmed = new Set(confirmedIds);
  if (products.length !== confirmed.size || products.some((product) => !confirmed.has(product.id))) return { status: "changed" as const, products };
  await tx.producto.updateMany({ where: { id_proveedor: id }, data: { id_proveedor: null } });
  await tx.proveedores.delete({ where: { id_proveedor: id } });
  return { status: "deleted" as const };
}
