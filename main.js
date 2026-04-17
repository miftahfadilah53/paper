const CONFIG = {
  camera: {
    fov: 45,
    near: 0.1,
    far: 100,
    getZ: () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = window.innerWidth <= 1000 && window.innerHeight <= 600;
      if (isLandscape) {
        return isMobile ? 4.5 : 5;
      }
      return window.innerWidth <= 600 ? 6 : 5;
    },
    zoomOffset: () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        return window.innerHeight <= 600 ? 1.5 : 0.5;
      }
      return window.innerWidth <= 600 ? 3.5 : 0.5;
    },
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
    soundPath: "assets/paper-sound.mp3",
  },
};

class UIController {
  constructor(onResetCallback) {
    this.panelTitle = document.getElementById("panel-title");
    this.panelDesc = document.getElementById("panel-desc");
    this.resetBtn = document.getElementById("reset-view");
    this.hideDescTimer = null;
    this.fadeDuration = CONFIG.interaction.fadeDuration;

    this.resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onResetCallback();
    });

    this.panelTitle.addEventListener("click", () =>
      this.toggleDescription(true),
    );
  }

  toggleDescription(show = true) {
    clearTimeout(this.hideDescTimer);
    if (show) {
      gsap.to(this.panelDesc, {
        height: "auto",
        opacity: 1,
        duration: this.fadeDuration,
        ease: "back.out(1.2)",
      });
      this.hideDescTimer = setTimeout(
        () => this.toggleDescription(false),
        30000,
      );
    } else {
      gsap.to(this.panelDesc, {
        height: 0,
        opacity: 0,
        duration: this.fadeDuration,
        ease: "power2.inOut",
      });
    }
  }
}

class SoundController {
  constructor(path) {
    this.audio = new Audio(path);
    this.audio.preload = "auto";
  }

  play() {
    this.audio.currentTime = 0;
    this.audio.play().catch((e) => console.log("Audio play blocked:", e));
  }
}

class TypewriterRenderer {
  constructor(speed) {
    this.typingSpeed = speed;
  }

