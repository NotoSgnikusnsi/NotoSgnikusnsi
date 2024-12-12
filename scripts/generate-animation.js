import fs from 'fs';
import { graphql } from '@octokit/graphql';

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

class Boid {
  constructor(color) {
    this.position = createVector(random(width), random(height));
    this.velocity = p5.Vector.random2D(); // 大きさが1のランダムなベクトル
    this.acceleration = createVector(0, 0);

    this.color = color;
  }

  // 結合
  cohesion(boids) {
    // 1. 結合したい仲間の距離を決める
    const maxRadius = 100;
    const minRadius = 50;
    const sum = createVector(0, 0);
    let count = 0;
    // 2. 仲間の合計距離を計算する
    for (let boid of boids) {
      const distance = this.position.dist(boid.position);
      if (distance < maxRadius && distance >= minRadius) {
        sum.add(boid.position);
        count++;
      }
    }
    // 3. 仲間の平均位置に向かうベクトルを計算する
    if (count > 0) {
      sum.div(count);
      sum.sub(this.position);
      sum.setMag(0.1);
      // 4. 速度を更新する
      this.acceleration.add(sum);
    }
  }

  // 分離
  separation(boids) {
    // 1. 分離したい仲間の距離を決める
    const radius = 50;
    const sum = createVector(0, 0);
    let count = 0;
    // 2. 仲間の合計距離を計算する
    for (let boid of boids) {
      const distance = this.position.dist(boid.position);
      if (distance < radius) {
        sum.add(boid.position);
        count++;
      }
    }
    // 3. 仲間から離れるベクトルを計算する
    sum.div(count);
    sum.sub(this.position);
    sum.setMag(0.1);
    // 4. 速度を更新する
    this.acceleration.sub(sum);
  }

  // 整列
  alignment(boids) {
    // 1. 整列したい仲間の距離を決める
    const radius = 100;
    const sum = createVector(0, 0);
    let count = 0;
    // 2. 仲間の合計速度を計算する
    for (let boid of boids) {
      const distance = this.position.dist(boid.position);
      if (distance < radius) {
        sum.add(boid.velocity);
        count++;
      }
    }
    // 3. 仲間の平均速度に向かうベクトルを計算する
    sum.div(count);
    sum.setMag(0.1);
    // 4. 速度を更新する
    this.acceleration.add(sum);
  }

  // フレームごとの処理
  update() {
    // 速度を更新する
    this.velocity.add(this.acceleration);
    // 速度の大きさを制限する
    this.velocity.limit(5);
    // 位置を更新する
    this.position.add(this.velocity);
    // 加速度をリセットする
    this.acceleration.mult(0);

    // 画面の外に出た場合、反対側から再度入ってくる
    if (this.position.x > width) {
      this.position.x = 0;
    } else if (this.position.x < 0) {
      this.position.x = width;
    }
    if (this.position.y > height) {
      this.position.y = 0;
    } else if (this.position.y < 0) {
      this.position.y = height;
    }
  }

  display() {
    // 三角形を描く
    stroke(0);
    fill(this.color);
    push();
    translate(this.position.x, this.position.y);
    rotate(this.velocity.heading() + radians(90));
    beginShape();
    vertex(0, -12);
    vertex(-6, 12);
    vertex(6, 12);
    endShape(CLOSE);
    pop();
  }

  toSVGPath() {
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    return `
      <g transform="translate(${this.position.x} ${this.position.y}) rotate(${angle * 180 / Math.PI})">
        <path 
          d="M ${-12},0 
             C ${-9.6},${-3.6} ${-3.6},${-6} 0,0 
             C ${-3.6},${6} ${-9.6},${3.6} ${-12},0 
             Z"
          fill="${this.color}"
          opacity="${Math.min(0.3 + 12 / 30, 1)}"
        />
      </g>
    `;
  }
}

async function getContributions(username) {
  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const response = await graphqlWithAuth(query, { username });
  const weeks = response.user.contributionsCollection.contributionCalendar.weeks;
  return weeks.flatMap(week => week.contributionDays.map(day => day.contributionCount));
}

async function generateAnimation() {
  const username = process.env.GITHUB_REPOSITORY.split('/')[0];
  const contributions = await getContributions(username);
  const width = 800;
  const height = 400;
  const boids = [];
  const boidsColor = color(random(255), random(255), random(255));
  createCanvas(width, height);

  contributions.forEach(count => {
    if (count > 0) {
      boids.push(new Boid(boidsColor));
    }
  });

  const frames = 120;
  const animations = boids.map((boid, index) => {
    const keyframes = [];
    for (let i = 0; i < frames; i++) {
      boid.cohesion(boids);
      boid.separation(boids);
      boid.alignment(boids);
      boid.update();
      boid.display();
      keyframes.push(`${(i / frames) * 100}% { transform: translate(${boid.position.x}px, ${boid.position.y}px) rotate(${Math.atan2(boid.velocity.y, boid.velocity.x) * 180 / Math.PI}deg); }`);
    }
    return `
      #boid-${index} {
        animation: boid-${index} 20s linear infinite;
      }
      @keyframes boid-${index} {
        ${keyframes.join('\n')}
      }
    `;
  });

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        ${animations.join('\n')}
      </style>
      <rect width="100%" height="100%" fill="#1a1b26"/>
      ${boids.map((boid, index) => `
        <g id="boid-${index}">
          ${boid.toSVGPath()}
        </g>
      `).join('\n')}
    </svg>
  `;

  fs.writeFileSync('./dist/github-contribution-animation.svg', svg);
}

generateAnimation().catch(console.error);