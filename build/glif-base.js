
//
// glif-base.js 
// standalone functions for managing WebGL resources
//

var glif = window._g = window.glif = {};

(function () {

// top level namespace
// base functions namespace
glif.base = {};


glif.webGLSupport = 
glif.base.webGLSupport = function (onfail) { 
  var support = !!window.WebGLRenderingContext;
  if (!support && onfail) onfail('sorry, your device does not support WebGL! Please go to http://get.webgl.org</a> for more info.');
  return support;
};


glif.getWebGLContext = 
glif.base.getWebGLContext = function (canvas, options, onerror) {

  var gl = null;

  if (typeof options === 'function') {
    onerror = options; options= {};
  }
  options = options || {};
  onerror = onerror || alert;

  if (typeof canvas === 'string')
    canvas = document.getElementById(canvas);

  try { 
   gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
  } catch (e) {
    console.log('failed to get webgl context, ', e);
    return onerror && onerror('failed to get webgl context, try again or go to get.webgl.org for more info.\n' + e);
  }

  return gl;
};

glif.base.createShader = function (gl, shaderSource, shaderType, onerror) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  // check status
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    var info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    //console.log("webgl shader compile error:\n", info, '\nsource: \n', shaderSource);
    return onerror && onerror("webgl shader compile error:\n" + info + '\nsource: \n' + shaderSource);
  }

  return shader;
};

glif.base.createProgram = function (gl, vertexShader, fragmentShader, onerror) {
  var program = gl.createProgram(), el;

  if (typeof vertexShader === 'string') {
    // look for a dom sript element
    el = (vertexShader.length < 128) ? document.getElementById(vertexShader) : null; 
    if (el && el.type === "x-shader/x-vertex") 
      vertexShader = el.text; 
    if (!(vertexShader = glif.base.createShader(gl, vertexShader, gl.VERTEX_SHADER, onerror)))
      return;
  }

  if (typeof fragmentShader === 'string') {
    el = (fragmentShader.length < 128) ? document.getElementById(fragmentShader) : null;
    if (el && el.type === "x-shader/x-fragment") 
      fragmentShader = el.text; 
    if (!(fragmentShader = glif.base.createShader(gl, fragmentShader, gl.FRAGMENT_SHADER, onerror)))
      return;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    console.log("webgl link error, ", info);
    return onerror && onerror("webgl link error, " + info);
  }
  return program;
};

glif.base.createShaderFromScriptElement = function (gl, scriptId, onerror) {
  var el = document.getElementById(scriptId);
  if (!el) return onerror && onerror('shader script element \'' + scriptId + '\' not found');

  return createShader(gl, el.text, { 
      "x-shader/x-fragment": gl.FRAGMENT_SHADER, 
      "x-shader/x-vertex": gl.VERTEX_SHADER 
    }[el.type],
    onerror);
};


// utility functions

window.requestAnimFrame = window.requestAnimFrame || (function() {
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ) {
            window.setTimeout(callback, 1000 / 60);
          };
})();


})(); 

// glif-glsl.js 
// functions/data for assembling glsl shader text strings

