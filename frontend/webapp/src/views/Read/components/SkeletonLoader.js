import React, { useState, useMemo } from 'react';

/**
 * Skeleton loader component for read view
 */
export const SkeletonLoader = () => {
    // Generate skeleton data once and memoize it
    const skeletonData = useMemo(() => {
        const getRandomWidth = () => Math.floor(Math.random() * (80 - 40 + 1)) + 40;
        const getRandomParagraphs = () => Math.floor(Math.random() * 5) + 1; // 1-5 paragraphs
        const getRandomLines = () => Math.floor(Math.random() * 6) + 2; // 2-7 lines
        const getRandomLineWidth = (isLast) => {
            if (isLast) {
                // Last line in paragraph: 50-75% width for ragged edge
                return Math.floor(Math.random() * 26) + 50;
            }
            // Regular lines: 90-100% width with some variation in last 10%
            return Math.floor(Math.random() * 11) + 90;
        };

        // Generate skeleton data once
        return [1, 2, 3].map((sectionIndex) => ({
            id: sectionIndex,
            headingWidth: getRandomWidth(),
            paragraphs: Array.from({ length: getRandomParagraphs() }, (_, paragraphIndex) => {
                const numLines = getRandomLines();
                return {
                    id: paragraphIndex,
                    lines: Array.from({ length: numLines }, (_, lineIndex) => {
                        const isLastLine = lineIndex === numLines - 1;
                        return {
                            id: lineIndex,
                            width: getRandomLineWidth(isLastLine)
                        };
                    })
                };
            })
        }));
    }, []); // Empty dependency array - generate once
    
    return (
        <div className="read-content">
            {skeletonData.map((section) => (
                <div key={section.id} className="read-section skeleton-section">
                    <div className="read-section-header skeleton-header">
                        <div className="skeleton-heading" style={{ width: `${section.headingWidth}%` }}></div>
                        <div className="skeleton-study-btn"></div>
                    </div>
                    <div className="read-block skeleton-block">
                        <div className="left-gutter skeleton-gutter">
                            <div className="skeleton-avatar"></div>
                            <div className="skeleton-voice"></div>
                        </div>
                        <div className="main-content skeleton-content">
                            {section.paragraphs.map((paragraph) => (
                                <div key={paragraph.id} className="skeleton-paragraph">
                                    {paragraph.lines.map((line) => (
                                        <div 
                                            key={line.id} 
                                            className="skeleton-text-line" 
                                            style={{ width: `${line.width}%` }}
                                        ></div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
