import React from 'react';

export default function PeoplePlacesFilter({ showFilterOption, toggleOption, filterOptions, filterData, isUser }) {
    return (
        <div className={showFilterOption ? "filter-option-visible" : "filter-option"}>
            <div className="filter-type">{isUser ? 'Social Identification' : 'Location Type'}</div>
            <div className="filter-option-block">
                {filterOptions.map((option, index) => {
                    if (option.filterType === 'type' || option.filterType === 'identification') {
                        let isExit = filterData.find(x => x === option);
                        return <div key={index}
                            className={`${isExit ? 'in-active-option' : 'active-option'} peopleoption identificationbiblical`} onClick={() => toggleOption(option)}>
                            {!isExit && <i className="fa fa-check" aria-hidden="true" />}
                            &nbsp;<span>{option.text}</span>
                        </div>
                    }
                    else return <div key={index} />
                })}
            </div>
            <div className="filter-type">{isUser ? 'Social Classification' : 'Greater Region'}</div>
            <div className="filter-option-block">
                {filterOptions.map((option, index) => {
                    if (option.filterType === 'location' || option.filterType === 'classification') {
                        let isExit = filterData.find(x => x === option)
                        return (
                            <div key={index}
                                className={`${isExit ? 'in-active-option' : 'active-option'} peopleoption identificationbiblical`} onClick={() => toggleOption(option)}>
                                {!isExit && <i className="fa fa-check" aria-hidden="true" />}
                                <span>{option.text}</span>
                            </div>
                        )
                    }
                    else return <div key={index} />
                })}
            </div>
            <div className="filter-type">{isUser ? 'Social Unit' : 'Occupants'}</div>
            <div className="filter-option-block">
                {filterOptions.map((option, index) => {
                    if (option.filterType === 'occupants' || option.filterType === 'unit') {
                        let isExit = filterData.find(x => x === option)
                        return (
                            <div key={index} className={`${isExit ? 'in-active-option' : 'active-option'} peopleoption identificationbiblical`}
                                onClick={() => toggleOption(option)}>
                                {!isExit && <i className="fa fa-check" aria-hidden="true" />}
                                <span>{option.text}</span>
                            </div>
                        )
                    }
                    else return <div key={index} />
                })}
            </div>
        </div>
    )
}
