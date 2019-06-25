var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var port = 27020;
var convertQuality = "85";

var spawn = require('child_process').spawn;
var proc;
var _compressing = false;

app.use('/', express.static(path.join(__dirname, 'stream')));


app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var sockets = {};

io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);

  socket.on('disconnect', function() {
    delete sockets[socket.id];

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
      app.set('watchingFile', false);
      if (proc) proc.kill();
      fs.unwatchFile('./stream/image_stream.jpg');
      fs.unwatchFile('./stream/compressed.jpg');
    }
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

});

http.listen(port, function() {
  console.log('listening on *: '+port);
});

function stopStreaming() {
  if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
  }
}

function startStreaming(io) {

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', 'compressed.jpg?_t=' + (Math.random() * 100000));
    return;
  }

  var args = ["-w", "640", "-h", "480", "-o", "./stream/image_stream.jpg", "-t", "999999999", "-tl", "100"];

  if(!_compressing){
    proc = spawn('raspistill', args);
  }

  console.log('Watching for changes...');

  app.set('watchingFile', true);

  fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
    console.log('compressing...');
    _compressing = true;
    spawn('convert',
      [
        "/var/www/pi_livestreaming/stream/image_stream.jpg",
        "-quality",
        convertQuality,
        "-resize",
        "640x480\\>",
        "./stream/compressed.jpg"
      ]);
  });

  fs.watchFile('./stream/compressed.jpg', function(c, p){
    console.log('compressed...');
    _compressing = false;
    io.sockets.emit('liveStream', 'compressed.jpg?_t=' + (Math.random() * 100000));
  });

}
