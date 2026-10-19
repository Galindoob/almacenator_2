import { prisma } from "@/lib/db";
import { uploadGeneratedImage } from "@/lib/cloudinary-images";

type ReceiptData = {
  saleNumber: number;
  companyRut: string;
  companyName: string;
  storeName: string;
  commune: string;
  seller: string;
  date: Date;
  items: { name: string; quantity: string; price: number; total: number }[];
  subtotal: number;
  total: number;
  payments: { method: string; amount: number }[];
  change: number;
};

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function amount(value: number) {
  return `$ ${value.toLocaleString("es-CL")}`;
}

function receiptDate(value: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

export function renderSaleReceiptSvg(data: ReceiptData) {
  const width = 720;
  const itemHeight = 58;
  const paymentHeight = 42;
  const itemRows = Math.max(1, data.items.length);
  const paymentRows = Math.max(1, data.payments.length);
  const itemStart = 320;
  const dividerY = itemStart + itemRows * itemHeight + 18;
  const summaryStart = dividerY + 48;
  const paymentStart = summaryStart + 112;
  const storeLocation = [data.storeName, data.commune].filter(Boolean).join(", ");
  const changeY = paymentStart + paymentRows * paymentHeight;
  const lastContentY = data.change > 0
    ? changeY
    : paymentStart + (paymentRows - 1) * paymentHeight;
  const height = lastContentY + 120;

  const items = data.items.length
    ? data.items.map((item, index) => {
        const y = itemStart + index * itemHeight;
        return `<g>
          <text x="30" y="${y}" class="body">${escapeXml(truncate(item.name, 28))}</text>
          <text x="405" y="${y}" class="body center">${escapeXml(item.quantity)}</text>
          <text x="550" y="${y}" class="body end">${escapeXml(amount(item.price))}</text>
          <text x="690" y="${y}" class="body end">${escapeXml(amount(item.total))}</text>
        </g>`;
      }).join("")
    : `<text x="30" y="${itemStart}" class="muted">Sin artículos</text>`;

  const payments = data.payments.length
    ? data.payments.map((payment, index) => {
        const y = paymentStart + index * paymentHeight;
        return `<text x="30" y="${y}" class="body">${escapeXml(payment.method)}</text>
          <text x="690" y="${y}" class="body end">${escapeXml(amount(payment.amount))}</text>`;
      }).join("")
    : `<text x="30" y="${paymentStart}" class="muted">Sin medios de pago</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <style>
      text { fill: #111111; font-family: Arial, Helvetica, sans-serif; }
      .title { font-size: 25px; font-weight: 700; }
      .header { font-size: 21px; }
      .label { font-size: 19px; font-weight: 700; }
      .body { font-size: 19px; }
      .muted { fill: #555555; font-size: 18px; }
      .center { text-anchor: middle; }
      .end { text-anchor: end; }
    </style>
    <text x="360" y="38" class="title center">Recibo no válido como boleta</text>
    <text x="360" y="72" class="header center">Número de venta: ${data.saleNumber}</text>
    <text x="360" y="104" class="header center">${escapeXml(data.companyRut)}</text>
    <text x="360" y="136" class="header center">${escapeXml(truncate(data.companyName, 52))}</text>
    <text x="360" y="168" class="header center">${escapeXml(truncate(storeLocation, 58))}</text>
    <text x="30" y="212" class="body">Vendedor: ${escapeXml(truncate(data.seller, 40))}</text>
    <text x="690" y="212" class="body end">${escapeXml(receiptDate(data.date))}</text>
    <line x1="30" y1="238" x2="690" y2="238" stroke="#111111" stroke-width="3"/>
    <text x="30" y="274" class="label">ARTÍCULO</text>
    <text x="405" y="274" class="label center">CANTIDAD</text>
    <text x="550" y="274" class="label end">PRECIO</text>
    <text x="690" y="274" class="label end">TOTAL</text>
    <line x1="30" y1="290" x2="690" y2="290" stroke="#111111" stroke-width="3"/>
    ${items}
    <line x1="30" y1="${dividerY}" x2="690" y2="${dividerY}" stroke="#111111" stroke-width="3"/>
    <text x="30" y="${summaryStart}" class="body">Subtotal:</text>
    <text x="690" y="${summaryStart}" class="body end">${escapeXml(amount(data.subtotal))}</text>
    <text x="30" y="${summaryStart + 42}" class="label">TOTAL:</text>
    <text x="690" y="${summaryStart + 42}" class="label end">${escapeXml(amount(data.total))}</text>
    <text x="30" y="${summaryStart + 92}" class="label">Métodos utilizados</text>
    ${payments}
    ${data.change > 0 ? `<text x="30" y="${changeY}" class="body">Vuelto</text><text x="690" y="${changeY}" class="body end">${escapeXml(amount(data.change))}</text>` : ""}
    <line x1="30" y1="${height - 62}" x2="690" y2="${height - 62}" stroke="#111111" stroke-width="2" stroke-dasharray="10 10"/>
    <text x="360" y="${height - 25}" class="muted center">Gracias por su compra</text>
  </svg>`;
}

export async function ensureSaleReceipt(saleId: string) {
  const sale = await prisma.venta.findUnique({
    where: { id_venta: saleId },
    include: {
      vendedor: { include: { configuracion: { include: { datosEmpresa: true } } } },
      detalles: { orderBy: { id_detalle: "asc" }, include: { producto: { select: { nombre: true } } } },
      pagos: { orderBy: { id_pago: "asc" }, include: { medio_pago: true } },
    },
  });
  if (!sale || sale.estado !== "completado") return sale?.recibo ?? null;
  if (sale.recibo) return sale.recibo;

  const company = sale.vendedor.configuracion?.datosEmpresa;
  if (!company) throw new Error("La venta no tiene una empresa asociada.");
  const subtotal = sale.detalles.reduce((sum, detail) => sum + detail.subtotal_venta, 0);
  const paymentTotals = new Map<string, { method: string; amount: number }>();
  for (const payment of sale.pagos) {
    const current = paymentTotals.get(payment.id_medio_pago);
    paymentTotals.set(payment.id_medio_pago, {
      method: payment.medio_pago.medio_de_pago,
      amount: (current?.amount ?? 0) + payment.pago,
    });
  }
  const svg = renderSaleReceiptSvg({
    saleNumber: sale.num_venta,
    companyRut: company.rut,
    companyName: company.nombre,
    storeName: company.nombreFantasia,
    commune: company.comuna ?? "",
    seller: `${sale.vendedor.nombre} ${sale.vendedor.apellido}`.trim(),
    date: sale.fecha_pago ?? sale.fecha_de_creacion,
    items: sale.detalles.map((detail) => ({
      name: detail.producto.nombre,
      quantity: detail.cantidad.toString(),
      price: detail.precio_actual,
      total: detail.subtotal_venta,
    })),
    subtotal,
    total: sale.valor_total,
    payments: [...paymentTotals.values()],
    change: sale.vuelto,
  });
  const receiptUrl = await uploadGeneratedImage(
    Buffer.from(svg, "utf8"),
    "mini-gest/recibos",
    `venta-${sale.num_venta}-${sale.id_venta}`,
  );
  const updated = await prisma.venta.updateMany({
    where: { id_venta: sale.id_venta, estado: "completado", recibo: null },
    data: { recibo: receiptUrl },
  });
  if (updated.count) return receiptUrl;
  const current = await prisma.venta.findUnique({ where: { id_venta: sale.id_venta }, select: { recibo: true } });
  return current?.recibo ?? receiptUrl;
}