(function () {

// namespace
glif.s = glif.glsl = {

// floatstr(inputvalue)
// return a string float representation with decimal point
// given a number or numeric string input
floatstr: function (num) { 
  var r = '' + parseFloat(num); 
  return (r.indexOf('.') === -1) ? (r+'.') : r; 
},

// join input array or string with line feeds
joinLines: function (lines, sepr) {
  sepr = sepr || '\n';
  if (!lines) return '';
  else if (Array.isArray(lines)) return lines.join(sepr) + sepr;
  else if (typeof lines === 'string') return lines + sepr;
  return ''; // unknown type
},

// valid characters for expressions 
filterExpr: function (str) { 
  return str.replace(/[^\w\s\.\,\:\?\(\)\*\+\;\-\/\=<\>]/g,'');
},

// and filters
filterFunction: function (str) {
  return str.replace(/[^\w\s\.\,\:\?\(\)\*\+\;\-\/\=<\>\{\}]/g,'');
},

// common glsl text
commonVS: 
'attribute vec3 aPos;\n' +
'attribute vec2 aTexCoord;\n' +
'varying   vec2 pos;\n',

commonFS: 
'precision mediump float;\n' +
'varying   vec2 pos;\n',

commonUniforms: 
'uniform   vec2 pixelSize;\n',
//'uniform ivec2 res;\n' +
//'uniform   float aspect;\n',


getDefaultVS: function (flip) {
  return this.commonVS +
    'void main(void) {\n' +
    '  gl_Position = ' + (flip ? 'vec4(aPos.x, -aPos.y, aPos.z, 1.)' : 'vec4(aPos, 1.)') + ';\n' +
    '  pos = aTexCoord;\n' +
    '}\n';
},

getMat3VS: function () {
  return glif.glsl.commonVS +
  'uniform mat3 transform;\n' +
  'void main() {\n' +
  '  gl_Position = vec4(transform * aPos, 1);\n' +
  '  pos = aTexCoord;\n' +
  '}\n';
},


// build glsl fragment shader text to process a stack of pixel aligned sample2d textures

getSampleStackShaderText: function (samplect, resultexpr, options) { 
  if (typeof resultexpr === 'object') { options = resultexpr; resultexpr = options.expr; }
  options = options || {};

  // create uniform sample2d lines and variables with sample at current x, y position
  var unisamples = [], pixvars = [];

  if (!options.noxy) { 
    pixvars.push('  float x = pos.x;'); 
    pixvars.push('  float y = pos.y;'); 
  }

  for (var i = 0; i < samplect; i++) {

    // sample name and variable name defaults are 'sample0' and 'c0'
    var samplename = (options.samplenames ? options.samplenames[i] : ('sample'+i) ), 
      varname = (options.varnames ? options.varnames[i] : ('c' + i)); 

    unisamples.push('uniform sampler2D ' + samplename  + ';');
    pixvars.push( '  vec4 ' + varname  + ' = texture2D(' + samplename  + ', pos);');
  }


  return [ this.commonFS +
  this.joinLines(unisamples),
   this.joinLines(options.globals),
   this.joinLines(options.functions),
  'void main() {',
  this.joinLines(pixvars),
  this.joinLines(options.variables),
  '  gl_FragColor = ' + this.filterExpr(resultexpr) + ';',
  '}'].join('\n');
},

getSampleGLSLText: function (pos, samplename) {
  return 'texture2D(' + (samplename || 'sample0') + ', pos + pixelSize * vec2('+ pos[0] + ', '+ pos[1] + '))';
},

// generate fragment shader text for weight averaged sum of samples

getWeightedSampleSumShaderText: function (kernel, positions, options) {
  options = options || {};
  var uniform = typeof kernel === 'string', // use uniform to pass weights, kernel is uniform array name
    samplename = options.samplename || 'sample0',

    code = this.commonFS + this.commonUniforms +
        'uniform sampler2D ' + samplename + ';\n' + 
        (uniform ? 'uniform float ' + kernel + '[' + positions.length + '];\n' : '') + 
        'void main() {\n' + 
        'vec4 sum = vec4(0.0);\n';

  for (var i=0; i<positions.length; i++) {
    code += 'sum += ' +
      this.getSampleGLSLText(positions[i], samplename) + ' * ' + 
      (uniform ? ( kernel  + '[' + i + ']' ) : this.floatstr(kernel[i])) + 
      ';\n';
  }

  code += 'gl_FragColor = ';
  if (options.value_script) 
    code += value_script + ';\n';
  else if (options.rgb) 
    code += 'vec4(sum.rgb, texture2D(' + samplename + ', pos).a);\n';
  else
    code += 'sum;\n';
  code += '}';

  //console.log(code);
  return code;
}


}; // glif.glsl namespace


})(); 

// glif-math.js 

