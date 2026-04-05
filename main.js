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
    typingSpeed: 0.03,
  },
};

const state = {
  isBookOpen: false,
  isAnimating: false,
  model: null,
  rightBone: null,
  leftBone: null,
  pages: [],
};

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

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.minDistance = 2;
controls.maxDistance = 10;

const ui = {
  panelTitle: document.getElementById("panel-title"),
  panelDesc: document.getElementById("panel-desc"),
  resetBtn: document.getElementById("reset-view"),
  hideDescTimer: null,
};

const resetView = () => {
  if (state.isAnimating || !state.model || !state.rightBone) return;
  state.isAnimating = true;

  const targetPosX = state.isBookOpen
    ? CONFIG.model.openOffset
    : CONFIG.model.closedOffset;
  const targetZ =
    CONFIG.camera.getZ() + (state.isBookOpen ? CONFIG.camera.zoomOffset() : 0);
  const targetBoneY = state.isBookOpen ? 0 : Math.PI * 0.99;

  gsap.to(camera.position, {
    x: 0,
    y: 0,
    z: targetZ,
    duration: CONFIG.interaction.cameraAnimDuration,
    ease: "expo.out",
  });

  gsap.to(state.rightBone.rotation, {
    y: targetBoneY,
    duration: CONFIG.interaction.animDuration,
    ease: "expo.out",
  });

  gsap.to(state.model.position, {
    x: targetPosX,
    duration: CONFIG.interaction.animDuration,
    ease: "expo.out",
  });

  gsap.to(controls.target, {
    x: 0,
    y: 0,
    z: 0,
    duration: CONFIG.interaction.cameraAnimDuration,
    ease: "expo.out",
    onComplete: () => {
      state.isAnimating = false;
      controls.update();
    },
  });
};

ui.resetBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  resetView();
});

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

function calculateLayout(ctx, text, maxWidth, fontSize, padding) {
  const layout = { paragraphs: [] };
  const paragraphs = text.split("\n");
  const lineHeight = fontSize * 1.2;

  ctx.font = `${fontSize}px 'Caveat', cursive`;

  paragraphs.forEach((pText) => {
    const paragraph = { lines: [] };
    const words = pText.trim().split(/\s+/);

    if (words.length === 0 || (words.length === 1 && words[0] === "")) {
      paragraph.isEmpty = true;
      layout.paragraphs.push(paragraph);
      return;
    }

    let currentLine = { words: [], totalWordsWidth: 0 };
    words.forEach((word) => {
      const wordWidth = ctx.measureText(word).width;
      const spaceWidth = ctx.measureText(" ").width;

      if (
        currentLine.totalWordsWidth + wordWidth > maxWidth &&
        currentLine.words.length > 0
      ) {
        paragraph.lines.push(currentLine);
        currentLine = { words: [], totalWordsWidth: 0 };
      }

      currentLine.words.push({ text: word, width: wordWidth });
      currentLine.totalWordsWidth += wordWidth + spaceWidth;
    });

    if (currentLine.words.length > 0) {
      paragraph.lines.push(currentLine);
    }

    layout.paragraphs.push(paragraph);
  });

  return { layout, lineHeight };
}

