import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/** CHECK (column IN (...)) using literal values. Bound parameters are invalid in CHECK. */
export function valueIn(column: SQLWrapper, values: readonly string[]): SQL {
  const list = values
    .map((value) => `'${value.replaceAll("'", "''")}'`)
    .join(", ");
  return sql`${column} in (${sql.raw(list)})`;
}
