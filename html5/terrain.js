const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

(window.onresize = function() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
})();

let currentX = 33322;
let currentY = 35273;
let scale = 8;
const step = 16;
let hashCount;

const normal = {
	snow:	{r:255, g:255, b:255},
	rocks:	{r:60, g:60, b:120},
	land:	{r:0, g:255, b:0},
	beach:	{r:255, g:255, b:0},
	sea:	{r:1, g:128, b:255}
};

const dark = {
	snow:	{r:128, g:128, b:128},
	rocks:	{r:30, g:30, b:60},
	land:	{r:0, g:128, b:0},
	beach:	{r:128, g:128, b:0},
	sea:	{r:1, g:128, b:255}
};

window.onkeydown = function(e) {
	switch (e.keyCode) {
		case 37: currentX -= step * scale; break;	// left
		case 38: currentY += step * scale; break;	// up
		case 39: currentX += step * scale; break;	// right
		case 40: currentY -= step * scale; break;	// down
		case 65: scale /= 1.125; break;	// A = zoom in
		case 90: scale *= 1.125; break;	// Z = zoom out
		case 72: toggleDialog('help'); break;	// H = toggle help
		case 73: toggleDialog('info'); break;	// I = toggle info
	}
};

let lastTime = 0;

(function loop(time) {
	requestAnimationFrame(loop);

	hashCount = 0;
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imageData.data;
	const width = canvas.width;
	const height = canvas.height;
	const startX = -width >> 1;
	const startY = -height >> 1;
	const endX = startX + width;
	const endY = startY + height;
	let i = 0;
	let h;
	const p = {};
	const row = [];
	for (p.x = startX; p.x < endX; p.x++) {
		row[p.x] = calculateHeight(p);
	}
	for (p.y = startY; p.y < endY; p.y++) {
		p.x = -1;
		let left = calculateHeight(p);
		for (p.x = startX; p.x < endX; p.x++) {
			h = calculateHeight(p);
			const c = color(h, h - left, h - row[p.x]);
			data[i++] = c.r;
			data[i++] = c.g;
			data[i++] = c.b;
			data[i++] = 255;
			row[p.x] = left = h;
		}
	}
	ctx.putImageData(imageData, 0, 0);

	const duration = time - lastTime;
	setInfo('center', Math.floor(currentX) + ', ' + Math.floor(currentY));
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
	let depth;
	for (depth = 12; depth >= 0; depth--) {
		const mask = (1 << depth) - 1;
		const internalX = x & mask;
		const internalY = y & mask;
		const cellX = (x >> depth) & 0xFFFF;
		const cellY = (y >> depth) & 0xFFFF;
		const anchorX = cellX & 1;
		const anchorY = cellY & 1;

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
			if (internalX < internalY && anchorX == 1) {
				corner = center;
			}
			else if (internalX > internalY && anchorY == 1) {
				corner = center;
			}
			else {
				corner += corner;
			}
		}

		near += hash(cellX, cellY, depth);
		far += hash(cellX + 1, cellY + 1, depth);
		if (internalX < internalY) {
			corner += hash(cellX, cellY + 1, depth);
		}
		else {
			corner += hash(cellX + 1, cellY, depth);
		}
	}
	x %= 1;
	y %= 1;
	return near + (corner - near) * Math.max(x, y) + (far - corner) * Math.min(x, y);
}

function color(h, s1, s2) {
	const rgb = s1 + s2 >= 0 ? normal : dark;
	return h > 8100 ? rgb.snow :
		h > 7500 ? rgb.rocks :
		h > 5500 ? rgb.land :
		h > 5400 ? rgb.beach : rgb.sea;
}

function pixel(p) {
	return {
		x: currentX + p.x * scale,
		y: currentY - p.y * scale
	};
}

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
