import * as THREE from 'three';
import { OrbitControls } from '/static/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/static/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from '/static/three/examples/jsm/environments/RoomEnvironment.js';

let scene, camera, renderer, controls, mixer, clock, model;
let clip_a, clip_b, clip_c, clip_d, clip_e, clip_f, clip_g, clip_h, clip_o, clip_x, clip_sil, animationActions;
let PollyJSON, createAnimationActions, timerPlay;
let aniRoutineId, aniFocusId, aniRoutineDirection, aniFocusedMovementId, focusMovementTimeoutId;
let BImageGroup, plane, BImageTargetX, BImageTargetY, BImageTargetZ, moveBImageIntoBrainId, BImageFadeInId, BrainCenter, getBrainImageId, loadBrainImagesCount, loadBrainImagesId;
let human_logos = [], human_logos_partial;

THREE.Cache.enabled = true;

/**========================================================================
 *                          Main Program Entrance
*========================================================================**/

(()=>{
    // init
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3.8;
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    clock = new THREE.Clock();

    // OrbitControls
    // controls = new OrbitControls(camera, renderer.domElement);

    // axesHelper
    // const axesHelper = new THREE.AxesHelper( 5 );
    // scene.add( axesHelper );

    // environment
    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator( renderer );
    scene.background = new THREE.Color( 0x000000);
    scene.environment = pmremGenerator.fromScene( environment ).texture;
    

    // GLTF Model
    const gltfLoder = new GLTFLoader();
    gltfLoder.load('/static/head_2-2-1.glb',(gltfScene)=>{
        model = gltfScene.scene;
        model.traverse((node) => {
          if (!node.isMesh) return;
          node.material.wireframe = true;
        });
        scene.add(model);

        //adjusting models default position and rotation
        model.position.z = 0.6;
        model.rotation.y = 0.1;
        model.rotation.x = 0.05;

        // rest operations
        manageAnimations(model, gltfScene.animations);
    });

    // initial data of speech marks from Polly; data for testing; real time data will get from Polly
    PollyJSON = [
        {"time":162,"type":"viseme","value":"r"},
        {"time":275,"type":"viseme","value":"i"},
        {"time":362,"type":"viseme","value":"t"},
        {"time":412,"type":"viseme","value":"k"},
        {"time":500,"type":"viseme","value":"O"},
        {"time":562,"type":"viseme","value":"t"},
        {"time":650,"type":"viseme","value":"t"},
        {"time":700,"type":"viseme","value":"i"},
        {"time":737,"type":"viseme","value":"t"},
        {"time":787,"type":"viseme","value":"@"},
        {"time":850,"type":"viseme","value":"f"},
        {"time":975,"type":"viseme","value":"e"},
        {"time":1100,"type":"viseme","value":"f"},
        {"time":1175,"type":"viseme","value":"E"},
        {"time":1275,"type":"viseme","value":"@"},
        {"time":1312,"type":"viseme","value":"t"},
        {"time":1350,"type":"viseme","value":"t"},
        {"time":1387,"type":"viseme","value":"p"},
        {"time":1450,"type":"viseme","value":"u"},
        {"time":1525,"type":"viseme","value":"k"},
        {"time":1575,"type":"viseme","value":"t"},
        {"time":1612,"type":"viseme","value":"k"},
        {"time":1637,"type":"viseme","value":"E"},
        {"time":1687,"type":"viseme","value":"f"},
        {"time":1812,"type":"viseme","value":"r"},
        {"time":1875,"type":"viseme","value":"E"},
        {"time":1937,"type":"viseme","value":"t"},
        {"time":1975,"type":"viseme","value":"t"},
        {"time":2000,"type":"viseme","value":"t"},
        {"time":2037,"type":"viseme","value":"u"},
        {"time":2075,"type":"viseme","value":"k"},
        {"time":2112,"type":"viseme","value":"E"},
        {"time":2150,"type":"viseme","value":"t"},
        {"time":2225,"type":"viseme","value":"p"},
        {"time":2287,"type":"viseme","value":"t"},
        {"time":2350,"type":"viseme","value":"a"},
        {"time":2387,"type":"viseme","value":"r"},
        {"time":2487,"type":"viseme","value":"e"},
        {"time":2525,"type":"viseme","value":"t"},
        {"time":2575,"type":"viseme","value":"T"},
        {"time":2612,"type":"viseme","value":"@"},
        {"time":2650,"type":"viseme","value":"p"},
        {"time":2737,"type":"viseme","value":"u"},
        {"time":2900,"type":"viseme","value":"k"},
        {"time":3037,"type":"viseme","value":"sil"}
    ];
  
    // Viseme to lip clip name
    let VisemeToLip = (visime)=>{
        const dict = {
            'p':'clip_a',
            'S':'clip_b',
            'T':'clip_b',
            'f':'clip_g',
            'k':'clip_b',
            'i':'clip_d',
            't':'clip_e',
            'r':'clip_b',
            's':'clip_b',
            'u':'clip_b',
            '@':'clip_d',
            'a':'clip_c',
            'e':'clip_d',
            'E':'clip_c',
            'o':'clip_e',
            'O':'clip_h',
            'u':'clip_f',
            'sil':'clip_sil'
        };
        return dict[visime];
    };

    createAnimationActions = function(PollyJSON){
        const actions = [];
        
        for(let i = 0; i<PollyJSON.length; i++){
            let this_time, next_time, duration;
            this_time = PollyJSON[i].time;
            if(i+1 < PollyJSON.length){
                next_time = PollyJSON[i+1].time;
            }else{
                next_time = PollyJSON[i].time + 100;
            }
            duration = (next_time - this_time)/1000;
            const animation = {...eval(VisemeToLip(PollyJSON[i].value))};
            const action = mixer.clipAction(animation);
            action.setLoop(THREE.LoopOnce);
            action.setDuration(duration);
            // action.setEffectiveTimeScale(animation.duration/duration);
            actions.push(action);
        }
        
        return actions;
    };
    
    //manage lip-sync animations
    let manageAnimations = (model, animations)=>{
        // mixer & animations from gltf
        mixer = new THREE.AnimationMixer( model );
        mixer.addEventListener("finished",( event ) => {
            //console.log( 'Finished animation action:'+actionBePlaying);
        });

        clip_a = THREE.AnimationClip.findByName( animations, 'a' );
        clip_b = THREE.AnimationClip.findByName( animations, 'b' );
        clip_c = THREE.AnimationClip.findByName( animations, 'c' );
        clip_d = THREE.AnimationClip.findByName( animations, 'd' );
        clip_e = THREE.AnimationClip.findByName( animations, 'e' );
        clip_f = THREE.AnimationClip.findByName( animations, 'f' );
        clip_g = THREE.AnimationClip.findByName( animations, 'g' );
        clip_h = THREE.AnimationClip.findByName( animations, 'h' );
        clip_o = THREE.AnimationClip.findByName( animations, 'o' );
        clip_x = THREE.AnimationClip.findByName( animations, 'x' );
        clip_sil = THREE.AnimationClip.findByName( animations, 'sil' );

        // Allocate each animation to each timer
        timerPlay = function(){
            for(let i=0; i < PollyJSON.length; i++){
                //console.log(PollyJSON[i].time)
                setTimeout(function(){
                    animationActions[i].reset().play();
                    // console.log(PollyJSON[i].time);
                }, PollyJSON[i].time);
            }
        };
        
        aniRoutine();
        
        buttonEvent(animations);
        
    };

    renderer.setAnimationLoop( () => {
        const delta = clock.getDelta();
        if ( mixer ) {
            mixer.update( delta );
        }
    });
    
    // Brain images 
    BrainCenter = new THREE.Vector3(0, 1.3, -0.7);
    BImageGroup = new THREE.Group();
    BImageGroup.position.set(BrainCenter.x, BrainCenter.y, BrainCenter.z);
    scene.add(BImageGroup);
    BImageGroupRotate();
})();

