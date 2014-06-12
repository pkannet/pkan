// 依存モジュールの読み込み
var express = require('express')    // expressモジュールをロード
   ,routes = require('./routes')    // routesのパスをロード
   ,path = require('path');

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

// socket.ioモジュールをロード
var io = require('socket.io').listen(app.listen(app.get('port')));

io.sockets.on("connection", function (socket) {

    // sendMessageソケットの挙動
    socket.on("sendMessage", function (text) {

        // receiveMessageソケットを発信（サーバ → ブラウザ）
        io.sockets.emit("receiveMessage", {
             message: text
            ,time:    new Date().toLocaleTimeString()
        });

    });
});