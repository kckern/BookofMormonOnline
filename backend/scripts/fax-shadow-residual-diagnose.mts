#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Diagnose residual render-QA failures against a trusted page registration.
 *
 * This script is deliberately read-only. It separates geometry that fails to
 * cover the registered source bounds from source content that maps beyond the
 * target scan's physical page. The latter is evidence of scan clipping, not a
 * whitespace-snap distance that can be repaired by moving a box.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

type QaResult = {
  version: string;
  verseId: number;
  selector: string;
  status: 'pass' | 'warning' | 'failure' | 'unavailable';
  flags: string[];
};

type AxisRegistration = {
  scale: number;
  offset: number;
};

type LineMapping = {
  sourceKey: string;
  targetKey: string;
  sourceCenter: number;
  targetCenter: number;
  matches: number;
};

type Registration = {
  accepted: boolean;
  storedPage: number;
  sourceImagePage: number;
  targetImagePage: number;
  x: AxisRegistration;
  y: AxisRegistration;
  yKnots: Array<{ source: number; target: number; matches: number }>;
  lineMappings: LineMapping[];
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
  throw new Error(
    `registration family is ${registrationReport.sourceVersion}->` +
    `${registrationReport.targetVersion}, expected ` +
    `${sourceVersion}->${targetVersion}`,
  );
}

const registrationByStoredPage = new Map(
  registrationReport.registrations
    .filter((registration) => registration.accepted)
    .map((registration) => [registration.storedPage, registration]),
);
const db = openShadow(shadowFile, { queryOnly: true });

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

const failures = qa.results.filter((result) =>
  result.version === targetVersion && result.status === 'failure');
const results = failures.map((failure) => {
  const sourceRows = ordered(loadShadowRows(db, {
    versions: [sourceVersion],
    verseIds: [failure.verseId],
  }));
  const targetRows = ordered(loadShadowRows(db, {
    versions: [targetVersion],
    verseIds: [failure.verseId],
  }));
  const categories = new Set<string>();
  if (sourceRows.length !== targetRows.length) {
    categories.add('TOPOLOGY_MISMATCH');
  }
  const rowDiagnostics = sourceRows.map((source, ordinal) => {
    const target = targetRows[ordinal] ?? null;
    const registration = registrationByStoredPage.get(source.page) ?? null;
    if (!target) {
      categories.add('TARGET_ROW_MISSING');
      return { ordinal, source, target, registration: null };
    }
    if (!registration) {
      categories.add('PAGE_REGISTRATION_UNAVAILABLE');
      return { ordinal, source, target, registration: null };
    }
    const mapX = (value: number) =>
      value * registration.x.scale + registration.x.offset;
    const mapped = {
      left: mapX(source.X),
      right: mapX(source.X + source.W),
      top: mappedY(registration, source.Y),
      bottom: mappedY(registration, source.Y + source.H),
    };
    const clipped = {
      left: Math.max(0, mapped.left),
      right: Math.min(700, mapped.right),
      top: Math.max(0, mapped.top),
      // Geometry is normalized by page width, so the vertical coordinate may
      // legitimately exceed 700 on a portrait page.
      bottom: mapped.bottom,
    };
    const current = {
      left: target.X,
      right: target.X + target.W,
      top: target.Y,
      bottom: target.Y + target.H,
    };
    const delta = {
      leftUndercoverage: current.left - clipped.left,
      rightUndercoverage: clipped.right - current.right,
      topUndercoverage: current.top - clipped.top,
      bottomUndercoverage: clipped.bottom - current.bottom,
    };
    if (mapped.left < -4) categories.add('SOURCE_CLIPPED_LEFT');
    if (mapped.right > 704) categories.add('SOURCE_CLIPPED_RIGHT');
    if (mapped.top < -4) categories.add('SOURCE_CLIPPED_TOP');
    if (delta.leftUndercoverage > 8) {
      categories.add('CURRENT_LEFT_UNDERCOVERAGE');
    }
    if (delta.rightUndercoverage > 8) {
      categories.add('CURRENT_RIGHT_UNDERCOVERAGE');
    }
    if (delta.topUndercoverage > 5) {
      categories.add('CURRENT_TOP_UNDERCOVERAGE');
    }
    if (delta.bottomUndercoverage > 5) {
      categories.add('CURRENT_BOTTOM_UNDERCOVERAGE');
    }
    if (delta.leftUndercoverage < -12) {
      categories.add('CURRENT_LEFT_OVERREACH');
    }
    if (delta.rightUndercoverage < -12) {
      categories.add('CURRENT_RIGHT_OVERREACH');
    }
    if (delta.topUndercoverage < -8) {
      categories.add('CURRENT_TOP_OVERREACH');
    }
    if (delta.bottomUndercoverage < -8) {
      categories.add('CURRENT_BOTTOM_OVERREACH');
    }
    const mappedLines = registration.lineMappings.filter((mapping) =>
      mapping.sourceCenter >= source.Y - 2 &&
      mapping.sourceCenter <= source.Y + source.H + 2);
    if (!mappedLines.length) categories.add('NO_REGISTERED_SOURCE_LINES');
    return {
      ordinal,
      source,
      target,
      registration: {
        storedPage: registration.storedPage,
        sourceImagePage: registration.sourceImagePage,
        targetImagePage: registration.targetImagePage,
        x: registration.x,
        y: registration.y,
      },
      mapped,
      clipped,
      current,
      delta,
      mappedLineCount: mappedLines.length,
      mappedLineMatches: mappedLines.reduce(
        (total, mapping) => total + mapping.matches,
        0,
      ),
    };
  });
  return {
    version: failure.version,
    verseId: failure.verseId,
    selector: failure.selector,
    qaFlags: failure.flags,
    categories: [...categories].sort(),
    rowDiagnostics,
  };
});
db.close();

const byCategory: Record<string, number> = {};
for (const result of results) {
  for (const category of result.categories) {
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }
}
const byImagePage = Object.fromEntries(
  [...new Set(results.flatMap((result) =>
    result.rowDiagnostics
      .map((row) => row.registration?.targetImagePage)
      .filter((page): page is number => page != null)))]
    .sort((left, right) => left - right)
    .map((page) => [
      String(page),
      results.filter((result) => result.rowDiagnostics.some((row) =>
        row.registration?.targetImagePage === page)).length,
    ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  method:
    'read-only residual QA diagnosis against robust family page registration',
  shadowFile,
  qaFile,
  registrationFile,
  sourceVersion,
  targetVersion,
  failures: results.length,
  registeredFailures: results.filter((result) =>
    !result.categories.includes('PAGE_REGISTRATION_UNAVAILABLE')).length,
  byCategory: Object.fromEntries(
    Object.entries(byCategory).sort((left, right) =>
      right[1] - left[1] || left[0].localeCompare(right[0])),
  ),
  byImagePage,
  results,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  failures: report.failures,
  registeredFailures: report.registeredFailures,
  byCategory: report.byCategory,
}, null, 2));
