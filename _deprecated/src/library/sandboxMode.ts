/**
 * Sandbox-mode write guard.
 *
 * When the backend is run against a read-only MySQL user (e.g. dev pointed at
 * the prod-like dataset with the `reader` account), every INSERT / UPDATE /
 * DELETE would otherwise blow up with ER_TABLEACCESS_DENIED_ERROR and
 * propagate as a 500. Real users still want to log in, save progress, etc. —
 * they just shouldn't actually persist anything.
 *
 * Activated when either:
 *   - SANDBOX_MODE=true is set explicitly, or
 *   - MYSQL_USER is the canonical read-only user (`reader`).
 *
 * Only the ORM write paths are intercepted (Model.create / update / destroy /
 * bulkCreate / upsert / increment / decrement, and the instance equivalents
 * save / update / destroy). Raw `sequelize.query()` with non-SELECT SQL is
 * NOT intercepted — wrap it at the call site or extend this module if a
 * resolver still hits ER_TABLEACCESS_DENIED_ERROR after this is on.
 */
import { Model } from 'sequelize';

const SANDBOX_MODE =
    process.env.SANDBOX_MODE === 'true' ||
    (process.env.MYSQL_USER || '').toLowerCase() === 'reader';

export const isSandboxMode = (): boolean => SANDBOX_MODE;

const skippedCounts = new Map<string, number>();

const noteSkip = (op: string, name: string): void => {
    const key = `${op}:${name}`;
    const n = (skippedCounts.get(key) || 0) + 1;
    skippedCounts.set(key, n);
    if (n === 1) {
        // First occurrence per op:table only — keep the log signal-not-noise.
        console.log(`🧪 sandbox: ${op} on ${name} suppressed (subsequent ${op}s on this table will be silent)`);
    }
};

const tableNameOf = (cls: any): string => cls?.tableName || cls?.name || 'unknown';

export function applySandboxGuards(): void {
    if (!SANDBOX_MODE) return;

    console.log('🧪 Sandbox mode active — ORM writes (INSERT/UPDATE/DELETE) will be no-op'); // eslint-disable-line no-console

    const M = Model as any;
    const proto = M.prototype;

    // ─── Class-level (static) writes ──────────────────────────────────
    M.create = async function (this: any, values: any) {
        noteSkip('create', tableNameOf(this));
        return this.build(values);
    };

    M.bulkCreate = async function (this: any, records: any[]) {
        noteSkip('bulkCreate', tableNameOf(this));
        return (records || []).map(r => this.build(r));
    };

    M.update = async function (this: any) {
        noteSkip('update', tableNameOf(this));
        return [0, []];
    };

    M.destroy = async function (this: any) {
        noteSkip('destroy', tableNameOf(this));
        return 0;
    };

    M.upsert = async function (this: any, values: any) {
        noteSkip('upsert', tableNameOf(this));
        return [this.build(values), false];
    };

    M.increment = async function (this: any) {
        noteSkip('increment', tableNameOf(this));
        return [[], 0];
    };

    M.decrement = async function (this: any) {
        noteSkip('decrement', tableNameOf(this));
        return [[], 0];
    };

    M.findOrCreate = async function (this: any, opts: any) {
        // Try find first; if not found, return a built (unsaved) instance.
        const found = await this.findOne(opts);
        if (found) return [found, false];
        noteSkip('findOrCreate', tableNameOf(this));
        return [this.build(opts?.defaults || {}), true];
    };

    M.truncate = async function (this: any) {
        noteSkip('truncate', tableNameOf(this));
        return undefined;
    };

    M.restore = async function (this: any) {
        noteSkip('restore', tableNameOf(this));
        return undefined;
    };

    // ─── Instance-level writes ─────────────────────────────────────────
    proto.save = async function () {
        noteSkip('save', tableNameOf(this.constructor));
        return this;
    };

    proto.update = async function (this: any, values: any) {
        noteSkip('update', tableNameOf(this.constructor));
        if (values && typeof values === 'object') {
            Object.assign(this, values);
        }
        return this;
    };

    proto.destroy = async function () {
        noteSkip('destroy', tableNameOf(this.constructor));
        return undefined;
    };

    proto.increment = async function () {
        noteSkip('increment', tableNameOf(this.constructor));
        return this;
    };

    proto.decrement = async function () {
        noteSkip('decrement', tableNameOf(this.constructor));
        return this;
    };

    // Note: instance.reload() is a SELECT — intentionally not patched.
}