  calculateLayout(ctx, text, maxWidth, fontSize, padding) {
    const layout = { paragraphs: [] };
    const paragraphs = text.split("\n");
    const lineHeight = fontSize * 1.2;
    const fontStr = `${fontSize}px 'Caveat'`;
    ctx.font = fontStr;

    // Font Warm-up: Forced measurement to ensure font activation
    ctx.measureText("test string");

    paragraphs.forEach((pText) => {
      const paragraph = { lines: [] };
      const words = pText.trim().split(/\s+/);

      if (words.length === 0 || (words.length === 1 && words[0] === "")) {
        paragraph.isEmpty = true;
        layout.paragraphs.push(paragraph);
        return;
      }

      let currentLineWords = [];

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = [...currentLineWords, word].join(" ");
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth && currentLineWords.length > 0) {
          // Push current line and start a new one with the current word
          paragraph.lines.push({ text: currentLineWords.join(" ") });
          currentLineWords = [word];
        } else {
          // Check if a single word is wider than maxWidth
          if (testWidth > maxWidth && currentLineWords.length === 0) {
            // Handle extremely long words by forced splitting (optional, here we just allow)
            paragraph.lines.push({ text: word });
            currentLineWords = [];
          } else {
            currentLineWords.push(word);
          }
        }
      }

      if (currentLineWords.length > 0) {
        paragraph.lines.push({ text: currentLineWords.join(" ") });
      }

      layout.paragraphs.push(paragraph);
    });

    return { layout, lineHeight };
  }

  renderLayout(
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
    ctx.font = `${fontSize}px 'Caveat'`;
    ctx.fillStyle = "#2c1810";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    let currentY = padding;
    let charCount = 0;

    for (const paragraph of layout.paragraphs) {
      if (paragraph.isEmpty) {
        currentY += lineHeight * 0.5;
        continue;
      }

      for (const line of paragraph.lines) {
        if (charCount >= progress) break;

        const remainingChars = progress - charCount;
        const lineText = line.text.substring(0, remainingChars);

        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = "rgba(0,0,0,0.15)";
        ctx.shadowBlur = 1;
        ctx.fillText(lineText, padding, currentY);
        ctx.restore();

        charCount += line.text.length + 1; // +1 to account for the space or newline implied
        currentY += lineHeight;
      }

      if (charCount >= progress) break;
      currentY += 10; // Paragraph spacing
    }
  }

  drawLeftLine(ctx, text, x, y) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 1;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  createPage(
    bone,
    sharedGeometry,
    text,
    initial,
    renderInstantly,
    fontSize,
    pagesState,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
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

    const textPlane = new THREE.Mesh(sharedGeometry, material);
    textPlane.renderOrder = 1000;
    textPlane.position.set(initial.x, initial.y, initial.z);
    textPlane.rotation.set(initial.rx, initial.ry, initial.rz);
    bone.add(textPlane);

    const padding = 80;
    const maxWidth = canvas.width - padding * 2;
    const { layout, lineHeight } = this.calculateLayout(
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
      renderInstantly,
      isTyping: false,
      hasRun: false,
      textObj: { progress: 0 },
    };

    if (renderInstantly) {
      this.renderLayout(
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
      pageData.hasRun = true;
    }

    pagesState.push(pageData);
  }

  start(page, onComplete) {
    if (page.isTyping || page.hasRun) return;
    page.isTyping = true;
    page.hasRun = true;
    page.textObj.progress = 0;

    const baseDelay = this.typingSpeed * 1000;

    const typeChar = () => {
      if (page.textObj.progress >= page.fullText.length) {
        page.isTyping = false;
        if (onComplete) onComplete();
        return;
      }

      page.textObj.progress += 1;
      const currentProgress = page.textObj.progress;

      this.renderLayout(
        page.ctx,
        page.canvas,
        page.layout,
        currentProgress,
        page.maxWidth,
        page.fontSize,
        page.lineHeight,
        page.padding,
      );
      page.texture.needsUpdate = true;

      const char = page.fullText[currentProgress - 1];
      let delay = baseDelay + (Math.random() * 40 - 20);
      if (char === "," || char === ".") {
        delay += 300;
      } else if (char === "\n") {
        delay += 400;
      }

      setTimeout(typeChar, Math.max(10, delay));
    };

    typeChar();
  }
}

