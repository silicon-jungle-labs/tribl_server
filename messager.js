const mongoClient = require('./mongo-connect')();
const Message = require('./message');
const _  = require('lodash');

class Conversation {
  constructor({ user1Id, user2Id, collectionName }) {
    this._collectionName = collectionName;
    this.conversationId = this._getID({ user1Id, user2Id });
    this.messages = [];
    this.members = [ user1Id, user2Id ];
  }

  isUserAMember({ userId }) {
    return _.indexOf(this.members, userId) !== -1;
  }

  _getID({ user1Id, user2Id }) {
    const isUser1IdSmaller = String(user1Id).localeCompare(String(user2Id)) === -1;

    // if user1Id is smaller, it returns user1Id + user2Id and vice versa
    return isUser1IdSmaller ? `${user1Id}${user2Id}` :  `${user2Id}${user1Id}`;
  }

  getMessages() {
    return mongoClient.findOne({
      collectionName: this._collectionName,
      query: {
        conversationId: this.conversationId
      },
      options: {
        fields: {
          messages: 1,
        },
        sort: {
          timestamp: 1,
        },
      },
    });
  }
}

class Messager {
  constructor() {
    this._collectionName = 'messagerCollection';
  }

  _getID({ user1Id, user2Id }) {
    const isUser1IdSmaller = String(user1Id).localeCompare(String(user2Id)) === -1;

    // if user1Id is smaller, it returns user1Id + user2Id and vice versa
   return isUser1IdSmaller ? `${user1Id}${user2Id}` :  `${user2Id}${user1Id}`;
  }

  newMessage({ text, from , to, conversationId }) {
    const conversation = this;
    const message = new Message({ text, from, to });
    return mongoClient.update({
      collectionName: this._collectionName,
      query: {
        conversationId
      },
      doc: {
        $push: { messages: message }
      }
    })
    .then(() => this.getConversation({ user1Id: from, user2Id: to }));
  }

  newConversation({ user1Id, user2Id }) {
    const { _collectionName: collectionName } = this;
    const conversation = new Conversation({ user1Id, user2Id, collectionName });
    return  mongoClient.update({
      collectionName,
      doc: conversation,
      query: {
        conversationId: conversation.conversationId
      },
      upsert: true,
    })
    .then(() => conversation);
  }

  getConversationsForUser({ userId }) {
    return mongoClient.find({
      collectionName: this._collectionName,
      query: {
        members: {
          $in: [
            userId
          ] 
        }
      }
    });
  }

  getConversation({ user1Id, user2Id }) {
    const conversationId = this._getID({ user1Id, user2Id });
    return mongoClient.findOne({
      collectionName: this._collectionName,
      query: {
        conversationId,
      }
    });
  }

}

module.exports = new Messager();
