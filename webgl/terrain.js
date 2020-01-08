const fragmentShaderSource = `

// ------------------------------------
// GLSL code
// ------------------------------------

precision lowp float;

uniform vec2 u_center;	// pixel coordinates
uniform vec2 u_position;	// terrain coordinates
uniform vec2 u_rotate;	// (cos, sin)
uniform float u_scale;	// above 1.0, even continents are smaller than pixels
uniform int u_detail;	// ranges from 0 (all flat) to 17 (full detail)
uniform bool u_seabed;

// Vector pointing in the direction of the sun.
const vec3 sun = normalize(vec3(-1.0, 1.0, 2.0));

// RGB color of landscape at different altitudes.
const vec3 snow = vec3(1.0, 1.0, 1.0);
const vec3 rocks = vec3(0.5, 0.5, 0.75);
const vec3 land = vec3(0.0, 0.875, 0.0);
const vec3 beach = vec3(1.0, 1.0, 0.0);
const vec3 sea = vec3(0.0, 0.5, 0.75);

// Skew: like 'coordinate skewing' in simplex noise.
const mat2 skew = mat2(1.3660254, 0.3660254, 0.3660254, 1.3660254);
const mat2 unskew = mat2(0.7886751, -0.2113249, -0.2113249, 0.7886751);

// Identical to (bitCount(n) & 1) in higher versions of GLSL
// (assuming its integers are wide enough).
float parity(float n) {
	float p = 0.0;
	n = floor(n);
	if (n < 0.0) n = -1.0 - n;
	for (int i = 0; i < 32; i++) {
		p += n;
		n = floor(n / 2.0);
	}
	return mod(p, 2.0);
}

// One-bit pseudo-random value.
float hash(float x, float y, int depth) {
	return parity(563.0 * x + 761.0 * y + float(16 - depth));
}

void main() {
	mat2 rotate = mat2(u_rotate.x, -u_rotate.y, u_rotate.y, u_rotate.x);
	mat2 unrotate = mat2(u_rotate.x, u_rotate.y, -u_rotate.y, u_rotate.x);
	vec2 position = skew * (u_position + rotate * u_scale * (gl_FragCoord.xy - u_center));
	vec2 internal;
	vec3 heights = vec3(0.0);	// x = near corner, y = far corner, z = left/right corner
	for (int depth = 0; depth < 17; depth++) {
		position *= 2.0;
		vec2 cell = floor(position);
		vec2 anchor = mod(cell, 2.0);
		// Subdivision: like 'simplicial subdivision' in simplex noise.
		internal = position - cell;
		float subdivision = step(internal.x, internal.y);

		// Reduce the current triangle to 1/4 (half its width).
		// At the same time, double the contribution of all previous iterations.
		heights += anchor.x == anchor.y
			? vec3(anchor.x == 0.0 ? heights.x : heights.y)
			: vec3(
				heights.zz,
				subdivision == anchor.x
					? heights.x + heights.y - heights.z
					: heights.z);

		// Pseudo-randomly put 'peaks' on the triangle's vertices.
		heights += depth >= u_detail
			? vec3(0.5)
			: vec3(
				hash(cell.x, cell.y, depth),
				hash(cell.x + 1.0, cell.y + 1.0, depth),
				subdivision != 0.0
					? hash(cell.x, cell.y + 1.0, depth)
					: hash(cell.x + 1.0, cell.y, depth));
	}

	// Interpolate between the vertices of the final (small) triangle.
	vec2 slope = internal.x > internal.y
		? vec2(heights.z - heights.x, heights.y - heights.z)
		: vec2(heights.y - heights.z, heights.z - heights.x);
	vec3 normal = normalize(vec3(unrotate * unskew * -slope, 1.0));
	float height = heights.x + dot(internal, slope);

	// Colors, shaded.
	vec3 rgb = !u_seabed && height < 91000.0
		? sea
		: clamp(mix(0.5, 1.0, dot(normal, sun)) * (
			height < 91000.0 ? sea :
			height < 91200.0 ? beach :
			height < 110000.0 ? land :
			height < 125000.0 ? rocks : snow), 0.0, 1.0);
	gl_FragColor = vec4(rgb, 1.0);
}
`;

// ------------------------------------
// JavaScript code
// ------------------------------------

const current = {
	x: 0,
	y: 0,
	rotation: 0,
	cos: 1.0,
	sin: 0.0,
	scale: 1 / (1 << 14),	// yes, the terrain coordinates are tiny!
	detail: 17,
	seabed: false,	// makes sea surface transparent (false) or opaque (true)

	move: function (dx, dy) {
		this.x += this.scale * (dx * this.cos + dy * this.sin);
		this.y += this.scale * (-dx * this.sin + dy * this.cos);
	},
	turn: function(degrees) {
		const rad = (this.rotation = (this.rotation + degrees) % 360) * Math.PI / 180;
		this.cos = Math.cos(rad);
		this.sin = Math.sin(rad);
	},
	lessDetail: function() {
		if (this.detail > 0) this.detail -= 1;
	},
	moreDetail: function() {
		if (this.detail < 17) this.detail += 1;
	}
};

