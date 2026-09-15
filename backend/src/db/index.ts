import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../env.js";
import * as schema from "./schema.js";

export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 10,
  timezone: "Z",
  dateStrings: false,
  enableKeepAlive: true,
});

// Run every connection in UTC. mysql2 already sends and reads dates as UTC ("Z"),
// but column defaults such as CURRENT_TIMESTAMP use the session timezone, which
// is otherwise the MySQL server's own: UTC on Railway, local time on a dev machine.
pool.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) console.error("[db] could not set the session time zone to UTC:", error);
  });
});

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
