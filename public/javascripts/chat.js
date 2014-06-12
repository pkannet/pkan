$(function () {
    var socket = io.connect();
 
    socket.on("receiveMessage", function (data) {
        $("#chat").prepend("<li>" + data.time + ": " + data.message + "</li>");
    });
 
    $("#send").click(function () {
        var text = $("#message").val();
 
        $("#message").val("");
 
        socket.emit("sendMessage", text);
    });
});