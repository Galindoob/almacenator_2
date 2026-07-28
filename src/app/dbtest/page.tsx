import { listDatabaseTables } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DbTestPage() {
  const tables = await listDatabaseTables();

  return (
    <main className="dbtest-shell">
      <section className="dbtest-panel">
        <p className="auth-kicker">Prueba de base de datos</p>
        <h1>Tablas encontradas</h1>
        {tables.length > 0 ? (
          <ul className="dbtest-list">
            {tables.map((table) => (
              <li key={`${table.table_schema}.${table.table_name}`}>
                <span>{table.table_schema}</span>
                {table.table_name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="dbtest-empty">No se encontraron tablas visibles.</p>
        )}
      </section>
    </main>
  );
}
