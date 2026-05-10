import React from 'react';
import './BasePanel.scss';

const BasePanel = ({ title, children, onClose, open }) => {
    return (
        <div className={`base-panel ${open ? 'open' : ''}`}>
            <div className="category-panel-header">
                <h5>{title}</h5>
                <button onClick={onClose} className="close-button">&times;</button>
            </div>
            <div className="category-panel-content">
                {children}
            </div>
        </div>
    );
};

export default BasePanel;
