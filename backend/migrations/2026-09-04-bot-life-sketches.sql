-- First-class biographical grounding for public bot profiles and prompts.
ALTER TABLE bom_bot
  ADD COLUMN birth_year INT NULL AFTER display_name,
  ADD COLUMN death_year INT NULL AFTER birth_year,
  ADD COLUMN life_sketch JSON NULL AFTER death_year;

-- Korean historical and legendary voices. Legendary dates remain NULL.
UPDATE bom_bot SET birth_year=1397, death_year=1450, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year',1418,'event','조선의 왕위에 올랐다.'),
 JSON_OBJECT('year',1443,'event','백성이 쉽게 배울 수 있는 훈민정음 창제를 이끌었다.'),
 JSON_OBJECT('year',1446,'event','훈민정음을 반포했다.')) WHERE display_name='세종대왕';
UPDATE bom_bot SET birth_year=1545, death_year=1598, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year',1592,'event','임진왜란 때 수군을 지휘하며 해상 보급로를 지켰다.'),
 JSON_OBJECT('year',1597,'event','명량에서 크게 불리한 전력으로 승리했다.'),
 JSON_OBJECT('year',1598,'event','노량 해전에서 전사했다.')) WHERE display_name='이순신';
UPDATE bom_bot SET birth_year=617, death_year=686, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year','7세기','event','신라의 승려이자 저술가로 활동했다.'),
 JSON_OBJECT('year','생애','event','서로 다른 불교 학설의 갈등을 화해시키는 화쟁을 강조했다.')) WHERE display_name='원효';
UPDATE bom_bot SET birth_year=NULL, death_year=NULL, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year','전설','event','버림받은 공주가 부모를 살릴 생명수를 찾아 저승길을 건넌다는 서사무가의 주인공이다.'),
 JSON_OBJECT('year','전승','event','죽은 이를 인도하고 치유하는 무속의 원형적 존재로 기억된다.')) WHERE display_name='바리공주';
UPDATE bom_bot SET birth_year=1821, death_year=1846, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year',1845,'event','상하이에서 사제품을 받고 한국 최초의 가톨릭 사제가 되었다.'),
 JSON_OBJECT('year',1846,'event','박해 속에서 신앙 공동체를 섬기다 체포되어 순교했다.')) WHERE display_name='김대건 안드레아';
UPDATE bom_bot SET birth_year=1868, death_year=1942, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year',1899,'event','북간도 명동촌 공동체 건설과 교육에 힘썼다.'),
 JSON_OBJECT('year',1908,'event','민족 교육 기관인 명동학교 설립을 이끌었다.'),
 JSON_OBJECT('year','일제강점기','event','목회·교육·독립운동을 함께 수행했다.')) WHERE display_name='김약연';
UPDATE bom_bot SET birth_year=1905, death_year=1959, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year',1951,'event','코넬 대학교 유학 중 침례를 받아 최초의 한국인 후기 성도가 되었다.'),
 JSON_OBJECT('year',1952,'event','귀국 뒤 전쟁 중인 한국에서 교회 공동체 형성을 도왔다.'),
 JSON_OBJECT('year',1955,'event','한국 선교를 준비하는 초기 지도자로 봉사했다.')) WHERE display_name='김호직';
UPDATE bom_bot SET birth_year=1762, death_year=1836, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year',1783,'event','과거에 급제하고 정조 치세의 관료로 일했다.'),
 JSON_OBJECT('year',1801,'event','천주교 박해의 여파로 강진에 유배되었다.'),
 JSON_OBJECT('year','유배기','event','행정·형법·경제 개혁에 관한 저술을 집필했다.')) WHERE display_name='정약용';
UPDATE bom_bot SET birth_year=NULL, death_year=NULL, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year','15세기','event','세종 치세에 천문·시간·강우를 측정하는 기구 제작을 이끈 기술자였다.'),
 JSON_OBJECT('year',1434,'event','자동 물시계 자격루 제작에 참여했다.')) WHERE display_name='장영실';
UPDATE bom_bot SET birth_year=1902, death_year=1920, life_sketch=JSON_ARRAY(
 JSON_OBJECT('year',1919,'event','아우내 장터의 3·1운동 만세 시위를 이끌었다.'),
 JSON_OBJECT('year',1919,'event','체포된 뒤에도 옥중에서 독립 의지를 굽히지 않았다.'),
 JSON_OBJECT('year',1920,'event','서대문형무소에서 숨졌다.')) WHERE display_name='유관순';

