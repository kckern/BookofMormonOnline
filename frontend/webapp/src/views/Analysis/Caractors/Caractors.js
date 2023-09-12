import "./Caractors.css"; 
import tileData from "./tiles.json";
import similarData from "./matches.json";
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Collapse,
  NavItem,
  NavLink,
  Nav,
  TabContent,
  TabPane,
  Row,
  Col,
} from "reactstrap";
import React, { useEffect, useState } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
function Caractors() {
  const [similars, setSimilars] = useState([]);
  const [activeGrid, setActiveGrid] = useState(false);
  const [activeTile, setActiveTile] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  const [openedCollapses, setOpenedCollapses] = React.useState([
    "collapseOne",
    "collapse1",
  ]);
  // with this function we create an array with the opened collapses
  // it is like a toggle function for all collapses from this page
  const collapsesToggle = (collapse) => {
    if (openedCollapses.includes(collapse)) {
      setOpenedCollapses(openedCollapses.filter((item) => item !== collapse));
    } else {
      openedCollapses.push(collapse);
      setOpenedCollapses([...openedCollapses, collapse]);
    }
  };

  let similarItems = tileData.filter((m) => similars?.includes(m.match));
  let matchedItems = tileData.filter((m) => m.match === activeTile && m.id !== activeItem.id);

  return (
    <div className="container">
      <div id="page">
        <h3 className="title lg-4 text-center">Caractors Document</h3>
        <div className="caractors">
          <div
            className={"grid " + (activeGrid ? "active" : "")}
            onMouseEnter={() => setActiveGrid(true)}
            onMouseLeave={() => setActiveGrid(false)}
          >
            {tileData.map((m) => (
              <div
                onMouseEnter={() => {
                  setActiveItem(m);
                  setActiveTile(m.match);
                  setSimilars(similarData[m.match]);
                }}
                onMouseLeave={() => {
                  setActiveTile(null);
                  setSimilars([]);
                }}
                className={
                  "tile " +
                  (similars?.includes(m.match) ? "similar " : "") +
                  (activeTile === m.match ? "active " : "")
                }
                style={{
                  backgroundImage: `url('${assetUrl}/caractors/row${m.id.replace(
                    "-",
                    "_"
                  )}')`,
                }}
              ></div>
            ))}
          </div>

          { (activeGrid) ? <div className="flex-row-container ">
            <div className="flex-row-item active">
              <h6>Active Glyph</h6> <div>
              <img
                  src={`${assetUrl}/caractors/row${activeItem?.id.replace(
                    "-",
                    "_"
                  )}`}
                />
              
            </div>
            </div>
            <div className="flex-row-item match">
              <h6>{matchedItems.length} Closely matched Glyphs</h6>
            <div>
              {matchedItems.map((m) => (
                <img
                  src={`${assetUrl}/caractors/row${m.id.replace(
                    "-",
                    "_"
                  )}`}
                />
              ))}</div>
            
            </div>
            <div className="flex-row-item similar">
              
              <h6>{similarItems.length} Similar Glyphs</h6>
              <div>
              {similarItems.map((m) => (
                <img
                  src={`${assetUrl}/caractors/row${m.id.replace(
                    "-",
                    "_"
                  )}`}
                />
              ))} </div>
              
            </div>
          </div> : null }
        </div>

        <Card>
          <CardBody>
            <div
              aria-multiselectable={true}
              className="card-collapse"
              id="accordion"
              role="tablist"
            >
              <CardTitle tag="h4">
                <h4>About the Document</h4>
              </CardTitle>
              <Card className="card-plain">
                <CardHeader role="tab">
                  <a
                    aria-expanded={openedCollapses.includes("collapseOne")}
                    href="#pablo"
                    data-parent="#accordion"
                    data-toggle="collapse"
                    onClick={() => collapsesToggle("collapseOne")}
                  >
                    Where did this document come from?{" "}
                    <i className="nc-icon nc-minimal-down" />
                  </a>
                </CardHeader>
                <Collapse
                  role="tabpanel"
                  isOpen={openedCollapses.includes("collapseOne")}
                >
                  <CardBody>
                    {
                      "Wednesday Feb 27, 1884. Took train at 6.45 a.m. for Richmond. Changed at Lexington Junction where we remained until after 10. A.M. At Richmond I met David J. Whitmer, son of David Whitmer, one of the witnesses of the Book of Mormon. He said his father was feeble, but he thought he could arrange for me to see him. I took dinner at the Wasson House, and at about half past one Mr Whitmer called at the Hotel for me. His father lived close by. He pointed out the track of a cyclone which had visited the town in 1878 and which had left their house, or rather the room in which the manuscript of the Book of Mormon was kept in such a condition as to astonish all the people — the roof was taken off, but nothing was disturbed and the glass was not broken even. The old gentleman (he was born Jan. 1805) soon entered. He is a man who probably stood in his early manhood 5.10 in or perhaps 5.11 inches in height, not fleshy, at present rather inclined to leanness. I noticed in shaking hands with him that the thumb of his right hand is missing and the hand has a long scar in the centre. His hair is thin, and he is rather bald. His nose is aquiline, and his eyes black or a dark brown. His likeness which was shown me, painted in oil when he was 32 years old, makes him appear as a handsome man of marked features, rather Jewish looking, with a head of thick hair inclined to curl. He had his son bring in the manuscript of the Book of Mormon, which he says is the only manuscript of which he knows anything. It is in the hand writing of several persons which he says were Oliver Cowdery, Emma Smith, Martin Harris, and perhaps some of it in that of his brother Christian who assisted the prophet Joseph somewhat. This is the manuscript from which the printers, he says, set the type of the Book, and he pointed out to me where it had been cut for convenience as copy. I noticed printers’ marks through the manuscript, still it was very clean for copy that printers had handled. This he explained as the consequence of the care taken by Oliver Cowdery in watching the manuscript while in the printers’ hands. It was fastened together, not as a whole, but a few folios, not more than a dozen, with woolen yarn, which he said was his mothers. This was exceedingly interesting to me and I examined it with care, and a feeling of reverence. But with this was another paper which I thought of surpassing interest. It was the Characters drawn by Joseph himself for Martin Harris to show to Professors Mitchell & Anthon. There were seven lines, the first four being about twice as large in size as the three last. Here was the very paper which Isaiah saw in vision [blank] years before and which he called the “words of a book.” Though evidently long written, the characters were as clear and distinct as though just written. This was also the case with the manuscript of the Book of Mormon — it was wonderfully well preserved and clear. This David Whitmer and the family think (in which belief I share) is due to the power of God. I cannot describe the characters particularly. They were glyphs and contained many forms. In speaking of the translating he said that Joseph had the stone in a hat from which all light was excluded. In the stone the character appeared and under that the translation in English and they remained until the scribe had copied it correctly. If he made a mistake the words still remained and were not replaced by any other. In describing the visit of the Angel he said that it was shortly before the completion of the translation when there were but a few pages left. He was plowing when Joseph and Oliver came to him and the former told him that he was chosen to be one of the three witnesses to whom the angel would show the plates. He also told him that the Lord had promised to make this manifest and now was the time. They went out and sat upon a log conversing upon the things to be revealed when they were surrounded by a glorious light which overshadowed them. A glorious personage appeared and he showed to them the plates, the sword of Laban, the Directors, the Urim & Thummim and other records. Human language could not, he said, describe heavenly things and that which they saw. The language of the Angel was: “Blessed is he that believeth and remaineth faithful to the end.” He had had his hours of darkness and trial and difficulty; but however dark upon other things that had ever been a bright scene in his mind and he had never wavered in regard to it; he had testified fearlessly always of it, even when his life was threatened. Martin Harris was not with them at the time Oliver and he saw the angel; but he and Joseph afterwards saw the same, and he thus became a witness also. I spent the afternoon with them till 5 p.m. when I took the hack to return to Lexington Junction. A nephew of his, a son of his brother Jacob, one of the eight witnesses, came in. His name is John C. Whitmer. The old gentleman, about 1/2 past 3 got so fatigued that he withdrew to rest. I thanked him for his kindness and I expressed the great pleasure the interview had given me. I had borne testimony of the truth of this work and of the Book of Mormon since my early life, and I was glad to hear from his own lips in the flesh his testimony. I thanked God, I said, that he had preserved him and enabled him to bear a faithful testimony till now and I prayed Him to still preserve and assist him. I find from conversation with the son and nephew that they do not sympathize with young Joseph as he is called; neither do they believe fully in plural marriage; but they stand clinging to the Book of Mormon and its contents, believing it and looking for the day when all who believe that will be united with the House of Israel as the Book promises. They all appear to be gentle, good spirited men. I said to them that I wished to speak upon my own experience and what God had revealed to me, but not in the spirit of argument. I then told them how the spirit first revealed the principle to me and how afterwards for a wise purpose in the Lord, he had impelled me to obey that principle, and in this way bore testimony of its truth to them. The Whitmer family is of German origin. I could detect a German twang in David Whitmer, Senrs talk. His mother was from the Rhine, and his grandfather or great grandfather from Germany. This visit is one that I hope I shall never forget; for whatever wrongs David Whitmer may have committed I do respect him for his integrity and firmness in continuing to bear testimony to the Book of Mormon. In fact though all three of the witnesses quarreled with the Prophet Joseph, and lef[t] the church or were cut off, and asserted he was a fallen prophet, they never ceased to bear unflinching testimony to that which they had seen and heard, and that an holy angel had shown them the plates and told them they had been translated by the gift and power of God. The sight of the manuscript of the Characters ought to be forever imprinted on my memory. I omitted to mention that Joseph had written <in> English above the characters, the word “Caractors.” The old jail in which the Prophet Joseph was imprisoned in Richmond was of hewed logs and perhaps lined with iron. That was replaced by a brick building and that was torn down and a stone building, now standing, took its place. The town contains, I was informed, about 3500, including coal miners, of whom there are a large number, there being good coal found here. I am not impressed with the appearance of the Country and improvements. It looks like a slow Country, not much interprise, and the buildings are not of a superior kind. At 5 p.m. I took the hack for Lexington Junction. The road was very rough. The train was late and it was midnight when I reached Kansas City, and I was fortunate enough to get a bed at the Hotel at the Depôt, though others were turned away. The night is very cold, a blizzard from the north blowing very strong."
                    }
                  </CardBody>
                </Collapse>
              </Card>
              <Card className="card-plain">
                <CardHeader role="tab">
                  <a
                    aria-expanded={openedCollapses.includes("collapseTwo")}
                    href="#pablo"
                    data-parent="#accordion"
                    data-toggle="collapse"
                    onClick={() => collapsesToggle("collapseTwo")}
                  >
                    Collapsible Group Item #2{" "}
                    <i className="nc-icon nc-minimal-down" />
                  </a>
                </CardHeader>
                <Collapse
                  role="tabpanel"
                  isOpen={openedCollapses.includes("collapseTwo")}
                >
                  <CardBody>
                    Anim pariatur cliche reprehenderit, enim eiusmod high life
                    accusamus terry richardson ad squid. 3 wolf moon officia
                    aute, non cupidatat skateboard dolor brunch. Food truck
                    quinoa nesciunt laborum eiusmod. Brunch 3 wolf moon tempor,
                    sunt aliqua put a bird on it squid single-origin coffee
                    nulla assumenda shoreditch et. Nihil anim keffiyeh
                    helvetica, craft beer labore wes anderson cred nesciunt
                    sapiente ea proident. Ad vegan excepteur butcher vice lomo.
                    Leggings occaecat craft beer farm-to-table, raw denim
                    aesthetic synth nesciunt you probably haven't heard of them
                    accusamus labore sustainable VHS.
                  </CardBody>
                </Collapse>
              </Card>
              <Card className="card-plain">
                <CardHeader role="tab">
                  <a
                    aria-expanded={openedCollapses.includes("collapseThree")}
                    href="#pablo"
                    data-parent="#accordion"
                    data-toggle="collapse"
                    onClick={() => collapsesToggle("collapseThree")}
                  >
                    Collapsible Group Item #3{" "}
                    <i className="nc-icon nc-minimal-down" />
                  </a>
                </CardHeader>
                <Collapse
                  role="tabpanel"
                  isOpen={openedCollapses.includes("collapseThree")}
                >
                  <CardBody>
                    Anim pariatur cliche reprehenderit, enim eiusmod high life
                    accusamus terry richardson ad squid. 3 wolf moon officia
                    aute, non cupidatat skateboard dolor brunch. Food truck
                    quinoa nesciunt laborum eiusmod. Brunch 3 wolf moon tempor,
                    sunt aliqua put a bird on it squid single-origin coffee
                    nulla assumenda shoreditch et. Nihil anim keffiyeh
                    helvetica, craft beer labore wes anderson cred nesciunt
                    sapiente ea proident. Ad vegan excepteur butcher vice lomo.
                    Leggings occaecat craft beer farm-to-table, raw denim
                    aesthetic synth nesciunt you probably haven't heard of them
                    accusamus labore sustainable VHS.
                  </CardBody>
                </Collapse>
              </Card>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default Caractors;
