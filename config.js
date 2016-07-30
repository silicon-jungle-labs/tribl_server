module.exports = environment => {
  if (!environment) return {};

  const options = {
    development: {
      mongoUrl: 'mongodb://localhost:27017/tribl',
    },
    production: {
      mongoUrl: 'mongodb://tribl:tiblAdmin@jello.modulusmongo.net:27017/oneNi4my',
    }
  };
  return options[environment];
};
