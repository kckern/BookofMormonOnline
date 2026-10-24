import React, { useEffect, useRef, useState } from "react";
import { label } from "src/models/Utils";

// A label with an English fallback (the dictionary returns the key when a row is missing).
const t = (key, fallback) => {
  const v = label(key);
  return v && v.trim() && v !== key ? v : fallback;
};

/**
 * Share control. `getUrl` returns the absolute URL to share at click time (so it
 * reflects the page/verse currently in the address bar). Uses the native share
 * sheet on touch devices that have one, otherwise copies to the clipboard and
 * says so.
 */
export default function FaxCopyLink({ getUrl, className = "", title }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const url = getUrl();
    const coarse = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (coarse && navigator.share) {
      try { await navigator.share({ url, title: title || document.title }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (insecure context / permissions): fall back to a prompt.
      window.prompt(t("copy_link", "Copy link"), url);
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className={`faxCopyLink ${className}`} onClick={onClick} aria-live="polite">
      {copied ? t("link_copied", "Link copied") : t("copy_link", "Copy link")}
    </button>
  );
}