/**========================================================================
 *                           Brain Images Functions
 *========================================================================**/

// Brain images group ratation
function BImageGroupRotate(){
    requestAnimationFrame(BImageGroupRotate);
    BImageGroup.rotation.y += 0.01;
}

// Create one brain image
function createBImage(imageName){
    function getBImagesPositionX(){
        const x_min = 0.4;
        const x_max = 0.7;
        const x_range = x_max - x_min;
        let x_rand;
    
        x_rand = Math.round((x_min+((x_max-x_min) * Math.random()))*100)/100;
        if (Math.random()>0.5){
            x_rand = x_rand;
        }else{
            x_rand = -x_rand;
        }
        return x_rand;
    }
    
    function getBImagesPositionY(){
        const y_min = 0;
        const y_max = 0.3;
        let y_rand;
    
        y_rand = Math.round((y_min+((y_max-y_min) * Math.random()))*100)/100;
        if (Math.random()>0.5){
            y_rand = y_rand;
        }else{
            y_rand = -y_rand;
        }
        return y_rand;
    }

    const geometry = new THREE.PlaneGeometry( 0.5, 0.5 );
    const texture = new THREE.TextureLoader().load('/static/brain_images/selected_images/'+imageName);
    // const material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide, transparent:true} );
    const material = new THREE.MeshBasicMaterial( {map: texture} );
    material.transparent = true;
    material.opacity = 0;
    material.side = THREE.DoubleSide;
    plane = new THREE.Mesh( geometry, material );
    scene.add( plane );
    plane.position.x = getBImagesPositionX();
    plane.position.y = getBImagesPositionY();
    plane.position.z = 3;

    // Brain Images posision range:
    // x : -0.7 ~ -0.4 & 0.4 ~ 0.7
    // y : -0.3 ~ 0.3
    // z : 3

    BImageTargetX = getBImageTargetX();
    BImageTargetY = getBImageTargetY();
    BImageTargetZ = getBImageTargetZ();

    BImageFadeIn();
}

