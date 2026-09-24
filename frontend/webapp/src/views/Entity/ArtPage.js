import React, { useEffect, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import { Spinner } from "src/views/_Common/Loader";
import "./EntityPage.css";

// label() returns " " before global.dictionary loads and echoes the key when the
// dictionary lacks it (models/Utils.js:99-101), so `label(k) || fallback` never
// falls back. See the same helper in EntityPage.js.
function text(key, fallback) {
  const value = label(key);
  if (!value || !String(value).trim() || value === key) return fallback;
  return value;
}

/**
 * Standalone view of one artwork.
 *
 * Art has no popup body to reuse — in-chapter art is activated inline through
 * appController.functions.requestImageActivation (views/Page/Annotations.js),
 * which this page deliberately does NOT call. Before this page existed, a
 * direct load of /art/:id resolved the image to its parent chapter and
 * activated it there (views/Page/Page.js).
 */
export default function ArtPage() {
  const { imageId } = useParams();
  const { pathname } = useLocation();
  const routerHistory = useHistory();
  const [state, setState] = useState({ data: null, status: "loading" });

  // /image/<id> canonicalizes to /art/<id>. Pre-existing contract, asserted by
  // e2e/deeplink-image.spec.js, and it matches the canonical SSR path
  // (frontend/next/app/art/[id]).
  useEffect(() => {
    if (pathname.startsWith("/image/")) routerHistory.replace(`/art/${imageId}`);
  }, [pathname, imageId, routerHistory]);

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, status: "loading" });
    BoMOnlineAPI({ image: [imageId] }).then((response) => {
      if (cancelled) return;
      const record = response?.image?.[imageId] ?? null;
      setState({ data: record, status: record ? "ready" : "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  const { data, status } = state;

  useEffect(() => {
    if (data?.title) document.title = `${data.title} | ${text("home_title", "Book of Mormon Online")}`;
  }, [data]);

  if (status === "loading") {
    return (
      <div className="entity-page art-page">
        <Spinner top={"6em"} />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="entity-page art-page">
        <div className="emptyState" style={{ padding: "2em", textAlign: "center" }}>
          {text("not_found", "Not found")}
        </div>
      </div>
    );
  }

  return (
    <div className="entity-page art-page">
      <img
        className="art-page-image"
        src={`${assetUrl}/art/${data.id}`}
        alt={data.title || ""}
        title={data.title || ""}
        width={data.width || undefined}
        height={data.height || undefined}
      />
      <h1>{data.title}</h1>
      {data.artist && <h2 className="art-page-artist">{data.artist}</h2>}
      {data.location?.slug && (
        <p>
          <a href={`/${data.location.slug}`}>❮ {text("read_passage", "Read the passage")}</a>
        </p>
      )}
      {data.link && (
        <p className="art-page-source">
          <a href={data.link} target="_blank" rel="noreferrer noopener">
            {text("source", "Source")}
          </a>
        </p>
      )}
    </div>
  );
}