(function () {


glif.mat3 = function (mat) {

  this.setArray = function (a) { 
    this._m = a.slice(); 
    while (this._m.length < 9) this._m.push(0); 
    return this; 
  };

  this.identity = function() { return this.setArray([1, 0, 0, 0, 1, 0, 0, 0, 1]); };

  this.zero = function() { return this.setArray([0, 0, 0, 0, 0, 0, 0, 0, 0]); };

  // set a translation matrix
  this.setTranslation = function (tx, ty) { return this.setArray([1, 0, 0, 0, 1, 0, tx||0, ty||0, 1]); };

  this.setScale = function (sx, sy) { return this.setArray([sx, 0, 0, 0, (isNaN(sy) ? sx : sy), 0, 0, 0, 1]); };

  this.setRotation = function (rad) {
    var c = Math.cos(rad), s = Math.sin(rad); return this.setArray([c,-s, 0, s, c, 0, 0, 0, 1]);
  };

  this.setShear = function (dx, dy) { return this.setArray([1, dx, 0, dy, 1, 0, 0, 0, 1]); };

  this.translate = function (tx, ty) { return this.multiply(new glif.mat3().setTranslation(tx, ty)); };

  this.scale = function (sx, sy) { return this.multiply(new glif.mat3().setScale(sx, sy)); };

  this.rotate = function (rad) { return this.multiply(new glif.mat3().setRotation(rad)); };

  this.shear = function (dx, dy) { return this.multiply(new glif.mat3().setShear(dx, dy)); };

  function multiplyArrays (a, b) {
    // a & b must be 1d row major matrix arrays
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b00 = b[0], b01 = b[1], b02 = b[2],
        b10 = b[3], b11 = b[4], b12 = b[5],
        b20 = b[6], b21 = b[7], b22 = b[8];

    return [ 
      b00 * a00 + b01 * a10 + b02 * a20,
      b00 * a01 + b01 * a11 + b02 * a21,
      b00 * a02 + b01 * a12 + b02 * a22,
      b10 * a00 + b11 * a10 + b12 * a20,
      b10 * a01 + b11 * a11 + b12 * a21,
      b10 * a02 + b11 * a12 + b12 * a22,
      b20 * a00 + b21 * a10 + b22 * a20,
      b20 * a01 + b21 * a11 + b22 * a21,
      b20 * a02 + b21 * a12 + b22 * a22
    ];
  }

  // mult this by matrix 
  this.multiply = function (m) {
    var b = (m instanceof glif.mat3) ? m._m : m;
    this.setArray(multiplyArrays(this._m, b));
    return this;
  };

  // init
  if (Array.isArray(mat)) this.setArray(mat);
  else if (mat instanceof glif.mat3) this.setArray(mat._m);
  else this.identity();

   return this;
};

/*
glif.mat4 = function (mat) {

  this.setArray = function (a) { 
    this._m = a.slice(); 
    while (this._m.length < 16) this._m.push(0); 
    return this; 
  };

  this.identity = function() { return this.setArray([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); };

  this.zero = function() { return this.setArray([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]); };

  // set a translation matrix
  this.setTranslation = function (tx, ty, tz) { 
    return this.setArray([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, tx || 0, ty || 0, tz || 0, 1]); 
  };

  this.setScale = function (sx, sy) { 
    sy = isNan(sy) ? sx : sy; 
    return this.setArray([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, (isNaN(sz) ? sy : sz), 0, 0, 0, 0, 1]); 
  };

  this.setRotationZ = function (rad) {
    var c = Math.cos(rad), s = Math.sin(rad); 
    return this.setArray([c,-s, 0, 0, s, c, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  };

  this.translate = function (x, y) { return this.multiply(new glif.mat4().setTranslation(x, y)); };

  this.scale = function (sx, sy) { return this.multiply(new glif.mat4().setScale(x, y)); };

  this.rotateZ = function (rad) { return this.multiply(new glif.mat4().setRotationZ(rad)); };

  function multiplyArrays (a, b) {
    // a & b must be 1d row major matrix arrays
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3],
        b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7],
        b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11],
        b30 = v[12], b31 = b[13], b32 = b[14], b33 = b[15];

    return [ 
      b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
      b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
      b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
      b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,

      b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
      b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
      b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
      b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,

      b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
      b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
      b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
      b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,

      b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
      b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
      b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
      b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33
    ];
  }

  this.multiply = function (m) {
    var b = (m instanceof glif.mat4) ? m._m : m;
    this.setArray(multiplyArrays(this._m, b));
    return this;
  };

  // init
  if (Array.isArray(mat)) this.setArray(mat);
  else if (mat instanceof glif.mat4) this.setArray(mat._m);
  else this.identity();

   return this;
};
*/

})(); 

//
// glif-classes.js 
// classes for simplifying the use of WebGL
//

