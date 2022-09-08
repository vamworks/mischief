function onload() {
    $(document).ready(function() {
        namespace='/test_conn'
        var socket = io('ws://127.0.0.1:5000/test_conn');
        socket.connect();
        //或者使用 var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);
        
        socket.on('server_response', function(res) {
            var msg = res.data;
            console.log(msg);
            document.getElementById("random").innerHTML = '<p>'+msg+'</p>';
        }); 

        $('#bu').click(function(event) {
            console.log(111);
            socket.emit('my_event', {data: 'button-clicked'});
            return false;
            });

        socket.on('my_response', function(e){
            console.log(e.data);
        })

        document.onkeydown=function(e){
            console.log(e.key);
        }
   	});
}