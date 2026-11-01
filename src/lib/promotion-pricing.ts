export type PromotionRule = {
  id_promocion: string;
  nombre_promocion: string;
  descuento: number | null;
  cantidad_llevar: number | null;
  cantidad_regalo: number | null;
  combo: number | null;
  precio_combo: number | null;
  tipo_promocion: { tipo: string };
};

export function promotionCondition(rule: PromotionRule) {
  if (rule.tipo_promocion.tipo === "descuento") return `${rule.descuento}% de descuento`;
  if (rule.tipo_promocion.tipo === "combo") return `Lleva ${rule.combo} por $${(rule.precio_combo ?? 0).toLocaleString("es-CL")}`;
  return `Lleva ${Number(rule.cantidad_llevar ?? 0) + Number(rule.cantidad_regalo ?? 0)} y paga ${rule.cantidad_llevar}`;
}

export function calculatePromotion(unitPrice: number, quantity: number, rule: PromotionRule | null) {
  const regularTotal = Math.round(unitPrice * quantity);
  if (!rule) return { total: regularTotal, applied: null };
  let total = regularTotal;
  if (rule.tipo_promocion.tipo === "descuento" && rule.descuento && rule.descuento > 0 && rule.descuento <= 100) {
    total = Math.round(regularTotal * (1 - rule.descuento / 100));
  } else if (Number.isInteger(quantity) && rule.tipo_promocion.tipo === "combo" && rule.combo && rule.combo > 0 &&
    rule.precio_combo !== null && quantity >= rule.combo) {
    const groups = Math.floor(quantity / rule.combo);
    total = groups * rule.precio_combo + (quantity - groups * rule.combo) * unitPrice;
  } else if (Number.isInteger(quantity) && rule.tipo_promocion.tipo === "yapa" && rule.cantidad_llevar && rule.cantidad_regalo &&
    rule.cantidad_llevar > 0 && rule.cantidad_regalo > 0 && quantity >= rule.cantidad_llevar + rule.cantidad_regalo) {
    const groups = Math.floor(quantity / (rule.cantidad_llevar + rule.cantidad_regalo));
    total = (quantity - groups * rule.cantidad_regalo) * unitPrice;
  }
  return total < regularTotal ? { total, applied: rule } : { total: regularTotal, applied: null };
}
