import React, { useState } from 'react';
import './PassageNotes.scss';
import CommentaryPanel from './CategoryPanels/CommentaryPanel';
import PeoplePanel from './CategoryPanels/PeoplePanel';
import PlacesPanel from './CategoryPanels/PlacesPanel';
import MattersPanel from './CategoryPanels/MattersPanel';
import ImagesPanel from './CategoryPanels/ImagesPanel';
import ChiasmusPanel from './CategoryPanels/ChiasmusPanel';
import ReferencesPanel from './CategoryPanels/ReferencesPanel';
import BasePanel from './CategoryPanels/BasePanel';
import './CategoryPanels/CategoryPanels.scss';

const PassageNotes = ({ 
    passageNotesLoading, 
    sectionPassageNotes, 
    sectionVerseIds,
    animationDelay = 0
}) => {
    // Flatten the verse ID structure to get combined category counts
    const getCategoryCounts = (passageNotes) => {
        if (!passageNotes) return {};
        
        const counts = {
            commentary: [],
            people: [],
            places: [],
            matters: [],
            images: [],
            chiasmus: [],
            refs: []
        };
        
        // Iterate through each verse ID and collect all items
        Object.values(passageNotes).forEach(verseData => {
            if (verseData.commentary) counts.commentary.push(...verseData.commentary);
            if (verseData.people) counts.people.push(...verseData.people);
            if (verseData.places) counts.places.push(...verseData.places);
            if (verseData.matters) counts.matters.push(...verseData.matters);
            if (verseData.images) counts.images.push(...verseData.images);
            if (verseData.chiasmus) counts.chiasmus.push(...verseData.chiasmus);
            if (verseData.refs) counts.refs.push(...verseData.refs);
        });

        // A chiasm spanning multiple verses appears once per verse; the panel
        // dedups by chiasmus_id, so the badge count must match it
        counts.chiasmus = counts.chiasmus.filter((c, i, a) => !c.chiasmus_id || a.findIndex(x => x.chiasmus_id === c.chiasmus_id) === i);

        return counts;
    };

    const categoryCounts = getCategoryCounts(sectionPassageNotes);
    const [activePanel, setActivePanel] = useState(null);

    const handleTabClick = (category) => {
        setActivePanel(activePanel === category ? null : category);
    };

    const renderPanel = () => {
        if (!activePanel || !categoryCounts[activePanel]) return null;
        
        const data = categoryCounts[activePanel];

        const panelConfig = {
            commentary: { title: 'Commentary', Component: CommentaryPanel },
            people: { title: 'People', Component: PeoplePanel },
            places: { title: 'Places', Component: PlacesPanel },
            matters: { title: 'Matters', Component: MattersPanel },
            images: { title: 'Images', Component: ImagesPanel },
            chiasmus: { title: 'Chiasmus', Component: ChiasmusPanel },
            refs: { title: 'References', Component: ReferencesPanel },
        };

        const { title, Component } = panelConfig[activePanel];

        return (
            <BasePanel
                title={title}
                onClose={() => handleTabClick(activePanel)}
                open={!!activePanel}
            >
                <Component data={data} />
            </BasePanel>
        );
    };

    return (
        <div className="section-footer">
            <div 
                className={`passage-notes ${passageNotesLoading ? 'loading' : ''}`}
                style={{
                    animationDelay: passageNotesLoading ? '0ms' : `${animationDelay}ms`,
                    transitionDelay: passageNotesLoading ? '0ms' : `${animationDelay}ms`
                }}
            >
                {passageNotesLoading ? (
                    // Loading state - content hidden by CSS
                    null
                ) : sectionPassageNotes ? (
                    <>
                        <div className="category-tabs">
                        {categoryCounts.commentary && categoryCounts.commentary.length > 0 && (
                            <div 
                                className={`category-tab ${activePanel === 'commentary' ? 'active' : ''}`}
                                onClick={() => handleTabClick('commentary')}
                            >
                                <span className="count">{categoryCounts.commentary.length}</span>
                                <span className="label">Commentary</span>
                            </div>
                        )}
                        {categoryCounts.people && categoryCounts.people.length > 0 && (
                            <div 
                                className={`category-tab ${activePanel === 'people' ? 'active' : ''}`}
                                onClick={() => handleTabClick('people')}
                            >
                                <span className="count">{categoryCounts.people.length}</span>
                                <span className="label">People</span>
                            </div>
                        )}
                        {categoryCounts.places && categoryCounts.places.length > 0 && (
                            <div
                                className={`category-tab ${activePanel === 'places' ? 'active' : ''}`}
                                onClick={() => handleTabClick('places')}
                            >
                                <span className="count">{categoryCounts.places.length}</span>
                                <span className="label">Places</span>
                            </div>
                        )}
                        {categoryCounts.matters && categoryCounts.matters.length > 0 && (
                            <div
                                className={`category-tab ${activePanel === 'matters' ? 'active' : ''}`}
                                onClick={() => handleTabClick('matters')}
                            >
                                <span className="count">{categoryCounts.matters.length}</span>
                                <span className="label">Matters</span>
                            </div>
                        )}
                        {categoryCounts.images && categoryCounts.images.length > 0 && (
                            <div 
                                className={`category-tab ${activePanel === 'images' ? 'active' : ''}`}
                                onClick={() => handleTabClick('images')}
                            >
                                <span className="count">{categoryCounts.images.length}</span>
                                <span className="label">Images</span>
                            </div>
                        )}
                        {categoryCounts.chiasmus && categoryCounts.chiasmus.length > 0 && (
                            <div 
                                className={`category-tab ${activePanel === 'chiasmus' ? 'active' : ''}`}
                                onClick={() => handleTabClick('chiasmus')}
                            >
                                <span className="count">{categoryCounts.chiasmus.length}</span>
                                <span className="label">Chiasmus</span>
                            </div>
                        )}
                        {categoryCounts.refs && categoryCounts.refs.length > 0 && (
                            <div 
                                className={`category-tab ${activePanel === 'refs' ? 'active' : ''}`}
                                onClick={() => handleTabClick('refs')}
                            >
                                <span className="count">{categoryCounts.refs.length}</span>
                                <span className="label">References</span>
                            </div>
                        )}                        </div>
                        {renderPanel()}
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default PassageNotes;