function renderLayout(
  ctx,
  canvas,
  layout,
  progress,
  maxWidth,
  fontSize,
  lineHeight,
  padding,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontSize}px 'Caveat', cursive`;
  ctx.fillStyle = "#2c1810";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let currentY = padding;
  let charCount = 0;

  layout.paragraphs.forEach((paragraph) => {
    if (paragraph.isEmpty) {
      currentY += lineHeight / 2;
      return;
    }

    paragraph.lines.forEach((line, lineIndex) => {
      if (charCount >= progress) return;

      const isLastLineOfParagraph = lineIndex === paragraph.lines.length - 1;
      let lineText = "";
      let visibleWords = [];

      for (let word of line.words) {
        const wordPlusSpace = word.text + " ";
        if (charCount + wordPlusSpace.length <= progress) {
          visibleWords.push(word);
          lineText += wordPlusSpace;
          charCount += wordPlusSpace.length;
        } else {
          const remainingChars = progress - charCount;
          if (remainingChars > 0) {
            const partialWord = word.text.slice(0, remainingChars);
            visibleWords.push({
              text: partialWord,
              width: ctx.measureText(partialWord).width,
            });
            lineText += partialWord;
            charCount += remainingChars;
          }
          break;
        }
      }

      const isLineComplete =
        visibleWords.length === line.words.length &&
        lineText.trim() === line.words.map((w) => w.text).join(" ");

      if (!isLastLineOfParagraph && isLineComplete) {
        drawJustifiedLine(
          ctx,
          visibleWords.map((w) => w.text),
          padding,
          currentY,
          maxWidth,
        );
      } else {
        drawLeftLine(ctx, lineText, padding, currentY);
      }

      currentY += lineHeight;
    });

    currentY += 10;
  });
}

function drawJustifiedLine(ctx, words, x, y, maxWidth) {
  let totalWordsWidth = 0;
  words.forEach((word) => {
    totalWordsWidth += ctx.measureText(word).width;
  });

  const totalSpaceWidth = maxWidth - totalWordsWidth;
  const spacing = words.length > 1 ? totalSpaceWidth / (words.length - 1) : 0;

  let currentX = x;
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 1;

  words.forEach((word) => {
    ctx.fillText(word, currentX, y);
    currentX += ctx.measureText(word).width + spacing;
  });
  ctx.restore();
}

function drawLeftLine(ctx, text, x, y) {
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 1;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function createTypewriterPage(
  bone,
  planeSize,
  text,
  initial,
  animateOnOpen = false,
  fontSize = 46,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;

  const geometry = new THREE.PlaneGeometry(planeSize.width, planeSize.height);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: 1,
    metalness: 0,
    side: THREE.FrontSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const textPlane = new THREE.Mesh(geometry, material);
  textPlane.renderOrder = 1000;
  textPlane.position.set(initial.x, initial.y, initial.z);
  textPlane.rotation.set(initial.rx, initial.ry, initial.rz);
  bone.add(textPlane);

  const padding = 80;
  const maxWidth = canvas.width - padding * 2;

  const { layout, lineHeight } = calculateLayout(
    ctx,
    text,
    maxWidth,
    fontSize,
    padding,
  );

  const pageData = {
    texture,
    ctx,
    canvas,
    layout,
    maxWidth,
    fontSize,
    lineHeight,
    padding,
    fullText: text,
    animateOnOpen,
    isTyping: false,
    hasRun: false,
    textObj: { progress: 0 },
  };

  if (!animateOnOpen) {
    renderLayout(
      ctx,
      canvas,
      layout,
      text.length + 1000,
      maxWidth,
      fontSize,
      lineHeight,
      padding,
    );
    texture.needsUpdate = true;
  }

  state.pages.push(pageData);
}

function startTypewriter(page) {
  if (page.isTyping || page.hasRun) return;
  page.isTyping = true;
  page.hasRun = true;
  page.textObj.progress = 0;

  gsap.to(page.textObj, {
    progress: page.fullText.length,
    duration: page.fullText.length * CONFIG.interaction.typingSpeed,
    ease: "none",
    onUpdate: () => {
      renderLayout(
        page.ctx,
        page.canvas,
        page.layout,
        Math.floor(page.textObj.progress),
        page.maxWidth,
        page.fontSize,
        page.lineHeight,
        page.padding,
      );
      page.texture.needsUpdate = true;
    },
    onComplete: () => {
      page.isTyping = false;
    },
  });
}

new THREE.GLTFLoader().load(CONFIG.model.path, (gltf) => {
  state.model = gltf.scene;
  scene.add(state.model);

  state.rightBone =
    state.model.getObjectByName("bone002") ||
    state.model.getObjectByName("Bone002");
  state.leftBone =
    state.model.getObjectByName("bone001") ||
    state.model.getObjectByName("Bone001");

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

    const setup = [
      {
        bone: state.rightBone,
        text: `Halo, waktu itu kamu pernah ngasih aku kertas kann, sekarang aku bakal kasih kamu kertas yang lebih keren, yang ga akan kamu temuin dimanapun. Kertas apaan sih ini?? buka dong biar tauu. Pencet aja kertasnya`,
        initial: { x: -0.36, y: 1.1, z: 0, rx: 0, ry: Math.PI, rz: 1.6 },
        animateOnOpen: true,
        fontSize: 70,
      },
      {
        bone: state.rightBone,
        text: "18-04-2004\nSELAMAT ULANG TAHUN YANG KE 22\nSITI MEGA UTAMA HENDRAWAN.\n\nSemoga panjang umur, sehat selalu, makin pinter, makin sukses, makin cantik, pokoknya yang terbaik buat kamu. Aamiin.",
        initial: { x: 0, y: 1, z: 0, rx: 0, ry: 0, rz: -1.6 },
        animateOnOpen: false,
        fontSize: 75,
      },
      {
        bone: state.leftBone,
        text: "Makasih ya udah jadi orang baik dihidup aku, aku seneng bisa kenal kamu, kamu orangnya baik, pinter. Aku masih bisa inget hal-hal kecil karena kamu salah satu orang yang masuk core memori aku, So you're special.\nJangan lupa baca halaman belakang ya hahaha",
        initial: { x: 0.05, y: 1, z: 0, rx: 0, ry: 0, rz: 1.6 },
        animateOnOpen: false,
        fontSize: 75,
      },
      {
        bone: state.leftBone,
        text: "Yang Buat:\nProgrammer ganteng dan intelek",
        initial: { x: 0.5, y: 1, z: 0, rx: 0, ry: Math.PI, rz: -1.6 },
        animateOnOpen: false,
        fontSize: 80,
      },
    ];

    if (state.rightBone) state.rightBone.rotation.y = Math.PI * 0.99;

    setup.forEach((p) => {
      if (p.bone) {
        createTypewriterPage(
          p.bone,
          planeSize,
          p.text,
          p.initial,
          p.animateOnOpen,
          p.fontSize,
        );
      }
    });
  });

  state.model.position.set(
    CONFIG.model.initialPos.x,
    CONFIG.model.initialPos.y,
    CONFIG.model.initialPos.z,
  );
  state.model.rotation.set(Math.PI / 4, 0, 0);

  gsap.to(state.model.rotation, {
    x: Math.PI / 2,
    duration: CONFIG.interaction.cameraAnimDuration,
    ease: "power2.out",
    onComplete: () => {
      toggleDescription(true);
      setTimeout(() => {
        state.pages.forEach((p) => {
          if (p.animateOnOpen) startTypewriter(p);
        });
      }, 1000);
    },
  });
});

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
    if (state.isAnimating) return;

    state.isBookOpen = !state.isBookOpen;
    state.isAnimating = true;

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
      onComplete: () => {
        state.isAnimating = false;
      },
    });
  }
});

const animate = () => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