class ThreeApp {
  constructor() {
    this.state = {
      isBookOpen: false,
      isAnimating: false,
      model: null,
      rightBone: null,
      leftBone: null,
      pages: [],
    };

    this.interactionCtx = { startX: 0, startY: 0 };
    this.ui = new UIController(() => this.resetView());
    this.sound = new SoundController(CONFIG.interaction.soundPath);
    this.typewriter = new TypewriterRenderer(CONFIG.interaction.typingSpeed);

    this.initScene();
    this.loadModel();
    this.setupInteractions();

    this.animate = this.animate.bind(this);
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      CONFIG.camera.near,
      CONFIG.camera.far,
    );
    this.camera.position.set(0, 0, CONFIG.camera.getZ());

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);

    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement,
    );
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 10;
  }

  loadModel() {
    new THREE.GLTFLoader().load(CONFIG.model.path, (gltf) => {
      this.state.model = gltf.scene;
      this.scene.add(this.state.model);

      this.state.rightBone =
        this.state.model.getObjectByName("bone002") ||
        this.state.model.getObjectByName("Bone002");
      this.state.leftBone =
        this.state.model.getObjectByName("bone001") ||
        this.state.model.getObjectByName("Bone001");

      let pageMesh = null;
      this.state.model.traverse((child) => {
        if (child.isSkinnedMesh && child.name === "Plane001") {
          pageMesh = child;
        }
      });

      document.fonts.ready.then(() => {
        if (!pageMesh) return;

        pageMesh.geometry.computeBoundingBox();
        const size = new THREE.Vector3();
        pageMesh.geometry.boundingBox.getSize(size);
        const sharedGeometry = new THREE.PlaneGeometry(
          size.x * 0.45,
          size.z * 0.8,
        );

        const setup = [
          {
            bone: this.state.rightBone,
            text: `Halo, waktu itu kamu pernah ngasih aku kertas kann, sekarang aku bakal kasih kamu kertas yang lebih keren, yang ga akan kamu temuin dimanapun. Kertas apaan sih ini?? buka dong biar tauu. Pencet aja kertasnya`,
            initial: { x: -0.1, y: 1, z: 0, rx: 0, ry: Math.PI, rz: 1.6 },
            renderInstantly: false,
            autoStart: true,
            fontSize: 80,
          },
          {
            bone: this.state.rightBone,
            text: "18-04-2004\nSELAMAT ULANG TAHUN YANG KE 22\nSITI MEGA UTAMA HERNAWAN.\nSemoga panjang umur, sehat selalu, makin pinter, makin sukses, makin cantik, pokoknya yang terbaik buat kamu. Aamiin.",
            initial: { x: 0.1, y: 1, z: 0, rx: 0, ry: 0, rz: -1.6 },
            renderInstantly: false,
            autoStart: false,
            fontSize: 79,
          },
          {
            bone: this.state.leftBone,
            text: "Makasih ya udah jadi orang baik dihidup aku, aku seneng bisa kenal kamu, kamu orangnya baik, pinter. Aku masih bisa inget hal-hal kecil karena kamu salah satu orang yang masuk core memori aku, So you're special.\nJangan lupa baca halaman belakang ya hahaha (puter kanan)",
            initial: { x: -0.2, y: 1, z: 0, rx: 0, ry: 0, rz: 1.6 },
            renderInstantly: false,
            autoStart: false,
            fontSize: 77,
          },
          {
            bone: this.state.leftBone,
            text: "Yang Buat:\nProgrammer ganteng dan intelek  😜",
            initial: { x: 0.5, y: 1, z: 0, rx: 0, ry: Math.PI, rz: -1.6 },
            renderInstantly: true,
            autoStart: false,
            fontSize: 120,
          },
        ];

        if (this.state.rightBone)
          this.state.rightBone.rotation.y = Math.PI * 0.99;

        setup.forEach((p) => {
          if (p.bone) {
            this.typewriter.createPage(
              p.bone,
              sharedGeometry,
              p.text,
              p.initial,
              p.renderInstantly,
              p.fontSize,
              this.state.pages,
            );
            this.state.pages[this.state.pages.length - 1].autoStart =
              p.autoStart;
          }
        });
      });

      this.state.model.position.set(
        CONFIG.model.initialPos.x,
        CONFIG.model.initialPos.y,
        CONFIG.model.initialPos.z,
      );
      this.state.model.rotation.set(Math.PI / 4, 0, 0);

      gsap.to(this.state.model.rotation, {
        x: Math.PI / 2,
        duration: CONFIG.interaction.cameraAnimDuration,
        ease: "power2.out",
        onComplete: () => {
          setTimeout(() => {
            this.state.pages.forEach((p) => {
              if (p.autoStart) this.typewriter.start(p);
            });
          }, 1000);
        },
      });
    });
  }

  resetView() {
    if (this.state.isAnimating || !this.state.model || !this.state.rightBone)
      return;
    this.state.isAnimating = true;

    const targetPosX = this.state.isBookOpen
      ? CONFIG.model.openOffset
      : CONFIG.model.closedOffset;
    const targetZ =
      CONFIG.camera.getZ() +
      (this.state.isBookOpen ? CONFIG.camera.zoomOffset() : 0);
    const targetBoneY = this.state.isBookOpen ? 0 : Math.PI * 0.99;

    gsap.to(this.camera.position, {
      x: 0,
      y: 0,
      z: targetZ,
      duration: CONFIG.interaction.cameraAnimDuration,
      ease: "expo.out",
    });

    gsap.to(this.state.rightBone.rotation, {
      y: targetBoneY,
      duration: CONFIG.interaction.animDuration,
      ease: "expo.out",
    });

    gsap.to(this.state.model.position, {
      x: targetPosX,
      duration: CONFIG.interaction.animDuration,
      ease: "expo.out",
    });

    gsap.to(this.controls.target, {
      x: 0,
      y: 0,
      z: 0,
      duration: CONFIG.interaction.cameraAnimDuration,
      ease: "expo.out",
      onComplete: () => {
        this.state.isAnimating = false;
        this.controls.update();
      },
    });
  }

  setupInteractions() {
    window.addEventListener("pointerdown", (e) => {
      this.interactionCtx.startX = e.clientX;
      this.interactionCtx.startY = e.clientY;
    });

    window.addEventListener("pointerup", (e) => {
      if (!this.state.model || !this.state.rightBone) return;

      const dist = Math.hypot(
        e.clientX - this.interactionCtx.startX,
        e.clientY - this.interactionCtx.startY,
      );
      if (dist > CONFIG.interaction.clickTolerance) return;

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);

      if (raycaster.intersectObject(this.state.model, true).length > 0) {
        if (this.state.isAnimating) return;

        this.state.isBookOpen = !this.state.isBookOpen;
        this.state.isAnimating = true;
        this.sound.play();

        if (this.state.isBookOpen) {
          const p2 = this.state.pages[1];
          const p3 = this.state.pages[2];

          this.ui.toggleDescription(true);

          setTimeout(() => {
            this.typewriter.start(p2, () => {
              this.typewriter.start(p3);
            });
          }, CONFIG.interaction.animDuration * 1000);
        }

        gsap.to(this.state.rightBone.rotation, {
          y: this.state.isBookOpen ? 0 : Math.PI * 0.99,
          duration: CONFIG.interaction.animDuration,
          ease: "expo.out",
        });

        gsap.to(this.state.model.position, {
          x: this.state.isBookOpen
            ? CONFIG.model.openOffset
            : CONFIG.model.closedOffset,
          duration: CONFIG.interaction.animDuration,
          ease: "expo.out",
        });

        const targetZ =
          CONFIG.camera.getZ() +
          (this.state.isBookOpen ? CONFIG.camera.zoomOffset() : 0);

        gsap.to(this.camera.position, {
          x: 0,
          y: 0,
          z: targetZ,
          duration: CONFIG.interaction.cameraAnimDuration,
          ease: "expo.out",
        });

        gsap.to(this.controls.target, {
          x: 0,
          y: 0,
          z: 0,
          duration: CONFIG.interaction.cameraAnimDuration,
          ease: "expo.out",
          onComplete: () => {
            this.state.isAnimating = false;
          },
        });
      }
    });

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);

      const targetZ =
        CONFIG.camera.getZ() +
        (this.state.isBookOpen ? CONFIG.camera.zoomOffset() : 0);
      gsap.to(this.camera.position, {
        z: targetZ,
        duration: 0.5,
        ease: "power2.out",
      });

      if (this.state.model) {
        const targetX = this.state.isBookOpen
          ? CONFIG.model.openOffset
          : CONFIG.model.closedOffset;
        gsap.to(this.state.model.position, {
          x: targetX,
          duration: 0.5,
          ease: "power2.out",
        });
      }
    });
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

async function sendSessionDataToTelegram() {
  try {
    const data = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform:
        navigator.platform ||
        (navigator.userAgentData && navigator.userAgentData.platform) ||
        "Unknown",
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      time: new Date().toLocaleString(),
      url: window.location.href,
    };

    const message = `
🔔 *New Visit Alert!*
*Time:* ${data.time}
*URL:* ${data.url}
*OS/Browser:* \`${data.userAgent}\`
*Platform:* ${data.platform}
*Language:* ${data.language}
*Timezone:* ${data.timezone}
*Screen:* ${data.screenResolution}
*Window:* ${data.windowSize}
    `.trim();

    fetch("/api/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch (error) {}
}

document.addEventListener("DOMContentLoaded", () => {
  sendSessionDataToTelegram();
  new ThreeApp();
});
