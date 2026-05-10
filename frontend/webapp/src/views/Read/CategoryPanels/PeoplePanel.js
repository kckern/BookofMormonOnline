import React from 'react';

const PeoplePanel = ({ data }) => {
    return (
        <pre className="category-data">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
};

export default PeoplePanel;
