const MongoClient = require('mongodb').MongoClient;
const config = require('./config')(process.env.NODE_ENV || 'development');

const connectAndExecute = () => new Promise((resolve, reject) => {
  MongoClient.connect(config.mongoUrl, (err, db) => {
    if (!err) {
      resolve(db);
    } else {
      reject(err);
    }
  }); 
});

module.exports = () => {
  return {
    insert: ({ collectionName, doc }) => new Promise((resolve, reject) => {
      connectAndExecute()
      .then(db => {
        db.collection(collectionName).insert(doc)
        .then(() => {
          resolve(true);
          db.close();
        })
        .catch(reject);
      })
      .catch(reject); 
    }), 
    findOne: ({ collectionName, doc }) => new Promise((resolve, reject) => {
      connectAndExecute()
      .then(db => {
        db.collection(collectionName).findOne(doc)
        .then(foundDoc => {
          resolve(foundDoc);
          db.close();
        })
        .catch(reject);
      })
      .catch(reject); 
    }), 
  };
};
