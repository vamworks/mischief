$( document ).ready(function(){
    $("body").append($("<button id = 'b1'>This is me</button>"));
    $("#b1").click(function(){
        console.log('clicked');
        $.get("/server/?a=111&b=222&c=445f", function(r){
            const response = r;
            console.log(response);
        });
    });
});