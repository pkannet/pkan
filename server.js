// 依存モジュールの読み込み
var express = require('express')    // expressモジュールをロード
  , routes = require('./routes')    // routes/index.jsをロード
//  , user = require('./routes/user')
//  , http = require('http')
  , path = require('path');

var app = express();    // expressサーバを生成

// expressサーバの環境設定
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');       // テンプレートエンジンのパス → views
  app.set('view engine', 'jade');               // テンプレートエンジン → jade
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));  // 静的ファイルのパス → public
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// ルーティング
app.get('/', routes.index);     // ルートディレクトリをroutes/index.jsにマッピング
//app.get('/users', user.list);

var io = require('socket.io').listen(app.listen(app.get('port')));

//io.configure(function () {
//    io.set("transports", ["xhr-polling"]);
//    io.set("polling duration", 100);
//});
 
io.sockets.on("connection", function (socket) {
    socket.on("sendMessage", function (text) {
        io.sockets.emit("receiveMessage", {
            message: text, time: new Date().toLocaleTimeString()
        });
    });
});