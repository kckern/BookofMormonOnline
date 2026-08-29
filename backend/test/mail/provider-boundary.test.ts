import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe('mail provider boundary', () => {
  it('keeps SES SDK imports inside its adapter directory', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const violations = files(sourceRoot)
      .filter((path) => path.endsWith('.ts'))
      .filter((path) => readFileSync(path, 'utf8').includes('@aws-sdk/client-ses'))
      .map((path) => relative(sourceRoot, path))
      .filter((path) => !path.startsWith('mail/adapters/'));
    expect(violations).toEqual([]);
  });
});
