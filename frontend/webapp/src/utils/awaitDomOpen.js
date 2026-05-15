export function awaitDomOpen(slug, timeoutMs = 2000) {
  return new Promise(resolve => {
    const target = document.querySelector(`[textid='${slug}'] .reference`);
    if (!target) {
      resolve("missing");
      return;
    }
    if (target.classList.contains("open")) {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve("opened")));
      return;
    }
    const observer = new MutationObserver(() => {
      if (target.classList.contains("open")) {
        observer.disconnect();
        clearTimeout(timer);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve("opened")));
      }
    });
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve("timeout");
    }, timeoutMs);
  });
}
