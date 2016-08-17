const mongoClient = require('./mongo-connect')();
const _  = require('lodash');


const RelationshipsManager = () => {
  const collectionName = 'relationshipsCollection';
  const newUserAction = 'added';
  const wantsToMatchAction = 'wantsToMatch';
  const tribl = 'Tribl';

  this.addNewUser = ({ userY }) => new Promise((resolve, reject) => {
    if (!userY) {
      reject('You must pass a value for userY');
      return false;
    }

    const userX = tribl;
    const action = newUserAction;

    const doc = {
      userX,
      action,
      userY
    };

    doc.relationshipId = `${userX}${action}${userX}`;

    mongoClient.update({
      collectionName
      doc,
      query: {}
      upsert: true,
    })
    .then(() => resolve(true))
    .catch(err => reject(err))
  });

  // Handler for when userX wants to match userY
  this.userWantsToMatch = ({ userX, userY }) => new Promise((resolve, reject) => {
    if (!userY && !userX) {
      reject('You must pass a value for userX and userY');
      return false;
    }

    const action = wantsToMatchAction;

    const doc = {
      userX,
      action,
      userY,
    };

    doc.relationshipId = `${userX}${action}${userX}`;

    mongoClient.update({
      collectionName,
      doc,
      query: {
        relationshipId: doc.relationshipId,
      },
      upsert: true,
    })
    .then(() => resolve(true))
    .catch(err => reject(err))
  });

  this.getRelationshipWithId = ({ relationshipId }) => new Promise((resolve, reject) => {
    mongoClient.findOne({
      collectionName,
      query: {
        relationshipId,
      }
    })
    .then(doc => resolve(doc))
    .catch(err => reject(err))
  }); 

  this.doesUserXLikeUserY = ({ userX, userY }) => new Promise((resolve, reject) => {
    // We check if userX wants to match userY if we can find a doc with id:
    // userX+wantsToMatchAction+userY
    mongoClient.findOne({
      collectionName,
      query: {
        relationshipId: `${userX}${userWantsToMatch}${userY}`,
      }
    })
    .then(doc => resolve({ userX, userY, status: !!doc }))
    .catch(err => reject(err))
  });

  this.getUsersThatWantToMatchUserX = ({ userX }) => new Promise((resolve, reject) => {
    mongoClient.find({
      collectionName,
      query: {
        userY: userX,
        action: wantsToMatchAction,
      },
    })
    .then(docs => resolve(docs))
    .catch(err => reject(err));
  });

  this.getMatchesForUserX = ({ userX }) => new Promise((resolve, reject) => {
    // For userX get all userY's that wantsToMatch with userX
    // Note: userX then becomes the userY for all relationships we're looking for
    this.getUsersThatWantToMatchUserX({userX})
    .then(potentialMatches => {
      return _.map(potentialMatches, potentialMatch => {
        // For all potentialMatches check if userX wants to match too
        return this.doesUserXLikeUserY({ userX, userY: potentialMatch.userX });
      });
    });
    .then(matchesTested => _.filter(matchesTested, match => match.status))
    .then(matches => {
      // return userY ids
      const userYIds = _.map(matches, match => {
        return match.userY
      });
      resolve(userYIds);
    })
    .catch(err => reject(err))
  });
};

// export singleton object for RelationshipManager
const singletonRelationshipManager = new RelationshipsManager();
module.exports = singletonRelationshipManager; 

