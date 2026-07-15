// Stage-swap page transition previously copy-pasted between Connection and
// PageLink. The ready-poll is now bounded (the old `while` could spin forever
// if the next page never reached .content.ready).
import { useHistory } from "react-router-dom";
import { usePageController } from "src/contexts/PageControllerContext";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const READY_TIMEOUT_MS = 8000;

export async function runStageTransition({
  setStageClass,
  navigate,
  isReady,
  direction = "forward",
  waitFn = wait,
  now = Date.now,
  timeoutMs = READY_TIMEOUT_MS,
}) {
  const [first, second] =
    direction === "back" ? ["stageRight", "stageLeft"] : ["stageLeft", "stageRight"];
  setStageClass(first);
  await waitFn(400);
  setStageClass(second + " " + first);
  await waitFn(10);
  setStageClass(second);
  navigate();
  await waitFn(500);
  const deadline = now() + timeoutMs;
  while (!isReady() && now() < deadline) await waitFn(50);
  setStageClass(null);
}

// Returns handleClick(slug, direction) → click handler.
export function useStageTransition() {
  const pageController = usePageController();
  const history = useHistory();
  return (slug, direction) => async (event) => {
    const { setStageClass } = pageController?.functions || {};
    if (!setStageClass) return;
    event.preventDefault();
    await runStageTransition({
      setStageClass,
      direction,
      navigate: () => history.push(`/${slug}`),
      isReady: () => !!document.querySelector(".content.ready"),
    });
  };
}
