import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createJiti } from "jiti";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";

// Uses a disposable PostgreSQL-compatible database, never DATABASE_URL / Neon.
const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") }, nativeModules: ["@prisma/client", "@prisma/adapter-pg"], interopDefault: false });
const { PrismaClient } = await jiti.import("../src/generated/prisma/client.ts");
const { executeSaleCommand, saleCommandSchema, calculatePayment } = await jiti.import("../src/lib/sales.ts");
const { listTransactions, transactionQuerySchema } = await jiti.import("../src/lib/transactions.ts");
  const { getInstantReport, reportQuerySchema } = await jiti.import("../src/lib/reports.ts");
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
let prisma;
try {
  const schema = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"], { encoding: "utf8" });
  assert.equal(schema.status, 0, schema.stderr);
  await db.exec(schema.stdout);
  await db.exec("SET TIME ZONE 'UTC'");
  await server.start();
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`, max: 1 }), errorFormat: "minimal" });
  const role = await prisma.role.create({ data: { role: "test" } });
  const user = await prisma.user.create({ data: { nombre: "Test", apellido: "Sales", contrasena: "not-a-login", roleid: role.id } });
  const other = await prisma.user.create({ data: { nombre: "Other", apellido: "Sales", contrasena: "not-a-login", roleid: role.id } });
  const marca = await prisma.marca.create({ data: { nombre: "Test" } });
  const categoria = await prisma.categoria.create({ data: { nombreCategoria: "Test" } });
  const unidad = await prisma.unidad.create({ data: { unidad: "Por unidad" } });
  const product = await prisma.producto.create({ data: {
    nombre: "Prueba", marcaId: marca.id, categoriaId: categoria.id, unidadId: unidad.id, precioVenta: 1000, costo: 500, stock: 20,
  } });
  const weight = await prisma.producto.create({ data: {
    nombre: "Peso", marcaId: marca.id, categoriaId: categoria.id, unidadId: unidad.id, precioVenta: 1990, costo: 1000, stock: 0, controlaStock: false,
  } });
  const early = new Date("2030-01-01T00:00:00Z");
  const later = new Date("2030-02-01T00:00:00Z");
  await prisma.instancia_producto.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ id_producto: product.id, fecha_vencimiento: i < 10 ? early : later })) });
  const cash = await prisma.medio_pago.create({ data: { medio_de_pago: "efectivo" } });
  const debit = await prisma.medio_pago.create({ data: { medio_de_pago: "debito" } });
  const run = (command, seller = user.id) => prisma.$transaction((tx) => executeSaleCommand(tx, seller, command), { timeout: 30000 });
  const create = (productId = product.id, quantity = 1) => run({ action: "create", key: randomUUID(), productId, quantity });
  const item = (sale, quantity) => run({ action: "item", saleId: sale.id_venta, revision: sale.revision, productId: product.id, quantity });
  const cancel = (sale) => run({ action: "cancel", saleId: sale.id_venta, revision: sale.revision });
  const stock = async () => (await prisma.producto.findUniqueOrThrow({ where: { id: product.id } })).stock;

  assert.equal(saleCommandSchema.safeParse({ action: "create", key: randomUUID(), productId: product.id, quantity: -1 }).success, false);
  assert.equal(saleCommandSchema.safeParse({ action: "create", key: randomUUID(), productId: product.id, quantity: 0.1234 }).success, false);
  assert.deepEqual(calculatePayment(1000, 0, 1500, true, true), { completed: true, change: 500, adjustment: 0 });
  assert.throws(() => calculatePayment(1000, 500, 1000, true, false));
  await assert.rejects(create(product.id, 0.5), /enteras/);
  await assert.rejects(create(product.id, 21), /stock suficiente/);
  assert.equal(await prisma.venta.count(), 0, "Failed creation must roll back its sale");

  const creation = { action: "create", key: randomUUID(), productId: product.id, quantity: 2 };
  let sale = await run(creation);
  assert.equal((await run(creation)).id_venta, sale.id_venta);
  assert.equal(await stock(), 18);
  assert.equal(sale.detalles.length, 1);
  const reserved = await prisma.instancia_producto.findMany({ where: { id_detalle_reserva: sale.detalles[0].id_detalle } });
  assert.equal(reserved.length, 2);
  assert(reserved.every((instance) => instance.fecha_vencimiento.getTime() === early.getTime()), "Reserve earliest lots");
  await assert.rejects(run({ action: "cancel", saleId: sale.id_venta, revision: sale.revision }, other.id), /no encontrada/);
  const stale = sale;
  sale = await item(sale, 3);
  assert.equal(sale.detalles.length, 1);
  assert.equal(await stock(), 17);
  await assert.rejects(item(stale, 4), /otra ventana/);
  sale = await item(sale, 1);
  assert.equal(await stock(), 19);
  await cancel(sale);
  assert.equal(await stock(), 20);
  assert.equal(await prisma.venta.count(), 0);
  assert.equal(await prisma.instancia_producto.count({ where: { id_detalle_reserva: { not: null } } }), 0);
  console.log("PASS creation, FEFO reservation, updates, ownership, revisions, cancellation");

  const pending = [];
  for (let i = 0; i < 5; i++) pending.push(await create());
  await assert.rejects(create(), /cinco ventas/);
  assert.equal(await stock(), 15);
  for (const entry of pending) await cancel(entry);
  assert.equal(await stock(), 20);
  console.log("PASS five-sale limit and stock restoration");

  sale = await create(product.id, 2);
  const payment = { action: "pay", saleId: sale.id_venta, revision: sale.revision, key: randomUUID(), methodId: cash.id_medio, amount: 500 };
  sale = await run(payment);
  assert.equal(sale.estado, "pendiente");
  assert.equal(sale.fecha_pago, null);
  assert.equal(sale.pagos.length, 1);
  assert.equal((await run(payment)).pagos.length, 1, "Retry must not insert another payment");
  await assert.rejects(cancel(sale), /pagos registrados/);
  await assert.rejects(item(sale, 3), /pagos registrados/);
  const finish = { action: "pay", saleId: sale.id_venta, revision: sale.revision, key: randomUUID(), methodId: debit.id_medio };
  sale = await run(finish);
  assert.equal(sale.estado, "completado");
  assert(sale.fecha_pago);
  assert.equal(sale.pagos.length, 2);
  assert.equal(sale.pagos.reduce((sum, p) => sum + p.pago, 0), 2000);
  assert.equal(sale.detalles.length, 1);
  assert.equal(sale.vuelto, 0);
  assert.equal(await stock(), 18, "No second stock deduction on completion");
  assert.equal(await prisma.instancia_producto.count(), 18);
  assert.equal(await prisma.movimiento_de_stock.count(), 1);
  assert.equal((await run(finish)).pagos.length, 2);
  await assert.rejects(run({ ...finish, key: randomUUID() }), /cerrada/);
  console.log("PASS partial cash + debit, frozen cart, idempotency, completion");

  sale = await create();
  sale = await run({ action: "pay", saleId: sale.id_venta, revision: sale.revision, key: randomUUID(), methodId: cash.id_medio, amount: 1500 });
  assert.equal(sale.vuelto, 500);
  assert.equal(sale.pagos[0].pago, 1500);
  assert.equal(sale.valor_total, 1000);
  const beforeWeight = await stock();
  sale = await create(weight.id, 1.125);
  assert.equal(sale.detalles[0].costo_adquisicion_actual, 1000);
  assert.equal(sale.detalles[0].precio_actual, 1990);
  assert.equal(sale.valor_total, 2239);
  assert.equal(Number(sale.detalles[0].cantidad), 1.125);
  await run({ action: "pay", saleId: sale.id_venta, revision: sale.revision, key: randomUUID(), methodId: debit.id_medio });
  assert.equal(await stock(), beforeWeight);
  console.log("PASS cash change and fractional weight without stock");

  sale = await create(product.id, 1);
  sale = await run({ action: "item", saleId: sale.id_venta, revision: sale.revision, productId: weight.id, quantity: 0.5 });
  assert.equal(sale.detalles.length, 2);
  await prisma.producto.update({ where: { id: product.id }, data: { precioVenta: 2000, costo: 900 } });
  sale = await item(sale, 2);
  const snapshot = sale.detalles.find(d => d.id_producto === product.id);
  assert.equal(snapshot.precio_actual, 1000);
  assert.equal(snapshot.costo_adquisicion_actual, 500);
  assert.equal(sale.valor_total, 2995);
  sale = await item(sale, 0);
  assert.equal(sale.detalles.length, 1);
  assert.equal(await stock(), beforeWeight);
  await cancel(sale);
  console.log("PASS unique product lines, price/cost snapshots and releasing a removed item");

  const history = (params = {}) => prisma.$transaction(tx => listTransactions(tx, transactionQuerySchema.parse(params)));
  const all = await history();
  assert.equal(all.total, 3);
  const mixed = all.transactions.find(t => t.pagos.length === 2);
  assert(mixed);
  assert.equal(mixed.cajero, "Test Sales");
  assert.equal(mixed.pagos.reduce((sum, p) => sum + p.pago, 0), 2000);
  await prisma.venta.update({ where: { id_venta: mixed.id_venta }, data: { recibo: "https://res.cloudinary.com/test/image/upload/recibo.png" } });
  assert.equal((await history({ saleNumber: String(mixed.num_venta) })).transactions[0].recibo, "https://res.cloudinary.com/test/image/upload/recibo.png");
  const cashHistory = await history({ paymentMethod: cash.id_medio });
  assert.equal(cashHistory.total, 2);
  assert.equal(cashHistory.transactions.find(t => t.id_venta === mixed.id_venta).pagos.length, 2, "Filtering by cash must retain the other payments of that sale");
  assert.equal((await history({ saleNumber: String(mixed.num_venta) })).transactions.some(t => t.id_venta === mixed.id_venta), true);
  assert.equal((await history({ status: "pendiente" })).total, 0);
  const unstarted = await prisma.venta.create({ data: { id_vendedor: other.id, estado: "pendiente", valor_total: 100, fecha_de_creacion: new Date("2026-10-11T03:00:00Z") } });
  await prisma.venta.updateMany({ where: { estado: "completado" }, data: { fecha_de_creacion: new Date("2026-10-11T02:59:59Z") } });
  await prisma.venta.create({ data: { id_vendedor: other.id, estado: "pendiente", valor_total: 200, fecha_de_creacion: new Date("2026-10-12T03:00:00Z") } });
  const day = await history({ startDate: "2026-10-11", endDate: "2026-10-11" });
  assert.equal(day.total, 1);
  assert.equal(day.transactions[0].id_venta, unstarted.id_venta);
  assert.equal(day.transactions[0].cajero, "Other Sales");
  assert.equal(day.transactions[0].fecha_pago, null);
  assert.deepEqual(day.transactions[0].pagos, []);
  await prisma.venta.createMany({ data: Array.from({ length: 12 }, () => ({ id_vendedor: user.id, estado: "pendiente", valor_total: 100 })) });
  const firstPage = await history();
  const lastPage = await history({ page: "999", pageSize: "10" });
  assert.equal(firstPage.transactions.length, 10);
  assert.equal(lastPage.page, 2);
  assert.equal(lastPage.transactions.length, 7);
  assert.equal(firstPage.transactions.some(a => lastPage.transactions.some(b => a.id_venta === b.id_venta)), false);
  assert.equal(transactionQuerySchema.safeParse({ startDate: "2026-02-30" }).success, false);
  assert.equal(transactionQuerySchema.safeParse({ startDate: "2026-10-12", endDate: "2026-10-11" }).success, false);
  assert.equal(transactionQuerySchema.safeParse({ saleNumber: "' OR TRUE --" }).success, false);
  console.log("PASS transaction joins, split payments, filters, Chile calendar bounds, pagination and validation");

  const chileMonthParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const reportMonth = `${chileMonthParts.find(part => part.type === "year").value}-${chileMonthParts.find(part => part.type === "month").value}`;
  const instantReport = (params = {}) => prisma.$transaction(tx =>
    getInstantReport(tx, reportQuerySchema.parse({ month: reportMonth, ...params })));
  const report = await instantReport();
  assert.equal(report.periodSummary.sales, 3);
  assert.equal(report.periodSummary.total, 5239);
  assert.equal(report.periodSummary.margin, 2614);
  assert.equal(report.days.reduce((sum, day) => sum + day.sales, 0), 3);
  assert.equal(report.paymentMethods.length, 2);
  const cashReport = await instantReport({ paymentMethod: cash.id_medio });
  assert.equal(cashReport.periodSummary.sales, 2);
  assert.equal(cashReport.periodSummary.total, 3000);
  assert.equal(cashReport.periodSummary.margin, 1500);
  assert.equal(reportQuerySchema.safeParse({ month: "2026-13" }).success, false);
  console.log("PASS instant reports by Chile payment date, historical detail totals, margin and payment filter");

  for (let digit = 0; digit <= 9; digit++) {
    const expected = digit <= 5 ? -digit : 10 - digit;
    const result = calculatePayment(1320 + digit, 0, 2000, true, true);
    assert.equal(result.adjustment, expected || 0);
    assert.equal(result.change, 2000 - (1320 + digit + expected));
  }
  assert.throws(() => calculatePayment(1325, 0, 1325, true, true), /terminar en 0/);
  assert.throws(() => calculatePayment(1325, 0, 0, true, true), /no es valido/);
  assert.deepEqual(calculatePayment(1325, 0, 1325, false, false), { completed: true, change: 0, adjustment: 0 });
  // Use another seller: the pagination fixtures deliberately contain many pending sales.
  const roundingSale = async (price) => {
    await prisma.producto.update({ where: { id: weight.id }, data: { precioVenta: price } });
    return run({ action: "create", key: randomUUID(), productId: weight.id, quantity: 1 }, other.id);
  };
  const payRounding = (entry, amount, methodId = cash.id_medio) => run({ action: "pay", saleId: entry.id_venta, revision: entry.revision, key: randomUUID(), methodId, amount }, other.id);
  for (const [price, finalTotal, delta] of [[1325, 1320, -5], [1326, 1330, 4], [2, 0, -2]]) {
    const pendingSale = await roundingSale(price);
    const paidSale = await payRounding(pendingSale, finalTotal);
    assert.equal(paidSale.estado, "completado");
    assert.equal(paidSale.valor_total, finalTotal);
    assert.equal(paidSale.redondeo, delta);
    assert.equal(paidSale.detalles[0].subtotal_venta, price);
    assert.equal(paidSale.pagos[0].pago, finalTotal);
    assert.equal(paidSale.vuelto, 0);
  }
  let roundedSale = await roundingSale(1326);
  roundedSale = await payRounding(roundedSale, 500);
  assert.equal(roundedSale.estado, "pendiente");
  assert.equal(roundedSale.redondeo, 0);
  assert.equal(roundedSale.valor_total, 1326);
  roundedSale = await payRounding(roundedSale, 1000);
  assert.equal(roundedSale.valor_total, 1330);
  assert.equal(roundedSale.vuelto, 170);
  assert.equal(roundedSale.redondeo, 4);
  roundedSale = await roundingSale(1325);
  roundedSale = await payRounding(roundedSale, 500);
  roundedSale = await payRounding(roundedSale, undefined, debit.id_medio);
  assert.equal(roundedSale.valor_total, 1325);
  assert.equal(roundedSale.redondeo, 0);
  assert.equal(roundedSale.pagos.reduce((sum, p) => sum + p.pago, 0), 1325);
  console.log("PASS cash rounding 0-9, zero balance, partial cash, cash/debit, change and stored adjustment");
} finally {
  if (prisma) await prisma.$disconnect();
  await server.stop();
  await db.close();
}
