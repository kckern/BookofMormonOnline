import { gql } from 'apollo-server-express';

export default gql`
# -----------------------------------------------
# QUERIES
# -----------------------------------------------
extend type Query {
    person(slug: [String]): [People]
    people(slug: [String]): [People]
    peoplenetwork: PeopleNetwork

    place(slug: [String]): [Place]
    places(map: [String]): [Place]
    maps(slug: [String]): [Map]
    mapstory(slug: String,map: String): [MapStory]
    mapstories(map: [String]!): [MapStory]
    timeline(slug: [String]): [Event]
}




  # -----------------------------------------------
  # TYPES
  # -----------------------------------------------

  type People {
    guid: String
    slug: String
    name: String
    title: String
    classification: String
    identification: String
    unit: String
    date: String
    description: String
    index: [Index]
    relations: [Relation]
  }
  type Relation {
    relation: String
    person: People
  }
  type PeopleNode {
    name: String
    slug: String
    title: String
    group: String
    cluster: String
    classif: String
    radius: Float
    degree: Float
    fill: String
    stroke: String
    charge: Float
    guid: String
    unit: String
  }
  type PeopleLink {
    guid: String
    source: Int
    target: Int
    value: Float
    strokeWidth: Float
    strokeColor: String
    charge: Float
  }
  type PeopleNetwork {
    nodes: [PeopleNode]
    links: [PeopleLink]
  }
  type Place {
    guid: String
    slug: String
    name: String
    aka: String
    info: String
    label: String
    icon: String
    occupants: String
    type: String
    location: String
    description: String
    w: Int
    h: Int
    ax: Int
    ay: Int
    minZoom: Int
    maxZoom: Int
    lat: Float
    lng: Float
    index: [Index]
    maps: [Map]
  }
  type Map {
    name: String
    slug: String
    desc: String
    group: String
    centerx: Float
    centery: Float
    minzoom: Int
    maxzoom: Int
    zoom: Int
    tiles: Boolean
    places: [Place]
  }

  type Index {
    pkey: String
    type: String
    slug: String
    ref: String
    verse_id: String
    verse_id_end: String
    text: String
  }

  type MapStory {
    slug: String
    guid: String
    title: String
    description: String
    moves: [MapMove]
  }
  type MapMove {
    guid: String
    seq: Int
    start: String
    startPlace: Place
    end: String
    endPlace: Place
    travelers: String
    people: [People]
    duration: String
    description: String
    verse_ids: [Int]
  }


`;
