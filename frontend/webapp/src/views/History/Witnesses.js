import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Parser from 'html-react-parser';
import './Witnesses.css';
import { label } from '../../models/Utils';
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import moment from 'moment';
import WitnessLifeHeatmap, { matchesYearMonth } from './WitnessLifeHeatmap';
import Identicon from '../_Common/Identicon';
import { useAppController } from "src/contexts/AppControllerContext";

// Editorial marks in a money quote — [Name] (supplied referent) / [...] (elision)
// — set apart from the quoted words (grey Roboto, not scripture).
const BRACKET_RE = /(\[[^\]]*\])/g;
const withBrackets = (text) =>
  String(text || "")
    .split(BRACKET_RE)
    .map((part, i) =>
      part.startsWith("[") && part.endsWith("]")
        ? <span key={i} className="editorialMark">{part}</span>
        : part
    );

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



const GROUP_LABELS = {
    "three-witnesses": "Three Witnesses",
    "eight-witnesses": "Eight Witnesses",
    "other-witnesses": "Other Sources",
};

const WitnessBreadcrumbs = ({ witness }) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDocClick = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <nav className='witness-breadcrumbs' aria-label='Breadcrumb' ref={wrapperRef}>
            <Link to='/history' className='breadcrumb-link'>History</Link>
            <span className='breadcrumb-sep' aria-hidden='true'>›</span>
            <Link to='/history/witnesses' className='breadcrumb-link'>Witnesses</Link>
            <span className='breadcrumb-sep' aria-hidden='true'>›</span>
            <button
                type='button'
                className={`breadcrumb-current${open ? ' open' : ''}`}
                aria-haspopup='listbox'
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
            >
                {witness.name}
                <span className='breadcrumb-chevron' aria-hidden='true'>▾</span>
            </button>
            {open && (
                <div className='breadcrumb-dropdown' role='listbox'>
                    {Object.keys(data).map(groupKey => (
                        <div key={groupKey} className='breadcrumb-group'>
                            <div className='breadcrumb-group-label'>{GROUP_LABELS[groupKey] || groupKey}</div>
                            {data[groupKey].map(w => {
                                const isCurrent = w.slug === witness.slug;
                                return (
                                    <Link
                                        key={w.slug}
                                        to={`/history/witnesses/${w.slug}`}
                                        className={`breadcrumb-option${isCurrent ? ' current' : ''}`}
                                        aria-current={isCurrent ? 'page' : undefined}
                                        onClick={() => setOpen(false)}
                                    >
                                        {w.name}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </nav>
    );
};

const SingleWitness = ({ witness, sourceSlug }) => {
    const appController = useAppController();

    const [sources, setSources] = useState(null);
    const [selectedYearMonth, setSelectedYearMonth] = useState(null);

    useEffect(() => {
        const handleEsc = (event) => { if (event.keyCode === 27) window.history.back(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

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
            list.sort((a, b) => (b.year || 0) - (a.year || 0) || (a.seq || 0) - (b.seq || 0));
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

    const displayDate = (date) => {
        if (!date) return '';
        const len = date.length;
        return moment(date, [(len === 4) ? "YYYY" : 'YYYY-MM-DD']).format(
            (len === 4) ? label("history_date_format_year")
            : (len === 7) ? label("history_date_format_month")
            : label("history_date_format_full")
        );
    };

    const visibleSources = useMemo(() => {
        if (!sources) return null;
        if (!selectedYearMonth) return sources;
        return sources.filter(s => matchesYearMonth(s, selectedYearMonth));
    }, [sources, selectedYearMonth]);

    const witnessAge = witness?.birthday ? moment('1829-06-28').diff(moment(witness.birthday), 'years') : null;

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
                            <div className='witness-hero-facts'>
                                {witness.birthday && <div><span className='witness-hero-facts-label'>Born</span> {displayDate(witness.birthday)}</div>}
                                {witnessAge !== null && !Number.isNaN(witnessAge) && (
                                    <div><span className='witness-hero-facts-label'>Age in 1829</span> {witnessAge}</div>
                                )}
                                {witness.excommunication && <div><span className='witness-hero-facts-label'>Excommunicated</span> {displayDate(witness.excommunication)}</div>}
                                {witness.deathday && <div><span className='witness-hero-facts-label'>Died</span> {displayDate(witness.deathday)}</div>}
                            </div>
                            <div className='witness-bio'>
                                {witness.bio
                                    ? witness.bio
                                    : <span className='witness-bio-placeholder'>Biography coming soon.</span>}
                            </div>
                        </div>
                    </div>

                    {sources && sources.length > 0 && (
                        <WitnessLifeHeatmap
                            witness={witness}
                            sources={sources}
                            selectedYearMonth={selectedYearMonth}
                            onSelectYearMonth={setSelectedYearMonth}
                        />
                    )}
                </aside>
                <main className='witness-sources'>
                    {sources === null && <div className='witness-sources-loading'>Loading sources…</div>}
                    {sources && sources.length === 0 && (
                        <div className='witness-sources-empty'>No sources available for this witness.</div>
                    )}
                    {visibleSources && visibleSources.length === 0 && sources && sources.length > 0 && (
                        <div className='witness-sources-empty'>No sources in this month.</div>
                    )}
                    {visibleSources && visibleSources.length > 0 && (
                        <div className='witness-sources-grid'>
                            {visibleSources.map((doc, i) => (
                            <div
                                key={doc.slug || i}
                                className='historycard card'
                                onClick={() => openSource(doc)}
                            >
                                <div className='historyHeader'>
                                    <Identicon seed={doc.slug || doc.document || doc.source || String(i)} size={34} className='historyIdenticon' />
                                    <span className='dateChip'>{displayDate(doc.date)}</span>
                                    {doc.teaser && <div className='historyTeaserText'>{Parser(doc.teaser)}</div>}
                                </div>
                                {/* Lead with the money quote when we have an attributed one
                                    (editorially prepared — [Name]/[...] are meaningful). */}
                                {doc.money_quote && doc.quote_speaker && (
                                    <blockquote className={`historyLead${doc.quote_is_witness_voice ? ' is-firsthand' : ''}`}>
                                        {doc.quote_is_witness_voice ? (
                                            <>
                                                <span className='money_quote_text'>&ldquo;{withBrackets(doc.money_quote)}&rdquo;</span>
                                                <footer className='money_quote_attribution'>
                                                    <span className='money_quote_speaker'>&mdash; {doc.quote_speaker}</span>
                                                </footer>
                                            </>
                                        ) : (
                                            <span className='money_quote_text'>
                                                <span className='money_quote_speaker-prefix'>{doc.quote_speaker}:</span>{' '}
                                                &ldquo;{withBrackets(doc.money_quote)}&rdquo;
                                            </span>
                                        )}
                                    </blockquote>
                                )}
                                <div className='historySupport'>
                                    {doc.id && (
                                        <div className='historyThumb'>
                                            <img
                                                style={{ aspectRatio: "1 / " + (parseFloat(doc.aspect) || 1) }}
                                                src={`${assetUrl}/history/thumbs/${String(doc.id).padStart(4, '0')}`}
                                                alt={doc.document}
                                                loading='lazy'
                                            />
                                        </div>
                                    )}
                                    {doc.citation && <div className='citation'>{Parser(doc.citation + "")}</div>}
                                </div>
                            </div>
                        ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    </div>;
};


const Witnesses = () => {

    const dateofWitness = `1829-06-28`;

    const { witness, source } = useParams();
    if (witness) {
        const dataKeys = Object.keys(data);
        const witnessData = dataKeys.map(key => data[key].find(w => w.slug === witness)).find(w => w);
        if (!witnessData) return <div className="container"><div id="page"><Link to='/history/witnesses' className='btn btn-primary'>Back</Link><p>Witness not found.</p></div></div>;
        return <SingleWitness witness={witnessData} sourceSlug={source} />;
    }
    return (
        <div className="container " style={{ display: 'block' }}>
            <div id="page" className='witnesses' >
                <h3 className="title lg-4 text-center">{label("title_witnesses")}</h3>
                <div className='three-witnesses'>
                    <h4>Three Witnesses</h4>
                    <h5>
                        Heard the voice of God • Saw an angel • Saw the plates • Saw the engravings
                    </h5>
                    <div className='witness-container'>
                        {data["three-witnesses"]
                        .sort((b, a) => moment(dateofWitness).diff(moment(a.birthday), 'years') - moment(dateofWitness).diff(moment(b.birthday), 'years'))
                        .map((w, i) => (
                            <div key={i} className='witness'>
                                <Link to={`/history/witnesses/${w.slug}`}>
                                <img src={`${assetUrl}/history/witnesses/people/${w.slug}.jpg`} alt={w.name} className='witness-image' />
                                    <div className='witness-name'>
                                    {w.name}
                                    </div>
                                    <div className='witness-age'>
                                    Age {moment(dateofWitness).diff(moment(w.birthday), 'years')}                                       
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                    <div className='witness-statement'>
                        <p>Be it known unto all nations, kindreds, tongues, and people, unto whom this work shall come:</p> <ul> <li>We, through the grace of God the Father, and our Lord Jesus Christ, have <b>seen the plates</b> which contain this record: <ul> <li>A record of the people of Nephi.</li> <li>A record of the Lamanites, their brethren.</li> <li>A record of the people of Jared, who came from the tower of which hath been spoken.</li> </ul> </li> <li>We know they have been translated by the gift and power of God, for <b>his voice hath declared it unto us</b>; wherefore we know of a surety that the work is true.</li> <li>We also testify that we have <b>seen the engravings</b> upon the plates: <ul> <li>Shown unto us by the power of God, and not of man.</li> </ul> </li> <li>We declare with words of soberness, that <b>an angel of God came down</b> from heaven: <ul> <li>Brought and laid before our eyes, that <b>we beheld and saw the plates</b>.</li> <li><b>Saw the engravings</b> thereon.</li> <li>By the grace of God the Father, and our Lord Jesus Christ, <b>we beheld</b> and bear record that these things are true.</li> </ul> </li> <li>The voice of the Lord commanded us that we should bear record of it; wherefore, to be obedient unto the commandments of God, we bear testimony of these things.</li> </ul> <p>If we are faithful in Christ:</p> <ul> <li>We shall rid our garments of the blood of all men.</li> <li>Be found spotless before the judgment-seat of Christ.</li> <li>Shall dwell with him eternally in the heavens.</li> </ul> <p>And the honor be to the Father, and to the Son, and to the Holy Ghost, which is one God. Amen.</p>
                    </div>
                </div>
                <hr/>
                <div className='eight-witnesses'>
                    <h4>Eight Witnesses</h4>
                    <h5>
                        Saw the plates • Handled the plates • Saw the engravings
                    </h5>
                    <div className='witness-container'>
                        {data["eight-witnesses"]
                        .sort((b, a) => moment(dateofWitness).diff(moment(a.birthday), 'years') - moment(dateofWitness).diff(moment(b.birthday), 'years'))
                        .map((w, i) => (
                            <div key={i} className='witness'>
                                <Link to={`/history/witnesses/${w.slug}`}>
                                    <img src={`${assetUrl}/history/witnesses/people/${w.slug}.jpg`} alt={w.name} className='witness-image' />
                                    <div className='witness-name'>
                                    {w.name}
                                    </div>
                                    <div className='witness-age'>
                                    Age {moment(dateofWitness).diff(moment(w.birthday), 'years')}                                       
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                    <div className='witness-statement'>
                        <p>Be it known unto all nations, kindreds, tongues, and people, unto whom this work shall come:</p>
                        <ul><li>That Joseph Smith, Jun., the translator of this work, has <b>shown unto us the plates</b> of which hath been spoken, which have the appearance of gold; 
                            <ul><li>and as many of the leaves as the said Smith has translated <b>we did handle with our hands</b>;</li><li> and we also <b>saw the engravings</b> thereon,</li><li> all of which has the appearance of ancient work,</li><li> and of curious workmanship.</li></ul></li>
                        <li>And this we bear record with words of soberness, that the said Smith has shown unto us, for <b>we have seen and hefted</b>, and know of a surety that the said Smith has got the plates of which we have spoken.</li>
                        <li>And we give our names unto the world, to witness unto the world that which we have seen.</li><li> And we lie not, God bearing witness of it.</li>
                        </ul>
                    </div>
                </div>  
                <hr/>
                <div className='other-witnesses'>
                    <h4>Other Sources</h4>
                    <h5>
                        Had various experiences with the plates or with Joseph while in posession of the plates
                    </h5>
                    <div className='witness-container'>
                        {data["other-witnesses"]
                        .sort((b, a) => moment(dateofWitness).diff(moment(a.birthday), 'years') - moment(dateofWitness).diff(moment(b.birthday), 'years'))
                        .map((w, i) => (
                            <div key={i} className='witness'>
                                <Link to={`/history/witnesses/${w.slug}`}>
                                    <img src={`${assetUrl}/history/witnesses/people/${w.slug}.jpg`} alt={w.name} className='witness-image' />
                                    <div className='witness-name'>
                                    {w.name}
                                    </div>
                                    <div className='witness-age'>
                                    Age {moment(dateofWitness).diff(moment(w.birthday), 'years')}
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                    <div>
                        <h4>Witness Statements</h4>
                    </div>
                    </div>
            </div>
        </div>
    );
};

export default Witnesses;