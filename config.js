module.exports = environment => {
  if (!environment) return {};

  const options = {
    development: {
      mongoUrl: 'mongodb://localhost:27017/tribl',
    },
    production: {
      mongoUrl: 'mongodb://tribl:triblAdmin@jello.modulusmongo.net:27017/te9Tedum',
    }
  };
  return options[environment];
};
