"use strict"

import { options } from "./samples/spiral.js"

function delay(t, val) {
    return new Promise(resolve => setTimeout(resolve, t, val));
}

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
		this.lengths = [];
		this.fixedTo = [];
		this.fixed = false;
	}

	distance(point) {
		return Math.sqrt((this.x - point.x) ** 2 + (this.y - point.y) ** 2);
	}

	updatePos(dt = .5) {
		this.vx += this.ax * dt
		this.vy += this.ay * dt
		this.x += this.vx * dt
		this.y += this.vy * dt
	}

	postprocPos() {
		let cnt = 1;
		for (let other of this.fixedTo) {
			this.x += other.x
			this.y += other.y
			cnt++;
		}
		this.x = this.x / cnt
		this.y = this.y / cnt
		for (let other of this.fixedTo) {
			other.x = this.x
			other.y = this.y
		}
	}

	updateAcc() {
		if (!this.fixed) {
			const F = { x: 0, y: 0 }
//			F.x += Point.C/100 * (400 - this.x)
//			F.y += Point.C/100 * (400 - this.y)
			for (let i = 0; i < this.connections.length; i++) {
				const other = this.connections[i]
				const length = this.lengths[i]
				const distance = this.distance(other)
				const diff = distance/* - length*/
				if (distance == 0) continue
				F.x += Point.C * diff * (other.x - this.x) / distance
				F.y += Point.C * diff * (other.y - this.y) / distance
			}
			F.x += - Point.S * this.vx
			F.y += - Point.S * this.vy
			this.ax = F.x / Point.m
			this.ay = F.y / Point.m
		}
	}

	connect(point) {
		this.connections.push(point);
		this.lengths.push(this.distance(point)*0.7);
		point.connections.push(this);
		point.lengths.push(this.distance(point)*0.7);
	}

	fixTo(point) {
		this.fixedTo.push(point)
		point.fixedTo.push(this)
	}

	disconnect(point, disconnectOther = true) {
		const index = this.connections.indexOf(point);
		if (index > -1) {
			this.connections.splice(index, 1);
			this.lengths.splice(index, 1);
		}
		if (disconnectOther) { 
			point.disconnect(this, false);
		}
	}

	static middle(point1, point2, factor = 0.5) { 
		return new Point(
			(point1.x * (1-factor) + point2.x * factor),
			(point1.y * (1-factor) + point2.y * factor));
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

	async makePointsAfter(index, count) {
		index = Math.round(index)
		let prevPoint = this.points[index]; 
		const nextPoint = this.points[index + 1];
		for (let i = 0; i < count; i++) {
			const factor = 1 / (count + 1 - i);
			prevPoint = await this.insertBetween(prevPoint, nextPoint, factor)
		}
	}

	async insertBetween(prevPoint, nextPoint, factor) {
		const interPoint = Point.middle(prevPoint, nextPoint, factor);
		prevPoint.disconnect(nextPoint);
		interPoint.connect(prevPoint);
		interPoint.connect(nextPoint);
		this.points.splice(this.points.indexOf(prevPoint),0, interPoint);

		const newPoint = Point.middle(prevPoint, nextPoint, factor);
		const endPoint = this.points[this.points.length - 1]
		endPoint.connect(newPoint);
		this.points.push(newPoint);

		interPoint.connect(newPoint);
		interPoint.fixTo(newPoint)

		return delay(3, interPoint);
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

	async contruct() {
		this.addBase();
		await this.addRounds(this.options.rounds)
		this.closePoints();
	}

	async addRounds(steps) {
		for (let step of steps)
			await this.addRound(step)
	}

	addBase() {
		const count = this.options.baseCount/* + .5*/
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

	async addRound(steps = [1]) {
		if (!Array.isArray(steps)) steps = [steps]
		let actEnd = this.thread.points.length - 1;
		for (let i = 0; this.actBase < actEnd; i++) {
			const step = steps[i % steps.length]
			if (step >= 1) {
				await this.thread.makePointsAfter(this.actBase, 1)
				this.actBase += step + 1
				actEnd += 1
			}
			else {
				const cnt = Math.round(1/step);
				await this.thread.makePointsAfter(this.actBase, cnt)
				this.actBase += cnt + 1;
				actEnd += cnt
			}
		}
		this.actBase = actEnd
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
		for (let point of this.thread.points)
			point.postprocPos()
	}

	drawBackground() {
		this.ctx.fillStyle = '#fff';
		this.ctx.fillRect(0, 0, this.width, this.height);
		this.ctx.strokeStyle = '#f0d0b0';
		this.ctx.lineWidth = 10;
		this.ctx.beginPath();
		this.ctx.arc(this.origo.x, this.origo.y, this.width/2-5, 0, 2 * Math.PI);
		this.ctx.stroke();
		this.ctx.lineWidth = 1;
	}

	drawPoints() {
		this.ctx.strokeStyle = '#a04090';
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

const dreamCatcher = new DreamCatcher('canvas', options);
dreamCatcher.contruct()
setInterval(() => {
	dreamCatcher.draw();
	dreamCatcher.update();
}, 1000 / 60);
