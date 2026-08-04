/** @format */

import React from "react"
import logo from "../svg/logo.svg"
// CSS
import "./Style.css"

// Inlined (was an <img> of loadbar.svg) so the stripe animation runs as a CSS
// transform on real DOM — GPU-composited and smooth even while the main thread
// is busy loading, unlike the old main-thread SMIL <animateTransform>.
let seq = 0
function LoadBar() {
  const clipId = React.useMemo(() => `loadbarClip${++seq}`, [])
  return (
    <svg
      className="loadbar"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid"
      role="img"
      aria-label="loading"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M81.3,58.7H18.7c-4.8,0-8.7-3.9-8.7-8.7v0c0-4.8,3.9-8.7,8.7-8.7h62.7c4.8,0,8.7,3.9,8.7,8.7v0C90,54.8,86.1,58.7,81.3,58.7z" />
        </clipPath>
      </defs>
      <path
        fill="none"
        stroke="#323b4d"
        strokeWidth="2.7928"
        d="M82 63H18c-7.2,0-13-5.8-13-13v0c0-7.2,5.8-13,13-13h64c7.2,0,13,5.8,13,13v0C95,57.2,89.2,63,82,63z"
      />
      <g clipPath={`url(#${clipId})`}>
        <g className="loadbarBars">
          <rect x="-100" y="0" width="25" height="100" fill="#323b4d" />
          <rect x="-75" y="0" width="25" height="100" fill="#fbc658" />
          <rect x="-50" y="0" width="25" height="100" fill="#dddddd" />
          <rect x="-25" y="0" width="25" height="100" fill="#666666" />
          <rect x="0" y="0" width="25" height="100" fill="#323b4d" />
          <rect x="25" y="0" width="25" height="100" fill="#fbc658" />
          <rect x="50" y="0" width="25" height="100" fill="#dddddd" />
          <rect x="75" y="0" width="25" height="100" fill="#666666" />
        </g>
      </g>
    </svg>
  )
}

function Loader({ top }) {
  return (
    <div
      className='loadBar noselect'
      style={{
        top: top ? top : "20vh",
      }}
    >
      <img src={logo} alt='logo' className='logo' />
      <LoadBar />
    </div>
  )
}

export function Spinner({ top }) {
  return (
    <div
      className='loadBar noselect'
      style={{
        top: top ? top : "20vh",
      }}
    >
      <LoadBar />
    </div>
  )
}

export default Loader
