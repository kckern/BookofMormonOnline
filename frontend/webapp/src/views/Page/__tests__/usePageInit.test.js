import { buildInitSteps, buildOpenList } from "../usePageInit";

const dom = (html) => { document.body.innerHTML = html; };

const controller = (initOpen, pageSlug = "lehites") => ({
  states: { initOpen, pageSlug, autoClicked: new Set() },
});

afterEach(() => { document.body.innerHTML = ""; });

test("textId: scroll → open parent → open target → final scroll, in DOM order", () => {
  dom(`
    <div class="content"><div class="row">
      <div textid="lehites/3"><span class="reference"><a href="#">3</a></span>
        <div textid="lehites/5"><span class="reference"><a href="#">5</a></span></div>
      </div>
    </div></div>`);
  const { steps } = buildInitSteps(controller({ textId: "5" }));
  expect(steps.map((s) => s.type)).toEqual([
    "scrollToElement",
    "call", "openAndAwait",   // parent lehites/3 (autoClicked tag + open)
    "call", "openAndAwait",   // target lehites/5
    "scrollToElement",        // final corrective scroll
  ]);
});

test("textId with no parent nesting opens only the target", () => {
  dom(`<div class="row"><div textid="lehites/7"><span class="reference"><a>7</a></span></div></div>`);
  const { steps } = buildInitSteps(controller({ textId: "7" }));
  expect(steps.filter((s) => s.type === "openAndAwait")).toHaveLength(1);
});

test("missing textId element reports verseNotFound", () => {
  dom(`<div class="row"></div>`);
  const out = buildInitSteps(controller({ textId: "99" }));
  expect(out.steps).toBeNull();
  expect(out.reason).toBe("verseNotFound");
});

test("goToSection scrolls to the section element", () => {
  dom(`<div id="lehites/some-section" class="pagesection"></div>`);
  const { steps } = buildInitSteps(controller({ goToSection: "some-section" }));
  expect(steps.map((s) => s.type)).toEqual(["scrollToElement"]);
});

test("no target yields empty steps", () => {
  expect(buildInitSteps(controller({})).steps).toEqual([]);
});

test("buildOpenList filters non-string parent slugs", () => {
  dom(`<div class="row"><div textid="lehites/2"><span class="reference"><a>2</a></span></div></div>`);
  const { openSlugs } = buildOpenList("lehites", "2");
  expect(openSlugs).toEqual(["lehites/2"]);
});
