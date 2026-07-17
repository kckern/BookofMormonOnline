import React from 'react';
import { Link } from 'react-router-dom';
import MiniChiasm from '../../_Common/MiniChiasm';
import ChiasmGlyph from '../../_Common/ChiasmGlyph';
import { t } from '../../Analysis/Chiasmus/t';

/**
 * Chiasmus tab of PassageNotes. The passagenotes query resolves only
 * title/reference/scheme/chiasmus_id (lines come back empty — the resolver
 * builds its summary from the first matched line), so each entry renders as
 * glyph + title + reference + deep link into /analysis/chiasmus. If lines
 * ever arrive (future backend work), MiniChiasm picks them up unchanged.
 */
const ChiasmusPanel = ({ data }) => {
    if (!data?.length) return null;

    // the same chiasm can arrive once per verse batch — collapse repeats
    const seen = new Set();
    const items = data.filter((c) => {
        const id = c?.chiasmus_id;
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    return (
        <div className="chiasmus-panel">
            {items.map((c, i) => (
                <div key={c.chiasmus_id || i} className="chiasmus-panel-item">
                    <div className="chiasmus-panel-head">
                        <ChiasmGlyph scheme={c.scheme} size={28} title={c.title || c.reference} />
                        <div className="chiasmus-panel-titles">
                            <strong>{c.title}</strong>
                            <div className="ref">{c.reference}</div>
                        </div>
                    </div>
                    {c.lines?.length ? <MiniChiasm lines={c.lines} /> : null}
                    {c.chiasmus_id && (
                        <Link className="chiasmus-panel-link" to={`/analysis/chiasmus/${c.chiasmus_id}`}>
                            {t('view_full_chiasm', 'View full chiasm')}
                        </Link>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ChiasmusPanel;
