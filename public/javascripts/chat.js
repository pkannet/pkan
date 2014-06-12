$(function () {
    var socket = io.connect();
 
    // receiveMessageソケットの挙動
    socket.on("receiveMessage", function (data) {
        $("#chat").prepend("<li>" + data.time + ": " + data.message + "</li>");
    });
 
    $("#send").click(function () {
        var text = $("#message").val();
 
        $("#message").val("");
 
        // sendMessageソケットを発信（ブラウザ → サーバ）
        socket.emit("sendMessage", text);
    });
});