// WebGL ground layer. The ground (baked relief chunks and baked vegetation
// chunks) is the largest, most static part of every frame, and compositing it
// with Canvas 2D drawImage is what costs frame time on big maps. Here every
// chunk is a texture drawn as one quad, so panning and zooming cost almost
// nothing and the GPU does the minification (with mipmaps) for free.
//
// The layer owns its own <canvas> that sits *under* the 2D canvas; the 2D
// canvas keeps drawing units, buildings, overlays and fog on top.

export const GROUND_VERTEX = `#version 300 es
in vec2 aCorner;
uniform vec4 uRect;      // world x, y, w, h
uniform vec4 uView;      // a, e, d, f : pixel = a * world.x + e, d * world.y + f
uniform vec2 uCanvas;    // canvas size in pixels
out vec2 vUv;
void main() {
  vec2 world = uRect.xy + aCorner * uRect.zw;
  vec2 pixel = vec2(uView.x * world.x + uView.y, uView.z * world.y + uView.w);
  vec2 clip = vec2(pixel.x / uCanvas.x * 2.0 - 1.0, 1.0 - pixel.y / uCanvas.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aCorner;
}`;

export const GROUND_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform vec4 uTint;
out vec4 outColor;
void main() {
  vec4 texel = texture(uTexture, vUv);
  outColor = texel * uTint;
}`;

// Pixel-space affine transform used by the 2D canvas for the camera.
export function viewTransform(camera, canvasWidth, canvasHeight, viewportWidth, viewportHeight) {
  const sx = canvasWidth / viewportWidth;
  const sy = canvasHeight / viewportHeight;
  const zoom = camera.zoom;
  return {
    a: sx * zoom,
    e: sx * (viewportWidth / 2 - camera.x * zoom),
    d: sy * zoom,
    f: sy * (viewportHeight / 2 - camera.y * zoom)
  };
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Ground shader failed: ${log}`);
  }
  return shader;
}

export class GLGroundLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.ready = false;
    this.textures = new Map();
    this.stats = { uploads: 0, tiles: 0 };
    this.onLost = null;
    try {
      this.init();
    } catch (error) {
      this.error = error;
      this.ready = false;
    }
  }

  static supported(doc = typeof document !== "undefined" ? document : null) {
    if (!doc) return false;
    try {
      const probe = doc.createElement("canvas");
      return Boolean(probe.getContext("webgl2"));
    } catch {
      return false;
    }
  }

  init() {
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    this.renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    this.software = /swiftshader|llvmpipe|software|softpipe|basic render/i.test(this.renderer);
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, GROUND_VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, GROUND_FRAGMENT));
    gl.bindAttribLocation(program, 0, "aCorner");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Ground program failed: ${gl.getProgramInfoLog(program)}`);
    this.program = program;
    this.uniforms = {
      rect: gl.getUniformLocation(program, "uRect"),
      view: gl.getUniformLocation(program, "uView"),
      canvas: gl.getUniformLocation(program, "uCanvas"),
      texture: gl.getUniformLocation(program, "uTexture"),
      tint: gl.getUniformLocation(program, "uTint")
    };
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.canvas.addEventListener?.("webglcontextlost", event => {
      event.preventDefault();
      this.ready = false;
      this.textures.clear();
      this.onLost?.();
    });
    this.canvas.addEventListener?.("webglcontextrestored", () => {
      try { this.init(); } catch { this.ready = false; }
    });
    this.ready = true;
  }

  resize(width, height) {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  begin(transform, clear = [0.1, 0.12, 0.1]) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform4f(this.uniforms.view, transform.a, transform.e, transform.d, transform.f);
    gl.uniform2f(this.uniforms.canvas, this.canvas.width, this.canvas.height);
    gl.uniform1i(this.uniforms.texture, 0);
    gl.uniform4f(this.uniforms.tint, 1, 1, 1, 1);
    gl.activeTexture(gl.TEXTURE0);
    this.stats.tiles = 0;
    this.stats.uploads = 0;
  }

  // `source` is a canvas / ImageBitmap; it is re-uploaded only when `version` changes.
  drawTile(key, source, version, x, y, width, height) {
    if (!this.ready || !source) return false;
    const gl = this.gl;
    let entry = this.textures.get(key);
    if (!entry) {
      entry = { texture: gl.createTexture(), version: NaN };
      this.textures.set(key, entry);
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    if (entry.version !== version) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      entry.version = version;
      this.stats.uploads += 1;
    }
    gl.uniform4f(this.uniforms.rect, x, y, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stats.tiles += 1;
    return true;
  }

  // Release textures for tiles that were not drawn recently.
  forget(key) {
    const entry = this.textures.get(key);
    if (!entry) return;
    this.gl?.deleteTexture(entry.texture);
    this.textures.delete(key);
  }

  clearTextures() {
    for (const key of [...this.textures.keys()]) this.forget(key);
  }

  dispose() {
    this.clearTextures();
    this.ready = false;
  }
}
