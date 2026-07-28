#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Build guarded family-registration proposals for residual QA failures.
 *
 * Page OCR registration establishes the source-to-target transform. When
 * target OCR cannot whitespace-snap every source line (often because a scan is
 * clipped or degraded), this fallback transfers the already-authored source
 * boundary through that accepted transform. It does not accept its own output:
 * the report must still pass structural and rendered before/after QA.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
  shadowImageMeta,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type QaResult = {
  version: string;
  verseId: number;
  selector: string;
  status: 'pass' | 'warning' | 'failure' | 'unavailable';
  flags: string[];
};

type Registration = {
  accepted: boolean;
  storedPage: number;
  sourceImagePage: number;
  targetImagePage: number;
  x: {
    scale: number;
    offset: number;
    p95Residual: number;
  };
  y: {
    scale: number;
    offset: number;
    p95Residual: number;
  };
  yKnots: Array<{ source: number; target: number; matches: number }>;
  lineMappings: Array<{
    sourceKey: string;
    targetKey: string;
    sourceCenter: number;
    targetCenter: number;
    matches: number;
  }>;
};

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const qaFile = path.resolve(flag('qa-report'));
const registrationFile = path.resolve(flag('registration-report'));
const sourceVersion = flag('source-version');
const targetVersion = flag('target-version');
const outputFile = path.resolve(flag('out'));
const pad = Math.max(0, Math.min(8, Number(flag('pad', '2')) || 0));
const rectanglesOnly = argv.includes('--rectangles-only');
const notchFreePagesOnly = argv.includes('--notch-free-pages-only');
if (!fs.existsSync(shadowFile) ||
    !flag('qa-report') || !fs.existsSync(qaFile) ||
    !flag('registration-report') || !fs.existsSync(registrationFile) ||
    !sourceVersion || !targetVersion || !flag('out')) {
  throw new Error(
    '--shadow, --qa-report, --registration-report, --source-version, ' +
    '--target-version, and --out are required',
  );
}

const qa = JSON.parse(fs.readFileSync(qaFile, 'utf8')) as {
  results: QaResult[];
};
const registrationReport = JSON.parse(
  fs.readFileSync(registrationFile, 'utf8'),
) as {
  sourceVersion: string;
  targetVersion: string;
  registrations: Registration[];
};
if (registrationReport.sourceVersion !== sourceVersion ||
    registrationReport.targetVersion !== targetVersion) {
  throw new Error('registration report does not match the requested family');
}
const registrationByPage = new Map(
  registrationReport.registrations
    .filter((registration) => registration.accepted)
    .map((registration) => [registration.storedPage, registration]),
);

function mappedY(registration: Registration, sourceY: number): number {
  const knots = [...registration.yKnots].sort((left, right) =>
    left.source - right.source);
  if (knots.length < 2) {
    return sourceY * registration.y.scale + registration.y.offset;
  }
  const first = knots[0]!;
  const last = knots.at(-1)!;
  if (sourceY <= first.source) {
    const next = knots[1]!;
    const scale = (next.target - first.target) /
      Math.max(1e-6, next.source - first.source);
    return first.target + (sourceY - first.source) * scale;
  }
  if (sourceY >= last.source) {
    const previous = knots.at(-2)!;
    const scale = (last.target - previous.target) /
      Math.max(1e-6, last.source - previous.source);
    return last.target + (sourceY - last.source) * scale;
  }
  for (let index = 1; index < knots.length; index++) {
    const right = knots[index]!;
    if (sourceY > right.source) continue;
    const left = knots[index - 1]!;
    const ratio = (sourceY - left.source) /
      Math.max(1e-6, right.source - left.source);
    return left.target + (right.target - left.target) * ratio;
  }
  return sourceY * registration.y.scale + registration.y.offset;
}

function ordered(rows: ShadowGeometry[]): ShadowGeometry[] {
  return [...rows].sort((left, right) =>
    left.page - right.page || left.Y - right.Y || left.X - right.X);
}

function transform(
  source: ShadowGeometry,
  current: ShadowGeometry,
  registration: Registration,
  targetOffset: number,
): { row: ShadowGeometry; evidence: Record<string, unknown> } | null {
  const mapX = (value: number) =>
    value * registration.x.scale + registration.x.offset;
  const sourceRight = source.X + source.W;
  const sourceBottom = source.Y + source.H;
  const mapped = {
    left: mapX(source.X),
    right: mapX(sourceRight),
    top: mappedY(registration, source.Y),
    bottom: mappedY(registration, sourceBottom),
  };
  const X = Math.max(0, Math.floor(mapped.left - pad));
  const right = Math.min(700, Math.ceil(mapped.right + pad));
  const Y = Math.max(0, Math.floor(mapped.top - pad));
  const bottom = Math.ceil(mapped.bottom + pad);
  const W = right - X;
  const H = bottom - Y;
  if (W <= 0 || H <= 0) return null;
  const tlActive = source.TLW > 0 && source.TLH > 0;
  const brActive = source.BRW > 0 && source.BRH > 0;
  const TLW = tlActive
    ? Math.max(0, Math.min(W, Math.round(
      mapX(source.X + source.TLW) - X,
    )))
    : 0;
  const TLH = tlActive
    ? Math.max(1, Math.min(H, Math.round(
      mappedY(registration, source.Y + source.TLH) - Y,
    )))
    : 0;
  const BRW = brActive
    ? Math.max(0, Math.min(W, Math.round(
      right - mapX(sourceRight - source.BRW),
    )))
    : 0;
  const BRH = brActive
    ? Math.max(1, Math.min(H, Math.round(
      bottom - mappedY(registration, sourceBottom - source.BRH),
    )))
    : 0;
  if ((TLW === 0) !== (TLH === 0) || (BRW === 0) !== (BRH === 0)) {
    return null;
  }
  return {
    row: {
      ...current,
      page: registration.targetImagePage - targetOffset,
      pageScale: 700,
      X,
      Y,
      W,
      H,
      TLW,
      TLH,
      BRW,
      BRH,
    },
    evidence: {
      storedPage: registration.storedPage,
      sourceImagePage: registration.sourceImagePage,
      targetImagePage: registration.targetImagePage,
      mapped,
      clippedAtLeft: mapped.left < 0,
      clippedAtRight: mapped.right > 700,
      xP95Residual: registration.x.p95Residual,
      yP95Residual: registration.y.p95Residual,
      pad,
    },
  };
}

