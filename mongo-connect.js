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
    update: ({ collectionName, doc, query, upsert }) => new Promise((resolve, reject) => {
      connectAndExecute()
      .then(db => {
        db.collection(collectionName).update(query, doc, { upsert })
        .then(() => {
          resolve(true);
          db.close();
        })
        .catch(reject);
      })
      .catch(reject); 
    }), 
    findOne: ({ collectionName, query }) => new Promise((resolve, reject) => {
      connectAndExecute()
      .then(db => {
        db.collection(collectionName).findOne(query)
        .then(foundDoc => {
          resolve(foundDoc);
          db.close();
        })
        .catch(reject);
      })
      .catch(reject); 
    }), 
    find: ({ collectionName, query, returnCursor, projection = {} }) => new Promise((resolve, reject) => {
      connectAndExecute()
      .then(db => {
        const cursor = db.collection(collectionName).find(query, projection);
        cursor.toArray((err, docs) => {
          if (err) {
            reject(err);
          } else {
            resolve(docs);
          }
        });
        db.close();
      })
      .catch(reject); 
    }), 
  };
};
