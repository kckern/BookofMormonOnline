import React from 'react'

const MenuIcon = ({ fill = "#ffffff", className }) => {
  return (
    <><svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill={fill} d="M32 96v64h448V96H32zm0 128v64h448v-64H32zm0 128v64h448v-64H32z"/></svg></>
  )
}

export default MenuIcon