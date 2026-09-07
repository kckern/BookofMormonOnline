import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import './Witnesses.css';
import HistorySourceCard from "./HistorySourceCard";
import { label } from '../../models/Utils';
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import moment from 'moment';
import Masonry from 'react-masonry-css';
import WitnessLifeHeatmap from './WitnessLifeHeatmap';
import { byCompositionDesc, compositionDate, groupByDecade, matchesYearMonth } from './witnessSources';
import Breadcrumb from "src/views/_Common/Breadcrumb/Breadcrumb";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import { useAppController } from "src/contexts/AppControllerContext";

// Masonry column counts by window width — the sources column sits beside a 280px
// rail, so tiers step down a little earlier than a full-width grid would.
const breakpointColumnsObj = { default: 4, 1600: 3, 1200: 2, 700: 1 };


const data = {
    "three-witnesses": [
        { "slug": "martin-harris",      "name": "Martin Harris",      "birthday": "1783-05-18", "deathday": "1875-07-10", "excommunication": "1837-12-27", "bio": "", "principalNames": ["Martin Harris", "Three Witnesses"] },
        { "slug": "oliver-cowdery",     "name": "Oliver Cowdery",     "birthday": "1806-10-03", "deathday": "1850-03-03", "excommunication": "1838-04-12", "bio": "", "principalNames": ["Oliver Cowdery", "Three Witnesses"] },
        { "slug": "david-whitmer",      "name": "David Whitmer",      "birthday": "1805-01-07", "deathday": "1888-01-25", "excommunication": "1838-04-13", "bio": "", "principalNames": ["David Whitmer", "Three Witnesses"] }
    ],
    "eight-witnesses": [
        { "slug": "john-whitmer",       "name": "John Whitmer",       "birthday": "1802-08-27", "deathday": "1878-07-11", "excommunication": "1838-03-10", "bio": "", "principalNames": ["John Whitmer", "Eight Witnesses"] },
        { "slug": "jacob-whitmer",      "name": "Jacob Whitmer",      "birthday": "1800-01-27", "deathday": "1856-04-21", "excommunication": "1838-06-27", "bio": "", "principalNames": ["Jacob Whitmer", "Eight Witnesses"] },
        { "slug": "christian-whitmer",  "name": "Christian Whitmer",  "birthday": "1798-01-18", "deathday": "1835-11-27", "bio": "", "principalNames": ["Christian Whitmer", "Christian Whitmer and Peter Whitmer, Jr.", "Eight Witnesses"] },
        { "slug": "peter-whitmer-jr",   "name": "Peter Whitmer Jr.",  "birthday": "1809-09-27", "deathday": "1836-09-22", "bio": "", "principalNames": ["Peter Whitmer Jr.", "Peter Whitmer, Jr.", "Christian Whitmer and Peter Whitmer, Jr.", "Eight Witnesses"] },
        { "slug": "hiram-page",         "name": "Hiram Page",         "birthday": "1800",       "deathday": "1852-08-12", "excommunication": "1838-06-27", "bio": "", "principalNames": ["Hiram Page", "Eight Witnesses"] },
        { "slug": "joseph-smith-sr",    "name": "Joseph Smith Sr.",   "birthday": "1771-07-12", "deathday": "1840-09-14", "bio": "", "principalNames": ["Joseph Smith Sr.", "Eight Witnesses"] },
        { "slug": "samuel-smith",       "name": "Samuel Smith",       "birthday": "1808-03-13", "deathday": "1844-07-30", "bio": "", "principalNames": ["Samuel H. Smith", "Eight Witnesses"] },
        { "slug": "hyrum-smith",        "name": "Hyrum Smith",        "birthday": "1800-02-09", "deathday": "1844-06-27", "bio": "", "principalNames": ["Hyrum Smith", "Eight Witnesses"] }
    ],
    "other-witnesses": [
        { "slug": "william-smith",                 "name": "William Smith",                          "birthday": "1811-03-13", "deathday": "1893-11-13", "excommunication": "1845-10-19", "bio": "", "principalNames": ["William Smith", "William B. Smith"] },
        { "slug": "mary-whitmer",                  "name": "Mary Whitmer",                           "birthday": "1778-08-27", "deathday": "1856-01-13", "bio": "", "principalNames": ["Mary Whitmer"] },
        { "slug": "lucy-mack-smith",               "name": "Lucy Mack Smith",                        "birthday": "1775-07-08", "deathday": "1856-05-14", "bio": "", "principalNames": ["Lucy Mack Smith"] },
        { "slug": "katherine-smith",               "name": "Katherine Smith",                        "birthday": "1813-07-28", "deathday": "1900-02-01", "bio": "", "principalNames": ["Katherine"] },
        { "slug": "josiah-stoal",                  "name": "Josiah Stoal",                           "birthday": "1771",       "deathday": "1844-05-12", "bio": "", "principalNames": ["Josiah Stowell"] },
        { "slug": "emma-smith",                    "name": "Emma Smith",                             "birthday": "1804-07-10", "deathday": "1879-04-30", "bio": "", "principalNames": ["Emma Smith"] },
        { "slug": "william-hussey-azel-vandruver", "name": "William T. Hussey and Azel Vandruver",   "birthday": "1800",       "bio": "", "principalNames": [] },
        { "slug": "willard-chase",                 "name": "Willard Chase",                          "birthday": "1800",       "deathday": "1871-01-01", "bio": "", "principalNames": ["Willard Chase"] }
    ]
}

