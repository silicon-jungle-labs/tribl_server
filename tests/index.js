var server = require('./server.js');
var http = require('http');
var assert = require('assert');

before(function () {
    server.listen(8888);
});

after(function () {
    server.close();
});

it('should return 200', function (done) {
    http.get('http://localhost:8888', function (res) {
        assert.equal(res.statusCode, '200');
        done();
    });
});

it('should say Hello World\n', function (done) {
    http.get('http://localhost:8888', function (res) {
        var data = '';
        res.on('data', function (chunk) {
            data += chunk;
        });
        res.on('end', function () {
            assert.equal(data, "Hello World!\n");
            done();
        });
    });
});
