// socket.ioフラグ
var socketReady = false;
//var socket = io.connect();

// connectソケットの挙動
socket.on('connect', function onOpened(evt){
    // socket.ioフラグをtrue
    socketReady = true;
});


// messageソケットの挙動
socket.on('message', function onMessage(evt) {

    // クライアントが接続候補をサーバに送信した時
    if (evt.type === 'candidate' && peerStarted) {
        onCandidate(evt);

    } else if (evt.type === 'offer') {
        onOffer(evt);

    } else if (evt.type === 'answer' && peerStarted) {
        onAnswer(evt);

    } else if (evt.type === 'user dissconnected' && peerStarted) {
        // videoストリームを切断する
        hangUp();
    }
});


