export type SeoCopyKey =
  | 'home'
  | 'about'
  | 'contents'
  | 'people'
  | 'places'
  | 'maps'
  | 'timeline'
  | 'facsimiles'
  | 'search'
  | 'user'

type SupportedSeoLang = 'en' | 'ko' | 'es' | 'fr' | 'de' | 'swe' | 'vn' | 'ru' | 'tgl'

// Curated launch copy. Non-English strings are intentionally static (never
// runtime-translated) and should receive native-speaker editorial review as the
// corresponding localized surfaces mature.

interface LocaleCopy {
  pages: Record<SeoCopyKey, string>
  entity: (title: string) => string
  image: (title: string) => string
}

const COPY: Record<SupportedSeoLang, LocaleCopy> = {
  en: {
    pages: {
      home: 'Explore the Book of Mormon through readable passages, contextual summaries, commentary, art, maps, people, places, and study resources.',
      about: 'Learn how Book of Mormon Online makes the text easier to explore through contextual summaries, connections, commentary, art, maps, and research tools.',
      contents: 'Browse the complete Book of Mormon Online table of contents, organized into books, narrative sections, teachings, journeys, and major events.',
      people: 'Explore people in the Book of Mormon, their relationships, appearances in the text, historical setting, and roles in the larger narrative.',
      places: 'Explore Book of Mormon places, related passages, geographic models, journeys, events, and connections between locations in the narrative.',
      maps: 'Explore maps and geographic models for Book of Mormon lands, journeys, settlements, battles, and other locations described in the text.',
      timeline: 'Follow Book of Mormon people, teachings, migrations, conflicts, and major events in narrative and chronological context.',
      facsimiles: 'Browse historical Book of Mormon editions, manuscripts, facsimiles, and page images for research and comparative study.',
      search: 'Search Book of Mormon Online for passages, people, places, topics, commentary, art, maps, and study resources.',
      user: 'View public profile information and contributions on Book of Mormon Online.',
    },
    entity: (title) => `Explore ${title} in its Book of Mormon context, including related passages, people, places, events, and study resources.`,
    image: (title) => `Social preview for ${title}`,
  },
  ko: {
    pages: {
      home: '읽기 쉬운 본문과 문맥 요약, 해설, 미술, 지도, 인물, 장소 및 학습 자료를 통해 몰몬경을 탐구해 보세요.',
      about: '문맥 요약, 연결 자료, 해설, 미술, 지도와 연구 도구를 통해 몰몬경·KR이 본문 탐구를 어떻게 돕는지 알아보세요.',
      contents: '책, 이야기 단락, 가르침, 여정과 주요 사건별로 정리된 몰몬경·KR 전체 목차를 살펴보세요.',
      people: '몰몬경 인물의 관계, 본문 등장, 역사적 배경과 전체 이야기 속 역할을 살펴보세요.',
      places: '몰몬경의 장소와 관련 구절, 지리 모형, 여정, 사건 및 장소 사이의 연결을 살펴보세요.',
      maps: '몰몬경에 기록된 땅, 여정, 정착지, 전쟁과 여러 장소의 지도 및 지리 모형을 살펴보세요.',
      timeline: '몰몬경의 인물, 가르침, 이주, 분쟁과 주요 사건을 이야기와 연대의 흐름 속에서 살펴보세요.',
      facsimiles: '연구와 비교 학습을 위한 역사적 몰몬경 판본, 원고, 영인본과 페이지 이미지를 살펴보세요.',
      search: '몰몬경·KR에서 구절, 인물, 장소, 주제, 해설, 미술, 지도와 학습 자료를 검색하세요.',
      user: '몰몬경·KR 사용자의 공개 프로필 정보와 활동을 확인하세요.',
    },
    entity: (title) => `${title}의 관련 구절, 인물, 장소, 사건과 학습 자료를 통해 몰몬경의 문맥을 살펴보세요.`,
    image: (title) => `${title} 소셜 미리보기`,
  },
  es: {
    pages: {
      home: 'Explora el Libro de Mormón con pasajes legibles, resúmenes contextuales, comentarios, arte, mapas, personajes, lugares y recursos de estudio.',
      about: 'Conoce cómo Libro de Mormón Online facilita el estudio del texto mediante resúmenes, conexiones, comentarios, arte, mapas y herramientas de investigación.',
      contents: 'Consulta el índice completo, organizado por libros, secciones narrativas, enseñanzas, viajes y acontecimientos principales.',
      people: 'Explora los personajes del Libro de Mormón, sus relaciones, apariciones, contexto histórico y función en la narración.',
      places: 'Explora lugares del Libro de Mormón, pasajes relacionados, modelos geográficos, viajes, acontecimientos y conexiones.',
      maps: 'Explora mapas y modelos geográficos de tierras, viajes, asentamientos, batallas y lugares del Libro de Mormón.',
      timeline: 'Sigue a los personajes, enseñanzas, migraciones, conflictos y acontecimientos del Libro de Mormón en su contexto.',
      facsimiles: 'Consulta ediciones históricas, manuscritos, facsímiles e imágenes de páginas del Libro de Mormón.',
      search: 'Busca pasajes, personajes, lugares, temas, comentarios, arte, mapas y recursos de estudio del Libro de Mormón.',
      user: 'Consulta la información pública del perfil y las contribuciones en Libro de Mormón Online.',
    },
    entity: (title) => `Explora ${title} en su contexto del Libro de Mormón, con pasajes, personajes, lugares, acontecimientos y recursos relacionados.`,
    image: (title) => `Vista previa social de ${title}`,
  },
  fr: {
    pages: {
      home: 'Explorez le Livre de Mormon grâce à des passages lisibles, des résumés contextuels, des commentaires, des œuvres, des cartes et des ressources d’étude.',
      about: 'Découvrez comment Livre de Mormon en ligne facilite l’étude du texte avec des résumés, des liens, des commentaires, des cartes et des outils de recherche.',
      contents: 'Parcourez la table des matières complète, organisée par livres, récits, enseignements, voyages et événements majeurs.',
      people: 'Explorez les personnages du Livre de Mormon, leurs relations, leurs apparitions, leur contexte historique et leur rôle dans le récit.',
      places: 'Explorez les lieux du Livre de Mormon, les passages associés, les modèles géographiques, les voyages et les événements.',
      maps: 'Explorez les cartes et modèles géographiques des pays, voyages, colonies, batailles et lieux du Livre de Mormon.',
      timeline: 'Suivez les personnages, enseignements, migrations, conflits et événements du Livre de Mormon dans leur contexte.',
      facsimiles: 'Consultez les éditions historiques, manuscrits, fac-similés et images de pages du Livre de Mormon.',
      search: 'Recherchez des passages, personnages, lieux, thèmes, commentaires, œuvres, cartes et ressources d’étude.',
      user: 'Consultez les informations publiques du profil et les contributions sur Livre de Mormon en ligne.',
    },
    entity: (title) => `Explorez ${title} dans son contexte du Livre de Mormon, avec les passages, personnages, lieux, événements et ressources associés.`,
    image: (title) => `Aperçu social de ${title}`,
  },
  de: {
    pages: {
      home: 'Erkunde das Buch Mormon mit gut lesbaren Textabschnitten, Zusammenfassungen, Kommentaren, Kunst, Karten, Personen, Orten und Studienhilfen.',
      about: 'Erfahre, wie Buch Mormon Online den Text durch Zusammenfassungen, Verknüpfungen, Kommentare, Karten und Forschungswerkzeuge erschließt.',
      contents: 'Durchsuche das vollständige Inhaltsverzeichnis nach Büchern, Erzählabschnitten, Lehren, Reisen und wichtigen Ereignissen.',
      people: 'Erkunde Personen im Buch Mormon, ihre Beziehungen, Textstellen, ihren historischen Kontext und ihre Rolle in der Erzählung.',
      places: 'Erkunde Orte im Buch Mormon, zugehörige Schriftstellen, geografische Modelle, Reisen, Ereignisse und Verbindungen.',
      maps: 'Erkunde Karten und geografische Modelle zu Ländern, Reisen, Siedlungen, Schlachten und Orten im Buch Mormon.',
      timeline: 'Verfolge Personen, Lehren, Wanderungen, Konflikte und wichtige Ereignisse des Buches Mormon im Zusammenhang.',
      facsimiles: 'Durchsuche historische Ausgaben, Manuskripte, Faksimiles und Seitenabbildungen des Buches Mormon.',
      search: 'Suche nach Schriftstellen, Personen, Orten, Themen, Kommentaren, Kunst, Karten und Studienhilfen.',
      user: 'Sieh dir öffentliche Profilinformationen und Beiträge auf Buch Mormon Online an.',
    },
    entity: (title) => `Erkunde ${title} im Kontext des Buches Mormon mit zugehörigen Schriftstellen, Personen, Orten, Ereignissen und Studienhilfen.`,
    image: (title) => `Social-Media-Vorschau für ${title}`,
  },
  swe: {
    pages: {
      home: 'Utforska Mormons bok med lättlästa avsnitt, sammanfattningar, kommentarer, konst, kartor, personer, platser och studieresurser.',
      about: 'Läs om hur Mormons bok online gör texten lättare att studera med sammanfattningar, samband, kommentarer, kartor och forskningsverktyg.',
      contents: 'Bläddra i hela innehållsförteckningen, ordnad efter böcker, berättelser, lärdomar, resor och viktiga händelser.',
      people: 'Utforska personer i Mormons bok, deras relationer, textställen, historiska sammanhang och roller i berättelsen.',
      places: 'Utforska platser i Mormons bok, tillhörande skriftställen, geografiska modeller, resor och händelser.',
      maps: 'Utforska kartor och geografiska modeller över länder, resor, bosättningar, strider och platser i Mormons bok.',
      timeline: 'Följ personer, lärdomar, migrationer, konflikter och viktiga händelser i Mormons bok i sitt sammanhang.',
      facsimiles: 'Bläddra bland historiska utgåvor, manuskript, faksimil och sidbilder av Mormons bok.',
      search: 'Sök efter skriftställen, personer, platser, ämnen, kommentarer, konst, kartor och studieresurser.',
      user: 'Visa offentlig profilinformation och bidrag på Mormons bok online.',
    },
    entity: (title) => `Utforska ${title} i Mormons boks sammanhang med relaterade skriftställen, personer, platser, händelser och studieresurser.`,
    image: (title) => `Förhandsvisning för ${title}`,
  },
  vn: {
    pages: {
      home: 'Khám phá Sách Mặc Môn qua các đoạn dễ đọc, phần tóm lược bối cảnh, bình luận, nghệ thuật, bản đồ, nhân vật, địa điểm và tài liệu học tập.',
      about: 'Tìm hiểu cách Sách Mặc Môn Trực Tuyến giúp nghiên cứu bản văn qua tóm lược, liên kết, bình luận, bản đồ và công cụ tra cứu.',
      contents: 'Xem mục lục đầy đủ được sắp xếp theo sách, phần tường thuật, lời giảng dạy, hành trình và sự kiện chính.',
      people: 'Khám phá các nhân vật trong Sách Mặc Môn, mối quan hệ, lần xuất hiện, bối cảnh lịch sử và vai trò của họ.',
      places: 'Khám phá các địa điểm trong Sách Mặc Môn, câu liên quan, mô hình địa lý, hành trình và sự kiện.',
      maps: 'Khám phá bản đồ và mô hình địa lý về vùng đất, hành trình, khu định cư, trận chiến và địa điểm trong Sách Mặc Môn.',
      timeline: 'Theo dõi các nhân vật, lời giảng dạy, cuộc di cư, xung đột và sự kiện chính của Sách Mặc Môn.',
      facsimiles: 'Xem các ấn bản lịch sử, bản thảo, bản sao và hình ảnh trang Sách Mặc Môn.',
      search: 'Tìm kiếm câu thánh thư, nhân vật, địa điểm, chủ đề, bình luận, nghệ thuật, bản đồ và tài liệu học tập.',
      user: 'Xem thông tin hồ sơ công khai và đóng góp trên Sách Mặc Môn Trực Tuyến.',
    },
    entity: (title) => `Khám phá ${title} trong bối cảnh Sách Mặc Môn cùng các câu, nhân vật, địa điểm, sự kiện và tài liệu liên quan.`,
    image: (title) => `Ảnh xem trước cho ${title}`,
  },
  ru: {
    pages: {
      home: 'Изучайте Книгу Мормона с удобными отрывками, обзорами контекста, комментариями, иллюстрациями, картами и справочными материалами.',
      about: 'Узнайте, как Книга Мормона онлайн помогает изучать текст с помощью обзоров, связей, комментариев, карт и исследовательских инструментов.',
      contents: 'Просмотрите полное оглавление по книгам, сюжетным разделам, учениям, путешествиям и главным событиям.',
      people: 'Изучайте персонажей Книги Мормона, их отношения, упоминания, исторический контекст и роль в повествовании.',
      places: 'Изучайте места Книги Мормона, связанные отрывки, географические модели, путешествия и события.',
      maps: 'Изучайте карты и географические модели земель, путешествий, поселений, сражений и мест Книги Мормона.',
      timeline: 'Проследите людей, учения, переселения, конфликты и важные события Книги Мормона в контексте.',
      facsimiles: 'Просмотрите исторические издания, рукописи, факсимиле и изображения страниц Книги Мормона.',
      search: 'Ищите отрывки, людей, места, темы, комментарии, иллюстрации, карты и учебные материалы.',
      user: 'Просмотрите общедоступные сведения профиля и публикации на сайте «Книга Мормона онлайн».',
    },
    entity: (title) => `Изучайте ${title} в контексте Книги Мормона: связанные отрывки, люди, места, события и учебные материалы.`,
    image: (title) => `Предпросмотр для ${title}`,
  },
  tgl: {
    pages: {
      home: 'Tuklasin ang Aklat ni Mormon sa madaling basahing mga talata, buod ng konteksto, komentaryo, sining, mapa, tao, lugar, at sanggunian.',
      about: 'Alamin kung paano pinadadali ng Aklat ni Mormon Online ang pag-aaral gamit ang mga buod, ugnayan, komentaryo, mapa, at kagamitan.',
      contents: 'Tingnan ang buong talaan ng nilalaman ayon sa aklat, salaysay, turo, paglalakbay, at mahahalagang pangyayari.',
      people: 'Tuklasin ang mga tao sa Aklat ni Mormon, kanilang ugnayan, pagbanggit sa teksto, kasaysayan, at papel sa salaysay.',
      places: 'Tuklasin ang mga lugar sa Aklat ni Mormon, kaugnay na talata, modelong heograpiko, paglalakbay, at pangyayari.',
      maps: 'Tuklasin ang mga mapa at modelong heograpiko ng mga lupain, paglalakbay, pamayanan, labanan, at lugar.',
      timeline: 'Sundan ang mga tao, turo, paglipat, tunggalian, at mahahalagang pangyayari sa Aklat ni Mormon.',
      facsimiles: 'Tingnan ang mga makasaysayang edisyon, manuskrito, facsimile, at larawan ng mga pahina ng Aklat ni Mormon.',
      search: 'Maghanap ng mga talata, tao, lugar, paksa, komentaryo, sining, mapa, at sanggunian sa pag-aaral.',
      user: 'Tingnan ang pampublikong impormasyon ng profile at mga ambag sa Aklat ni Mormon Online.',
    },
    entity: (title) => `Tuklasin si o ang ${title} sa konteksto ng Aklat ni Mormon kasama ang kaugnay na mga talata, tao, lugar, at pangyayari.`,
    image: (title) => `Social preview para sa ${title}`,
  },
}

function supported(lang: string): SupportedSeoLang {
  return lang in COPY ? (lang as SupportedSeoLang) : 'en'
}

export function seoPageDescription(lang: string, key: SeoCopyKey): string {
  return COPY[supported(lang)].pages[key]
}

export function seoEntityDescription(lang: string, title: string): string {
  return COPY[supported(lang)].entity(title)
}

export function seoImageAlt(lang: string, title: string): string {
  return COPY[supported(lang)].image(title)
}

function comparable(value: string): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/** Avoid labeling an untranslated English overlay as localized metadata. */
export function localizedOrFallback(lang: string, localized: string, english: string, title: string): string {
  if (lang === 'en') return localized || seoEntityDescription(lang, title)
  const local = comparable(localized)
  return local && local !== comparable(english) ? localized : seoEntityDescription(lang, title)
}

export const INDEXABLE_SEO_LANGS = new Set<SupportedSeoLang>(Object.keys(COPY) as SupportedSeoLang[])
