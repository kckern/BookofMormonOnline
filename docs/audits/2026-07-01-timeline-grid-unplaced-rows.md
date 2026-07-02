# Timeline grid — unplaced legacy rows (2026-07-01)

Companion to `2026-07-01-timeline-grid-ux-audit.md` §3.1/§5. Prod GraphQL rows
with no `grid` placement on dev. `p` false = place pin; `content` = has heading+html
(a clickable popup in prod that is currently unreachable in the grid).

| slug | p | date | content | heading |
|---|---|---|---|---|
| aarons-army | event | 326 AD | yes | Aaron’s Army |
| almas-people-in-slavery | event | 121 BC | yes | Alma’s People in Slavery |
| amaleki | event |  | yes | Amaleki |
| amalekite-attack | event | 77 BC | yes | Amalekite Attack |
| amalickiah-vs-nephites-1 | event | 73 BC | yes | Amalickiah’s Initial Strikes |
| amalickiah-vs-nephites-2 | event | 72 BC | yes | Amalickiah’s Invasion |
| amlicite-battle | event | 87 BC | yes | Amlicite Battle |
| amlicites | event | 87 BC | yes | Amlicite Defection |
| ammaron | event | 305 AD | yes | Ammaron |
| ammon-in-middoni | event | 91 BC - 77 BC | yes | Trip to Middoni |
| ammon-search-party | event | 121 BC | yes | Ammon’s Search Party |
| ammonites-anti-nephi-lehites | event | 77 BC | yes | People of Ammon |
| ammoron | event | 66 BC | yes | Ammoron |
| arabia | event | 600 BC - 592 BC | yes | Arabian Wilderness |
| attack-on-ammonihah | event | 81 BC | yes | Attack on Ammonihah |
| attack-on-converts | event | 81 BC | yes | Revolt, Attack, and Conversion |
| attacks-at-desolation | event | 360 AD | yes | Attacks at Desolation |
| bang | place | 91 BC - 77 BC | no |  |
| captain-moroni | event | 74 BC | yes | Captain Moroni |
| convert-massacre | event | 81 BC | yes | Convert Massacre in Ammonihah |
| convert-relocation | event | 77 BC | yes | Lamanite Convert Relocation |
| coriantumr-vs-nephites | event | 50 BC | yes | Coriantumr’s Strike on Zarahemla |
| cumorah-battle | event | 384 AD | yes | Last Battle at Cumorah |
| discovery-of-desolation | event | 120 BC | yes | Discovery of Desolation |
| eastern-war | event | 67 BC - 61 BC | yes | War on the Eastern Front |
| fate-of-the-nephites | event | 279 BC-200 BC | yes | Fate of the Nephites |
| gadianton-assaults | event | 9 BC | yes | Gadianton Assaults |
| gadianton-guerilla-attacks | event | 10 BC | yes | Gadianton Guerilla Attacks |
| gadianton-surrender | event | 19 AD | yes | Gadianton Surrender |
| ill-fated-expedition-conflict | event | 200 BC | yes | Expedition Conflict |
| internal-nephite-conflict | event | 36 BC | yes | Internal Nephite Conflict |
| jacob-and-his-followers | event | 25 AD | yes | Jacob and his Followers |
| jaredite-battle | event | 685 BC | yes | The Final Jaredite Battle |
| jaredite-voyage | event | 3000 BC | yes | Jaredite Voyage |
| jerusalem | place |  | no |  |
| king-laman-i | event | 200 BC | yes | King Laman I |
| king-laman-ii | event | 178 BC | yes | King Laman II |
| lamanite-occupation-of-zarahemla | event | 34 BC | yes | Lamanite Occupation of Zarahemla |
| lamanite-recruits-2 | event | 4 AD | yes | Lamanites Join Gadianton |
| lamanite-troops | event | 121 BC | yes | Lamanite Troops |
| lamanites-vs-benjamin | event | 185 BC | yes | Lamanites vs. Benjamin |
| lamanites-vs-limhi | event | 140 BC | yes | Lamanites vs. Limhi |
| lamanites-vs-noah | event | 150 BC | yes | Lamanites vs. Noah |
| lamanites-vs-zeniff | event | 187 BC | yes | First Lamanite Strike Against Zeniff |
| lamanites-vs-zeniff-2 | event | 178 BC | yes | Second Lamanite Strike Against Zeniff |
| lehite-voyage | event | 592-591 BC | yes | Lehite Voyage |
| limhis-revolts | event | 140 BC | yes | Limhi’s Revolts |
| mormon-vs-aaron | event | 330 AD | yes | Mormon vs. Aaron |
| moroni-east | event | 67 BC - 61 BC | yes | Moroni on the Eastern Front |
| mulekite-voyage | event |  | yes | Mulekite Voyage |
| mulekite-wars | event | 550 BC - 250 BC | yes | Mulekite Wars |
| nephi-2-and-lehi-2-north | event | 25 BC | yes | Nephi II and Lehi II Trave Northward |
| nephi-2-preaching | event | 24 BC | yes | Nephi Preaching to the Lamanites |
| nephite-counterstrike | event | 13 AD | yes | Nephite Counterstrike |
| nephite-followers | event | 570-279 BC | yes | Nephites |
| noah-vs-lamanites | event | 145 BC | yes | Lamanite Siege |
| pahoran-vs-kingmen | event | 63 BC | yes | Overthrow of the King-men |
| reclaiming-nephite-land | event | 31 BC | yes | Reclaiming Nephite Lands |
| teaching-mulek | event | 28 BC | yes | Mulek |
| war-in-zarahemla | event | 321 AD | yes | War in Zarahemla |
| western-war | event | 67 BC - 61 BC | yes | War on the Western Front |
| zarahemla-sermon | event | 83 BC | yes | Alma’s Sermon in Zarahemla |
| zemnarihahs-attack | event | 19 AD | yes | Zemnarihah’s Attack |
| zerahemnah-vs-moroni | event | 74 BC | yes | Zerahemnah vs. Moroni |
| zoramite-defection | event | 72 BC | yes | Zoramite Defection |

**Duplicate-slug rows in prod data (5):** bountiful, desolation, land-northward, land-of-nephi, zarahemla

---

## Resolution (2026-07-01 Round 2)

**R2b auto-placed (37 rows):** placed via `scripts/timeline-grid/data-overrides.json`, each
flagged `r2b_flag: "auto-placed"`. These cover the events with clear date + lineage signals
that the original pipeline missed. Total placed after R2b: 193 of 210 entries.

**12 rows retired-with-reason (not placed, not a gap):**

| slug | reason |
|---|---|
| amaleki | no date — cannot anchor on the time axis |
| mulekite-voyage | no date — cannot anchor on the time axis |
| ammaron | lineage unclear — does not map cleanly to a band column |
| arabia | lineage unclear — old-world locale; no band covers the Arabian peninsula |
| ill-fated-expedition-conflict | lineage unclear; story carried by the expedition bar |
| lehite-voyage | lineage unclear — ocean crossing; candidate for future ship icon-event |
| land-of-nephi | no band room at the target date/column |
| nephite-followers | no band room at the target date/column |
| teaching-mulek | too crowded at the target cell |
| fate-of-the-nephites | too crowded at the target cell |
| lamanites-vs-zeniff | no battle tile at that cell; avoids clutter — candidate for future battle marker |
| lamanites-vs-benjamin | no battle tile at that cell; avoids clutter — candidate for future battle marker |

**5 unplaced place-pins** (data-cleanup candidates): `bang`, `bountiful`, `land-northward` (×2), `zarahemla` —
duplicate-slug rows in prod; need deduplication before a place-pin placement pass.