const db = openShadow(shadowFile, { queryOnly: true });
const targetOffset = shadowImageMeta(db, targetVersion).offset;
const targetNotchedPages = new Set(
  loadShadowRows(db, { versions: [targetVersion] })
    .filter((row) =>
      row.TLW > 0 || row.TLH > 0 || row.BRW > 0 || row.BRH > 0)
    .map((row) => row.page),
);
const failures = qa.results.filter((result) =>
  result.version === targetVersion && result.status === 'failure');
const proposals = failures.map((failure) => {
  const sourceRows = ordered(loadShadowRows(db, {
    versions: [sourceVersion],
    verseIds: [failure.verseId],
  }));
  const currentRows = ordered(loadShadowRows(db, {
    versions: [targetVersion],
    verseIds: [failure.verseId],
  }));
  if (sourceRows.length !== currentRows.length) {
    return {
      version: targetVersion,
      verseId: failure.verseId,
      selector: failure.selector,
      outcome: 'REGISTRATION_FALLBACK_TOPOLOGY_MISMATCH',
      currentRows,
      proposedRows: undefined,
      evidence: { sourceRows: sourceRows.length, targetRows: currentRows.length },
      error: 'source and target row counts differ',
    };
  }
  if (rectanglesOnly && [...sourceRows, ...currentRows].some((row) =>
    row.TLW > 0 || row.TLH > 0 || row.BRW > 0 || row.BRH > 0)) {
    return {
      version: targetVersion,
      verseId: failure.verseId,
      selector: failure.selector,
      outcome: 'REGISTRATION_FALLBACK_NOTCH_DEPENDENCY',
      currentRows,
      proposedRows: undefined,
      evidence: { rectanglesOnly },
      error: 'notched rows require adjacent-verse dependency composition',
    };
  }
  if (notchFreePagesOnly && currentRows.some((row) =>
    targetNotchedPages.has(row.page))) {
    return {
      version: targetVersion,
      verseId: failure.verseId,
      selector: failure.selector,
      outcome: 'REGISTRATION_FALLBACK_PAGE_NOTCH_DEPENDENCY',
      currentRows,
      proposedRows: undefined,
      evidence: {
        notchFreePagesOnly,
        pages: currentRows.map((row) => row.page),
      },
      error: 'page contains a notch dependency outside this proposal',
    };
  }
  const transformed = sourceRows.map((source, ordinal) => {
    const registration = registrationByPage.get(source.page);
    return registration
      ? transform(source, currentRows[ordinal]!, registration, targetOffset)
      : null;
  });
  if (transformed.some((item) => item == null)) {
    return {
      version: targetVersion,
      verseId: failure.verseId,
      selector: failure.selector,
      outcome: 'REGISTRATION_FALLBACK_UNAVAILABLE',
      currentRows,
      proposedRows: undefined,
      evidence: {
        pages: sourceRows.map((row) => row.page),
        registered: sourceRows.map((row) =>
          registrationByPage.has(row.page)),
      },
      error: 'one or more rows lack a safe accepted page transform',
    };
  }
  return {
    version: targetVersion,
    verseId: failure.verseId,
    selector: failure.selector,
    outcome: 'ACCEPTED_REGISTERED_FAMILY_FALLBACK',
    currentRows,
    proposedRows: transformed.map((item) => item!.row),
    evidence: {
      sourceVersion,
      sourceQaFlags: failure.flags,
      rows: transformed.map((item) => item!.evidence),
    },
    error: null,
  };
});
db.close();

const byOutcome = Object.fromEntries(
  [...new Set(proposals.map((proposal) => proposal.outcome))]
    .sort()
    .map((outcome) => [
      outcome,
      proposals.filter((proposal) => proposal.outcome === outcome).length,
    ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  method:
    'registered source-boundary fallback; requires structural and render QA',
  shadowFile,
  qaFile,
  registrationFile,
  sourceVersion,
  targetVersion,
  pad,
  rectanglesOnly,
  notchFreePagesOnly,
  byOutcome,
  proposals,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  failures: failures.length,
  byOutcome,
}, null, 2));
