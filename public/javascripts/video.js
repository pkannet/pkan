// videoをRTCでピアツーピア通信する
//
// 1. 接続先候補(candidate)
// 2. オファーSDP(offer)
// 3. アンサーSDP(answer)
//
// Session Description Protocol（SDP）は通信のセッション名やセッションの有効時間などを扱うプロトコル。
//

$(function () {

    // ◆変数
    // 使用するデバイスの情報
    videoObj = {
        video: true,
        audio: false
    };

    // 自video表示領域
    localVideo = $("#local-video").get(0);

    // 相手先video表示領域
    remoteVideo = $("#remote-video").get(0);

    // videoストリーム
    localStream = null;

    // P2P通信
    peerConnection = null;

    // 接続フラグ
    peerStarted = false;

    mediaConstraints = { 'mandatory': { 'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true} };

    textForSendSDP = $("#text-for-send-sdp");
    //textToReceiveSDP = $("#text-for-receive-sdp");
    textForSendICE = $("#text-for-send-ice");
    //textToReceiveICE = $("#text-for-receive-ice");
    mylog = $("#my-log");

    iceSeparator = '------ ICE Candidate -------';

    // 改行コード
    CR = String.fromCharCode(13);

    // P2P通信でのNAT越えのために、googleのSTUNサーバを設定
    peerConnectionConfig = { "iceServers": [{ "url": "stun:stun.l.google.com:19302"}] };

    // P2P通信での制約等
    peerDataConnectionConfig = { "optional": [{ "RtpDataChannels": true}] };

    socketReady = false;
    socket = io.connect();


    // webkit：Chrome
    // moz：FireFox
    // ms：IE

    // getUserMediaのＡＰＩをすべてnavigator.getUserMediaに統一
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    // window.URLのＡＰＩをすべてwindow.URLに統一
    window.URL = window.URL || window.webkitURL;

    window.RTCPeerConnection = window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

    window.RTCSessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;

    window.RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;

    // カメラの対応状況をチェック
    if (!navigator.getUserMedia) {
        alert("カメラ未対応のブラウザです。");
    }


    // connectソケットの挙動(socketに正常につながった時に呼ばれる）
    socket.on('connect', function onOpened(evt) {
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
});


// ビデオ表示スタート
function startVideo() {

    navigator.getUserMedia(
        // 使用するデバイスの情報
        videoObj,

        // 成功時の処理
        function (stream) {
            localStream = stream;

            // video表示領域にvideoストリームを表示
            localVideo.src = window.URL.createObjectURL(stream);
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
    localVideo.src = "";

    // videoストリームを止める
    localStream.stop();
}

// 接続をリクエスト
function connect() {

    // 以下の条件の場合
    // ①接続フラグがfalse ②videoが流れている ③socket.ioフラグがtrue
    if (!peerStarted && localStream && socketReady) {

        // P2P接続開始
        peerConnection = prepareNewConnection();
      
        // オファーSDP生成
        peerConnection.createOffer(
        // 成功時
            function (sessionDescription) {
                peerConnection.setLocalDescription(sessionDescription);

                // sendSDP(sessionDescription);
                // 自ブラウザのSDP情報整形
                var text = JSON.stringify(sessionDescription);

                // 自ブラウザのSDP情報を表示
                textForSendSDP.val(text);
                textForSendSDP.focus();
                textForSendSDP.select();

                // messageソケットを発信（ブラウザ → サーバ）
                // type=offer
                socket.json.send(sessionDescription);
            },

        // 失敗時
            function () {
                mylog.val(mylog.val() + CR + "Create Offer failed");
            },

            mediaConstraints
        );

        // 接続フラグをtrue
        peerStarted = true;

    } else {
        alert("まずストリーミングを開始してください。");
    }
}


// 接続開始
function prepareNewConnection() {

    var peer = null;
    try {
        // P2P通信のインスタンス生成
        peer = new RTCPeerConnection(peerConnectionConfig,peerDataConnectionConfig);

    } catch (e) {
        mylog.val(mylog.val() + CR + "Failed to create peerConnection, exception: " + e.message);
    }

    // STUNサーバから接続候補(candidate)の情報が送信される
    peer.onicecandidate = function (evt) {
        if (evt.candidate) {

            /*
            sendCandidate(
            {
            type: "candidate",
            sdpMLineIndex: evt.candidate.sdpMLineIndex,
            sdpMid: evt.candidate.sdpMid,
            candidate: evt.candidate.candidate
            }
            );
            */

            // 接続候補（自ブラウザの情報）の設定
            var candidate =
                {
                    type: "candidate",
                    sdpMLineIndex: evt.candidate.sdpMLineIndex,
                    sdpMid: evt.candidate.sdpMid,
                    candidate: evt.candidate.candidate
                };
            // 接続先候補情報を整形
            var text = JSON.stringify(candidate);

            // 整形した接続先候補を追加して表示
            textForSendICE.val(textForSendICE.val() + CR + iceSeparator + CR + text + CR);
            textForSendICE.scrollTop = textForSendICE.scrollHeight;

            // messageソケットを発信（ブラウザ → サーバ）
            // type=candidate
            socket.json.send(candidate);

        } else {
            // STUNサーバから接続候補(candidate)の情報が送信されていない場合は何もしない
            //mylog.val("End of candidates. ------------------- phase=" + evt.eventPhase);
        }
    };

    // videoストリームをP2P通信する
    peer.addStream(localStream);

    // P2P通信のイベントリスナ
    peer.addEventListener("addstream", onRemoteStreamAdded, false);      // P2P通信相手のストリームが追加された時
    peer.addEventListener("removestream", onRemoteStreamRemoved, false); // P2P通信相手のストリームが取り消された時
 
    // P2P通信相手のストリームが追加された時
    function onRemoteStreamAdded(event) {
        // 相手先video表示領域にvideoストリームを表示
        remoteVideo.src = window.URL.createObjectURL(event.stream);
    }
 
    // P2P通信相手のストリームが取り消された時
    function onRemoteStreamRemoved(event) {
        // 相手先video表示領域をクリア
        remoteVideo.src = "";
    }
 
    return peer;
}

// クライアントから接続候補をサーバに送信した後にcallされる
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

function onOffer(evt){
    mylog.val(mylog.val() + CR + "◆onOffer");

    // setOffer
    // P2P通信が未開始であった場合
    if (!peerConnection) {
        mylog.val(mylog.val() + CR + "peerConnection alreay exist!");
    // P2P接続開始
    peerConnection = prepareNewConnection();
    }


    // P2P接続先を設定
    peerConnection.setRemoteDescription(new RTCSessionDescription(evt));

    // sendAnswer
    // P2P接続が未開始であった場合
    if (! peerConnection) {
        mylog.val(mylog.val() + CR + "peerConnection NOT exist!");
    }

    // アンサーSDPを生成
    peerConnection.createAnswer(
        // 成功時
        function (sessionDescription) {
            peerConnection.setLocalDescription(sessionDescription);

            // sendSDP(sessionDescription);
            // 自ブラウザのSDP情報整形
            var text = JSON.stringify(sessionDescription);

            // 自ブラウザのSDP情報を表示
            textForSendSDP.val(text);
            textForSendSDP.focus();
            textForSendSDP.select();

            // messageソケットを発信（ブラウザ → サーバ）
            // type=answer
            socket.json.send(sessionDescription);
         }, 
            
        // 失敗時
        function () {
            mylog.val(mylog.val() + CR + "Create Answer failed");
        },
            
        mediaConstraints
    );

    peerStarted = true;
}

function onAnswer(evt){
    mylog.val(mylog.val() + CR + "◆onAnswer");

    // P2P接続が未開始であった場合
    if (! peerConnection) {
        mylog.val(mylog.val() + CR + "peerConnection NOT exist!");
    }

    peerConnection.setRemoteDescription(new RTCSessionDescription(evt));
}
 
// videoストリームを切断する
function hangUp() {
    mylog.val(mylog.val() + CR + "◆hangUp");

    peerConnection.close();
    peerConnection = null;
    peerStarted = false;    

}

/*
function sendCandidate(candidate){
    var text = JSON.stringify(candidate);
    textForSendICE.val(textForSendICE.val() + CR + iceSeparator + CR + text + CR);
    textForSendICE.scrollTop = textForSendICE.scrollHeight;

    socket.json.send(candidate);
}
*/

/*
// SDP送信
function sendSDP(sdp) {
    // 自ブラウザのSDP情報整形
    var text = JSON.stringify(sdp);

    // 自ブラウザのSDP情報を表示
  	textForSendSDP.val(text);
	textForSendSDP.focus();
	textForSendSDP.select();

	socket.json.send(sdp);
}
*/

/*
// SDP取得
function onSDP() {
    var text = textToReceiveSDP.val();
    var evt = JSON.parse(text);

    if (peerConnection) {
        onAnswer(evt);
	  
	    textForSendICE.focus();
	    textForSendICE.select();
    } else {
        onOffer(evt);
    }
    
    textToReceiveSDP.val("");
}
*/

/*
//--- multi ICE candidate ---
function onICE() {
    var text = textToReceiveICE.val();
    var arr = text.split(iceSeparator);
    for (var i = 1, len = arr.length; i < len; i++) {
        var evt = JSON.parse(arr[i]);

        onCandidate(evt);
    }
 
    textToReceiveICE.val("");
	textForSendICE.focus();
	textForSendICE.select();
}
*/

/*
function stop() {
    peerConnection.close();
    peerConnection = null;
    peerStarted = false;    

}
*/ 