// Fadein a brain image
function BImageFadeIn(){
    BImageFadeInId = requestAnimationFrame(BImageFadeIn);
    if (plane.material.opacity < 0.6){
        plane.material.opacity += 0.002;
    }else{
        cancelAnimationFrame(BImageFadeInId);
        moveBImageIntoBrain();
    }
    //console.log(plane.material.opacity);
}

// Calulate a limited random position inside brain
function getBImageTargetX(){
    // Position range:
    // x: -0.4 ~ 0.4
    // y: 1 ~ 1.6
    // z: -0.4 ~ -1
    let x = (Math.random()*4)/10;
    if(Math.random()<0.5){
        x = -x;
    }
    return x;
}
function getBImageTargetY(){
    let y = (Math.random()*6)/10 + 1;
    return y;
}
function getBImageTargetZ(){
    let z = -(0.4+(Math.random()*(1 - 0.4)));
    return z;
}

// Move a image into brain
function moveBImageIntoBrain(){
    moveBImageIntoBrainId = requestAnimationFrame(moveBImageIntoBrain);
    // plane.position.x = 0;
    // plane.position.y = 1.6;
    // plane.position.z = -1;
    let quitSign = true;
    let step = 0.1;

    if (plane.position.x > BImageTargetX){
        plane.position.x -= step;
        quitSign = false;
        if (plane.position.x < BImageTargetX){
            plane.position.x = BImageTargetX;
            quitSign = true;
        }
    } else if (plane.position.x < BImageTargetX){
        plane.position.x += step;
        quitSign = false;
        if(plane.position.x > BImageTargetX){
            plane.position.x = BImageTargetX;
            quitSign = true;
        }
    }

    if (plane.position.y > BImageTargetY){
        plane.position.y -= step;
        quitSign = false;
        if (plane.position.y < BImageTargetY){
            plane.position.y = BImageTargetY;
            quitSign = true;
        }
    } else if (plane.position.y < BImageTargetY){
        plane.position.y += step;
        quitSign = false;
        if(plane.position.y > BImageTargetY){
            plane.position.y = BImageTargetY;
            quitSign = true;
        }
    }

    if (plane.position.z > BImageTargetZ){
        plane.position.z -= step;
        quitSign = false;
        if (plane.position.z < BImageTargetZ){
            plane.position.z = BImageTargetZ;
            quitSign = true;
        }
    } else if (plane.position.z < BImageTargetZ){
        plane.position.z += step;
        quitSign = false;
        if(plane.position.z > BImageTargetZ){
            plane.position.z = BImageTargetZ;
            quitSign = true;
        }
    }

    plane.rotation.x += (Math.random()*2)/10;
    plane.rotation.y += (Math.random()*2)/10;
    plane.rotation.z += (Math.random()*2)/10;

    plane.material.opacity -= 0.01;

    if (quitSign) {
        cancelAnimationFrame(moveBImageIntoBrainId);
        
        BImageGroup.add(plane);
        plane.position.set( BImageTargetX-BrainCenter.x, BImageTargetY-BrainCenter.y, BImageTargetZ-BrainCenter.z);
        plane.material.opacity = 0.2;
        document.AllowBrainImaging = true
    }
}
document.AllowBrainImaging = true;
function getBrainImage(){
    if(document.AllowBrainImaging == true){
        document.AllowBrainImaging = false;
        $.get("/client_get_brain_image/?"+Math.random(), function(response){
            if(response != ''){
                createBImage(response);
            }else{
                document.AllowBrainImaging = true;
            }
        });
    }
}