// In our HTML page, there should be a canvas with ID 'canvas'.
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');
if (!gl) throw 'WebGL not supported here';

// Create a 'program' with a vertex shader and a fragment shader.
const program = gl.createProgram();
const loadShader = function(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw 'Compile error: ' + gl.getShaderInfoLog(shader);
	}
	return shader;
};
gl.attachShader(program, loadShader(gl, gl.VERTEX_SHADER, `
	attribute vec2 a_position;	// clip space [-1, +1]
	varying vec2 v_texCoord;
	void main() {
		gl_Position = vec4(a_position, 0.0, 1.0);
		v_texCoord = (a_position + 1.0) * 0.5;	// texel coordinates [0, 1]
	}
`));
gl.attachShader(program, loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
	throw 'Link error: ' + gl.getProgramInfoLog(program);
}

// 'Attributes' and 'uniforms' are used to pass parameters into the shaders.
// Each one has a unique number called a 'location'. Collecting those here.
const locations = {
	attribute: function(name) {
		this[name] = gl.getAttribLocation(program, name);
	},
	uniform: function(name) {
		this[name] = gl.getUniformLocation(program, name);
	}
};
locations.uniform('u_center');
locations.uniform('u_position');
locations.uniform('u_rotate');
locations.uniform('u_scale');
locations.uniform('u_detail');
locations.uniform('u_seabed');
locations.attribute('a_position');

// Prepare the vertex shader with a buffer containing 6 vertices (2 triangles).
const vertexShader = {
	positionBuffer: gl.createBuffer(),
	draw: function(positionLocation) {
		gl.enableVertexAttribArray(positionLocation);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
};
gl.bindBuffer(gl.ARRAY_BUFFER, vertexShader.positionBuffer);
gl.bufferData(
	gl.ARRAY_BUFFER,
	new Float32Array([ -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1 ]),
	gl.STATIC_DRAW);

// Canvas size will always follow window size.
(window.onresize = function() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
})();

// Keyboard controls.
window.onkeydown = function(e) {
	switch (e.keyCode) {
		case 37: current.move(-8, 0); break;	// left
		case 38: current.move(0, 8); break;	// up
		case 39: current.move(8, 0); break;	// right
		case 40: current.move(0, -8); break;	// down
		case 81: current.turn(355); break;	// Q = rotate left
		case 87: current.turn(5); break;	// W = rotate right
		case 65: current.scale /= 1.0625; break;	// A = zoom in
		case 90: current.scale *= 1.0625; break;	// Z = zoom out
		case 83: current.moreDetail(); break;	// S = more detail
		case 88: current.lessDetail(); break;	// X = less detail
		case 66: current.seabed = !current.seabed; break;	// B = toggle seabed
		case 67: toggleDisplay('crosshair'); break;	// C = toggle crosshair
		case 72: toggleDisplay('help'); break;	// H = toggle help
		case 73: toggleDisplay('info'); break;	// I = toggle info
	}
};

// Measuring frames per second.
const framerate = {
	minDuration: 400,
	rate: 0,
	frameCount: 0,
	fromTime: 0,
	fps: function(time) {
		const duration = time - this.fromTime;
		this.frameCount++;
		if (duration >= this.minDuration) {
			this.rate = 1000 * this.frameCount / duration;
			this.frameCount = 0;
			this.fromTime = time;
		}
		return this.rate;
	}
};

// Animation loop.
(function loop(time) {
	requestAnimationFrame(loop);

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.useProgram(program);
	gl.uniform2f(locations.u_center, canvas.width / 2, canvas.height / 2);
	gl.uniform2f(locations.u_position, current.x, current.y);
	gl.uniform2f(locations.u_rotate, current.cos, current.sin);
	gl.uniform1f(locations.u_scale, current.scale);
	gl.uniform1i(locations.u_detail, current.detail);
	gl.uniform1i(locations.u_seabed, current.seabed);

	vertexShader.draw(locations.a_position);

	setInfo('center', format(current.x, 0) + ', ' + format(current.y, 0));
	setInfo('rotation', current.rotation);
	setInfo('scale', format(current.scale, 3));
	setInfo('detail', current.detail);
	setInfo('pixels', canvas.width * canvas.height);
	setInfo('fps', framerate.fps(time).toFixed(0));
})(0);

function format(n, prec) {
	return (n * (1 << 17)).toFixed(prec);
}

function toggleDisplay(id) {
	const style = document.getElementById(id).style;
	style.display = style.display == 'none' ? 'block' : 'none';
}

function setInfo(id, text) {
	document.getElementById('info_' + id).innerText = text;
}
