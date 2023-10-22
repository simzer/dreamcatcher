"use strict"

class Point {
	static C = 1
	static S = .4
	static m = 1

	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.vx = 0;
		this.vy = 0;
		this.ax = 0;
		this.ay = 0;
		this.connections = [];
		this.fixed = false;
	}

	updatePos(dt = .5) {
		this.vx += this.ax * dt
		this.vy += this.ay * dt
		this.x += this.vx * dt
		this.y += this.vy * dt
	}

	updateAcc() {
		if (!this.fixed) {
			const F = { x: 0, y: 0 }
//			F.x += Point.C/50 * (400 - this.x)
//			F.y += Point.C/50 * (400 - this.y)
			for (let other of this.connections) {
				F.x += Point.C * (other.x - this.x)
				F.y += Point.C * (other.y - this.y)
			}
			F.x += - Point.S * this.vx
			F.y += - Point.S * this.vy
			this.ax = F.x / Point.m
			this.ay = F.y / Point.m
		}
	}

	connect(point) {
		this.connections.push(point);
		point.connections.push(this);
	}

	disconnect(point, disconnectOther = true) {
		const index = this.connections.indexOf(point);
		if (index > -1) {
			this.connections.splice(index, 1);
		}
		if (disconnectOther) point.disconnect(this, false);
	}

	static middle(point1, point2) {
		return new Point((point1.x + point2.x) / 2, (point1.y + point2.y) / 2);
	}
}

class Thread {
	constructor() {
		this.points = [];
	}

	makePointAtEnd(x, y) {
		const point = new Point(x, y);
		if (this.points.length > 0) {
			this.points[this.points.length - 1].connect(point);
		}
		this.points.push(point);
		return point;
	}

	makePointsAfter(index, count) {
		const prevPoint = this.points[index]; 
		const nextPoint = this.points[index + 1];
		for (let i = 0; i < count; i++) {
			prevPoint = this.insertBetween(prevPoint, nextPoint)
		}
	}

	makePointAfter(index) {
		const prevPoint = this.points[index]; 
		const nextPoint = this.points[index + 1];
		return this.insertBetween(prevPoint, nextPoint)
	}

	insertBetween(prevPoint, nextPoint) {
		const endPoint = this.points[this.points.length - 1]
		const newPoint = Point.middle(prevPoint, nextPoint);
		prevPoint.disconnect(nextPoint);
		prevPoint.connect(newPoint);
		newPoint.connect(nextPoint);
		endPoint.connect(newPoint);
		this.points.push(newPoint);
		return newPoint;
	}
}

class DreamCatcher {
	constructor(canvas, options)
	{
		this.options = options;
		this.canvas = document.getElementById(canvas);
		this.ctx = this.canvas.getContext('2d');
		this.width = this.canvas.width;
		this.height = this.canvas.height;
		this.radius = this.width / 2;
		this.origo = {x: this.width / 2, y: this.height / 2};
		this.thread = new Thread();
		this.actBase = 0;
	}

	contruct() {
		this.addBase();
		this.addRounds([
			[2,0],[0,1],[0,1],[2,1],[0,1],1,2,1,1,2,[0,1],1,2,2,2,
			1,1,1,1,1,1,1,1,1,1
		])
		this.closePoints();
	}

	addRounds(steps) {
		for (let step of steps)
		 this.addRound(step)
	}

	addBase() {
		const count = this.options.baseCount + .5
		for (let i = 0; i <= count; i++) {
			let angle = i * 2 * Math.PI / count;
			const point = this.thread.makePointAtEnd(...this.basePointCoords(angle));
			point.fixed = true;
		}
	}

	basePointCoords(angle) {
		const x = this.origo.x + this.radius * Math.cos(angle);
		const y = this.origo.y + this.radius * Math.sin(angle);
		return [x, y];
	}

	addRound(steps = [1]) {
		if (!Array.isArray(steps)) steps = [steps]
		const actEnd = this.thread.points.length - 1;
		for (let i = 0; this.actBase < actEnd; i++) {
			const step = steps[i % steps.length]
			this.thread.makePointAfter(this.actBase)
			this.actBase += step;
		}
	}

	closePoints() {
		this.thread.makePointAtEnd(this.origo.x, this.origo.y);
	}

	draw() {
		this.drawBackground();
		this.drawPoints();
	}

	update() {
		for (let point of this.thread.points)
			point.updateAcc()
		for (let point of this.thread.points)
			point.updatePos()
	}

	drawBackground() {
		this.ctx.fillStyle = '#f0f0f0';
		this.ctx.fillRect(0, 0, this.width, this.height);
	}

	drawPoints() {
		this.ctx.fillStyle = '#000';
		this.ctx.strokeStyle = '#000';
		const points = this.thread.points;
		for (let i = 1; i < points.length; i++) {
			const point = points[i]
			for (let other of point.connections)
			{
				this.ctx.beginPath();
				this.ctx.moveTo(other.x, other.y);
				this.ctx.lineTo(point.x, point.y);
				this.ctx.stroke();
			}
		}
	}
}

const dreamCatcher = new DreamCatcher('canvas', {
	baseCount: 25
});
dreamCatcher.contruct()
setInterval(() => {
	dreamCatcher.draw();
	dreamCatcher.update();
}, 1000 / 20);