-- Reformers group and its configured historical respondents.
UPDATE bom_bot SET birth_year=1483,death_year=1546,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1517,'event','Published the Ninety-five Theses against indulgence abuses.'),JSON_OBJECT('year',1521,'event','Refused to recant at the Diet of Worms and was hidden at Wartburg Castle.'),JSON_OBJECT('year',1522,'event','Published his German New Testament translation.')) WHERE display_name='Martin Luther';
UPDATE bom_bot SET birth_year=1509,death_year=1564,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1536,'event','Published the first edition of the Institutes of the Christian Religion.'),JSON_OBJECT('year',1541,'event','Returned to Geneva and shaped its Reformed church order.'),JSON_OBJECT('year',1559,'event','Founded the Genevan Academy.')) WHERE display_name='John Calvin';
UPDATE bom_bot SET birth_year=1514,death_year=1572,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1559,'event','Returned to Scotland after exile and helped lead its Reformation.'),JSON_OBJECT('year',1560,'event','Helped compose the Scots Confession and First Book of Discipline.')) WHERE display_name='John Knox';
UPDATE bom_bot SET birth_year=1703,death_year=1791,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1738,'event','Experienced a spiritual assurance at a meeting in Aldersgate Street.'),JSON_OBJECT('year','1740s onward','event','Organized Methodist societies and traveled widely as a preacher.'),JSON_OBJECT('year',1784,'event','Made provision for American Methodism after independence.')) WHERE display_name='John Wesley';
UPDATE bom_bot SET birth_year=1714,death_year=1770,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1739,'event','Began open-air preaching to large crowds in Britain.'),JSON_OBJECT('year','1740s','event','Made repeated preaching tours through the British Atlantic colonies.')) WHERE display_name='George Whitefield';
UPDATE bom_bot SET birth_year=1484,death_year=1531,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1519,'event','Led reform in Zürich through sequential biblical preaching.'),JSON_OBJECT('year',1529,'event','Disagreed with Luther over the Eucharist at the Marburg Colloquy.'),JSON_OBJECT('year',1531,'event','Died at the Battle of Kappel.')) WHERE display_name='Ulrich Zwingli';
UPDATE bom_bot SET birth_year=1494,death_year=1536,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1526,'event','Published an English New Testament translated from Greek.'),JSON_OBJECT('year',1530,'event','Published The Obedience of a Christian Man.'),JSON_OBJECT('year',1536,'event','Was executed near Vilvoorde after imprisonment for heresy.')) WHERE display_name='William Tyndale';
UPDATE bom_bot SET birth_year=1491,death_year=1547,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1521,'event','Received the title Defender of the Faith for opposing Luther.'),JSON_OBJECT('year',1534,'event','Parliament established royal supremacy over the Church of England.'),JSON_OBJECT('year','1530s','event','Dissolved monasteries while pursuing dynastic and political control.')) WHERE display_name='Henry VIII';
UPDATE bom_bot SET birth_year=1497,death_year=1560,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1521,'event','Defended Catholic teaching against Luther at Leipzig and Worms.'),JSON_OBJECT('year',1530,'event','Took part in the Diet of Augsburg as a leading Catholic controversialist.')) WHERE display_name='Johann Eck';
UPDATE bom_bot SET birth_year=1478,death_year=1534,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1523,'event','Became pope amid the conflict surrounding the Reformation.'),JSON_OBJECT('year',1530,'event','Refused to annul Henry VIII’s marriage to Catherine of Aragon.'),JSON_OBJECT('year',1527,'event','Endured the Sack of Rome and confinement in Castel Sant’Angelo.')) WHERE display_name='Pope Clement VII';
UPDATE bom_bot SET birth_year=1497,death_year=1560,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1521,'event','Published Loci Communes, an early systematic account of Lutheran theology.'),JSON_OBJECT('year',1530,'event','Drafted the Augsburg Confession.'),JSON_OBJECT('year','career','event','Worked as an educator and mediator within the Lutheran Reformation.')) WHERE display_name='Philipp Melanchthon';
UPDATE bom_bot SET birth_year=1703,death_year=1758,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1734,'event','Preached sermons associated with revival in Northampton, Massachusetts.'),JSON_OBJECT('year',1741,'event','Preached Sinners in the Hands of an Angry God during the Great Awakening.'),JSON_OBJECT('year',1758,'event','Became president of the College of New Jersey shortly before his death.')) WHERE display_name='Jonathan Edwards';
UPDATE bom_bot SET birth_year=NULL,death_year=NULL,life_sketch=JSON_ARRAY(JSON_OBJECT('year','16th century','event','Served as an Ethiopian Orthodox cleric and debated Luther in Wittenberg.'),JSON_OBJECT('year',1534,'event','Helped introduce Luther to Ethiopian Christian practice and liturgy.')) WHERE display_name='Abba Mikael';
UPDATE bom_bot SET birth_year=1536,death_year=1595,life_sketch=JSON_ARRAY(JSON_OBJECT('year',1572,'event','Became Ecumenical Patriarch of Constantinople.'),JSON_OBJECT('year','1570s','event','Corresponded with Lutheran theologians at Tübingen and rejected key parts of the Augsburg Confession.')) WHERE display_name='Jeremiah II of Constantinople';
