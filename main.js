const getCameraZ = () => (window.innerWidth <= 600 ? 6 : 5);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, getCameraZ());

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 10;

let tulangKiri = null;
let modelBuku = null;
let isBookOpen = false;
let hideDescTimer;

const panelTitle = document.getElementById("panel-title");
const panelDesc = document.getElementById("panel-desc");
const clickHint = document.getElementById("click-hint");

function toggleDescription(show = true) {
  clearTimeout(hideDescTimer);

  if (show) {
    gsap.to(panelDesc, {
      height: "auto",
      opacity: 1,
      duration: 0.5,
      ease: "back.out(1.2)",
    });

    hideDescTimer = setTimeout(() => toggleDescription(false), 4000);
  } else {
    gsap.to(panelDesc, {
      height: 0,
      opacity: 0,
      duration: 0.5,
      ease: "power2.inOut",
    });
  }
}

panelTitle.addEventListener("click", () => toggleDescription(true));

function createHandwrittenTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "48px 'Caveat', cursive";
  ctx.fillStyle = "#2c1810";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const padding = 80;
  const maxWidth = canvas.width - padding * 2;
  const words = text.split(" ");

  let line = "";
  let y = padding;
  const lineHeight = 55;

  words.forEach((word) => {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth) {
      drawLine(ctx, line, padding, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  });

  drawLine(ctx, line, padding, y);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

function drawLine(ctx, text, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((Math.random() - 0.5) * 0.015);
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 1.5;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function attachTextToPage(bone, modelBuku) {
  modelBuku.position.set(-1.6, 0.5, 0.1);

  document.fonts.ready.then(() => {
    const text = `1. Aplikasi metode-metode, teknik-teknik dan
peralatan ilmiah dalam menghadapi masalah-
masalah yang timbul di dalam operasi perusahaan
dengan tujuan ditemukannya pemecahan yang
optimum masalah-masalah tersebut, Teori dari?

a. Morse
b. Kimball
c. Morse dan Kimball
d. Churchman, Arkoff dan Arnoff
e. Miller dan M.K. Star`;

    const texture = createHandwrittenTexture(text);

    let pageMesh = null;
    modelBuku.traverse((child) => {
      if (child.isSkinnedMesh && child.name === "Plane001") {
        pageMesh = child;
      }
    });

    if (!pageMesh) return;

    pageMesh.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    pageMesh.geometry.boundingBox.getSize(size);

    const planeW = size.x * 0.45;
    const planeH = size.z * 0.8;

    const geometry = new THREE.PlaneGeometry(planeW, planeH);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 1,
      metalness: 0,
      side: THREE.FrontSide,
    });

    material.depthWrite = false;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -4;
    material.polygonOffsetUnits = -4;

    const textPlane = new THREE.Mesh(geometry, material);
    textPlane.renderOrder = 999;

    bone.add(textPlane);

    textPlane.position.set(-0.36, 1.1, 0);
    textPlane.rotation.set(0, Math.PI, 1.6);
  });
}

const loader = new THREE.GLTFLoader();
loader.load("/assets/paperex.glb", function (gltf) {
  modelBuku = gltf.scene;
  scene.add(modelBuku);

  tulangKiri =
    modelBuku.getObjectByName("bone002") ||
    modelBuku.getObjectByName("Bone002");
  if (tulangKiri) {
    tulangKiri.rotation.y = Math.PI * 0.99;
    attachTextToPage(tulangKiri, modelBuku);
  }

  modelBuku.position.set(-1, -3, -1);
  modelBuku.rotation.set(Math.PI / 4, 0, 0);

  gsap.to(modelBuku.position, {
    x: -1,
    y: 0,
    z: 0,
    duration: 1.5,
    ease: "power2.out",
  });
  gsap.to(modelBuku.rotation, {
    x: Math.PI / 2,
    duration: 1.5,
    ease: "power2.out",
    onComplete: () => {
      clickHint.style.display = "inline-flex";
      gsap.to(clickHint, { opacity: 1, duration: 0.5 });
      toggleDescription(true);
    },
  });
});

let startPoint = { x: 0, y: 0 };
window.addEventListener("pointerdown", (e) => {
  startPoint.x = e.clientX;
  startPoint.y = e.clientY;
});

window.addEventListener("pointerup", (e) => {
  const dist = Math.hypot(e.clientX - startPoint.x, e.clientY - startPoint.y);
  if (dist > 10 || !modelBuku || !tulangKiri) return;

  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(modelBuku, true);

  if (intersects.length > 0) {
    isBookOpen = !isBookOpen;

    gsap.to(tulangKiri.rotation, {
      y: isBookOpen ? 0 : Math.PI * 0.99,
      duration: 1.2,
      ease: "expo.out",
    });

    gsap.to(modelBuku.position, {
      x: isBookOpen ? 0 : -1,
      duration: 1.2,
      ease: "expo.out",
    });

    const currentZ = getCameraZ();
    const zoomOffset = window.innerWidth <= 600 ? 3.5 : 0.5;
    const targetZ = isBookOpen ? currentZ + zoomOffset : currentZ;

    gsap.to(camera.position, {
      x: 0,
      y: 0,
      z: targetZ,
      duration: 1.5,
      ease: "expo.out",
    });

    gsap.to(controls.target, {
      x: 0,
      y: 0,
      z: 0,
      duration: 1.5,
      ease: "expo.out",
    });

    clickHint.innerHTML = isBookOpen
      ? 'Klik buku untuk menutup <span style="font-size: 18px;">👉</span>'
      : '<span style="font-size: 18px;">👆</span> Klik buku untuk membuka';
  }
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
