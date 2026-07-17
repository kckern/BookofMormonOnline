import React from 'react';
import { useAppController } from 'src/contexts/AppControllerContext';
import { popUpTargetFor } from '../../_Common/XrelSection';

/**
 * Passage-anchored cross-entity relationships (PassageXrel rows).
 * Unlike XrelSection rows, these carry BOTH endpoints — a passage has no
 * implicit anchor entity — so each row reads src-name, verb, dst-name.
 */
const RelationshipsPanel = ({ data }) => {
    const appController = useAppController();

    const handleEndpointClick = (type, slug, e) => {
        e.preventDefault();
        const target = popUpTargetFor(type, slug);
        if (target) appController.functions.setPopUp(target);
    };

    if (!Array.isArray(data) || data.length === 0) return null;

    const endpointLink = (type, slug, name) => (
        <a href="#" onClick={(e) => handleEndpointClick(type, slug, e)}>
            {name}
        </a>
    );

    return (
        <ul className="passage-xrels">
            {data.map((x, idx) => (
                <li key={idx} className={`passage-xrel xrel-${x.src_type}-${x.dst_type}`}>
                    {endpointLink(x.src_type, x.src_slug, x.src_name)}{' '}
                    <span className="rel-verb">{x.rel}</span>{' '}
                    {endpointLink(x.dst_type, x.dst_slug, x.dst_name)}
                    {x.note && <div className="xrel-note">{x.note}</div>}
                </li>
            ))}
        </ul>
    );
};

export default RelationshipsPanel;