let keysPressed = {};
document.addEventListener('keydown', (event)=> {    
    keysPressed[event.key] = true;
    // Get summary from GPT-3 and save to database
    if(keysPressed['Control'] && event.key === 's') {
        console.log('Get summary from GPT-3 and save to database...');
        $.get("/get_summary_from_gpt3/", function(response){
            console.log(response);
        });
        return false;
    }

    // Create brain images from craiyon.com
    if(keysPressed['Control'] && event.key === 'd') {
        console.log('Create brain images from craiyon.com...');
        $.get("/create_brain_image/", function(response){
            console.log(response);
        });
        return false;
    }

    // Switch Inserting brain images into brain
    if(keysPressed['Control'] && event.key === 'b') {
        console.log('w')
        if (getBrainImageId){
            clearInterval(getBrainImageId);
            getBrainImageId = null;
            console.log('Stop to insert a brain image...');
        } else {
            getBrainImageId = setInterval(getBrainImage, 20000);
            console.log('Start to insert a brain image...');
        }
        
        return false;
    }

    // Focus to talker
    if(keysPressed['Control'] && event.key === 'f') {
        aniFocus();
        return false;
    }
    
});

loadBrainImagesCount = 20;
// Load brain images
function loadBrainImages(){
    console.log(loadBrainImagesCount);
    if (loadBrainImagesCount > 0){
        if (document.AllowBrainImaging){
            loadBrainImagesCount -= 1;
            getBrainImage();
        }
    } else {
        clearInterval(loadBrainImagesId);
    }
}
loadBrainImagesId = setInterval(loadBrainImages, 3000);

/**========================================================================
 *                          Head Rotation Control
 *========================================================================**/

// Head routine rotation
aniRoutineDirection = 1;
function aniRoutine(){
    cancelAnimationFrame( aniFocusedMovementId );
    cancelAnimationFrame( aniFocusId );
    aniRoutineId = requestAnimationFrame(aniRoutine);
    renderer.render(scene, camera);
    // controls.update();
    // Model rotating slowly
    if (Math.abs(model.rotation.y) > 1){
        aniRoutineDirection = Math.abs(aniRoutineDirection - 1);
    }
    if (aniRoutineDirection == 1){
        model.rotation.y += 0.0001;
    } else {
        model.rotation.y -= 0.0001;
    }
}

function aniFocus(){
    cancelAnimationFrame( aniRoutineId );
    aniFocusId = requestAnimationFrame(aniFocus);
    renderer.render(scene, camera);

    if (model.rotation.y < -0.1){
        model.rotation.y += 0.007;
    } else if (model.rotation.y > 0.1){
        model.rotation.y -= 0.007;
    } else {
        cancelAnimationFrame(aniFocusId);
        aniFocusedMovement();
    }
}

