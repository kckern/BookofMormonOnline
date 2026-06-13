import {
  STUDYEDITION_TITLE,
  STUDYEDITION_UL_INNER,
  STUDYEDITION_PARAGRAPHS,
  STUDYEDITION_IMG_SRC,
} from '@/lib/studyedition'

// Shared body render for /studyedition and its /특별반 alias. A React Fragment so
// the children land as direct <body> children (the box has no wrapper div). The
// <ul> inner HTML is injected raw to keep the PHP `href="..." >` trailing space.
export function StudyEditionView() {
  return (
    <>
      <h1>{STUDYEDITION_TITLE}</h1>
      <ul dangerouslySetInnerHTML={{ __html: STUDYEDITION_UL_INNER }} />
      {STUDYEDITION_PARAGRAPHS.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={STUDYEDITION_IMG_SRC} style={{ width: '100%' }} />
    </>
  )
}