(function () {

// glenv is an environment wrapper for a canvas WebGLRenderingContext object
// all the easy to use fun flows from here

// use glif.getEnv() below to create an instance of this class

glif.glenv = function (glctx, options, onerror) {

  // init
  if (typeof options === 'function') { onerror = options; options = {}; }
  options = options || {};

  this.onerror = onerror || function (e) { 
    alert(Array.isArray(e) ? e.join('\n') : e); 
  };

  this.gl = glctx;
  if (glctx instanceof HTMLCanvasElement) {  // get context for canvas
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
    glctx.enableVertexAttribArray( aPosLoc );

    var aTexLoc = glctx.getAttribLocation(program.program, "aTexCoord");
    glctx.enableVertexAttribArray( aTexLoc );

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
  // (texture) returns texture
  // (image, .options) returns image painted on new texture  
  // (width, height, .options) returns empty texture w x h
  this.createTexture = function (width, height, options) {
    if (width === null) return width;
    if (width instanceof glif.Texture) return width; // passthru
    if (glif.util.isImage(width)) return this.createImageTexture(width, height);
    return new glif.Texture (this, width, height, options);
  };

  this.getInputTexture = function (options) {
    //if (!this._texture) // contents of canvas may change, don't cache for now.
    this._texture = this.createImageTexture(this.gl.canvas, options);
    return this._texture;
  };
};


// call this to get a glif environment for a webgl enabled canvas

// glctx  : WebGLRenderingContext or Canvas element or canvas id
// options : options to create webgl context
// onerror : error callback

glif.getEnv = function (glctx, options, onerror) {
  if (typeof glctx === 'string') {
    glctx = document.getElementById(glctx);
  } 
  var env = new glif.glenv(glctx, options, onerror);
  if (!env.gl) { 
    // iOS gets this far
    (onerror || alert)('error getting WebGL rendering context from canvas' + 
        (typeof glctx==='string') ? ('\' ' + glctx + '\'') : ''); 
  }
  return env;  
};


// (gl, .options)
// (gl, width, height, .options)

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

  this.active = function (index) { gl.activeTexture(gl.TEXTURE0 + (index || 0)); };

  this.texture = gl.createTexture();
  this.format = options.format || gl.RGBA;
  this.type = options.type || gl.UNSIGNED_BYTE;
  this.width = width;
  this.height = height;

  if (typeof options.textureUnit === 'number')
      this.active(options.textureUnit);
  this.bind();

  // defaults are for pixel aligned images
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, (options.wrap ? gl.REPEAT : null) || options.wrapS || gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, (options.wrap ? gl.REPEAT : null) || options.wrapT || gl.CLAMP_TO_EDGE);


  var minfilter = options.minFilter || options.filter || gl.NEAREST;
  if (minfilter === 'linear') minfilter = gl.LINEAR;
  else if (minfilter === 'nearest') minfilter = gl.NEAREST;
  else if (minfilter === 'mipmap') minfilter = gl.LINEAR_MIPMAP_NEAREST;

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minfilter);
  if (minfilter === 'mipmap') 
    gl.generateMipmap(gl.TEXTURE_2D);  

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
      program._setUniform('1i', uniname || options.name || 'sample'+unit, unit || 0);
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

//(glenv, null/, texture/null/, .options)
//(glenv, width, height, .options)
//(glenv, image/texture, texture/null/, .options)

glif.DoubleBuffer = function (glenv, texture0, texture1, options) {
  var _index = false;

  var w , h, _owned_tex = [];

  this.createOwnedTexture = function (opt) {
    var t = glenv.createTexture(opt);
    _owned_tex.push(t);
    return t;
  };

  if (!texture0) { // use gl ctx size
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

  if (!texture0) { texture0 = glenv.createTexture(w, h, options); _owned_tex.push(texture0); }
  if (!texture1) { texture1 = glenv.createTexture(w, h, options); _owned_tex.push(texture1); }    

  var fb0 = texture0.framebuffer();
  var fb1 = texture1.framebuffer();

  this.inputTexture = function () { return _index ? texture0 : texture1; };
  this.outputTexture = function () { return _index ? texture1 : texture0; };
  this.outputFB = function () { return _index ? fb1 : fb0; };

  this.advance = function () {
    _index = 1 - _index;  //console.log('advance ', _index);
    return this.inputTexture(); // return texture last written to
  };

  this.destroy = function () {
    _owned_tex.forEach(function (tex) { tex.destroy(); });
    _owned_tex = [];
  };
};


// Program class

glif.Program = function (glenv, vs, fs, options) {

  var on_error, _gl = glenv.gl;

  if (typeof options === 'function' ) { on_error = options; options = {}; }
  options = options || {};

  this.use = function () {
    _gl.useProgram(this.program);
  };

  // bind input texture and output framebuffer
  function bindPair(intex, outfb, program) {
    if (!Array.isArray(intex)) 
      intex = [intex];

    for (var i=0; i<intex.length; i++) {
      if (intex[i]) intex[i].use(i, program); 
      else glif.Texture.prototype.usenull(_gl, i);
    }

    // outfb can be a framebuffer or output texture or null
    outfb = (outfb && outfb.framebuffer) ? outfb.framebuffer() : outfb;
    _gl.bindFramebuffer(_gl.FRAMEBUFFER, outfb);
  }

  // 'Program interface'
  this.run = function (inputs, output, properties) {
    this.use();

    if (properties) {
      this._setProperties(properties);
    }

    bindPair(inputs, output || null, this);

    glenv.draw();
    return true;
  };


  var _ulocs = {};  // uniform location cache

  this._getUniformLocation = function (name) {
    if (_ulocs[name]) return _ulocs[name];
    var u = glenv.gl.getUniformLocation(this.program, name);
    _ulocs[name] = u;
    return _ulocs[name];
  };

  // dont use these externally 
  this._setUniform = function (utype, name, values) {

    var args = (Array.isArray(values) && utype.slice(-1) !== 'v') ? 
      values : 
      Array.prototype.slice.call(arguments, 2); 

    args.unshift(this._getUniformLocation(name));
    var ufnname = 'uniform'+utype, 
      fn = glenv.gl[ufnname]; //  || glenv.gl.__proto__[ufnname]; // __proto__ makes this work with WebGLInspector
    fn.apply(glenv.gl, args);
  };

  this._setUniforms = function (uniforms) {
    for (var i=0; i< uniforms.length; i++) {
      var u = uniforms[i];
      this._setUniform(u[0], u[1], u.slice(2));
    }
  };

  this._setPropertyVector = function (name, vec, typeint) {
    if (vec.length == 2)
      this._setUniform(typeint?'2i':'2f', name, vec[0], vec[1]);
    else if (vec.length == 3)
      this._setUniform(typeint?'3i':'3f', name, vec[0], vec[1], vec[2]);
    else if (vec.length == 4)
      this._setUniform(typeint?'4i':'4f', name, vec[0], vec[1], vec[2], vec[3]);
    else
      this._setUniform(typeint?'1iv':'1fv', name, vec);
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
        this._setPropertyVector(name, val.value, val.type === 'int' );
      else
        this._setUniform((val.type === 'int')?'1i':'1f', name, val.value);
    }
    else if (typeof val === 'number')
      this._setUniform('1f', name, val);
    else 
      console.log('unknown type for uniform property', name, val);
  };

  // ''
  this._setProperties = function (props) {
    if (!props) return;
    for (var k in props) { this._setProperty(k, props[k]); }
  };

  this._initVertexData = function (options) { glenv.initVertexData(this, options); };

  // initialize
  this.program = glif.base.createProgram(glenv.gl, vs, fs, on_error || glenv.onerror);
  
  if (!this.program) { // failed
    return null;
  }

  if (!options.noinit) { 
    this._initVertexData(options);
  }

  return this;
};


glif.programs = glif.programs || {};

glif.programs.CopyProgram = function (glenv, options, mat3) {
  options = options || {};
  this.mat3 = mat3 || [1,0,0,0,1,0,0,0,1];

  var shadertext = glif.glsl.commonFS + 
    'uniform sampler2D sample0;\n' +
    'void main(void) {\n' +
    '  gl_FragColor = texture2D(sample0, pos);\n' +
    (options.rgb ? '  gl_FragColor.a = ' + glif.glsl.floatstr(options.alpha||1) + ';\n'  : '') +
    '}';

  var prog = new glif.Program(glenv, glif.glsl.getMat3VS(), shadertext);

  this.run = function (input, output) {
    prog.run(input, output, { 'transform': { type:'mat3', value: this.mat3 } });
  };

};

})(); 