function aniFocusedMovement(){
    aniFocusedMovementId = requestAnimationFrame(aniFocusedMovement);
    renderer.render(scene, camera);

    // Model rotating slowly 
    if (Math.abs(model.rotation.y) > 0.11){
        aniRoutineDirection = Math.abs(aniRoutineDirection - 1);
    }
    if (aniRoutineDirection == 1){
        model.rotation.y += 0.0001;
    } else {
        model.rotation.y -= 0.0001;
    }
    clearTimeout(focusMovementTimeoutId);
    focusMovementTimeoutId = setTimeout(aniRoutine,20000);
}

/**========================================================================
 *             Websocket & Transcribe Responsed Text Control
 *========================================================================**/
$(document).ready(function() {

    /**----------------------
     *       Websocket
     *------------------------**/
    let namespace='/socket_conn'
    let socket = io('ws://127.0.0.1:5000/socket_conn');
    socket.connect();
    
    socket.on('server_info_response', function(res) {
        let msg = res.data;
        console.log(msg);
    }); 

    socket.on('transcribe_text', function(res) {
        if(document.Speaking === true){
            let msg = res.data;
            let msgA = msg.split('|');
            human_logos_partial = msgA[0];
            if(msgA[1] == 'False'){
                human_logos.push(human_logos_partial);
                $('#human-logos').val(human_logos.join('\n'));
                autoHeight('human-logos');
            } else {
                $('#human-logos').val(human_logos.join('\n')+'\n'+human_logos_partial);
                autoHeight('human-logos');
            }
        }
        
        console.log(res.data);
    }); 

    /**----------------------
     * Transcribe Responsed Text Control
     *------------------------**/
    //Processing sign
    document.Speaking = false;

    // Connect to Transcribe
    document.addEventListener('keydown', (event)=> {    
        if(keysPressed['Control'] && event.key === 'c') {
            console.log('Connecting AWS Transcribe');
            socket.emit('connect_transcribe', {data: 'Connecting AWS Transcribe from Client'});
            return false;
        }
    });

    // Processing Transcribe response text switch
    // let keysPressed = {};
    document.addEventListener('keydown', (event)=> {  
        keysPressed[event.key] = true;  
        // Start talking
        if(keysPressed['Control'] && event.key === 'q') {
            if(document.Speaking === false){
                document.Speaking = true;
                setHumanFlicker(true);
                human_logos.length = 0;
                human_logos_partial = ''
                console.log('Talking');
                return false;
            } else {
                document.Speaking = false;
                setHumanFlicker(false);
                console.log('Stop talking');
                return false;
            }
            
        }

        // Talk to Mischief (send text to GPT-3)
        if (keysPressed['Control'] && event.key == 'Enter') {
            console.log("'Talk to'...clicked");
            aniFocus();

            let human_logos = "Vam: "+$("#human-logos").val();
            appendConversation("<br><br>" + human_logos);
            let mischief_logos;
            human_logos = human_logos.trim().replaceAll('\n','\\n');
            $.get("/talk-to-mischief/?human_logos="+human_logos, function(response){
                console.log(response);
                // add reponse text to text box
                mischief_logos = response["GPT3response"]["choices"][0]["text"].trim().replace('Mischief:','').trim();

                // playing mp3 and model animation
                let speechMarkString = response["speechMarkString"];
                speechMarkString= speechMarkString.split("\\n")
                PollyJSON = [];
                for(const item of  speechMarkString){
                    PollyJSON.push(JSON.parse(item));
                }

                // Typerwriter animation
                // $("#gpt3-logos").val(mischief_logos);
                var p = 0;
                var txt = mischief_logos;
                var speed = PollyJSON[PollyJSON.length-1].time / mischief_logos.length;

                $("#gpt3-logos").val('');
                (function typeWriter() {
                    if (p < txt.length) {
                        $("#gpt3-logos").val($("#gpt3-logos").val() + txt.charAt(p)) ;
                        p++;
                        autoHeight('gpt3-logos');
                        setTimeout(typeWriter, speed);
                    }
                })();

                animationActions = createAnimationActions(PollyJSON);
                
                let mp3 = new Audio("/static/mp3/speech.mp3?random=" + new Date().getTime());
                mp3.load();
                console.log('------');
                mp3.play();
                setMischiefFlicker(true);
                timerPlay();
                mp3.addEventListener('ended', function(e){
                    setMischiefFlicker(false);
                });
                appendConversation('Mischief: '+mischief_logos +"<br><br>");
                
            });
        }
    });
    document.addEventListener('keyup', (event) => {
        delete keysPressed[event.key];
    });

});

