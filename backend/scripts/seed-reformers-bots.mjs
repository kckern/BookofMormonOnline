console.error(
  'This seed is retired because it embedded identities and prompts in source. ' +
  'Use scripts/configure-study-group.ts with an operator-reviewed JSON file.',
);
process.exitCode = 1;
