export function roundCashAmount(amount: number) {
  const remainder = amount % 10;
  const adjustment = remainder <= 5 ? -remainder : 10 - remainder;
  return { total: amount + adjustment, adjustment: adjustment || 0 };
}
