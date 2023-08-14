import { gql } from 'apollo-server-express';

import BomNotes from './BomNotes';
import BomPage from './BomPage';
import BomUser from './BomUser';
import BomUtils from './BomUtils';
import BomPeoplePlaces from './BomPeoplePlaces';
import BomCommunity from './BomCommunity';

const linkedSchema = gql`
  type Query {
    _: Boolean
  }
  type Mutation {
    _: Boolean
  }
`;
export default [BomNotes, BomPage, BomPeoplePlaces, BomUser, BomUtils,BomNotes,BomCommunity,linkedSchema]; //
