import React from 'react';

const CommentaryPanel = ({ data }) => {
    return (
        <pre className="category-data">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
};

export default CommentaryPanel;
