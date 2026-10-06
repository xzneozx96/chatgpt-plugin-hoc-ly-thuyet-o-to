import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const listTables = async () => (await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")).map(row => row.table_name);

console.log("before:", await listTables());
for (const file of ["scripts/neon-schema.sql", "migrations/002-learner-workspaces.sql"])
  for (const statement of readFileSync(file, "utf8").split(";").map(text => text.trim()).filter(Boolean))
    await sql.query(statement);
console.log("after:", await listTables());
