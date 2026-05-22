# Objects — title & subtitle trim candidates

Pulled from `GET /graphql { objectList }` on 2026-05-13. CSS now clamps subtitle to 3 lines and title to 2 lines with ellipsis, so this list flags entries whose content is being **truncated visually** and would benefit from copyediting the source rows in `bom_objects`.

## Sizing math

- Title: `1.2rem ≈ 19px`, card content ≈ 190px → **~19 chars/line**. CSS clamp at 2 lines → ellipsis if name ≥ ~38 chars.
- Subtitle: `0.85em ≈ 13.6px`, card content ≈ 190px → **~30 chars/line**. CSS clamp at 3 lines → ellipsis if subtitle ≥ ~90 chars.

## Names — single-line preferred, only break if needed (≥22 chars wraps)

| Slug | Chars | Name | Suggested shorter form |
|---|---|---|---|
| `opened-graves` | 38 | Opened Graves at Christ's Resurrection | Opened Graves |
| `fruits-by-which-known` | 30 | Fruits By Which They Are Known | Fruits By Which Known |
| `vineyard-of-the-lord-of-hosts` | 29 | Vineyard of the Lord of Hosts | Vineyard of Hosts |
| `mountain-of-the-lords-house` | 28 | Mountain of the Lord's House | Mountain of the Lord's House |
| `great-and-spacious-building` | 27 | Great And Spacious Building | Great & Spacious Building |
| `twenty-four-jaredite-plates` | 27 | Twenty Four Jaredite Plates | 24 Jaredite Plates |
| `twenty-four-plates-of-ether` | 27 | Twenty Four Plates of Ether | 24 Plates of Ether |
| `first-fruits-of-repentance` | 26 | First Fruits of Repentance | First Fruits |
| `lehis-house-at-jerusalem` | 25 | Lehi's House at Jerusalem | Lehi's House |
| `fruit-of-the-tree-of-life` | 25 | Fruit of the Tree of Life | Fruit of the Tree |
| `fountain-of-living-waters` | 25 | Fountain of Living Waters | Living Waters |
| `fruit-meet-for-repentance` | 25 | Fruit Meet for Repentance | Fruit of Repentance |
| `lion-of-jacob-remnant` | 25 | Lion of the Jacob Remnant | Lion of Jacob |
| `house-of-jared` | 25 | House of Jared (Jaredite) | House of Jared |
| `fountain-of-filthy-water` | 24 | Fountain of Filthy Water | Filthy Fountain |
| `lamanite-prison-of-nephi` | 24 | Lamanite Prison of Nephi | Prison of Nephi |
| `lamoni-fathers-palace` | 24 | Lamoni's Father's Palace | Lamoni's Father's Palace |
| `sixteen-jaredite-stones` | 23 | Sixteen Jaredite Stones | 16 Jaredite Stones |
| `dove-of-the-holy-ghost` | 22 | Dove of the Holy Ghost | Dove of the Holy Ghost |
| `jaredite-noahs-prison` | 22 | Jaredite Noah's Prison | Noah's Prison (Jaredite) |

## Subtitles — target ≤ ~90 chars for 3 visible lines (≥100 will be cut)

