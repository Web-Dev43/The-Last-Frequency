const canvas = document.getElementById("renderCanvas");
const intro = document.getElementById("intro");
const beginButton = document.getElementById("beginButton");
const chapterLabel = document.getElementById("chapter");
const subtitles = document.getElementById("subtitles");
const soundButton = document.getElementById("soundButton");
const endCard = document.getElementById("endCard");
const replayButton = document.getElementById("replayButton");

const engine = new BABYLON.Engine(canvas, true, {
  preserveDrawingBuffer: false,
  stencil: true,
  adaptToDeviceRatio: true,
  powerPreference: "high-performance"
});

let scene;
let soundOn = false;
let audioContext;
let masterGain;
let sequenceTimer = 0;
let running = false;
let radioHum;
let radioLight;
let camera;

function makeMaterial(name, color, roughness = 1, emissive = null) {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(color);
  material.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
  material.roughness = roughness;
  if (emissive) material.emissiveColor = BABYLON.Color3.FromHexString(emissive);
  return material;
}

function box(name, position, scaling, material) {
  const mesh = BABYLON.MeshBuilder.CreateBox(name, { width: scaling.x, height: scaling.y, depth: scaling.z }, scene);
  mesh.position = new BABYLON.Vector3(position.x, position.y, position.z);
  mesh.material = material;
  return mesh;
}

function buildRoom() {
  const wall = makeMaterial("old plaster", "#30383a");
  const darkWall = makeMaterial("shadow wall", "#151b1e");
  const floor = makeMaterial("worn floor", "#242322");
  const wood = makeMaterial("old wood", "#49382d");
  const black = makeMaterial("radio casing", "#101416");
  const glass = makeMaterial("radio glass", "#253b3d", .2, "#142c30");

  box("floor", {x:0,y:-.12,z:0}, {x:10,y:.2,z:10}, floor);
  box("back wall", {x:0,y:2.5,z:4.8}, {x:10,y:5,z:.2}, wall);
  box("left wall", {x:-4.9,y:2.5,z:0}, {x:.2,y:5,z:10}, darkWall);
  box("right wall", {x:4.9,y:2.5,z:0}, {x:.2,y:5,z:10}, wall);
  box("ceiling", {x:0,y:5,z:0}, {x:10,y:.15,z:10}, darkWall);

  // A rain-darkened window and its frame
  box("window recess", {x:-2.3,y:2.8,z:4.66}, {x:2.1,y:2.1,z:.08}, darkWall);
  const windowGlass = makeMaterial("night window", "#101d25", .15, "#07121b");
  box("window pane", {x:-2.3,y:2.8,z:4.58}, {x:1.85,y:1.85,z:.04}, windowGlass);
  box("window divider", {x:-2.3,y:2.8,z:4.52}, {x:.045,y:1.85,z:.06}, wood);
  box("window sill", {x:-2.3,y:1.72,z:4.42}, {x:2.25,y:.12,z:.35}, wood);

  // Side table and radio
  box("table top", {x:.9,y:1.05,z:1.2}, {x:2.1,y:.14,z:1.1}, wood);
  for (const x of [0, 1.8]) for (const z of [.8, 1.6]) {
    box("table leg", {x,y:.52,z}, {x:.12,y:1,z:.12}, wood);
  }
  const radio = box("old radio", {x:.9,y:1.48,z:1.18}, {x:1.05,y:.65,z:.62}, black);
  const dial = box("radio dial", {x:.9,y:1.52,z:.86}, {x:.62,y:.23,z:.025}, glass);
  const knobMat = makeMaterial("knob", "#9b927e");
  for (const x of [.53, 1.27]) {
    const knob = BABYLON.MeshBuilder.CreateCylinder("radio knob", {diameter:.12,height:.08}, scene);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(x,1.48,.82);
    knob.material = knobMat;
  }
  const antenna = BABYLON.MeshBuilder.CreateCylinder("antenna", {diameter:.018,height:.85}, scene);
  antenna.position.set(1.28,2.12,1.18);
  antenna.rotation.z = -.25;
  antenna.material = knobMat;

  // The clock makes the time a quiet visual clue
  const clock = box("digital clock", {x:-.9,y:1.45,z:1.1}, {x:.7,y:.34,z:.18}, black);
  const digits = makeMaterial("clock digits", "#a7c5bd", .2, "#5caa96");
  const display = box("clock display", {x:-.9,y:1.46,z:1.0}, {x:.52,y:.17,z:.025}, digits);

  // A barely visible figure-shaped coat on a stand, not a character reveal
  const coatMat = makeMaterial("coat", "#111619");
  const coat = BABYLON.MeshBuilder.CreateCylinder("hanging coat", {diameterTop:.2,diameterBottom:.72,height:1.55,tessellation:6}, scene);
  coat.position.set(3.2,.95,3.1);
  coat.material = coatMat;
  const head = BABYLON.MeshBuilder.CreateSphere("coat hanger shadow", {diameter:.28,segments:8}, scene);
  head.position.set(3.2,1.85,3.1);
  head.material = coatMat;

  const warm = new BABYLON.PointLight("weak lamp", new BABYLON.Vector3(.8,2.4,1.1), scene);
  warm.diffuse = new BABYLON.Color3(.55,.42,.28);
  warm.intensity = .55;
  warm.range = 5;
  const cold = new BABYLON.DirectionalLight("moonlight", new BABYLON.Vector3(.4,-1,-.4), scene);
  cold.diffuse = new BABYLON.Color3(.28,.42,.52);
  cold.intensity = .38;

  radioLight = new BABYLON.PointLight("radio signal", new BABYLON.Vector3(.9,1.55,.7), scene);
  radioLight.diffuse = new BABYLON.Color3(.25,.75,.72);
  radioLight.intensity = 0;
  radioLight.range = 2.5;

  return { radio, dial, display };
}

