//
// glif-base.js 
// standalone functions for managing WebGL resources
//

(function (global) {

  // top level namespace
  var glif = global.glif = {};

  // base functions namespace
  glif.base = {};


  glif.webGLSupport =
  glif.base.webGLSupport = function (onfail) {

    var support = !!window.WebGLRenderingContext === true;

    if (!support && onfail) {
      onfail('sorry, your device does not support WebGL! Please go to http://get.webgl.org</a> for more info.');
    }
    return support;
  };


  glif.getWebGLContext =
  glif.base.getWebGLContext = function (canvas, options, onerror) {

    var gl = null;

    if (typeof options === 'function') {
      onerror = options; options = {};
    }

    options = options || {};
    onerror = onerror || alert;

    if (typeof canvas === 'string')
      canvas = document.getElementById(canvas);

    try {
      gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
    } 
    catch (e) {
      console.log('failed to get webgl context, ', e);
      if (onerror) onerror('failed to get webgl context, try again or go to get.webgl.org for more info.\n' + e);
      return null;
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

  window.requestAnimFrame = window.requestAnimFrame || (function () {
    return  window.requestAnimationFrame       ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
      function (callback) {
      window.setTimeout(callback, 1000 / 60);
    };
  })();


})(this);
