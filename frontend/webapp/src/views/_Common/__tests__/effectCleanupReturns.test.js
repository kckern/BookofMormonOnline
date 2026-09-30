import fs from "node:fs";
import path from "node:path";

// React 19 calls whatever an effect returns as its cleanup and throws
// "destroy is not a function" on unmount if that is not a function, which
// tears down the whole app (React 17 only warned). The usual culprit is an
// expression-bodied arrow whose expression is an assignment:
//   useEffect(() => document.title = "…", [])   // returns the string
// Leaving /home/user/preferences this way blanked the app on every Back.

const SRC = path.resolve(__dirname, "../../..");
const ASSIGNING_EFFECT = /use(?:Layout)?Effect\(\s*\(\)\s*=>\s*\(?\s*[\w$.[\]"']+\s*=(?![=>])/g;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(p);
    return /\.(jsx?|tsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

describe("effect callbacks", () => {
  it("never return an assignment's value as their cleanup", () => {
    const offenders = sourceFiles(SRC).flatMap((f) => {
      const s = fs.readFileSync(f, "utf8");
      return [...s.matchAll(ASSIGNING_EFFECT)].map(
        (m) => `${path.relative(SRC, f)}:${s.slice(0, m.index).split("\n").length}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});
