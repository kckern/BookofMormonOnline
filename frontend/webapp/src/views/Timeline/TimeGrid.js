
import React, { useState } from 'react';
import "./TimeGrid.css";

function timeGridWrapper() {
    return (
      <div className="time-grid-wrapper container">
        <h1>TimeGrid</h1>
        <TimeGrid />
      </div>
    );
  }

  function TimeGrid() {

    const cols = 40;
    const rows = 100;
    const cells = Array.from({ length: cols * rows }, (_, i) => {
        const x = i % cols;
        const y = Math.floor(i / cols);
        return [x, y, {}];
    });
    return <div className="time-grid">
            {cells.map((cell, i) => <TimeGridCell key={i} x={cell[0]} y={cell[1]} />)}
        </div>;
  }

const squares = [
    { xywh: [1,1,10,5], color: "#F00", corners: { tl: .5, tr: .5, bl: .5, br: .5 } },
];


const cellData = squares.reduce((acc, square) => {
    const [x, y, width, height] = square.xywh;
    for (let i = x; i < x + width; i++) {
        for (let j = y; j < y + height; j++) {
            const isTopLeft = i === x && j === y;
            const isTopRight = i === x + width - 1 && j === y;
            const isBottomLeft = i === x && j === y + height - 1;
            const isBottomRight = i === x + width - 1 && j === y + height - 1;
            const radius = {};
            if(isTopLeft && square.corners.tl) radius.tl = square.corners.tl;
            if(isTopRight && square.corners.tr) radius.tr = square.corners.tr;
            if(isBottomLeft && square.corners.bl) radius.bl = square.corners.bl;
            if(isBottomRight && square.corners.br) radius.br = square.corners.br;

            acc.push([i, j, { back: null, fore: square.color, borderRadius:radius }]);
        }
    }
    return acc;
}, []);

function TimeGridCell({ x, y }) {

    let [,,item] = cellData.find(datum => datum[0] === x && datum[1] === y) || [0,0,{}];
    item = item || {};

    const style = {};
    if(item.back) style.backgroundColor = item.back;

    return <div className="time-grid-cell" {...style}  >
            {item.fore && <TimeGridCellContent {...item} />}
        </div>;
  }
    
function TimeGridCellContent({  fore, borderRadius, fade }) {


    const borderKeys = Object.keys(borderRadius);
    const radius = borderKeys.reduce((acc, key) => {
        const value = borderRadius?.[key];
        if(!value) return acc;
        if(key === "tl") acc.borderTopLeftRadius = `${value * 100}%`;
        if(key === "tr") acc.borderTopRightRadius = `${value * 100}%`;
        if(key === "bl") acc.borderBottomLeftRadius = `${value * 100}%`;
        if(key === "br") acc.borderBottomRightRadius = `${value * 100}%`;
        return acc;
    }, {});

    console.log("radius", radius,borderKeys);
    return <div className="time-grid-cell-content"
     style={{ 
        backgroundColor: fore || "#FFF", 
        ...radius
         }} >
     </div>;
  }


export default timeGridWrapper;