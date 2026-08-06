-- PR-3: DB-level constraint: at most one active reading plan per owner.
--
-- MySQL has no native partial unique indexes, so the standard workaround is:
--   1. A generated (virtual) column that equals the owner when status='active',
--      else NULL.
--   2. A UNIQUE index on (owner, active_owner_key).
--
-- NULL values are never considered equal by MySQL UNIQUE indexes, so rows with
-- status != 'active' (completed / abandoned) can coexist freely. Only
-- status='active' rows are constrained: a second INSERT with the same owner and
-- status='active' will produce a duplicate-key error (ER_DUP_ENTRY 1062),
-- which the application maps to ACTIVE_PLAN_EXISTS.
--
-- Precondition: no owner may have more than one status='active' row before this
-- DDL is applied.  Run:
--   SELECT owner, COUNT(*) c FROM bom_readingplan
--   WHERE status='active' GROUP BY owner HAVING c>1;
-- and resolve any violations before executing this script.
--
-- Applied: 2026-08-05 (zero violations confirmed against bom_prd).

ALTER TABLE bom_readingplan
  ADD COLUMN active_owner_key VARCHAR(256) GENERATED ALWAYS AS (
    CASE WHEN status = 'active' THEN owner ELSE NULL END
  ) VIRTUAL,
  ADD UNIQUE KEY uniq_owner_active (active_owner_key);