// Flattened list of every witness, for the hub's featured pick.
export const WITNESSES = Object.values(data).flat();


const GROUP_LABELS = {
    "three-witnesses": "Three Witnesses",
    "eight-witnesses": "Eight Witnesses",
    "other-witnesses": "Other Sources",
};

const WitnessGrid = ({ witness, onPick }) => (
    <div className='witness-grid'>
        {Object.keys(data).map(groupKey => (
            <div key={groupKey} className='witness-group'>
                <div className='witness-group-label'>{GROUP_LABELS[groupKey] || groupKey}</div>
                {data[groupKey].map(w => {
                    const isCurrent = w.slug === witness.slug;
                    return (
                        <Link
                            key={w.slug}
                            to={`/history/witnesses/${w.slug}`}
                            className={`witness-option${isCurrent ? ' current' : ''}`}
                            aria-current={isCurrent ? 'page' : undefined}
                            onClick={onPick}
                        >
                            <img
                                className='witness-avatar'
                                src={`${assetUrl}/history/witnesses/people/${w.slug}.jpg`}
                                alt=''
                                aria-hidden='true'
                                loading='lazy'
                                onError={(e) => { e.target.style.visibility = 'hidden'; }}
                            />
                            <span className='witness-option-name'>{w.name}</span>
                        </Link>
                    );
                })}
            </div>
        ))}
    </div>
);

