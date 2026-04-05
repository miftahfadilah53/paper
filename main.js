// --- Configuration ---
const CONFIG = {
  camera: {
    fov: 45,
    near: 0.1,
    far: 100,
    getZ: () => (window.innerWidth <= 600 ? 6 : 5),
    zoomOffset: () => (window.innerWidth <= 600 ? 3.5 : 0.5),
  },
  model: {
    path: "/assets/paperex.glb",
    initialPos: { x: -1, y: 0.2, z: 0.1 },
    openOffset: 0,
    closedOffset: -1,
  },
  interaction: {
    clickTolerance: 10,
    fadeDuration: 0.5,
    animDuration: 1.2,
    cameraAnimDuration: 1.5,
  },
};

// --- Application State ---
const state = {
  isBookOpen: false,
  model: null,
  rightBone: null,
  leftBone: null,
};

// --- Setup Three.js Environment ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov,
  window.innerWidth / window.innerHeight,
  CONFIG.camera.near,
  CONFIG.camera.far,
);
camera.position.set(0, 0, CONFIG.camera.getZ());

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 10;

// --- UI Management ---
const ui = {
  panelTitle: document.getElementById("panel-title"),
  panelDesc: document.getElementById("panel-desc"),
  clickHint: document.getElementById("click-hint"),
  hideDescTimer: null,
};

const toggleDescription = (show = true) => {
  clearTimeout(ui.hideDescTimer);
  if (show) {
    gsap.to(ui.panelDesc, {
      height: "auto",
      opacity: 1,
      duration: CONFIG.interaction.fadeDuration,
      ease: "back.out(1.2)",
    });
    ui.hideDescTimer = setTimeout(() => toggleDescription(false), 4000);
  } else {
    gsap.to(ui.panelDesc, {
      height: 0,
      opacity: 0,
      duration: CONFIG.interaction.fadeDuration,
      ease: "power2.inOut",
    });
  }
};

ui.panelTitle.addEventListener("click", () => toggleDescription(true));

// --- Text Drawing Utilities ---
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

function createHandwrittenTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.font = "48px 'Caveat', cursive";
  ctx.fillStyle = "#2c1810";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const padding = 80;
  const maxWidth = canvas.width - padding * 2;
  const lineHeight = 55;
  let line = "";
  let y = padding;

  text.split(" ").forEach((word) => {
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

function attachTextToPage(bone, planeSize, text, initial) {
  const geometry = new THREE.PlaneGeometry(planeSize.width, planeSize.height);
  const material = new THREE.MeshStandardMaterial({
    map: createHandwrittenTexture(text),
    transparent: true,
    roughness: 1,
    metalness: 0,
    side: THREE.FrontSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -20,
    polygonOffsetUnits: -20,
  });

  const textPlane = new THREE.Mesh(geometry, material);
  textPlane.renderOrder = 1000;

  textPlane.position.set(initial.x, initial.y, initial.z);
  textPlane.rotation.set(initial.rx, initial.ry, initial.rz);

  bone.add(textPlane);
}

// --- Model Initialization ---
new THREE.GLTFLoader().load(CONFIG.model.path, (gltf) => {
  state.model = gltf.scene;
  scene.add(state.model);

  state.rightBone =
    state.model.getObjectByName("bone002") ||
    state.model.getObjectByName("Bone002");
  state.l =
    state.model.getObjectByName("bone001") ||
    state.model.getObjectByName("Bone001");

  // Determine plane size once instead of running it for every text layer
  let pageMesh = null;
  state.model.traverse((child) => {
    if (child.isSkinnedMesh && child.name === "Plane001") {
      pageMesh = child;
    }
  });

  document.fonts.ready.then(() => {
    if (!pageMesh) return;

    pageMesh.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    pageMesh.geometry.boundingBox.getSize(size);
    const planeSize = { width: size.x * 0.45, height: size.z * 0.8 };

    const notebookContents = [
      {
        bone: state.rightBone,
        text: `1. Aplikasi metode-metode, teknik-teknik dan\nperalatan ilmiah dalam menghadapi masalah-\nmasalah yang timbul di dalam operasi perusahaan\ndengan tujuan ditemukannya pemecahan yang\noptimum masalah-masalah tersebut, Teori dari?\n\na. Morse\nb. Kimball\nc. Morse dan Kimball\nd. Churchman, Arkoff dan Arnoff\ne. Miller dan M.K. Star`,
        initial: { x: -0.36, y: 1.1, z: 0, rx: 0, ry: Math.PI, rz: 1.6 },
      },
      {
        bone: state.rightBone,
        text: "Halo, Selamat Ulang Tahun",
        initial: { x: 0, y: 1, z: 0, rx: 0, ry: 0, rz: -1.6 },
      },
      {
        bone: state.l,
        text: "Halo, Selamat Datang di Halaman Kanan!\nTulis apa pun di sini.",
        initial: { x: 1, y: 1, z: 0, rx: 0, ry: 0, rz: 1.6 },
      },
      {
        bone: state.l,
        text: "Teks Sampul Belakang Kanan...",
        initial: { x: 1, y: 0.9, z: 0, rx: 0, ry: Math.PI, rz: -1.6 },
      },
    ];

    if (state.rightBone) {
      state.rightBone.rotation.y = Math.PI * 0.99;
    }

    notebookContents.forEach(({ bone, text, initial }) => {
      if (bone) attachTextToPage(bone, planeSize, text, initial);
    });
  });

  state.model.position.set(
    CONFIG.model.initialPos.x,
    CONFIG.model.initialPos.y,
    CONFIG.model.initialPos.z,
  );
  state.model.rotation.set(Math.PI / 4, 0, 0);

  // Entrance Animation
  gsap.to(state.model.rotation, {
    x: Math.PI / 2,
    duration: CONFIG.interaction.cameraAnimDuration,
    ease: "power2.out",
    onComplete: () => {
      ui.clickHint.style.display = "inline-flex";
      gsap.to(ui.clickHint, {
        opacity: 1,
        duration: CONFIG.interaction.fadeDuration,
      });
      toggleDescription(true);
    },
  });
});

// --- User Interactions ---
const interactionCtx = { startX: 0, startY: 0 };
window.addEventListener("pointerdown", (e) => {
  interactionCtx.startX = e.clientX;
  interactionCtx.startY = e.clientY;
});

window.addEventListener("pointerup", (e) => {
  if (!state.model || !state.rightBone) return;

  const dist = Math.hypot(
    e.clientX - interactionCtx.startX,
    e.clientY - interactionCtx.startY,
  );
  if (dist > CONFIG.interaction.clickTolerance) return;

  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  if (raycaster.intersectObject(state.model, true).length > 0) {
    state.isBookOpen = !state.isBookOpen;

    // Animate Book Opening/Closing
    gsap.to(state.rightBone.rotation, {
      y: state.isBookOpen ? 0 : Math.PI * 0.99,
      duration: CONFIG.interaction.animDuration,
      ease: "expo.out",
    });

    gsap.to(state.model.position, {
      x: state.isBookOpen ? CONFIG.model.openOffset : CONFIG.model.closedOffset,
      duration: CONFIG.interaction.animDuration,
      ease: "expo.out",
    });

    // Animate Camera Zoom
    const targetZ =
      CONFIG.camera.getZ() +
      (state.isBookOpen ? CONFIG.camera.zoomOffset() : 0);

    gsap.to(camera.position, {
      x: 0,
      y: 0,
      z: targetZ,
      duration: CONFIG.interaction.cameraAnimDuration,
      ease: "expo.out",
    });

    gsap.to(controls.target, {
      x: 0,
      y: 0,
      z: 0,
      duration: CONFIG.interaction.cameraAnimDuration,
      ease: "expo.out",
    });

    // Update UI
    ui.clickHint.innerHTML = state.isBookOpen
      ? 'Klik buku untuk menutup <span style="font-size: 18px;">👉</span>'
      : '<span style="font-size: 18px;">👆</span> Klik buku untuk membuka';
  }
});

// --- Render Loop ---
const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};
animate();

// --- Resize Handler ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