| Slug | Chars | Current subtitle |
|---|---|---|
| `temples` | 215 | Houses of God built after the manner of Solomon's temple — Nephi's, Zarahemla's, Bountiful's, and the eschatological mountain of the Lord's house have their own entries; the residual covers the institutional pattern |
| `vineyard-of-zenos` | 202 | The Lord of the Vineyard's allegorical estate — vineyard, tame olive tree, wild and natural branches, and fruit — in Zenos's great prophecy preserved by Jacob and reprised in Alma's missionary preaching |
| `lambs` | 165 | Literal and Isaiah-quoted lambs — firstlings of Mosaic sacrifice, peaceful-kingdom wolf-and-lamb, lamb-skin loincloths, and the child-with-lamb of restored innocence |
| `lamanite-prison-of-nephi` | 156 | Recurring prison at the land of Nephi where Ammon's party was held under Limhi and where Nephi and Lehi later witnessed walls trembling and a pillar of fire |
| `fountain-of-filthy-water` | 153 | Vision-fountain whose depths are the depths of hell, separating those clinging to the rod of iron from those drawn toward the great and spacious building |
| `vineyard-of-the-lord-of-hosts` | 153 | Isaiah's "song of the beloved's vineyard" — judgment-parable of a vineyard that yielded wild grapes despite every care, quoted by Nephi at 2 Nephi 15:1-2 |
| `gates-of-hell` | 152 | Christ's threshold-of-perdition figure: the gates that shall not prevail against the rock of revelation and that swallow those built on sandy foundation |
| `tents` | 150 | Portable shelters of wilderness camps, military encampments, and Benjamin's coronation gathering — distinct from Lehi's tent which carries its own row |
| `graven-images` | 148 | Recurring Decalogue and Isaiah-quoted figure of forbidden carved images — the prohibited objects of every form of idolatry across the Book of Mormon |
| `fruits` | 147 | Wilderness gathering and cultivated produce of the Lehite, Nephite, and Bountiful records — the literal harvest from which every fruit-figure draws |
| `prisons` | 146 | Places of forced confinement used across Nephite, Lamanite, and Jaredite regimes to silence prophets, hold prisoners of war, and detain dissenters |
| `mountain-of-the-lords-house` | 146 | Isaiah's eschatological temple-summit established in the top of the mountains, to which all nations shall flow — quoted by Nephi at 2 Nephi 12:2-3 |
| `altar` | 144 | Stone offering-place of Mosaic continuity, first raised by Lehi at the valley of Lemuel and recurring in Nephite, Lamanite, and Zoramite worship |
| `lehis-tent` | 141 | Patriarch's family-camp tent at every stage of the wilderness journey — "the tent of my father" recurring from Jerusalem to the promised land |
| `pruning-hook` | 139 | Curved blade for vine and olive-tree maintenance into which spears are beaten in Isaiah's messianic-peace oracle, paired with the plowshare |
| `fiery-flying-serpents` | 138 | Israelite-wilderness and Jaredite plague: the poisonous serpents sent in judgment that drove migration and yielded the brazen-serpent type |
| `house-upon-the-rock` | 138 | Christ's Sermon-at-Bountiful parable of the wise and foolish builders — the doctrine that hearing and doing are the only secure foundation |
| `swords` | 137 | Steel-bladed war weapon of every Book of Mormon civilization — Nephite, Lamanite, and Jaredite — and Isaianic figure of beaten plowshares |
| `vineyards` | 136 | Literal cultivated vineyards of the Lehite, Nephite, and Zeniffite records — the agronomic ground from which every vineyard-figure draws |
| `opened-graves` | 136 | Many graves opened and saints arose at Christ's resurrection — Samuel the Lamanite's prophecy explicitly fulfilled in the Nephite record |
| `house-of-israel` | 134 | Primary covenant-lineage figure of the Book of Mormon, scattered and gathered across Lehite, Isaianic, and resurrected-Christ prophecy |
| `palaces` | 131 | Royal residences of Book of Mormon kings (Noah, Lamoni, Lamoni's father) and Isaiah's emblem of fallen Babylon's "pleasant palaces" |
| `fruits-by-which-known` | 129 | Christ's Sermon-at-Bountiful figure: the moral fruit by which true and false prophets, and good and corrupt people, are discerned |
| `sanctuary` | 126 | Third member of the Nephite worship-house triad with temples and synagogues, where Sidom's converts assembled before the altar |
| `houses` | 125 | Generic literal dwellings of Nephite, Lamanite, and Jaredite families and the Isaiah-quoted "houses shall be desolate" oracle |
| `fruit-of-the-tree-of-life` | 124 | Sweet white fruit at the center of Lehi's vision, representing the love of God and reprised in Alma's seed-and-tree allegory |
| `lamb-of-god` | 124 | Central messianic title of the Book of Mormon — Christ as the Lamb slain, baptized, and reigning over the church of the Lamb |
| `mote-and-beam` | 124 | Christ's Sermon-at-Bountiful parable of self-correction: cast the beam from thine own eye before the mote from thy brother's |
| `dove-of-the-holy-ghost` | 123 | Form in which the Holy Ghost descended upon the Lamb of God at his baptism — Nephi's vision and the doctrine-of-Christ unit |
| `idols` | 123 | Apostasy-coded idolatry of Lamanites, Zeniffites, and Nephite-dissenter groups across the Book of Mormon prophetic register |
| `chariots` | 123 | Royal Lamanite conveyances of Lamoni's court and Isaianic emblem of military pride condemned by Christ against the Gentiles |
| `noahs-watchtower` | 123 | Tower beside the temple at Lehi-Nephi from which Noah surveyed the Lamanite border and to which he fled from Gideon's sword |
| `plowshare` | 123 | Cutting blade of the plow into which swords are beaten in Isaiah's messianic-peace oracle, alongside Jaredite plowing tools |
| `staff-of-indignation` | 121 | Isaiah's figure of Assyria as the Lord's judgement-staff — lifted in his anger, rebuked for its pride, and at last broken |
| `labans-treasury` | 120 | Secured storehouse within Laban's house in Jerusalem where the brass plates were kept and from which Nephi obtained them |
| `towers` | 119 | Elevated structures for surveillance, defense, and prophetic proclamation across Lehite, Lamanite, and Jaredite history |
| `lion-of-jacob-remnant` | 119 | Christ's prophecy at Bountiful that the remnant of Jacob shall be as a young lion among the Gentiles in the latter days |
| `lions` | 116 | Isaiah's Assyrian-judgment and peaceful-kingdom lions plus the simile of Limhi's people fighting like lions for prey |
| `labans-house` | 115 | Jerusalem residence and treasury of the brass plates, entered by Nephi at night to slay Laban and obtain the record |
| `serpents` | 115 | Generic serpent imagery — Sermon-at-Bountiful "serpent for fish" and the disciples-take-up-serpents immunity figure |
| `zarahemla-prison` | 114 | Civic detention building at the Nephite judgment-seat where the five witnesses to Seezoram's murder were converted |
| `garden-of-eden` | 114 | Primordial garden of Adam and Eve cited by Lehi, Alma, and Nephite preaching as the lost-fruit setting of the Fall |
| `house-of-the-lord` | 114 | Sacred-residence figure: Isaiah's latter-day temple, Malachi's storehouse, and the heavenly mansions of the Father |
| `fruit-meet-for-repentance` | 112 | Alma and Moroni's recurring moral-works figure — the visible fruit by which repentance is shown forth in conduct |
| `gardens` | 112 | Walled enclosures of cultivation and prayer — Eden, Nephi's tower garden in Zarahemla, and the Zenosian vineyard |
| `snares-of-the-devil` | 111 | Recurring metaphor of Satan's cunning plans that catch the unrepentant heart in the Nephite preaching tradition |
| `lamonis-sepulchre` | 111 | Lamanite royal burial chamber prepared for king Lamoni's body while he lay two days in the trance of conversion |
| `garden-of-nephi` | 111 | Tower garden of Nephi son of Helaman by the highway in Zarahemla, from which he prophesied of Seezoram's murder |
| `lamonis-house` | 110 | Royal residence of king Lamoni in the land of Ishmael where his household fell into a trance and was converted |
| `graves` | 110 | Burial places of the slain at Cumorah and the Jaredite "go down to the grave" expressions of patriarchal death |
| `fountain-of-living-waters` | 109 | Vision-fountain at the tree of life signifying the love of God in Lehi's dream and Nephi's interpreted vision |
| `snares` | 109 | Literal Jaredite fowl-snares, Isaiah's gate-snare, and the Lamanite military-ambush snares of the Helaman war |
| `prison-of-middoni` | 109 | Lamanite holding cell where Aaron and his brethren were starved before Lamoni and Ammon secured their release |
| `strait-gate` | 107 | Salvation-doorway figure: the narrow gate of repentance and baptism that admits to the path of eternal life |
| `sword-of-justice` | 107 | Recurring Book of Mormon metaphor for the divine judgment that hangs over the wicked and falls in their day |
| `jaredite-noahs-prison` | 107 | Holding cell inside the Jaredite king Noah's palace where Shule was held until his sons broke down the door |
| `lamanite-idol-gods` | 106 | Idols of the late Lamanite confederacy to which Nephite women and children were offered as human sacrifice |
| `cave-of-ether` | 106 | Rock cavity in which the Jaredite prophet Ether hid by day and wrote the record of his people's extinction |
| `noahs-prison` | 105 | Holding cell of king Noah's royal complex at Lehi-Nephi where Abinadi was twice confined before martyrdom |
| `prison-of-ammonihah` | 105 | Holding cell of the order of Nehor where Alma and Amulek were starved before its walls were rent in twain |
| `gideons-sword` | 103 | Sword Gideon drew against king Noah in rebellion, spared only by the sight of advancing Lamanite armies |
| `bread` | 103 | Common Nephite staple and the sacramental emblem of Christ's body instituted at the temple in Bountiful |
| `coriantumrs-sword` | 102 | Sword on which the last Jaredite king leaned exhausted, then used to behead Shiz at the end of the war |
| `gates` | 101 | Literal civic gates of Nephite and Zeniffite cities and Isaiah-quoted gate imagery preserved by Nephi |
| `amuleks-house` | 100 | Ammonihah residence where Amulek hosted Alma the Younger after the angel's command to feed a prophet |
