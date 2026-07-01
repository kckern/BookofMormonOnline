battle tiles: 38  candidate slugs: 31  matched: 22

UNMATCHED TILES (16): 11,33, 19,34, 21,16, 23,16, 25,16, 27,16, 29,16, 75,35, 84,32, 85,31, 105,24, 121,24, 126,32, 126,33, 126,34, 126,35

UNMATCHED SLUGS (9): aarons-army, attack-on-converts, convert-massacre, ill-fated-expedition-conflict, jaredite-battle, lamanites-vs-benjamin, lamanites-vs-zeniff, mormon-vs-aaron, war-in-zarahemla

## Curation (2026-07-01)

Kept **16** / dropped **6** from the 22 draft pairs.

**Method:** For each draft pair, computed interpolated tile year (dateAxis), fetched event year from API.
Kept only: (1) |tile_year − event_year| ≤ 8, (2) slug contains a battle-like keyword
(battle|attack|war|-vs-|siege|assault|conflict|massacre|raid|army|invasion|destruction),
(3) no other unplaced candidate slug within 2yr of the tile. Slug-only battle check to avoid 'Northward'→'war' false-positive.

**Kept pairs:**

- `103,31` → `zemnarihahs-attack` — "Zemnarihah’s Attack" (19 AD) delta=3.8yr
- `119,24` → `attacks-at-desolation` — "Attacks at Desolation" (360 AD) delta=0.0yr
- `123,30` → `cumorah-battle` — "Last Battle at Cumorah" (384 AD) delta=6.5yr
- `19,16` → `mulekite-wars` — "Mulekite Wars" (550 BC - 250 BC) delta=6.7yr
- `33,19` → `lamanites-vs-zeniff-2` — "Second Lamanite Strike Against Zeniff" (178 BC) delta=2.0yr
- `37,31` → `lamanites-vs-noah` — "Lamanites vs. Noah" (150 BC) delta=0.0yr
- `38,14` → `lamanites-vs-limhi` — "Lamanites vs. Limhi" (140 BC) delta=2.5yr
- `53,31` → `amlicite-battle` — "Amlicite Battle" (87 BC) delta=3.0yr
- `58,31` → `attack-on-ammonihah` — "Attack on Ammonihah" (81 BC) delta=2.9yr
- `59,15` → `amalekite-attack` — "Amalekite Attack" (77 BC) delta=0.5yr
- `61,14` → `zerahemnah-vs-moroni` — "Zerahemnah vs. Moroni" (74 BC) delta=2.2yr
- `72,32` → `pahoran-vs-kingmen` — "Overthrow of the King-men" (63 BC) delta=0.6yr
- `75,30` → `western-war` — "War on the Western Front" (67 BC - 61 BC) delta=7.7yr
- `78,29` → `coriantumr-vs-nephites` — "Coriantumr’s Strike on Zarahemla" (50 BC) delta=5.0yr
- `82,29` → `internal-nephite-conflict` — "Internal Nephite Conflict" (36 BC) delta=4.0yr
- `97,32` → `gadianton-guerilla-attacks` — "Gadianton Guerilla Attacks" (10 BC) delta=5.0yr

**Dropped pairs:**

- `100,34` → `gadianton-assaults` ("Gadianton Assaults", 9 BC) — **far-date**: delta=10.0yr (tile=1.0, event=-9)
- `40,16` → `noah-vs-lamanites` ("Lamanite Siege", 145 BC) — **far-date**: delta=13.3yr (tile=-131.7, event=-145)
- `65,29` → `amalickiah-vs-nephites-1` ("Amalickiah’s Initial Strikes", 73 BC) — **ambiguous**: 3 candidates within 2yr: ['zerahemnah-vs-moroni', 'amalickiah-vs-nephites-2', 'amalickiah-vs-nephites-1']
- `71,32` → `eastern-war` ("War on the Eastern Front", 67 BC - 61 BC) — **ambiguous**: 3 candidates within 2yr: ['western-war', 'pahoran-vs-kingmen', 'eastern-war']
- `75,32` → `amalickiah-vs-nephites-2` ("Amalickiah’s Invasion", 72 BC) — **far-date**: delta=12.7yr (tile=-59.3, event=-72)
- `92,32` → `nephi-2-and-lehi-2-north` ("Nephi II and Lehi II Trave Northward", 25 BC) — **not-battle-like**: slug has no battle terms (heading='Nephi II and Lehi II Trave Northward')

**22 tiles unmatched** in the draft: stay decorative until KC reviews the 9 unmatched slugs
and confirms correct tile assignments or adds date data for undated events.
