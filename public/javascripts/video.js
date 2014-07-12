// videoをRTCでピアツーピア通信する
//
// 1. 接続先候補(ICE)取得＆共有
// 2. オファーSDP(offer)
// 3. アンサーSDP(answer)
//
// Session Description Protocol（SDP）は通信のセッション名やセッションの有効時間などを扱うプロトコル。
// Interactive Connectivity Establishment (ICE)は可能性のある通信経路に関する情報を文字列で表現したもの。

$(function () {

    // ◆変数
    // 使用するデバイスの情報
    videoObj = {
        video: true,
        audio: false
    };

    // 自video表示領域
    localVideo = $("#local-video")[0];

    // 相手先video表示領域
    remoteVideo = $("#remote-video")[0];

    // videoストリーム
    localStream = null;

    // P2P通信
    peerConnection = null;

    // getUserMediaのAPIで使用するメディアの制約
    mediaConstraints = { 'mandatory': { 'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true} };

    textForSendSDP = $("#text-for-send-sdp");
    textForSendICE = $("#text-for-send-ice");
    roomInfo = $("#room-info");
    mylog = $("#my-log");

    iceSeparator = '------ ICE Candidate -------';

    // 改行コード
    CR = String.fromCharCode(13);

    // P2P通信でのNAT越えのために、googleのSTUNサーバを設定
    iceServers = { "iceServers": [{ "url": "stun:stun.l.google.com:19302"}] };

    // P2P通信での制約等
    optionalRtpDataChannels = { "optional": [{ "RtpDataChannels": true}] };

    socketReady = false;
    socket = io.connect();

    // webkit：Chrome
    // moz：FireFox
    // ms：IE

    // getUserMediaのＡＰＩをすべてnavigator.getUserMediaに統一
    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia;

    // window.URLのＡＰＩをすべてwindow.URLに統一
    window.URL = window.URL || window.webkitURL;

    // PeerConnection00(window.webkitPeerConnection00)はDeprecatedなので使用しない
    window.RTCPeerConnection = window.RTCPeerConnection ||
                               window.webkitRTCPeerConnection ||
                               window.mozRTCPeerConnection;

    window.RTCSessionDescription = window.RTCSessionDescription ||
                                   window.webkitRTCSessionDescription ||
                                   window.mozRTCSessionDescription;

    window.RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;

    // カメラの対応状況をチェック
    if (!navigator.getUserMedia) {
        alert("カメラ未対応のブラウザです。");
    }


    // connectソケットの挙動(socketに正常につながった時に呼ばれる）
    socket.on('connect', function onOpened(evt) {

        room = window.prompt('idを入力してください');

        // initソケットを発信(ブラウザ→サーバ)
        // room=[ユーザがプロンプトで入力した値]
        socket.json.emit('init', { 'room': room });

        // room情報を画面表示
        roomInfo.html("入室している部屋：" + room);
        mylog.val(mylog.val() + CR + "◆onOpened");

        // socket.ioフラグをtrue
        socketReady = true;
    });


    // messageソケットの挙動
    socket.on('message', function onMessage(evt) {

        // クライアントが接続候補をサーバに送信した時
        if (evt.type === 'candidate' && peerConnection) {
            onCandidate(evt);

        } else if (evt.type === 'offer') {
            onOffer(evt);

        } else if (evt.type === 'answer' && peerConnection) {
            onAnswer(evt);

        } else if (evt.type === 'user dissconnected' && peerConnection) {
            // videoストリームを切断する
            hangUp();
        }

    });
});


// ビデオ表示スタート
function startVideo() {

    navigator.getUserMedia(
        // 使用するデバイスの情報
        videoObj,

        // 成功時の処理
        function (stream) {

            // 使いまわせるようにグローバル変数に設定
            localStream = stream;

            // video表示領域にvideoストリームを表示
            localVideo.src = window.URL.createObjectURL(stream);
            localVideo.play();
        },

        // 失敗時の処理
        function (err) {
            mylog.val(mylog.val() + CR + "エラーが発生しました。:" + err.name);
        }
    );
}

// ビデオ表示停止
function stopVideo() {

    // 自video表示領域をクリア
    localVideo.src = null;

    // videoストリームを止める
    localStream.stop();
}

// 接続をリクエスト
function connect() {

    // 以下の条件の場合
    // ①接続フラグがfalse ②videoが流れている ③socket.ioフラグがtrue
    if (!peerConnection && localStream && socketReady) {
        // P2P接続開始
        peerConnection = prepareNewConnection();      

    } else {
        if(!socketReady){
            alert("nodeサーバの接続に失敗しました");
        }else if(!localStream){
            alert("まずストリーミングを開始してください。");            
        }
    }
            
    // オファーSDP生成
    peerConnection.createOffer(
    // 成功時
        function (sessionDescription) {
            peerConnection.setLocalDescription(sessionDescription);


            // 自ブラウザのSDP情報を表示
            textForSendSDP.val(JSON.stringify(sessionDescription));

            // messageソケットを発信（ブラウザ → サーバ）
            // type=offer
            socket.json.send(sessionDescription);

        },

    // 失敗時
        function () {
            mylog.val(mylog.val() + CR + "Create Offer failed");
        },

        // メディアの制約
        mediaConstraints
    );

}


// 接続開始
function prepareNewConnection() {

    var peer = null;
    try {
        // P2P通信のインスタンス生成
        peer = new RTCPeerConnection(iceServers,optionalRtpDataChannels);

    } catch (e) {
        mylog.val(mylog.val() + CR + "Failed to create peerConnection, exception: " + e.message);
    }

    // STUNサーバからICE(接続候補)の情報が送信された時のイベント
    peer.onicecandidate = function (evt) {
        if (evt.candidate) {

            // 接続候補（自ブラウザの情報）の設定
            var candidate =
                {
                    type: "candidate",
                    sdpMLineIndex: evt.candidate.sdpMLineIndex,
                    sdpMid: evt.candidate.sdpMid,
                    candidate: evt.candidate.candidate
                };

            // 整形した接続先候補を追加して表示
            textForSendICE.val(textForSendICE.val() + CR + iceSeparator + CR + JSON.stringify(candidate) + CR);

            // messageソケットを発信（ブラウザ → サーバ）
            // socketへ自ブラウザのICE情報を送信
            // type=candidate
            socket.json.send(candidate);

        } else {
            // STUNサーバから接続候補(candidate)の情報が送信されていない場合は何もしない
            //mylog.val("End of candidates. ------------------- phase=" + evt.eventPhase);
        }
    };

    // videoストリームをP2P通信する
    peer.addStream(localStream);

    // P2P通信相手のストリームが追加された時
    peer.onaddstream = function (event) {
        mylog.val(mylog.val() + CR + "◆onRemoteStreamAdded");

        // 自video表示領域を縮小
        //localVideo.animate(
        //    {"width": 50 },"slow"
        //)};
        $("#local-video").removeClass("css-local1");
        $("#local-video").addClass("css-local2");

        // 相手先video表示領域にvideoストリームを表示
        remoteVideo.src = window.URL.createObjectURL(event.stream);
        remoteVideo.play();

    }
 
    // P2P通信相手のストリームが取り消された時
    peer.onremovestream = function(event) {
        mylog.val(mylog.val() + CR + "◆onRemoteStreamRemoved");
        hangUp();
    }
 
    return peer;
}

// クライアントからICE(接続候補)をサーバに送信した後にcallされる
// 他ブラウザのICEを取得
function onCandidate(evt){
    mylog.val(mylog.val() + CR + "◆onCandidate");
    var candidate = new RTCIceCandidate(
        {
            sdpMLineIndex:evt.sdpMLineIndex, 
            sdpMid:evt.sdpMid, 
            candidate:evt.candidate
        });

    // P2P通信に最新の接続候補を設定する
    peerConnection.addIceCandidate(candidate);
}

// クライアントからオファーSDPをサーバに送信した後にcallされる
// 他ブラウザのSDPを取得
function onOffer(evt){
    mylog.val(mylog.val() + CR + "◆onOffer");

    // setOffer
    // P2P通信が未開始であった場合
    if (!peerConnection) {
        mylog.val(mylog.val() + CR + "Peer Not Started");

        // P2P接続開始
        peerConnection = prepareNewConnection();

    }

    // P2P接続先を設定
    peerConnection.setRemoteDescription(new RTCSessionDescription(evt));

    // アンサーSDPを生成
    peerConnection.createAnswer(
        // 成功時
        function (sessionDescription) {
            peerConnection.setLocalDescription(sessionDescription);


            // 自ブラウザのSDP情報を表示
            textForSendSDP.val(JSON.stringify(sessionDescription));

            // messageソケットを発信（ブラウザ → サーバ）
            // type=answer
            socket.json.send(sessionDescription);
         }, 
            
        // 失敗時
        function () {
            mylog.val(mylog.val() + CR + "Create Answer failed");
        },

        // メディアの制約            
        mediaConstraints
    );
}

function onAnswer(evt){
    mylog.val(mylog.val() + CR + "◆onAnswer");

    // P2P接続が未開始であった場合
    if (! peerConnection) {
        mylog.val(mylog.val() + CR + "Peer Not Started");

        return;
    }

    peerConnection.setRemoteDescription(new RTCSessionDescription(evt));
}
 
// videoストリームを切断する
function disconnect() {

    // messageソケットを発信（ブラウザ → サーバ）
    // socketへ自ブラウザのICE情報を送信
    // type="user dissconnected"
    socket.json.send({type:"user dissconnected"});
}

function hangUp(){
    mylog.val(mylog.val() + CR + "◆hangUp");

    peerConnection.close();
    peerConnection = null;

    remoteVideo.src = null;

    // 自video表示領域を拡大
    $("#local-video").removeClass("css-local2");
    $("#local-video").addClass("css-local1");
}
