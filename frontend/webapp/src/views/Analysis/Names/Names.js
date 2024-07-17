import React, { useState } from "react";
import BootstrapSwitchButton from 'bootstrap-switch-button-react';
import { MultiSelect } from "react-multi-select-component";

import "./Names.css";
import names from "./data.js";

function Container({ appController }) {
  const [nameControls, setNameControls] = useState({});
  
  return (
    <div className="container" >

<h3 class="title lg-4 text-center"
        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexGrow:0 }}
       >Book of Mormon Names
       </h3>
       {/* WARN: Under Construction */}
         <div className="alert alert-warning" role="alert" style={{textAlign: "center"}}>
         🚧 Under Construction 🚧
        </div>
      <NameControls appController={appController} />
      <div className="nameAnalysisList">
        {(names||[]).map((name, i) => (
          <div key={i} className="nameAnalysisItem" style={{
            border: "1px solid #ddd",
            borderRadius: "5px"
          }}>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}

function NameControls({ appController }) {
  return (
    <div className="nameControls">
      <NamesForm />
    </div>
  );
}


const NamesForm = () => {
    // Assuming state management is needed for each select, initialize state here
    const [selectedOptions, setSelectedOptions] = useState({});


    const structure = [
        { label: 'Prefix', value: 'prefix' , items: [
            "A~", "Ƨe~", "La~", "Ne~", "Am~", "Rip~"
        ]},
        { label: 'Stem', value: 'stem' , items:[
            "Ab",
            "Am",
            "An",
            "Ant",
            "Che",
            "Co",
            "Cor",
            "Cum",
            "Em",
            "Es",
            "Eth",
            "Ez",
            "Gid",
            "Gil",
            "Ha",
            "Hel",
            "Her",
            "Him",
            "Irr",
            "Jac",
            "Jar",
            "Jer",
            "Josh",
            "Kib",
            "Kim",
            "Kor",
            "Lam",
            "Leh",
            "Mor",
            "Ne",
            "Om",
            "Pa",
            "Sam",
            "Sar",
            "Se",
            "She",
            "Shi",
            "Shub",
            "Si",
            "Tean",
            "Teom",
            "Zara",
            "Ze",
            "Zem",
            "Zera",
            "Ziff",
            "Zor"
        ]
        },
        { label: 'Affix', value: 'affix', items: [
            "~ian", "~ər", "~əmn", "~i", "~ah", "g~", "~əs"]},
        { label: 'Suffix', value: 'suffix', items: [
             "~iah", "~hah", "g~", "~əs"]
         },
        { label: 'Culture', value: 'culture' , items: [
            "Hebrew", "Greek", "Egyptian", 
             "Latin", "Nephite", "Lamanite", "Jaredite"
        ]}
    ]
  
    return (
        <div>

      <table className="nameform" style={{ width: "100%" }}>
        <thead>
          <tr>
            {structure.map((field, i) => (
                <th key={i}>{field.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {
            //['prefix', 'stems', 'affix', 'suffix',  'culture']
            structure.map((items, i) => {
                
              const field = items.value;
              const options  = items.items.map((item) => ({ label: item, value: item }));
              
              //[  { label: 'Item', value: 'one' , disabled: true} ];
  
              const handleChange = (newValues, field) => {
                newValues.forEach((newValue) => {
                  selectedOptions[field] = selectedOptions[field] || [];
                  const index = selectedOptions[field].indexOf(newValue);
                  if (index >= 0) delete selectedOptions[field][index];
                  else selectedOptions[field].push(newValue);
                });
                setSelectedOptions(selectedOptions);
              };
  
              return (
                <td key={i}>
                  <MultiSelectComponent
                    options={options}
                    value={selectedOptions[i]}
                    fieldName={field}
                    onChange={handleChange}
                    labelledBy="Select"
                  />
                </td>
              );
            })}
          </tr>
        </tbody>
      </table></div>
    );
  };

const MultiSelectComponent = ({ options, value, fieldName, onChange, labelledBy }) => {

    const onChangeSingle = (newValues) => {
        const vals = newValues.map((val) => val.value);
        onChange(vals, fieldName);
    };

    return (
      <div className="form-group">
        <MultiSelect
            options={options}
            value={[]}
            onChange={onChangeSingle}
            labelledBy="Select"
        />
      </div>
    );
  };

function ThWithPopup({ label }) {
  return (
    <th>
      {label}
    </th>
  );
}

export default Container;
