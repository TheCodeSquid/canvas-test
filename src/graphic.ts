const FPS = 48;
const MILLIS_PER_FRAME = (1 / FPS) * 1000;

const VERTEX_SHADER = `
  precision highp float;

  attribute vec2 pos;
  attribute vec2 uv;

  varying vec2 v_uv;

  void main() {
    gl_Position = vec4(pos, 0.0, 1.0);
    v_uv = uv;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 screen;
  uniform float time;

  varying vec2 v_uv;

  // randomness for dithering
  // https://shader-tutorial.dev/advanced/color-banding-dithering/
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 47358.5453);
  }

  void main() {
    float aspect = screen.x / screen.y;
    float middle = screen.y / 2.0;
    vec2 screen_uv = v_uv * screen;

    float wave_scale = max(40.0, min(screen.x / 25.0, pow(screen.x / 80.0, 2.0)));

    float main_wave = sin(screen_uv.x / wave_scale + time) * wave_scale;
    float sub_wave = sin(screen_uv.x / wave_scale * 0.2 + time) * wave_scale * 0.5;
    float curve = pow(screen_uv.x / (60.0 * aspect), 2.0);
    float pulse = pow(sin(time * 1.5), 2.0) * 0.9 + 1.0;

    float offset = middle / 10.0;
    float threshold = middle + main_wave + sub_wave - curve + offset;

    vec3 color;
    if (screen_uv.y < threshold) {
      // solid white
      color = vec3(1.0);
    } else {
      float proximity = screen_uv.y - threshold;
      float glow = (pulse * 7.0) / (proximity + 10.0);

      // apply glow
      color = mix(vec3(0.1), vec3(0.7, 0.5, 0.9), glow);

      // apply dither
      color += mix(-0.5/255.0, 0.5/255.0, random(screen_uv));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const VERTICES = new Float32Array([
  -1.0, -1.0,
  -1.0, 1.0,
  1.0, -1.0,
  1.0, 1.0
]);
const UVS = new Float32Array([
  0.0, 1.0,
  0.0, 0.0,
  1.0, 1.0,
  1.0, 0.0
]);

interface Buffers {
  vertex: WebGLBuffer;
  uv: WebGLBuffer;
}

interface Locations {
  attrs: {
    vertex: number;
    uv: number;
  };
  uniforms: {
    screen: WebGLUniformLocation;
    time: WebGLUniformLocation;
  }
}

export class Graphic {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;

  private width: number = 0;
  private height: number = 0;

  private program: WebGLProgram;
  private buffers: Buffers;
  private locations: Locations;

  private lastTimestamp: number | undefined;
  private time: number = 0;
  private delta: number = 0;

  get aspectRatio(): number {
    return this.width / this.height;
  }
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2")!;

    this.resize();
    window.addEventListener("resize", this.resize.bind(this));

    this.program = this.createShaderProgram([
      {
        type: this.gl.VERTEX_SHADER,
        source: VERTEX_SHADER
      },
      {
        type: this.gl.FRAGMENT_SHADER,
        source: FRAGMENT_SHADER
      }
    ]);

    this.buffers = {
      vertex: this.createBuffer(VERTICES),
      uv: this.createBuffer(UVS)
    };

    this.locations = {
      attrs: {
        vertex: this.gl.getAttribLocation(this.program, "pos"),
        uv: this.gl.getAttribLocation(this.program, "uv")
      },
      uniforms: {
        screen: this.gl.getUniformLocation(this.program, "screen")!,
        time: this.gl.getUniformLocation(this.program, "time")!
      }
    };
  }

  start() {
    requestAnimationFrame(this.frame.bind(this));
  }


  private frame(timestamp: number) {
    if (this.lastTimestamp === undefined) {
      this.lastTimestamp = timestamp;
    }

    this.delta += timestamp - this.lastTimestamp;
    this.time = timestamp / 1000;
    
    if (this.delta >= MILLIS_PER_FRAME) {
      this.render();
      this.delta -= MILLIS_PER_FRAME;
    }
    this.lastTimestamp = timestamp;

    requestAnimationFrame(this.frame.bind(this));
  }
  

  private render() {
    this.gl.viewport(0, 0, this.width, this.height);

    // shaders
    this.gl.useProgram(this.program);

    // uniforms
    this.gl.uniform2fv(this.locations.uniforms.screen, [this.width, this.height]);
    this.gl.uniform1f(this.locations.uniforms.time, this.time);

    // vertex
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertex);
    this.gl.enableVertexAttribArray(this.locations.attrs.vertex);
    this.gl.vertexAttribPointer(
      this.locations.attrs.vertex,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    // uv
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.uv);
    this.gl.enableVertexAttribArray(this.locations.attrs.uv);
    this.gl.vertexAttribPointer(
      this.locations.attrs.uv,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    // draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, VERTICES.length / 2);
  }  


  private createBuffer(data: Float32Array): WebGLBuffer {
    const buf = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    return buf;
  }
  

  private createShaderProgram(shaderInfo: {type: number, source: string}[]): WebGLProgram {
    const program = this.gl.createProgram()!;

    shaderInfo.forEach(({type, source}) => {
      const shader = this.compileShader(type, source);

      if (shader) {
        this.gl.attachShader(program, shader);
      }
    });

    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      throw new Error(`Error linking shader program:\n${info}`);
    }

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const type_str = type == this.gl.VERTEX_SHADER ? "vertex" : "fragment";
      const info = this.gl.getShaderInfoLog(shader);
      throw new Error(`Error compiling ${type_str} shader:\n${info}`);
    }
    return shader;
  }

  
  private resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }
}