function setHumanFlicker(state){
    if(state){
        $('#flicker-human').addClass("animate-ping bg-sky-400");
        $('#flicker-human-o').addClass("bg-sky-500").removeClass("bg-zinc-900");
    }else{
        $('#flicker-human').removeClass("animate-ping bg-sky-400");
        $('#flicker-human-o').removeClass("bg-sky-500").addClass("bg-zinc-900");
    }
}
function setMischiefFlicker(state){
    if(state){
        $('#flicker-mischief').addClass("animate-ping bg-green-400");
        $('#flicker-mischief-o').addClass("bg-green-300").removeClass("bg-zinc-900");
    }else{
        $('#flicker-mischief').removeClass("animate-ping bg-green-400");
        $('#flicker-mischief-o').removeClass("bg-green-300").addClass("bg-zinc-900");
    }
}
setHumanFlicker(false);
setMischiefFlicker(false);

// read conversation content
function readTextFile(file)
{
    let allText;
    let rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                allText = rawFile.responseText;
            }
        }
    }
    rawFile.send(null);
    $('#conversation-container').html(allText.replaceAll('\n','<br />'));
    $("#conversation-container").animate({ scrollTop: $('#conversation-container').prop("scrollHeight")}, 2000);
}
readTextFile("/static/mp3/conversation.txt");

// append conversation and scoll to bottom
function appendConversation(logos){
    $('#conversation-container').append(logos);
    $("#conversation-container").animate({ scrollTop: $('#conversation-container').prop("scrollHeight")}, 1000);
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize',onWindowResize, false);

/**========================================================================
 *                           UI Functions
 *========================================================================**/

// Auto textarea height
$('textarea').on('input propertychange', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

function autoHeight(elementID){
    let element = document.getElementById(elementID)
    console.log(element.scrollHeight);
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
}

/**========================================================================
 *                           Testing Buttons Event Binding
 *========================================================================**/

 function buttonEvent(animations){
    
    $("#click-to-play").click(function(){
        console.log('clicked');
        // console.log(document.Speaking)
        setHumanFlicker(true);
        setMischiefFlicker(false);
    });
    
    $("#gpt-3").click(function(){
        
        console.log("GPT-3 querying...");

        $.get("/gpt-3/?human_logos=this is not baby", function(r){
            $("#gpt3-logos").val(r)
        });
    });

    $("#b2").click(function(){
        // createBImage("image-4.png");
        setHumanFlicker(false);
        setMischiefFlicker(true);
    });
}

$("#talk-to-mischief").click(function(){
    $("#gpt3-logos").val( $("#gpt3-logos").val()+"222 222 eee eee eee \n ww");
    autoHeight($("#gpt3-logos"));
});

/**========================================================
 *                Key SHORTCUTS
 *  -------------------------------------------------------
 * 
 *  Ctrl + c : Connect AWS Transcribe
 *  Ctrl + q : Switch human voice imput
 *  Crtl + Enter : Send to GPT-3
 *  
 *  Ctrl + b : Switch Inserting brain images into brain
 *  Ctrl + d : Create brain images from craiyon.com
 *  Ctrl + s : Get summary from GPT-3 and save to database
 * 
 *  Ctrl + f : Focus to talker
 *  
 *======================================================**/