const WitnessBreadcrumbs = ({ witness }) => (
    <Breadcrumb>
        <Breadcrumb.Link to='/history'>History</Breadcrumb.Link>
        <Breadcrumb.Link to='/history/witnesses'>Witnesses</Breadcrumb.Link>
        <Breadcrumb.Dropdown label={witness.name}>
            {({ close }) => <WitnessGrid witness={witness} onPick={close} />}
        </Breadcrumb.Dropdown>
    </Breadcrumb>
);

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Render a `selectedYearMonth` key ("YYYY-MM" or bare "YYYY") for the filter
 * chip and the live region: "September 1945" for a month key, "1945" for a bare
 * year (the widened state -- see the chip's `yearOnlyInYear` widen button).
 */
const formatYearMonth = (ym) => {
    if (!ym) return '';
    const [y, m] = String(ym).split('-').map(n => parseInt(n, 10));
    return m ? `${MONTHS_FULL[m - 1]} ${y}` : `${y}`;
};

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Render a {year, month, precision} from compositionDate: "Sep 1945" when the
 * month is known, a bare "1940" when it is not. This -- not `displayDate`, which
 * formats `doc.date` -- is what the witness card's date must go through: the
 * witnesses archive's `date` column is corrupt on many rows (see witnessSources.js),
 * and compositionDate() is what already reads around that.
 */
const formatComposition = (comp) =>
    !comp ? '' : comp.month ? `${MONTHS_ABBR[comp.month - 1]} ${comp.year}` : `${comp.year}`;

/**
 * The date of the witness event itself (Three/Eight Witnesses, June 1829).
 * Both the hero's "Age in 1829" fact (`SingleWitness`) and the index page's
 * "Age N" chips (`preciseAge`) measure age against this single date — kept
 * as one constant so a future correction to the date can't update one
 * consumer and silently miss the other.
 */
const WITNESS_EVENT_DATE = '1829-06-28';

const SingleWitness = ({ witness, sourceSlug }) => {
    const appController = useAppController();

    const [sources, setSources] = useState(null);
    const [selectedYearMonth, setSelectedYearMonth] = useState(null);

    useEffect(() => {
        setSelectedYearMonth(null);
        if (!witness?.principalNames?.length) {
            setSources([]);
            return;
        }
        BoMOnlineAPI({
            history: { archive: "witnesses", principal: witness.principalNames }
        }).then(r => {
            const list = r.history || [];
            list.sort(byCompositionDesc);
            setSources(list);
        });
    }, [witness?.slug]);

    const openSource = (doc) => {
        if (!appController || !doc) return;
        appController.functions.setPopUp({
            type: "history",
            ids: [doc.slug],
            popUpData: doc,
            underSlug: `history/witnesses/${witness.slug}`,
            vhtop: 10,
        });
    };

    useEffect(() => {
        if (!sourceSlug || !sources?.length || !appController) return;
        openSource(sources.find(s => s.slug === sourceSlug));
    }, [sourceSlug, sources, appController, witness?.slug]);

    const visibleSources = useMemo(() => {
        if (!sources) return null;
        if (!selectedYearMonth) return sources;
        return sources.filter(s => matchesYearMonth(s, selectedYearMonth));
    }, [sources, selectedYearMonth]);

    const witnessAge = witness?.birthday ? moment(WITNESS_EVENT_DATE).diff(moment(witness.birthday), 'years') : null;

    const displayDate = (date) => {
        if (!date) return '';
        const len = date.length;
        return moment(date, [(len === 4) ? "YYYY" : 'YYYY-MM-DD']).format(
            (len === 4) ? label("history_date_format_year")
            : (len === 7) ? label("history_date_format_month")
            : label("history_date_format_full")
        );
    };

    return <div className="container" style={{ display: 'block' }}>
        <div id="page" className='single-witnesses'>
            <WitnessBreadcrumbs witness={witness} />

            <div className='witness-layout'>
                <aside className='witness-rail'>
                    <div className='witness-hero'>
                        <div className='witness-hero-portrait'>
                            <img src={`${assetUrl}/history/witnesses/people/${witness.slug}.jpg`} alt={witness.name} />
                        </div>
                        <div className='witness-hero-bio'>
                            <h1 className='witness-hero-name'>{witness.name}</h1>
                            <dl className='witness-hero-facts'>
                                {witness.birthday && (
                                    <div className='witness-fact'><dt>Born</dt><dd>{displayDate(witness.birthday)}</dd></div>
                                )}
                                {witnessAge !== null && !Number.isNaN(witnessAge) && (
                                    <div className='witness-fact'><dt>Age in 1829</dt><dd>{witnessAge}</dd></div>
                                )}
                                {witness.excommunication && (
                                    <div className='witness-fact'><dt>Excommunicated</dt><dd>{displayDate(witness.excommunication)}</dd></div>
                                )}
                                {witness.deathday && (
                                    <div className='witness-fact'><dt>Died</dt><dd>{displayDate(witness.deathday)}</dd></div>
                                )}
                            </dl>
                            <div className='witness-bio'>
                                {witness.bio
                                    ? witness.bio
                                    : <span className='witness-bio-placeholder'>Biography coming soon.</span>}
                            </div>
                        </div>
                    </div>
                </aside>
                <main className='witness-sources'>
                    {/* Reserve the heatmap's space while sources are in flight so the cards below
                        don't jump down mid-load. `sources === null` is specifically the in-flight
                        state: it is set to `[]` synchronously for a witness with no
                        `principalNames` (no fetch happens, so no heatmap will ever render), and
                        asynchronously to the fetched list otherwise. A witness whose fetch
                        resolves to zero rows lands on `sources.length === 0` after loading --
                        rendering neither skeleton nor heatmap, since there is nothing to plot. */}
                    {sources === null && <div className='witness-life-heatmap-skeleton' aria-hidden='true' />}
                    {sources && sources.length > 0 && (
                        <WitnessLifeHeatmap
                            witness={witness}
                            sources={sources}
                            selectedYearMonth={selectedYearMonth}
                            onSelectYearMonth={setSelectedYearMonth}
                        />
                    )}
                    {/* Announcement lives in its own PERMANENTLY-mounted node, separate from the
                        visible chip below. ARIA live regions announce on a text mutation *inside an
                        already-present node* -- a role="status" element that is itself freshly
                        inserted into the DOM (as the chip is, rendering only when selectedYearMonth
                        is set) is a different event, and VoiceOver/Safari and some JAWS/NVDA
                        combinations do not reliably announce it. This node exists from first paint
                        with empty text, so only its content ever changes. */}
                    <div role='status' aria-live='polite' className='visually-hidden'>
                        {selectedYearMonth
                            ? `Showing ${formatYearMonth(selectedYearMonth)}, ${visibleSources ? visibleSources.length : 0} source${visibleSources && visibleSources.length === 1 ? '' : 's'}`
                            : ''}
                    </div>

                    {selectedYearMonth && (() => {
                        // Month filtering is month-strict (see witnessSources.js matchesYearMonth),
                        // so a cell's count always equals the card count. Year-only sources from the
                        // same year are unreachable that way -- this chip is how they stay findable.
                        // Selecting the bare year widens to both precisions.
                        const selectedYear = String(selectedYearMonth).split('-')[0];
                        const isMonthView = String(selectedYearMonth).includes('-');
                        const yearOnlyInYear = isMonthView && sources
                            ? sources.filter(s => {
                                  const c = compositionDate(s);
                                  return c && c.precision === 'year' && String(c.year) === selectedYear;
                              }).length
                            : 0;
                        return (
                            <div className='witness-sources-head'>
                                <div className='witness-filter-chip'>
                                    <span>
                                        Showing <strong>{formatYearMonth(selectedYearMonth)}</strong>
                                        {' · '}{visibleSources ? visibleSources.length : 0} source
                                        {visibleSources && visibleSources.length === 1 ? '' : 's'}
                                    </span>
                                    {yearOnlyInYear > 0 && (
                                        <button type='button' className='chip-widen'
                                                onClick={() => setSelectedYearMonth(selectedYear)}>
                                            {yearOnlyInYear} more dated {selectedYear} without a month — show them
                                        </button>
                                    )}
                                    <button type='button' onClick={() => setSelectedYearMonth(null)}>
                                        Show all sources
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                    {sources === null && <div className='witness-sources-loading'>Loading sources…</div>}
                    {sources && sources.length === 0 && (
                        <div className='witness-sources-empty'>No sources available for this witness.</div>
                    )}
                    {visibleSources && visibleSources.length === 0 && sources && sources.length > 0 && (
                        <div className='witness-sources-empty'>
                            <p>No sources in {formatYearMonth(selectedYearMonth)}.</p>
                            <button type='button' className='btn btn-link'
                                    onClick={() => setSelectedYearMonth(null)}>
                                Show all sources
                            </button>
                        </div>
                    )}
                    {visibleSources && visibleSources.length > 0 && (
                        <div className='witness-source-decades'>
                            {groupByDecade(visibleSources).map(group => (
                                <section key={group.label} className='witness-decade'>
                                    <h2 className='witness-decade-label'>{group.label}</h2>
                                    <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid" columnClassName="my-masonry-grid_column">
                                        {group.sources.map((doc, i) => (
                                            <HistorySourceCard
                                                key={doc.slug || i}
                                                doc={doc}
                                                variant="witness"
                                                // Not `displayDate` (which formats `doc.date` directly) --
                                                // ignores its argument and formats this doc's own
                                                // compositionDate() instead, since `doc.date` is corrupt
                                                // on many witness rows.
                                                displayDate={() => formatComposition(compositionDate(doc))}
                                                onOpen={openSource}
                                            />
                                        ))}
                                    </Masonry>
                                </section>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    </div>;
};


/**
 * Bare "YYYY" birthdays in `data` are placeholders standing in for an unknown
 * exact date, not a real (if imprecise) date — e.g. Hiram Page's "1800".
 * Expressed as what is actually being tested (a whole-string 4-digit year),
 * not as a length coincidence: "1800-01-27" is 10 characters and "1800 "
 * (stray trailing space) would wrongly slip past a bare length check while
 * still parsing to a valid, silently-fabricated age. Mirrors the year-prefix
 * regex parsing `witnessSources.js`'s `parseYearMonth` already uses, rather
 * than inventing a second, looser date-shape idiom.
 */
const isYearOnlyPlaceholder = (birthday) => /^\d{4}$/.test(String(birthday).trim());

/** Year-only birthdays in `data` are placeholders, not real dates — no age is claimed for them. */
const preciseAge = (birthday) => {
    if (!birthday || isYearOnlyPlaceholder(birthday)) return null;
    const age = moment(WITNESS_EVENT_DATE).diff(moment(birthday), 'years');
    return Number.isNaN(age) ? null : age;
};

/**
 * Oldest first at the time of the witness event. Sorts a copy — `data` is
 * module state. Assumes every entry has a birthday; add a guard here if a
 * future entry omits one — `moment(undefined)` resolves to *now*, not NaN,
 * so a missing birthday would silently sort that witness in as freshly born
 * rather than crashing or landing at a NaN-tolerant fallback position.
 */
const byAgeAtEvent = (a, b) =>
    moment(a.birthday).valueOf() - moment(b.birthday).valueOf();

/**
 * One index-page group (Three/Eight/Other). Hoisted because the three group
 * blocks were otherwise identical apart from heading/subtitle/trailing content.
 *
 * `[...data[groupKey]].sort(...)` sorts a COPY — the old inline
 * `data[groupKey].sort((b, a) => ...)` sorted the module-level array in place
 * on every render, which also silently reordered `WitnessBreadcrumbs`'s
 * dropdown menu (it reads from this same `data` object).
 */
const WitnessGroup = ({ groupKey, heading, subtitle, children }) => (
    <div className={groupKey}>
        <h4>{heading}</h4>
        <h5>{subtitle}</h5>
        <div className='witness-container'>
            {[...data[groupKey]].sort(byAgeAtEvent).map(w => {
                const age = preciseAge(w.birthday);
                return (
                    <div key={w.slug} className='witness'>
                        <Link to={`/history/witnesses/${w.slug}`}>
                            <img src={`${assetUrl}/history/witnesses/people/${w.slug}.jpg`}
                                 alt={w.name} className='witness-image' />
                            <div className='witness-name'>{w.name}</div>
                            {age !== null && <div className='witness-age'>Age {age}</div>}
                        </Link>
                    </div>
                );
            })}
        </div>
        {children}
    </div>
);

const Witnesses = () => {

    const { witness, source } = useParams();
    if (witness) {
        const dataKeys = Object.keys(data);
        const witnessData = dataKeys.map(key => data[key].find(w => w.slug === witness)).find(w => w);
        if (!witnessData) return <div className="container"><div id="page"><Link to='/history/witnesses' className='btn btn-primary'>Back</Link><p>Witness not found.</p></div></div>;
        // Key on the slug so switching subjects REMOUNTS the whole view: state resets
        // (sources → null → loading) and the portrait <img> is a fresh element, so no
        // stale content lingers from the previous witness until the new data hydrates.
        return <SingleWitness key={witnessData.slug} witness={witnessData} sourceSlug={source} />;
    }
    return (
        <div className="container " style={{ display: 'block' }}>
            <div id="page" className='witnesses' >
                <HistoryBreadcrumb sectionKey="witnesses" />
                <h3 className="title lg-4 text-center">{label("title_witnesses")}</h3>
                <WitnessGroup
                    groupKey='three-witnesses'
                    heading='Three Witnesses'
                    subtitle='Heard the voice of God • Saw an angel • Saw the plates • Saw the engravings'
                >
                    <div className='witness-statement'>
                        <p>Be it known unto all nations, kindreds, tongues, and people, unto whom this work shall come:</p> <ul> <li>We, through the grace of God the Father, and our Lord Jesus Christ, have <b>seen the plates</b> which contain this record: <ul> <li>A record of the people of Nephi.</li> <li>A record of the Lamanites, their brethren.</li> <li>A record of the people of Jared, who came from the tower of which hath been spoken.</li> </ul> </li> <li>We know they have been translated by the gift and power of God, for <b>his voice hath declared it unto us</b>; wherefore we know of a surety that the work is true.</li> <li>We also testify that we have <b>seen the engravings</b> upon the plates: <ul> <li>Shown unto us by the power of God, and not of man.</li> </ul> </li> <li>We declare with words of soberness, that <b>an angel of God came down</b> from heaven: <ul> <li>Brought and laid before our eyes, that <b>we beheld and saw the plates</b>.</li> <li><b>Saw the engravings</b> thereon.</li> <li>By the grace of God the Father, and our Lord Jesus Christ, <b>we beheld</b> and bear record that these things are true.</li> </ul> </li> <li>The voice of the Lord commanded us that we should bear record of it; wherefore, to be obedient unto the commandments of God, we bear testimony of these things.</li> </ul> <p>If we are faithful in Christ:</p> <ul> <li>We shall rid our garments of the blood of all men.</li> <li>Be found spotless before the judgment-seat of Christ.</li> <li>Shall dwell with him eternally in the heavens.</li> </ul> <p>And the honor be to the Father, and to the Son, and to the Holy Ghost, which is one God. Amen.</p>
                    </div>
                </WitnessGroup>
                <hr/>
                <WitnessGroup
                    groupKey='eight-witnesses'
                    heading='Eight Witnesses'
                    subtitle='Saw the plates • Handled the plates • Saw the engravings'
                >
                    <div className='witness-statement'>
                        <p>Be it known unto all nations, kindreds, tongues, and people, unto whom this work shall come:</p>
                        <ul><li>That Joseph Smith, Jun., the translator of this work, has <b>shown unto us the plates</b> of which hath been spoken, which have the appearance of gold;
                            <ul><li>and as many of the leaves as the said Smith has translated <b>we did handle with our hands</b>;</li><li> and we also <b>saw the engravings</b> thereon,</li><li> all of which has the appearance of ancient work,</li><li> and of curious workmanship.</li></ul></li>
                        <li>And this we bear record with words of soberness, that the said Smith has shown unto us, for <b>we have seen and hefted</b>, and know of a surety that the said Smith has got the plates of which we have spoken.</li>
                        <li>And we give our names unto the world, to witness unto the world that which we have seen.</li><li> And we lie not, God bearing witness of it.</li>
                        </ul>
                    </div>
                </WitnessGroup>
                <hr/>
                <WitnessGroup
                    groupKey='other-witnesses'
                    heading='Other Sources'
                    subtitle='Had various experiences with the plates or with Joseph while in possession of the plates'
                />
            </div>
        </div>
    );
};

export default Witnesses;