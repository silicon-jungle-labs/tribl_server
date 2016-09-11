const server = require('http').createServer()
  , url = require('url')
  , WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ server })
  , express = require('express')
  , app = express()
  , util = require('util')
  , RelationshipsManager = require('./relationships-manager')
  , port = (process.env.NODE_ENV !== 'production') ? 3030 : process.env.PORT;

console.log(`Port is: ${port} and env is ${process.env.NODE_ENV}`);

const config = require('./config')(process.env.NODE_ENV || 'development');
const mongoClient = require('./mongo-connect')();
const bodyParser = require('body-parser');
const moment = require('moment');
const Messager = require('./messager');

app.use(bodyParser.json()); // for parsing application/json

app.get('/', (req, res) => {
  res.send({ msg: "hello" });
});

// Get matches for a specific user
app.post('/getMatchesFor/:userId', (req, res) => {
  const { userId } = req.params;
  if (!userId) res.send({ error: 'invalidId' });

  const { body: userAppState } = req;
  if (!userAppState || !userAppState.facebook) res.send({ error: 'invalid userAppState' });
  if (userId !== userAppState.facebook.credentials.userId) res.send({ error: 'access denied' });

  RelationshipsManager.getMatchesForUserX({ userX: userId })
  .then(documents => res.json({ docs: documents })) 
  .catch(err => {
    console.log(`err in hydrateUser ${err}`);
    res.json({error: err });
  });
});

app.get('/getPotentialMatchesForUserX/:userX', (req, res) => {
  const { userX } = req.params;
  if (!userX) res.send({ error: 'invalidId' });
  RelationshipsManager.getPotentialMatchesForUserX({ userX })
  .then(documents => res.json({ docs: documents })) 
  .catch(err => {
    console.log(`err in getPotentialMatchesForUserX ${err}`);
    res.json({error: err });
  });
});

app.get('/getUserDetails/:userId', (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    res.send({ error: 'invalidId' });
    return false;
  }

  //TODO: Restrict facebook credentials field
  mongoClient.findOne({ 
    collectionName: 'userAppStatesCollection',
    query: {
      _id: userId,
    },
    options: {
      fields: {
        _id: 0,
        'userAppState.userInfo': 1,
        'userAppState.profilePictures.chosenPhotos': 1,
        'userAppState.facebook.credentials': 1,
      }
    }
  })
  .then(userDetails => {
    res.json(userDetails)
  })
  .catch(err => {
    console.log(`err in hydrateUser ${err}`);
    res.send({error: err });
  });
});

app.get('/hydrateUserAppState/:userId/', (req, res) => {
  const { userId } = req.params;
  if (!userId) res.send({ error: 'invalidId' });

  mongoClient.findOne({ 
    collectionName: 'userAppStatesCollection',
    query: {
      _id: userId,
    }
  })
  .then(userAppState => {
    res.json(userAppState)
  })
  .catch(err => {
    console.log(`err in hydrateUser ${err}`);
    res.send({error: err });
  });
});

app.get('/userxWantsToMatchUserY/:userX/:userY', (req, res) => {
  const { userX, userY } = req.params;
  if (!userX && ! userY) {
    res.json({ err: 'invalid parameters' });
    return false;
  }

  RelationshipsManager.userXWantsToMatchUserY({ userX, userY })
  .then(() => RelationshipsManager.isMutualMatch({ userX, userY }))
  .then(isMutualMatch => {
    // if it's a mutual match, go ahead and create a new Conversation
    if (isMutualMatch) Messager.newConversation({ user1Id: userX, user2Id: userY });
    return isMutualMatch;
  })
  .then(isMutualMatch => res.json({ isMutualMatch }))
  .catch(err => {
    console.log(err);
    res.json({ error: err })
  })
});

app.post('/saveUserAppState/:userId/:firstTime?', (req, res) => {
  const { userId, firstTime } = req.params;
  if (!userId) res.send({ error: 'invalidId' });

  const { body: userAppState } = req;
  if (!userAppState || !userAppState.facebook) res.send({ error: 'invalid userAppState' });
  if (userId !== userAppState.facebook.credentials.userId) res.send({ error: 'access denied' });

  if (firstTime === 'true') {
    console.log('first time true');
    RelationshipsManager.addNewUser({
      userY: userId
    })
  }
  mongoClient.update({ 
    query: { _id: userAppState.facebook.credentials.userId },
    collectionName: 'userAppStatesCollection',
    doc: {
      userAppState,
    },
    upsert: true,
  })
  .then(userAppState => {
    res.send({ success: 'success' })
  })
  .catch(err => {
    res.send({error: err });
  });
});

app.get('/newMessage/:from/:to/:text', (req, res) => {
  const { from, to, text } = req.params;
  // const { body: text } = req;
  if (!from && !to && !text) {
    res.send({ error: 'invalid parameters' });
    return false;
  }

  Messager.getConversation({ user1Id: from, user2Id: to })
  .then(conversation => {
    if (!conversation) {
      Messager.newConversation({ user1Id: from, user2Id: to })
      .then(newConversation => {
        return Messager.newMessage({ from, to, text, conversationId: newConversation.conversationId })
      })
      .then(newConversation => {
        res.json({ conversation: newConversation })
        clientSocketConnection.send(
          JSON.stringify({type: newConversation.conversationId, conversation })
        );
      })
    } else {
      const { conversationId } = conversation;
      Messager.newMessage({ from, to, text, conversationId })
      .then(newConversation => {
        res.json({ conversation: newConversation })
        clientSocketConnection.send(
          JSON.stringify({type: newConversation.conversationId, conversation })
        );
      })
    }
  })
  .catch(err => {
    console.log(err);
    res.send({error: err });
  });
});

app.get('/getConversationsForUser/:userId', (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    res.send({ error: 'invalidId' });
    return false;
  }

  Messager.getConversationsForUser({ userId })
  .then(conversations => res.json({ conversations }))
  .catch(err => {
    res.send({error: err });
  });
});

app.get('/getConversationBetween/:user1Id/:user2Id', (req, res) => {
  const { user1Id, user2Id } = req.params;
  if (!user1Id && !user2Id) {
    res.send({ error: 'invalidId' });
    return false;
  }
  Messager.getConversation({ user1Id, user2Id })
  .then(conversation => res.json({ conversation }))
  .catch(err => {
    res.send({error: err });
  });
});

const hydrateUser = ({ userId, ws }) => {
  mongoClient.findOne({ 
    collectionName: 'userAppStatesCollection',
    query: {
      _id: userId,
    }
  })
  .then(userAppState => {
    ws.send(
      JSON.stringify({type: 'hydrateUserAppState', userAppState })
    );
  })
  .catch(err => {
    res.send({error: err });
  });
};

const newUser = ({ userId, ws, userAppState }) => {
  mongoClient.insert({ 
    collectionName: 'userAppStatesCollection',
    doc: {
      _id: userId,
      userAppState,
    }
  })
  .then(() => {
    console.log('created user')
  })
  .catch(err => {
    console.log(`err in newUser ${err}`);
  });
};

wss.on('connection', ws => {
  clientSocketConnection = ws;
  ws.on('message', message => {
    const payload = JSON.parse(message.data);
    const { userId } = payload;
    switch(payload.type) {
      case 'hydrate': 
        hydrateUser({ userId, ws });
        break;
      case 'newUser': 
        const { userAppState } = payload;
        newUser({ userId, ws, userAppState });
        break;
      default: 
        break;
    }
  });
});

server.on('request', app);
server.listen(port, () => {
  console.log('Listening on ' + server.address().port)
});
