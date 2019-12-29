let current = { x: 0.0, y: 0.0 };
let rotation = 0;
let cos = 1.0;
let sin = 0.0;
let scale = 0.0001;
let detail = 0;

const coloring = `

precision lowp float;

uniform sampler2D u_image;
//uniform vec2 u_size;
 
varying vec2 v_texCoord;

void main() {
	// TODO: colors, emboss
	//vec2 onePixel = vec2(1.0, 1.0) / u_textureSize;
	//gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
	//gl_FragColor = texture2D(u_image, vec2(0.0, 0.0));
	gl_FragColor = texture2D(u_image, v_texCoord);
	//texture2D(u_image, v_texCoord + vec2(onePixel.x, 0.0)) +
	//texture2D(u_image, v_texCoord + vec2(-onePixel.x, 0.0))) / 3.0;
}
`;

const heightmap = `

precision lowp float;

uniform vec2 u_center;
uniform vec2 u_position;
uniform vec2 u_rotate;
uniform float u_scale;
uniform int u_detail;

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

float hash(float x, float y, int depth) {
	return parity(563.0 * x + 761.0 * y + float(depth));
}

void main() {
	// skew: like 'coordinate skewing' in simplex noise
	mat2 skew = mat2(1.3660254, 0.3660254, 0.3660254, 1.3660254);
	mat2 rotate = mat2(u_rotate.x, -u_rotate.y, u_rotate.y, u_rotate.x);
	vec2 position = skew * (u_position + rotate * u_scale * (gl_FragCoord.xy - u_center));
	vec2 internal;
	float near = 0.0;
	float far = 0.0;
	float corner = 0.0;
	float divisor = 1.0;
	for (int depth = 16; depth >= 0; depth--) {
		divisor /= 2.0;
		vec2 cell = floor(position / divisor);
		vec2 anchor = mod(cell, 2.0);
		// subdivision: like 'simplicial subdivision' in simplex noise
		internal = mod(position, divisor);
		float subdivision = internal.x < internal.y ? 1.0 : 0.0;

		if (anchor.x == 0.0 && anchor.y == 0.0) {
			far += near;
			corner += near;
			near += near;
		}
		else if (anchor.x != 0.0 && anchor.y != 0.0) {
			near += far;
			corner += far;
			far += far;
		}
		else {
			float center = near + far;
			near += corner;
			far += corner;
			if (subdivision == anchor.x) {
				corner = center;
			}
			else {
				corner += corner;
			}
		}

		if (depth >= u_detail) {
			near += hash(cell.x, cell.y, depth);
			far += hash(cell.x + 1.0, cell.y + 1.0, depth);
			corner += subdivision != 0.0
				? hash(cell.x, cell.y + 1.0, depth)
				: hash(cell.x + 1.0, cell.y, depth);
		}
		else {
			near += 0.5;
			far += 0.5;
			corner += 0.5;
		}
	}
	float internalCorner = max(internal.x, internal.y);
	float internalFar = min(internal.x, internal.y);
	float height = near * divisor + (corner - near) * internalCorner + (far - corner) * internalFar;
	if (height < 91000.0 * divisor) height = 0.0;	// TODO: remove when everything else works
	gl_FragColor = vec4(vec3(height), 1.0);
}
`;

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');
const program = gl.createProgram();
const program2 = gl.createProgram();
const fbo = gl.createFramebuffer();
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
initProgram(program, heightmap);
initProgram(program2, coloring);

function initProgram(program, fragmentShaderSource) {
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([
			-1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
			-1.0,  1.0, 1.0, -1.0,  1.0, 1.0 ]),
		gl.STATIC_DRAW);

	gl.attachShader(program, loadShader(gl, gl.VERTEX_SHADER, `
		attribute vec2 a_position;
		//attribute vec2 a_texCoord;
		//uniform vec2 u_resolution;
		varying vec2 v_texCoord;
		void main() {
			// TODO: correct coordinates
			gl_Position = vec4(a_position, 0.0, 1.0);
			v_texCoord = vec2(0.0, 0.0);
			//gl_Position = vec4(a_position / u_resolution * 2.0 - 1.0, 0.0, 1.0);
			//v_texCoord = a_texCoord;
		}
	`));
	gl.attachShader(program, loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw "Link error: " + gl.getProgramInfoLog(program);
	}
}

function loadShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw "Compile error: " + gl.getShaderInfoLog(shader);
	}
	return shader;
}

(window.onresize = function() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
})();

window.onkeydown = function(e) {
	switch (e.keyCode) {
		case 37: move(-8, 0); break;	// left
		case 38: move(0, -8); break;	// up
		case 39: move(8, 0); break;	// right
		case 40: move(0, 8); break;	// down
		case 81: turn(355); break;	// Q = rotate left
		case 87: turn(5); break;	// W = rotate right
		case 65: scale /= 1.0625; break;	// A = zoom in
		case 90: scale *= 1.0625; break;	// Z = zoom out
		case 83: if (detail > 0) detail -= 1; break;	// S = more detail
		case 88: if (detail < 16) detail += 1; break;	// X = less detail
		//case 66: seabed = !seabed; break;	// B = toggle seabed
		//case 67: crosshair = !crosshair; break;	// C = toggle crosshair
		case 72: toggleDialog('help'); break;	// H = toggle help
		case 73: toggleDialog('info'); break;	// I = toggle info
	}
};

function move(dx, dy) {
	current = pixel({x:dx, y:dy});
}

function turn(degrees) {
	const rad = (rotation = (rotation + degrees) % 360) * Math.PI / 180;
	cos = Math.cos(rad);
	sin = Math.sin(rad);
}

function pixel(p) {
	return {
		x: current.x + scale * (p.x * cos + p.y * sin),
		y: current.y + scale * (p.x * sin - p.y * cos)
	};
}

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

(function loop(time) {
	requestAnimationFrame(loop);

	// TODO: clean up the mess once everything works
	//const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	//if (status != gl.FRAMEBUFFER_COMPLETE) {
	//	throw "Framebuffer incomplete: " + status + " / " + gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
	//}
	gl.bindTexture(gl.TEXTURE_2D, texture);	// source = pipe from previous shader
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);	// destination = pipe to next shader
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.bindTexture(gl.TEXTURE_2D, null);	// source = none
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.useProgram(program);
	gl.uniform2f(gl.getUniformLocation(program, "u_center"), canvas.width / 2, canvas.height / 2);
	gl.uniform2f(gl.getUniformLocation(program, "u_position"), current.x, current.y);
	gl.uniform2f(gl.getUniformLocation(program, "u_rotate"), cos, sin);
	gl.uniform1f(gl.getUniformLocation(program, "u_scale"), scale);
	gl.uniform1i(gl.getUniformLocation(program, "u_detail"), detail);

	const positionLocation = gl.getAttribLocation(program, 'a_position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);	// destination = canvas
	gl.bindTexture(gl.TEXTURE_2D, texture);	// source = pipe from previous shader
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.useProgram(program2);
	gl.uniform2f(gl.getUniformLocation(program2, "u_resolution"), canvas.width, canvas.height);

	const positionLocation2 = gl.getAttribLocation(program2, 'a_position');
	gl.enableVertexAttribArray(positionLocation2);
	gl.vertexAttribPointer(positionLocation2, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	setInfo('center', format(current.x, 0) + ', ' + format(current.y, 0));
	setInfo('rotation', rotation);
	setInfo('scale', format(scale, 3));
	setInfo('detail', detail);
	setInfo('pixels', canvas.width * canvas.height);
	setInfo('fps', framerate.fps(time).toFixed(0));
})(0);

function format(n, prec) {
	return (n * (1 << 17)).toFixed(prec);
}

function toggleDialog(id) {
	const style = document.getElementById(id).style;
	style.display = style.display == 'none' ? 'block' : 'none';
}

function setInfo(id, text) {
	document.getElementById('info_' + id).innerText = text;
}
