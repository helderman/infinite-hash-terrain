const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

(window.onresize = function() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
})();

let current = { x: 33322, y: 35273 };
let rotation = 0;
let cos = 1;
let sin = 0;
let scale = 8;
let crosshair = true;
let hashCount;

const colors = {
	snow:	{r:255, g:255, b:255},
	rocks:	{r:128, g:128, b:192},
	land:	{r:0, g:224, b:0},
	beach:	{r:255, g:255, b:0},
	sea:	{r:1, g:128, b:192}
};

window.onkeydown = function(e) {
	switch (e.keyCode) {
		case 37: move(-16, 0); break;	// left
		case 38: move(0, -16); break;	// up
		case 39: move(16, 0); break;	// right
		case 40: move(0, 16); break;	// down
		case 65: scale /= 1.125; break;	// A = zoom in
		case 90: scale *= 1.125; break;	// Z = zoom out
		case 81: turn(5); break;	// Q = rotate left
		case 87: turn(355); break;	// W = rotate right
		case 67: crosshair = !crosshair; break;	// C = toggle crosshair
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

let lastTime = 0;

(function loop(time) {
	requestAnimationFrame(loop);

	hashCount = 0;
	const width = canvas.width;
	const height = canvas.height;
	const imageData = ctx.getImageData(0, 0, width, height);
	const data = imageData.data;
	const startX = -width >> 1;
	const startY = -height >> 1;
	const endX = startX + width;
	const endY = startY + height;
	const p = {x: startX - 1, y: startY - 1};
	const above = [];
	while (++p.x < endX) {
		above[p.x] = calculateHeight(p);
	}
	let i = 0;
	while (++p.y < endY) {
		p.x = startX - 1;
		let left = calculateHeight(p);
		while (++p.x < endX) {
			const h = calculateHeight(p);
			const c = material(h, (h - left) / scale, (h - above[p.x]) / scale);
			data[i++] = c.r;
			data[i++] = c.g;
			data[i++] = c.b;
			data[i++] = 255;
			above[p.x] = left = h;
		}
	}
	if (crosshair && width >= 16 && height >= 16) {
		const paint = function(x, y) {
			const j = 4 * (x - startX + width * (y - startY));
			data[j] = 255;
			data[j+1] = data[j+2] = 0;
		}
		for (let d = -8; d < 8; d++) {
			paint(0, d);
			paint(-1, d);
			paint(d, 0);
			paint(d, 1);
		}
	}
	ctx.putImageData(imageData, 0, 0);

	const duration = time - lastTime;
	setInfo('center', Math.floor(current.x) + ', ' + Math.floor(current.y));
	setInfo('rotation', rotation);
	setInfo('scale', scale.toFixed(3));
	setInfo('pixels', i >> 2);
	setInfo('hashes', hashCount);
	setInfo('fps', duration ? (1000 / duration).toFixed(2) : '');
	lastTime = time;
})(lastTime);

function calculateHeight(p) {
	return summedHashes(skew(pixel(p)));
}

function summedHashes(p) {
	let x = p.x;
	let y = p.y;
	let near = 0;
	let far = 0;
	let corner = 0;
	let internalX, internalY;
	for (let depth = 12; depth >= 0; depth--) {
		const divisor = 1 << depth;
		const cellX = Math.floor(x / divisor);
		const cellY = Math.floor(y / divisor);
		const anchorX = cellX & 1;
		const anchorY = cellY & 1;
		// Similar to 'simplicial subdivision' in simplex noise
		internalX = x - cellX * divisor;
		internalY = y - cellY * divisor;
		const subdivision = internalX < internalY ? 1 : 0;

		if (anchorX == 0 && anchorY == 0) {
			far += near;
			corner += near;
			near += near;
		}
		else if (anchorX == 1 && anchorY == 1) {
			near += far;
			corner += far;
			far += far;
		}
		else {
			const center = near + far;
			near += corner;
			far += corner;
			if (subdivision == anchorX) {
				corner = center;
			}
			else {
				corner += corner;
			}
		}

		near += hash(cellX, cellY, depth);
		far += hash(cellX + 1, cellY + 1, depth);
		corner += subdivision
			? hash(cellX, cellY + 1, depth)
			: hash(cellX + 1, cellY, depth);
	}
	return near + (corner - near) * Math.max(internalX, internalY) + (far - corner) * Math.min(internalX, internalY);
}

function material(height, s1, s2) {
	if (height < 5400) {
		return colors.sea;
	}
	else {
		return shade((10 + s1 + s2) / Math.sqrt(100 + s1*s1 + s2*s2),
			height > 8000 ? colors.snow :
			height > 7200 ? colors.rocks :
			height > 5500 ? colors.land : colors.beach);
	}
}

function shade(inprod, rgb) {
	const f = (inprod + 1) / 2;
	return {
		r: f * rgb.r,
		g: f * rgb.g,
		b: f * rgb.b
	};
}

function pixel(p) {
	return {
		x: current.x + scale * (p.x * cos + p.y * sin),
		y: current.y + scale * (p.x * sin - p.y * cos)
	};
}

// Similar to 'coordinate skewing' in simplex noise
function skew(p) {
	const d = (p.x + p.y) * 0.3660254037844386;
	return {
		x: p.x + d,
		y: p.y + d
	};
}

function hash(x, y, depth) {
	hashCount++;
	return parity(563 * x + 761 * y + depth);
	// * parity(1409 * x + 397 * y + depth);
}

function parity(n) {
	n ^= n >> 8;
	n ^= n >> 4;
	n ^= n >> 2;
	n ^= n >> 1;
	return n & 1;
}

function toggleDialog(id) {
	const style = document.getElementById(id).style;
	style.display = style.display == 'none' ? 'block' : 'none';
}

function setInfo(id, text) {
	document.getElementById('info_' + id).innerText = text;
}
