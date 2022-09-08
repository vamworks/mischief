$( document ).ready(function() {
    let video = document.querySelector("#videoElement");

    if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
        video.srcObject = stream;
        })
        .catch(function (err0r) {
        console.log("Something went wrong!");
        });
    }

    video = document.querySelector('video'),
    //  filters = ['noir','bluefill'];
    
    video.style.webkitFilter='url(#bluefill)';
    video.style.mozFilter='url(#bluefill)';
    video.style.filter='url(#bluefill)';
});