function createScene() {
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(.012,.018,.024,1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = .035;
  scene.fogColor = new BABYLON.Color3(.025,.035,.04);
  camera = new BABYLON.FreeCamera("cinema camera", new BABYLON.Vector3(0,2.1,-5.8), scene);
  camera.setTarget(new BABYLON.Vector3(0,1.5,1.3));
  camera.fov = .78;
  camera.minZ = .05;
  scene.activeCamera = camera;
  const hemi = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0,1,0), scene);
  hemi.intensity = .32;
  buildRoom();
  return scene;
}

function initAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  audioContext = audioContext || new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
  if (!masterGain) {
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioContext.destination);
    const oscillator = audioContext.createOscillator();
    const lowpass = audioContext.createBiquadFilter();
    const humGain = audioContext.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = 48;
    lowpass.type = "lowpass";
    lowpass.frequency.value = 95;
    humGain.gain.value = .025;
    oscillator.connect(lowpass);
    lowpass.connect(humGain);
    humGain.connect(masterGain);
    oscillator.start();
    radioHum = humGain;
  }
  masterGain.gain.setTargetAtTime(soundOn ? .65 : 0, audioContext.currentTime, .4);
}

function softTone(frequency, duration = .45, volume = .05) {
  if (!soundOn || !audioContext || !masterGain) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + .04);
  gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioContext.currentTime + duration + .05);
}

function showChapter(text) {
  chapterLabel.textContent = text;
  chapterLabel.classList.add("show");
  window.setTimeout(() => chapterLabel.classList.remove("show"), 4200);
}
function subtitle(text, duration = 3500) {
  subtitles.textContent = text;
  window.clearTimeout(subtitle.timeout);
  subtitle.timeout = window.setTimeout(() => subtitles.textContent = "", duration);
}

function animateCamera(toPosition, toTarget, duration, onDone) {
  const fps = 30;
  const frames = duration * fps;
  const fromPosition = camera.position.clone();
  const fromTarget = camera.getTarget().clone();
  const anims = [];
  for (const [property, from, to] of [
    ["position", fromPosition, toPosition],
    ["target", fromTarget, toTarget]
  ]) {
    const animation = new BABYLON.Animation(
      "cinema move " + property, property, fps,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    animation.setKeys([{frame:0,value:from},{frame:frames,value:to}]);
    animation.setEasingFunction(new BABYLON.CubicEase());
    animation.getEasingFunction().setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    anims.push(animation);
  }
  scene.beginDirectAnimation(camera, anims, 0, frames, false, 1, onDone);
}

function runFilm() {
  if (running) return;
  running = true;
  sequenceTimer = 0;
  endCard.hidden = true;
  subtitles.textContent = "";
  chapterLabel.classList.remove("show");
  camera.position.set(0,2.1,-5.8);
  camera.setTarget(new BABYLON.Vector3(0,1.5,1.3));
  intro.classList.add("fade");
  window.setTimeout(() => intro.hidden = true, 1600);
  showChapter("CHAPTER ONE  ·  THE SIGNAL");

  // Opening shot: the room appears before the story explains it.
  animateCamera(new BABYLON.Vector3(-2.7,2.2,-3.4), new BABYLON.Vector3(-1.2,1.8,2.6), 8, () => {
    subtitle("It was quiet that night.", 3000);
  });

  window.setTimeout(() => {
    animateCamera(new BABYLON.Vector3(-1.9,1.9,.3), new BABYLON.Vector3(-2.3,2.7,4.5), 6, () => {
      subtitle("Until the radio turned on.", 3000);
      softTone(180, .8, .035);
    });
  }, 9000);

  window.setTimeout(() => {
    radioLight.intensity = .8;
    softTone(440, .18, .025);
    window.setTimeout(() => softTone(392, .25, .02), 260);
    animateCamera(new BABYLON.Vector3(.1,1.75,-.3), new BABYLON.Vector3(.9,1.5,1), 5, () => {
      subtitle("3:17 AM", 2600);
    });
  }, 16000);

  window.setTimeout(() => {
    radioLight.intensity = .15;
    animateCamera(new BABYLON.Vector3(2.7,1.7,2.1), new BABYLON.Vector3(3.2,1.4,3.1), 5, () => {
      subtitle("Someone was standing in the corner.", 3500);
      softTone(62, 1.2, .06);
    });
  }, 23000);

  window.setTimeout(() => {
    subtitle("And it knew his name.", 4000);
    softTone(110, 1.4, .035);
  }, 29000);

  window.setTimeout(() => {
    endCard.hidden = false;
    endCard.style.opacity = "0";
    requestAnimationFrame(() => {
      endCard.style.transition = "opacity 2s ease";
      endCard.style.opacity = "1";
    });
    running = false;
  }, 35000);
}

beginButton.addEventListener("click", () => {
  soundOn = true;
  soundButton.textContent = "SOUND ON";
  initAudio();
  runFilm();
});
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
  initAudio();
});
replayButton.addEventListener("click", () => {
  if (audioContext) initAudio();
  runFilm();
});

createScene();
engine.runRenderLoop(() => {
  if (scene) {
    const t = performance.now() * .001;
    if (radioLight && running) {
      radioLight.intensity = Math.max(radioLight.intensity, .05) + Math.sin(t * 7) * .004;
    }
    scene.render();
  }
});
window.addEventListener("resize", () => engine.resize());
