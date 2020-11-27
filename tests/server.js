var http = require('http');

var server = http.createServer(function (req, res) {
    console.log('Received request');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Hello World!\n');
    res.end()
});

var listen = function (port) {
    server.listen(port, function() {
        console.log('Listening on port: ' + port);
    });
};


var close = function () {
    server.close(function(){
        console.log('Closing connection!');
    });
};

module.exports.listen = listen;
module.exports.close = close;
