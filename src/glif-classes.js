//
// glif-classes.js 
// classes for simplifying the use of WebGL
//

(function (global) {

  var glif = global.glif;

  // glenv is an environment wrapper for a canvas WebGLRenderingContext object
  // all the easy to use fun flows from here

  // use glif.getEnv() below to create an instance of this class
  // @param {WebGLRenderingContext} glctx
  glif.glenv = function (glctx, options, onerror) {

    // init
    if (typeof options === 'function') {
      onerror = options; options = {};
    }
    options = options || {};

    this.onerror = onerror || function (e) {
      alert(Array.isArray(e) ? e.join('\n') : e);
    };

    this.gl = glctx;
    if (glctx instanceof HTMLCanvasElement) {// get context for canvas
      this.gl = glctx = glif.base.getWebGLContext(glctx, options, onerror);
    }

    if (!this.gl) return; // failed to get gl context

    this.draw = function () {
      glctx.drawArrays(glctx.TRIANGLE_STRIP, 0, 4);
      glctx.flush();
    };

    this.canvas = function () {
      return glctx.canvas;
    };

    this.initVertexData = function (program) {

      program.use();

      var posBuffer = glctx.createBuffer();
      glctx.bindBuffer(glctx.ARRAY_BUFFER, posBuffer);

      var vertices = new Float32Array(
        options.flipVerticesY ? [-1,  1, 0,  1,  1, 0, -1, -1, 0,  1, -1, 0] :
          [-1, -1, 0,  1, -1, 0, -1,  1, 0,  1,  1, 0]
      );

      var aPosLoc = glctx.getAttribLocation(program.program, "aPos");
      glctx.enableVertexAttribArray(aPosLoc);

      var aTexLoc = glctx.getAttribLocation(program.program, "aTexCoord");
      glctx.enableVertexAttribArray(aTexLoc);

      var texCoords = new Float32Array(
        options.flipTextureY ? [0, 1, 1, 1, 0, 0, 1, 0] :
          [0, 0, 1, 0, 0, 1, 1, 1]
      );

      var texCoordOffset = vertices.byteLength;

      glctx.bufferData(glctx.ARRAY_BUFFER, texCoordOffset + texCoords.byteLength, glctx.STATIC_DRAW);

      glctx.bufferSubData(glctx.ARRAY_BUFFER, 0, vertices);
      glctx.bufferSubData(glctx.ARRAY_BUFFER, texCoordOffset, texCoords);
      glctx.vertexAttribPointer(aPosLoc, 3, glctx.FLOAT, glctx.FALSE, 0, 0);
      glctx.vertexAttribPointer(aTexLoc, 2, glctx.FLOAT, glctx.FALSE, 0, texCoordOffset);

      var w = glctx.canvas.width, h = glctx.canvas.height;

      if (options.viewport) glctx.viewport.apply(glctx, options.viewport); // expecting array[4]
      else glctx.viewport(0, 0, w, h);
      // set default uniforms here... 
      program._setUniform('2f', "pixelSize", 1 / w, 1 / h);
      //program._setUniform('2i', "res", w, h);
      //program._setUniform('1f', "aspect", w / h);
    };

    this.createProgram = function (fragmentshader, options) {
      options = options || {};
      var program = new glif.Program (this,
            glif.glsl.getDefaultVS(options.flip), // vertex
            fragmentshader,
            options);

      return (program.program) ? program : null;
    };

    this.createImageTexture = function (image, options) {
      return new glif.Texture (this, options).setImage(image);
    };

    // (null) returns null
    // ({Texture}) returns Texture
    // ({Image|Canvas}, [options]) returns image painted on new texture  
    // (width {Number}, height {Number}, [options]) returns empty texture w x h

    this.createTexture = function (width, height, options) {
      if (width === null) return width;
      if (width instanceof glif.Texture) return width; // passthru
      if (glif.util.isImage(width)) return this.createImageTexture(width, height);
      return new glif.Texture (this, width, height, options);
    };

    // copy this canvas to destcanvas
    this.copyCanvas = function (outputcanvas) {
      outputcanvas.width = this.gl.canvas.width;
      outputcanvas.height = this.gl.canvas.height;
      outputcanvas.getContext('2d').drawImage(this.gl.canvas, 0, 0);
      return outputcanvas;
    }

    // return a a copy of context's canvas 
    this.getCanvas = function (options) {
      if (options && options.direct) return this.gl.canvas;
        // make a copy, to bypass y-flip and image data availability problems
      return this.copyCanvas(document.createElement('canvas'));
    }

    this.getTexture = function (options) {
      //if ( !this._texture ) // contents of canvas may change, don't cache
      //this._texture = 
      return this.createImageTexture(this.getCanvas(options));
      //return this._texture;
    };
  };


  // call getEnv('canvasid') to get a glif environment for a webgl enabled canvas

  // @param { WebGLRenderingContext | Canvas | String | null} glctx : element ref or a canvas id or null to create
  // @param [options] : options to create webgl context
  // @param [onerror] : error callback

  glif.getEnv = function (glctx, options, onerror) {
    if (!glctx) { 
      glctx = document.createElement('canvas');
      glctx.width = options.width || 512;
      glctx.height = options.height || 512;
    }
    if (typeof glctx === 'string') {
      glctx = document.getElementById(glctx);
    }
    var env = new glif.glenv(glctx, options, onerror);
    if (!env.gl) {
      // iOS gets this far
      (onerror || alert)('error getting WebGL rendering context from canvas');
      return null;
    }

    return env;
  };



  // use glenv.createTexture instead of creating a Texture directly

  glif.Texture = function (glenv, width, height, _options) {

    var gl = glenv.gl,
    options = _options;

    if (typeof width === 'object') {
      options = width;
      width = options.width; height = options.height;
    }

    options = options || {};

    this.bind = function () {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
    };

    this.active = function (index) {
      gl.activeTexture(gl.TEXTURE0 + (index || 0));
    };  

    this.texture = gl.createTexture();
    this.format = options.format || gl.RGBA;
    this.type = options.type || gl.UNSIGNED_BYTE;
    this.width = width;
    this.height = height;

    if (typeof options.textureUnit === 'number')
      this.active(options.textureUnit);

    this.bind();

    // defaults are for pixel aligned images
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
      (options.wrap ? gl.REPEAT : null) || options.wrapS || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,
      (options.wrap ? gl.REPEAT : null) || options.wrapT || gl.CLAMP_TO_EDGE);


    var minfilter = options.minFilter || options.filter || gl.NEAREST;
    if (minfilter === 'linear') minfilter = gl.LINEAR;
    else if (minfilter === 'nearest') minfilter = gl.NEAREST;
    else if (minfilter === 'mipmap') minfilter = gl.LINEAR_MIPMAP_NEAREST;

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minfilter);
    if (minfilter === 'mipmap') gl.generateMipmap(gl.TEXTURE_2D);

    var magfilter = options.magFilter || options.filter || gl.NEAREST;
    if (magfilter === 'linear') magfilter = gl.LINEAR;
    else if (magfilter === 'nearest') magfilter = gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magfilter);


    if (width && height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, this.type, options.pixels ? new Uint8Array(pixels) : null);
    }

    // set texture image, options: flipY, textureUnit
    this.setImage = function (image) {

      this.width = image.width || image.videoWidth;
      this.height = image.height || image.videoHeight;

      if (typeof options.textureUnit === 'number')
        gl.activeTexture(gl.TEXTURE0 + options.textureUnit);

      this.bind();

      if (!('flipY' in options) || options.flipY)  // normally gets flipped
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, this.type, image);

      return this;
    };

    this.setTextureData = function (data, width, height) {
      this.width = width || this.width;
      this.height = height || this.height;
      this.format = gl.RGBA;
      this.type = gl.UNSIGNED_BYTE;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, this.type, new Uint8Array(data));
      return this;
    };

    this.destroy = function () {
      if (this.texture) {
        gl.deleteTexture(this.texture);
        this.texture = null;
      }
      return this;
    };

    this.use = function (unit, program, uniname) {
      gl.activeTexture(gl.TEXTURE0 + (unit || 0));
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      if (program && this.texture)
        program._setUniform('1i', uniname || options.name || 'sample' + unit, unit || 0);
      return this;
    };

    this._fb = null;
    this.framebuffer = function () {
      if (this._fb) return this._fb;
      this._fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      return this._fb;
    };

  };

  glif.Texture.prototype.usenull = function (gl, unit) {
    gl.activeTexture(gl.TEXTURE0 + (unit || 0));
    gl.bindTexture(gl.TEXTURE_2D, null);
  };


  // DoubleBuffer class

  // ({glif.glenv}, [imagesrc {Image/Canvas/Texture}], [Texture], [options])
  // ({glif.glenv}, width{Number}, height{Number}, [options])

  glif.DoubleBuffer = function (glenv, texture0, texture1, options) {
    var _index = false;

    var w , h, _owned_tex = [];

    this.createOwnedTexture = function (opt) {
      var t = glenv.createTexture(opt);
      _owned_tex.push(t);
      return t;
    };

    if (!texture0) {// use gl ctx size
      w = glenv.gl.canvas.width; h = glenv.gl.canvas.height;
      // options can move up
      options = options || texture1;
    }
    else if (typeof texture0 === 'number' && typeof texture1 === 'number') {
      w = texture0; h = texture1;
      texture0 = null; texture1 = null;
    }
    else if (glif.util.isImage(texture0)) {
      w = texture0.width; h = texture0.height;
      texture0 = this.createOwnedTexture(texture0);
    }
    else if (texture0 instanceof glif.Texture) {
      w = texture0.width; h = texture0.height;
    }
    else if (typeof texture0 === 'object') {
      options = texture0;
      texture0 = null;
    }

    options = options || {};
    w = w || options.width || glenv.gl.canvas.width; h = h || options.height || glenv.gl.canvas.height;

    if (!texture0) {texture0 = glenv.createTexture(w, h, options); _owned_tex.push(texture0);}
    if (!texture1) {texture1 = glenv.createTexture(w, h, options); _owned_tex.push(texture1);}

    var fb0 = texture0.framebuffer();
    var fb1 = texture1.framebuffer();

    this.inputTexture = function () {return _index ? texture0 : texture1;};
    this.outputTexture = function () {return _index ? texture1 : texture0;};
    this.outputFB = function () {return _index ? fb1 : fb0;};

    this.advance = function () {
      _index = 1 - _index;  //console.log('advance ', _index);
      return this.inputTexture(); // return texture last written to
    };

    this.destroy = function () {
      _owned_tex.forEach(function (tex) {tex.destroy();});
      _owned_tex = [];
    };
  };


  // Program class

  glif.Program = function (glenv, vs, fs, options) {

    var on_error, _gl = glenv.gl;

    if (typeof options === 'function') {
      on_error = options; options = {};
    }
    options = options || {};

    this.use = function () {
      _gl.useProgram(this.program);
    };

    // bind input textures and output framebuffer
    function bindIO(intex, outfb, program) {
      if (!Array.isArray(intex))
        intex = [intex];

      for (var i = 0; i < intex.length; i++) {
        if (intex[i]) intex[i].use(i, program);
        else glif.Texture.prototype.usenull(_gl, i);
      }

      // outfb can be a framebuffer or output texture or null
      outfb = (outfb && outfb.framebuffer) ? outfb.framebuffer() : outfb;
      _gl.bindFramebuffer(_gl.FRAMEBUFFER, outfb);
    }

    // 'Program interface' this is the only method to call normally
    this.run = function (inputs, output, properties) {
      this.use();

      if (properties) {
        this._setProperties(properties);
      }

      // if 'output' is a Canvas, copy glenv to output after draw
      var canvas;
      if (output instanceof HTMLCanvasElement) { canvas = output; output = null; }
      
      bindIO(inputs, output || null, this);
      glenv.draw();

      if (canvas) glenv.copyCanvas(canvas);

      return true;
    };


    var _ulocs = {};  // uniform location cache

    this._getUniformLocation = function (name) {

      if (_ulocs[name]) return _ulocs[name];

      _ulocs[name] = glenv.gl.getUniformLocation(this.program, name);
      return _ulocs[name];
    };

    this._setUniform = function (utype, name, values) {

      var args = (Array.isArray(values) && utype.slice(-1) !== 'v') ?
          values :
        Array.prototype.slice.call(arguments, 2);

      args.unshift(this._getUniformLocation(name));
      var ufnname = 'uniform' + utype,
      fn = glenv.gl[ufnname]; //  || glenv.gl.__proto__[ufnname]; // __proto__ makes this work with WebGLInspector
      fn.apply(glenv.gl, args);
    };

    this._setUniforms = function (uniforms) {
      for (var i = 0; i < uniforms.length; i++) {
        var u = uniforms[i];
        this._setUniform(u[0], u[1], u.slice(2));
      }
    };

    this._setPropertyVector = function (name, vec, typeint) {
      if (vec.length == 2)
        this._setUniform(typeint ? '2i' : '2f', name, vec[0], vec[1]);
      else if (vec.length == 3)
        this._setUniform(typeint ? '3i' : '3f', name, vec[0], vec[1], vec[2]);
      else if (vec.length == 4)
        this._setUniform(typeint ? '4i' : '4f', name, vec[0], vec[1], vec[2], vec[3]);
      else
        this._setUniform(typeint ? '1iv' : '1fv', name, vec);
    };

    this._setPropertyMatrix3 = function (name, mat3) {
      _gl.uniformMatrix3fv(this._getUniformLocation(name), false, (mat3 instanceof glif.mat3) ? mat3._m : mat3);
    };

    this._setProperty = function (name, val) {
      if (Array.isArray(val)) {
        this._setPropertyVector(name, val);
      }
      else if (typeof val === 'object') { // type identified or matrix object
        if (val instanceof glif.mat3)
          this._setPropertyMatrix3(name, val);
        else if (val.type === 'mat3')
          this._setPropertyMatrix3(name, val.value);
        else if (Array.isArray(val.value))
          this._setPropertyVector(name, val.value, val.type === 'int');
        else
          this._setUniform((val.type === 'int') ? '1i' : '1f', name, val.value);
      }
      else if (typeof val === 'number')
        this._setUniform('1f', name, val);
      else
        console.log('unknown type for uniform property', name, val);
    };

    this._setProperties = function (props) {
      if (!props) return;
      for (var k in props) {this._setProperty(k, props[k]);}
    };

    // initialize
    this.program = glif.base.createProgram(glenv.gl, vs, fs, on_error || glenv.onerror);

    if (!this.program) {// failed
      return null;
    }

    if (!options.noinit) {
      glenv.initVertexData(this, options);
    }

    return this;
  };


  glif.programs = glif.programs || {};

  glif.programs.CopyProgram = function (glenv, options, mat3) {
    options = options || {};
    this.mat3 = mat3 || [1, 0, 0, 0, 1, 0, 0, 0, 1];

    var shadertext = glif.glsl.commonFS +
      'uniform sampler2D sample0;\n' +
      'void main(void) {\n' +
      '  gl_FragColor = texture2D(sample0, pos);\n' +
      (options.rgb ? '  gl_FragColor.a = ' + glif.glsl.floatstr(options.alpha || 1) + ';\n'  : '') +
      '}';

    var prog = new glif.Program(glenv, glif.glsl.getMat3VS(), shadertext);

    this.run = function (input, output) {
      prog.run(input, output, { 'transform': { type:'mat3', value: this.mat3 } });
    };

  };

})(this);
