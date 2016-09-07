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
        'userAppState.facebook.credentials.userId': 1,
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
  .then(res => res.json({ success: 'success' }))
  .catch(err => res.json({ error: err }))
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
