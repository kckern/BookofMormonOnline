/** @format */

import React from "react"
import logo from "../svg/logo.svg"
import loading from  "../svg/loadbar.svg"
// CSS
import "./Style.css"

function Loader({ top }) {
  return (
    <div
      className='loadBar noselect'
      style={{
        top: top ? top : "20vh",
      }}
    >
      <img src={logo} alt='logo' className='logo' />
      <img alt='reload' src={loading} />
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
      <img alt='reload' src={loading} />
    </div>
  )
}

export default Loader
