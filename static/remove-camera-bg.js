if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    tf.setBackend("webgl").then(() => main());
    async function main() {
      const webcamEl = document.getElementById("webcam");
      const canvasEl = document.getElementById("canvas");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      webcamEl.srcObject = stream;
      webcamEl.play();
      const net = await bodyPix.load();

      const backgroundBlurAmount = 3;
      const edgeBlurAmount = 1;
      const flipHorizontal = true;
      const foregroundColor = {r: 0, g: 40, b: 140, a: 120};
      const backgroundColor = {r: 0, g: 0, b: 0, a: 255};
      const maskBlurAmount = 3;
      const opacity = 1;

      let mask = null;

      async function renderLoop(now, metadata) {
        canvasEl.width = metadata.width;
        canvasEl.height = metadata.height;
        if (mask) {
          // bodyPix.drawMask(canvasEl, webcamEl, mask, ...);
        //   bodyPix.drawBokehEffect(canvasEl, webcamEl, segmentation, backgroundBlurAmount, edgeBlurAmount, flipHorizontal);
          bodyPix.drawMask(canvasEl, webcamEl, mask, opacity, maskBlurAmount, flipHorizontal);
        }
        webcamEl.requestVideoFrameCallback(renderLoop);
      }
      webcamEl.requestVideoFrameCallback(renderLoop);

      async function segmentLoop(now, metadata) {
        webcamEl.width = metadata.width;
        webcamEl.height = metadata.height;
        const segmentation = await net.segmentPerson(webcamEl, {
            internalResolution: 1.3,
          });
        mask = bodyPix.toMask(segmentation, foregroundColor, backgroundColor);
        webcamEl.requestVideoFrameCallback(segmentLoop);
      }
      webcamEl.requestVideoFrameCallback(segmentLoop);
    }
  } else {
    alert('API not supported')
  }