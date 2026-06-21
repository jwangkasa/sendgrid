/**
 * lib/db.ts
 *
 * SAP HANA Cloud connection pool using the `hdb` Node.js driver.
 *
 * `hdb` does not ship a built-in pool — we implement a lightweight manual pool
 * that reuses idle connections and creates new ones up to HANA_POOL_MAX.
 *
 * Environment variables:
 *   HANA_HOST        — fully-qualified HANA Cloud host
 *   HANA_PORT        — port (default 443 for Cloud)
 *   HANA_USER        — database user
 *   HANA_PASSWORD    — database password
 *   HANA_SCHEMA      — default schema (optional)
 *   HANA_POOL_MIN    — minimum idle connections (default 2)
 *   HANA_POOL_MAX    — maximum connections (default 10)
 */

import hdb from 'hdb';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowsAffected?: number;
}

// Shape exposed by hdb client instances
interface HdbClient {
  connect(cb: (err: Error | null) => void): void;
  disconnect(cb?: (err: Error | null) => void): void;
  exec(sql: string, params: (unknown | null)[], cb: (err: Error | null, rows: unknown) => void): void;
  prepare(sql: string, cb: (err: Error | null, stmt: HdbStatement) => void): void;
  setAutoCommit(value: boolean): void;
  commit(cb: (err: Error | null) => void): void;
  rollback(cb: (err: Error | null) => void): void;
  readyState: string;
}

interface HdbStatement {
  exec(params: unknown[], cb: (err: Error | null, rows: unknown) => void): void;
  drop(cb?: (err: Error | null) => void): void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

function assertEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function getConnectParams() {
  return {
    host:     assertEnv('HANA_HOST'),
    port:     parseInt(process.env.HANA_PORT ?? '443', 10),
    user:     assertEnv('HANA_USER'),
    password: assertEnv('HANA_PASSWORD'),
    schema:   process.env.HANA_SCHEMA || undefined,
    useTLS:   true,
  };
}

// ─── Manual connection pool ───────────────────────────────────────────────────

interface PooledConnection {
  client:  HdbClient;
  inUse:   boolean;
}

interface Pool {
  connections: PooledConnection[];
  maxSize:     number;
  minSize:     number;
  waitQueue:   ((client: HdbClient) => void)[];
}

declare global {
  // eslint-disable-next-line no-var
  var __hanaPool: Pool | undefined;
}

function createClientConnected(): Promise<HdbClient> {
  return new Promise((resolve, reject) => {
    const client = hdb.createClient(getConnectParams()) as HdbClient;
    client.connect((err) => {
      if (err) return reject(err);
      resolve(client);
    });
  });
}

function getPool(): Pool {
  if (!globalThis.__hanaPool) {
    globalThis.__hanaPool = {
      connections: [],
      maxSize:     parseInt(process.env.HANA_POOL_MAX ?? '10', 10),
      minSize:     parseInt(process.env.HANA_POOL_MIN ?? '2',  10),
      waitQueue:   [],
    };
  }
  return globalThis.__hanaPool;
}

async function acquireConnection(): Promise<HdbClient> {
  const pool = getPool();

  // Return an idle connection if one is available
  const idle = pool.connections.find((c) => !c.inUse && c.client.readyState === 'connected');
  if (idle) {
    idle.inUse = true;
    return idle.client;
  }

  // Create a new connection if under the limit
  if (pool.connections.length < pool.maxSize) {
    const client = await createClientConnected();
    pool.connections.push({ client, inUse: true });
    return client;
  }

  // Otherwise wait for a connection to be released
  return new Promise((resolve) => {
    pool.waitQueue.push(resolve);
  });
}

function releaseConnection(client: HdbClient): void {
  const pool = getPool();
  const entry = pool.connections.find((c) => c.client === client);
  if (!entry) return;

  // If someone is waiting, hand the connection directly to them
  const next = pool.waitQueue.shift();
  if (next) {
    next(client);
    return;
  }

  entry.inUse = false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function withConnection<T>(
  fn: (client: HdbClient) => Promise<T>
): Promise<T> {
  const client = await acquireConnection();
  try {
    return await fn(client);
  } finally {
    releaseConnection(client);
  }
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return withConnection(
    (client) =>
      new Promise<QueryResult<T>>((resolve, reject) => {
        client.prepare(sql, (prepErr, stmt) => {
          if (prepErr) return reject(prepErr);
          stmt.exec(params, (execErr, rows) => {
            stmt.drop();
            if (execErr) return reject(execErr);
            resolve({ rows: rows as T[] });
          });
        });
      })
  );
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ rowsAffected: number }> {
  return withConnection(
    (client) =>
      new Promise<{ rowsAffected: number }>((resolve, reject) => {
        client.prepare(sql, (prepErr, stmt) => {
          if (prepErr) return reject(prepErr);
          stmt.exec(params, (execErr, result) => {
            stmt.drop();
            if (execErr) return reject(execErr);
            const rowsAffected =
              typeof (result as { rowsAffected?: number })?.rowsAffected === 'number'
                ? (result as { rowsAffected: number }).rowsAffected
                : 0;
            resolve({ rowsAffected });
          });
        });
      })
  );
}

export async function transaction<T>(
  fn: (exec: (sql: string, params?: unknown[]) => Promise<void>) => Promise<T>
): Promise<T> {
  return withConnection(async (client) => {
    client.setAutoCommit(false);

    const exec = (sql: string, params: unknown[] = []): Promise<void> =>
      new Promise((resolve, reject) => {
        client.prepare(sql, (prepErr, stmt) => {
          if (prepErr) return reject(prepErr);
          stmt.exec(params, (execErr) => {
            stmt.drop();
            if (execErr) return reject(execErr);
            resolve();
          });
        });
      });

    try {
      const result = await fn(exec);
      await new Promise<void>((res, rej) =>
        client.commit((err) => (err ? rej(err) : res()))
      );
      return result;
    } catch (err) {
      await new Promise<void>((res) =>
        client.rollback(() => res())
      );
      throw err;
    } finally {
      client.setAutoCommit(true);
    }
  });
}

export async function dbPing(): Promise<boolean> {
  try {
    await query('SELECT * FROM DUMMY', []);
    return true;
  } catch {
    return false;
  }
}