//
// glif-functions.js 
// functions for processing stacks of images/textures
//

(function () {

// these functions operate on stacks of 0..n input textures

glif.f = glif.functions = {};


// one time use of a program, use exact arguments

glif.functions._applyShader = function (glenv, fragmentShader, image, outtex, program_options) {

  var program = glenv.createProgram(fragmentShader, program_options);
  if (!program) return; // failure

  var intex = glenv.createTexture(image);
  return program.run(intex, outtex);
};


// zero sample image/texture inputs, generates output only

glif.functions.generate = function (glenv, exprtext, outtexture) {

  var options;
  if (typeof exprtext === 'object') { options = exprtext; exprtext = options.exprtext; }
  options = options || {};

  var text = glif.glsl.getSampleStackShaderText (0, exprtext);
  return this._applyShader(glenv, text, null, outtexture, options);
};

// single image input

glif.functions.effect = function (glenv, image, exprtext, outtexture) {

  if (!image || !glif.util.isProgramInput(image)) { 
    outtexture = exprtext; exprtext = image; image = null; 
  }

  var options;
  if (typeof exprtext === 'object') { options = exprtext; exprtext = options.expr; }
  options = options || {};

  // if no input image use the gl context's canvas
  image = image || glenv.getInputTexture(); //{flipY: true});

  var shadertext = glif.glsl.getSampleStackShaderText (1, exprtext, { varnames: ['c'] });
  return this._applyShader(glenv, shadertext, image, outtexture, options); 
};


// blending functions - 2 or more input sample textures

// helper function blendexpr() creates a compositing fragment shader expression string 
// to be passed to a stack fragment shader builder, given input rgb blended color source 
// 'Cs' and a composite mode. only handles premultiplied alpha currently

glif.functions.blendexpr = function (blendmode, compositemode) {

  // blend mode expressions for rgb1 a (Cb) and b (Cs) components
  var blendmode_exprs =  {

    normal: '__Cs__.rgb',
    lighten: 'max(__Cb__.rgb, __Cs__.rgb)',
    darken: 'min(__Cb__.rgb, __Cs__.rgb)',

    multiply: '__Cb__.rgb * __Cs__.rgb',
    screen: 'vec3(1.) - (vec3(1.) - __Cb__.rgb) * (vec3(1.) - __Cs__.rgb)',
    subtract: '__Cb__.rgb - __Cs__.rgb',
    difference: 'abs(__Cb__.rgb - __Cs__.rgb)',

    overlay: 
        'vec3((__Cb__.r < 0.5) ? (2.*__Cb__.r*__Cs__.r) : (1.-2.*(1.-__Cb__.r)*(1.-__Cs__.r)),\n' +
        '     (__Cb__.g < 0.5) ? (2.*__Cb__.g*__Cs__.g) : (1.-2.*(1.-__Cb__.g)*(1.-__Cs__.g)),\n' +
        '     (__Cb__.b < 0.5) ? (2.*__Cb__.b*__Cs__.b) : (1.-2.*(1.-__Cb__.b)*(1.-__Cs__.b)))',

    'hard-light':
        'vec3((__Cs__.r < 0.5) ? (2.*__Cb__.r*__Cs__.r) : (1.-2.*(1.-__Cb__.r)*(1.-__Cs__.r)),\n' +
        '     (__Cs__.g < 0.5) ? (2.*__Cb__.g*__Cs__.g) : (1.-2.*(1.-__Cb__.g)*(1.-__Cs__.g)),\n' +
        '     (__Cs__.b < 0.5) ? (2.*__Cb__.b*__Cs__.b) : (1.-2.*(1.-__Cb__.b)*(1.-__Cs__.b)))',

    'color-dodge': 
        'vec3((__Cb__.r == 0.) ? 0. : ((__Cs__.r == 1.) ? 1. : min(1., __Cb__.r / (1. - __Cs__.r))),\n' +
        '     (__Cb__.g == 0.) ? 0. : ((__Cs__.g == 1.) ? 1. : min(1., __Cb__.g / (1. - __Cs__.g))),\n' +
        '     (__Cb__.b == 0.) ? 0. : ((__Cs__.b == 1.) ? 1. : min(1., __Cb__.b / (1. - __Cs__.b))))',

    'color-burn': 
        'vec3((__Cb__.r == 1.) ? 1. : ((__Cs__.r == 0.) ? 0. : (1. - min(1., (1. - __Cb__.r) / __Cs__.r))),\n' +
        '     (__Cb__.g == 1.) ? 1. : ((__Cs__.g == 0.) ? 0. : (1. - min(1., (1. - __Cb__.g) / __Cs__.g))),\n' +
        '     (__Cb__.b == 1.) ? 1. : ((__Cs__.b == 0.) ? 0. : (1. - min(1., (1. - __Cb__.b) / __Cs__.b))))',

    'soft-light':
        'vec3( (__Cs__.r <= 0.5) ? (__Cb__.r - (1. - clamp(2. * __Cs__.r, 0., 1.)) * __Cb__.r * (1. - __Cb__.r)) : __Cb__.r + (2. * __Cs__.r - 1.) * ((__Cb__.r <= 0.25) ? (((16. * __Cb__.r - 12.) * __Cb__.r + 4.) * __Cb__.r) : sqrt(__Cb__.r) - __Cb__.r),\n' +
        '      (__Cs__.g <= 0.5) ? (__Cb__.g - (1. - clamp(2. * __Cs__.g, 0., 1.)) * __Cb__.g * (1. - __Cb__.g)) : __Cb__.g + (2. * __Cs__.g - 1.) * ((__Cb__.g <= 0.25) ? (((16. * __Cb__.g - 12.) * __Cb__.g + 4.) * __Cb__.g) : sqrt(__Cb__.g) - __Cb__.g),\n' +
        '      (__Cs__.b <= 0.5) ? (__Cb__.b - (1. - clamp(2. * __Cs__.b, 0., 1.)) * __Cb__.b * (1. - __Cb__.b)) : __Cb__.b + (2. * __Cs__.b - 1.) * ((__Cb__.b <= 0.25) ? (((16. * __Cb__.b - 12.) * __Cb__.b + 4.) * __Cb__.b) : sqrt(__Cb__.b) - __Cb__.b))',

    'pin-light': 
        'vec3((__Cs__.r < 0.5) ? min(__Cb__.r, 2.0 * __Cs__.r) : max(__Cb__.r, 2.0*(__Cs__.r - 0.5)),\n' +
        '     (__Cs__.g < 0.5) ? min(__Cb__.g, 2.0 * __Cs__.g) : max(__Cb__.g, 2.0*(__Cs__.g - 0.5)),\n' +
        '     (__Cs__.b < 0.5) ? min(__Cb__.b, 2.0 * __Cs__.b) : max(__Cb__.b, 2.0*(__Cs__.b - 0.5)))',

    exclusion: '(__Cb__ + __Cs__ - 2. * __Cb__ * __Cs__).rgb'
  };

  function createBlendExpr(name, csName, cbName) {
     return blendmode_exprs[name].replace(/__Cs__/g, csName || "Cs").replace(/__Cb__/g, cbName || "Cb");
  }

  compositeExprs = {
    //Fa = 1; Fb = 1 – αs 
    //co = αs x Cs + αb x Cb x (1 – αs)
    //αo = αs + αb x (1 – αs)    

    // from flex4 source, softlight.pbk
    // http://svn.apache.org/repos/asf/flex/sdk/trunk/frameworks/projects/framework/src/mx/graphics/shaderClasses/SoftLight.pbk
    over: 'vec4(\n' +
     '(1.0 - Cs.a) * Cb.rgb * Cb.a + (1.0 - Cb.a) * Cs.rgb * Cs.a + Cs.a * Cb.a * (\n' +
      '__CBlendExpr__\n' +
      '), (1.0 - Cs.a) * Cb.a + Cs.a)',


    // incorrect results with in, out composite modes where alpha < 1 in both images

    //Fa = αb; Fb = 0
    //  co = αs x Cs x αb
    //  αo = αs x αb

    'in' : '// in composite modes are incorrect currently\n' + 
    'vec4(\n' +
     'Cs.rgb * Cs.a * (1.-Cb.a) + Cb.a * Cs.a * (\n' +
     '__CBlendExpr__\n' +
     '), Cs.a * (1. - Cb.a) + Cs.a)',

    //Fa = 1 – αb; Fb = 0
    //co = αs x Cs x (1 – αb)
    //αo = αs x (1 – αb)
    out:  '// out composite modes are incorrect currently\n' +  
      'vec4(\n' +
     'Cb.rgb * Cb.a * (1.-Cs.a) + Cb.a * Cs.a * (\n' +
      '__CBlendExpr__\n' +
      '), Cb.a * (1. - Cs.a) + Cb.a)'

  // atop
    //Fa = αb; Fb = 1 – αs
    //co = αs x Cs x αb + αb x Cb x (1 – αs)
    //αo = αs x αb + αb x (1 – αs)
  };

  var compositeExpr, 
    swap = false; // swap Cb/Cs layers

  if (!compositemode || compositemode === 'source-over') {
    compositeExpr = compositeExprs.over;
  }
  else if (compositemode === 'destination-over') {
    compositeExpr = compositeExprs.over;
    swap = true;
  }
  else if (compositemode === 'source-in') {
    compositeExpr = compositeExprs['in']; 
  }
  else if (compositemode === 'destination-in') {
    compositeExpr = compositeExprs['in']; 
    swap = true;  }
  else if (compositemode === 'source-out') {
    compositeExpr = compositeExprs.out; 
  }
  else if (compositemode === 'destination-out') {
    compositeExpr = compositeExprs.out; 
    swap = true;
  }
  else if (compositemode === 'destination') {
    return 'vec4(Cb.rgb*Cb.a, Cb.a)';
  }
  else if (compositemode === 'copy') {
    return 'vec4(Cs.rgb*Cs.a, Cs.a)';
  }

  // composite mode not found
  if (!compositeExpr) {
    console.log('blendexpr() composite mode ' + compositemode + 'not found'); 
    return 'vec4(\n// unknown/unsupported composite mode ' + compositeExpr + ' \n0.5,0.,1.-x,1.)';
  }

  // CblendExpr is an expression string that evaluates to 'vec3(r,g,b) in shader
  // currently swapping inputs to blend for source/destination switch (probably wrong)
  var CblendExpr = createBlendExpr(blendmode, swap?'Cb':'Cs', swap?'Cs':'Cb'); 
  if (!CblendExpr) { 
    console.log('blendexpr() blend mode ' + blendmode + 'not found, using normal'); 
    CblendExpr = '// blendexpr() blend mode ' + blendmode + 'not found, using normal\n' + createBlendExpr('normal'); 
  }

  CblendExpr = '\n// blend expr\n' + CblendExpr + '\n//\n';
  return compositeExpr.replace(/__CBlendExpr__/g, CblendExpr);
};


// 2 inputs, supports blend and composite modes
glif.functions.blendComposite = function (glenv, imageBack, imageSrc, outtexture, options) {

  if (!(outtexture instanceof glif.Texture)) { options = outtexture || {}; outtexture = null; }

  var exprtext;
  if (typeof options === 'string') { exprtext = options; options = {}; }
  else if (options) { exprtext = options.expr || blendexpr(options.blendmode, options.compositemode); }

  // FIXME shouldnt write to options
  options.varnames = options.varnames || ['Cb', 'Cs'];

  var text =  glif.glsl.getSampleStackShaderText (2, exprtext, options);
  var program = glenv.createProgram(text);
  if (!program) return; // failed

  var texB = glenv.createTexture(imageBack);
  var texS = glenv.createTexture(imageSrc);

  return program.run([texB, texS], outtexture, options.properties);
};

glif.functions.blendStack = function (glenv, images, outtexture, options) {

  if (!(outtexture instanceof glif.Texture)) { options = outtexture || {}; outtexture = null; }

  var exprtext;
  if (typeof options === 'string') { exprtext = options; options = {}; }
  else if (options) exprtext = options.expr;

  var shadertext = glif.glsl.getSampleStackShaderText (images.length, exprtext, options);
  program = glenv.createProgram(shadertext);
  if (!program) return; // failed

  var textures = [];
  for (var i=0; i< images.length; i++) 
    textures.push(glenv.createTexture(images[i]));

  return program.run(textures, outtexture, options.properties);
};


// utility functions namespace 

glif.u = glif.util = {};

glif.util.isImage = function (obj) {
  return (obj instanceof HTMLCanvasElement) || (obj instanceof HTMLImageElement) || (obj instanceof HTMLVideoElement);
};

// check null separately
glif.util.isProgramInput = function (obj) {
  return this.isImage(obj) || (obj instanceof glif.Texture);
};



// add primary functions to glenv

glif.glenv.prototype.effect = function (image, effectexpr, outtexture) { 
  return glif.functions.effect(this, image, effectexpr, outtexture); 
};

glif.glenv.prototype.generate = function (effectexpr, outtexture) { 
  return glif.functions.generate(this, effectexpr, outtexture); 
};

glif.glenv.prototype.blendComposite = function (image, imageBack, imageSrc, outtexture, options) { 
  return glif.functions.blendComposite(this, image, imageBack, imageSrc, outtexture, options); 
};

glif.glenv.prototype.blendStack = function (images, outtexture, options) { 
  return glif.functions.blendStack(this, images, outtexture, options); 
};

})(); 
