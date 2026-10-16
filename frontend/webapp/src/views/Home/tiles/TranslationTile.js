import React from "react";
import labelOr from "./_ds/labelOr";
import ArchiveDocTile from "./ArchiveDocTile";

// Translation-archive tile — no image (per direction). The eyebrow goes to the
// translation archive, the CTA to the featured document itself.
//
// NOT in the reserve pool (registry.js): every translation-archive row is still
// quote_curation_status "needs-editorial-quote" (0/155 have a money_quote), so
// the sampler returns null for every seed. Re-add the pool entry once quotes
// are curated.
export default function TranslationTile({ data }) {
  if (!data) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history/translation";
  return (
    <ArchiveDocTile
      data={data}
      heading={labelOr("translation", "Translation")}
      headingTo="/history/translation"
      to={to}
      images={[]}
    />
  );
}
