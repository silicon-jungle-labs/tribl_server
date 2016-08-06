const server = require('http').createServer()
  , url = require('url')
  , WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ server })
  , express = require('express')
  , app = express()
  , port = 3030;

const config = require('./config')(process.env.NODE_ENV || 'development');
const mongoClient = require('./mongo-connect')();
const bodyParser = require('body-parser');
const moment = require('moment');

app.use(bodyParser.json()); // for parsing application/json

app.get('/', (req, res) => {
  res.send({ msg: "hello" });
});

app.post('/getMatchesFor/:userId', (req, res) => {
  const { userId } = req.params;
  if (!userId) res.send({ error: 'invalidId' });

  const { body: userAppState } = req;
  if (!userAppState || !userAppState.facebook) res.send({ error: 'invalid userAppState' });
  if (userId !== userAppState.facebook.credentials.userId) res.send({ error: 'access denied' });

  const {
    gender,
    minAge,
    maxAge,
    located,
  } = userAppState.userInfo.lookinFor;

  const query = {};
  query.userInfo.bio.gender = gender;
  query.userInfo.bio.location = located;
  query.userInfo.birthday = {
    $gte: moment().subtract(minAge, 'years').toISOString(),
    $lte: moment().subtract(maxAge, 'years').toISOString(),
  };

  mongoClient.find({ 
    query,
    returnCursor: true,
    collectionName: 'userAppStatesCollection',
  })
  .then(cursor => res.send(cursor)) 
  .catch(err => {
    console.log(`err in hydrateUser ${err}`);
    res.send({error: err });
  });
});

app.get('/hydrateUserAppState/:userId', (req, res) => {
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

app.post('/saveUserAppState/:userId', (req, res) => {
  const { userId } = req.params;
  if (!userId) res.send({ error: 'invalidId' });

  const { body: userAppState } = req;
  if (!userAppState || !userAppState.facebook) res.send({ error: 'invalid userAppState' });
  if (userId !== userAppState.facebook.credentials.userId) res.send({ error: 'access denied' });

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
