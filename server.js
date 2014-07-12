// サーバログ出力 ⇒ console.log
// io.sockets.emit → brooadcast(自分含む)
// socket.broadcast.emit → broadcast(自分除く)
// 配列型のオブジェクトを見えやすく整形→JSON.stringify(xxx)
// 改行コード→String.fromCharCode(13)

// 依存モジュールの読み込み
var express = require('express')    // express.jsをロード
   , routes = require('./routes')    // ./routes/index.jsをロード
   , path = require('path')
;

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

// 環境ごとの設定
// 開発環境(NODE_ENV=development もしくは 指定ない)の場合
app.configure('development', function(){
    app.use(express.errorHandler());
});

// 本番環境(NODE_ENV=production)の場合
app.configure('production', function(){
});

// ルーティング
app.get('/', routes.index);     // ルートディレクトリをroutes/index.jsにマッピング

// socket.ioモジュールをロード
var io = require('socket.io').listen(app.listen(app.get('port')));

// 入室する部屋
var rm;

// クライアントがサーバに接続した時
chat = io.sockets.on('connection', function (socket) {

    // socketの内容をlogに記録
    // console.log('◆socket.handshake◆'+JSON.stringify(socket.handshake));

    // initソケットの挙動
    socket.on('init', function (req) {

        // 入室する部屋の名前をlogに記録
        // console.log('◆req◆' + JSON.stringify(req));

        // roomパラメータを取得
        rm = req.room;

        // 入室
        socket.join(rm);
    });

    // messageソケットの挙動
    socket.on('message', function (message) {

        // 同一の部屋に所属するユーザに発行
        chat.to(rm).emit('message', message);
    });

    // disconnectソケットの挙動
    socket.on('disconnect', function () {

        // 部屋から退出
        socket.leave(rm);
    });
});