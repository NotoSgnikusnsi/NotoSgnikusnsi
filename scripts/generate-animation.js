const fs = require('fs');
const { graphql } = require('@octokit/graphql');

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

class Bird {
  constructor(x, y, contributionCount) {
    this.x = x;
    this.y = y;
    this.size = Math.min(10 + contributionCount / 2, 30);
    this.velocity = {
      x: Math.random() * 4 - 2,
      y: Math.random() * 4 - 2
    };
  }

  toSVGPath() {
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    return `
      <g transform="translate(${this.x} ${this.y}) rotate(${angle * 180 / Math.PI})">
        <path 
          d="M ${-this.size},0 
             C ${-this.size * 0.8},${-this.size * 0.3} ${-this.size * 0.3},${-this.size * 0.5} 0,0 
             C ${-this.size * 0.3},${this.size * 0.5} ${-this.size * 0.8},${this.size * 0.3} ${-this.size},0 
             Z"
          fill="#40916c"
          opacity="${Math.min(0.3 + this.size / 30, 1)}"
        />
      </g>
    `;
  }

  update(birds, width, height) {
    // Boidsのルール適用
    const alignment = { x: 0, y: 0 };
    const cohesion = { x: 0, y: 0 };
    const separation = { x: 0, y: 0 };
    let neighborCount = 0;

    birds.forEach(other => {
      if (other === this) return;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 100) {
        alignment.x += other.velocity.x;
        alignment.y += other.velocity.y;
        cohesion.x += other.x;
        cohesion.y += other.y;
        if (distance < 50) {
          separation.x -= dx / distance;
          separation.y -= dy / distance;
        }
        neighborCount++;
      }
    });

    if (neighborCount > 0) {
      this.velocity.x += (alignment.x / neighborCount - this.velocity.x) * 0.05;
      this.velocity.y += (alignment.y / neighborCount - this.velocity.y) * 0.05;
      this.velocity.x += (cohesion.x / neighborCount - this.x) * 0.01;
      this.velocity.y += (cohesion.y / neighborCount - this.y) * 0.01;
    }

    this.velocity.x += separation.x * 0.05;
    this.velocity.y += separation.y * 0.05;

    // 速度制限
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (speed > 4) {
      this.velocity.x = (this.velocity.x / speed) * 4;
      this.velocity.y = (this.velocity.y / speed) * 4;
    }

    // 位置更新
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // 画面端での折り返し
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
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
  const birds = [];

  contributions.forEach(count => {
    if (count > 0) {
      birds.push(new Bird(
        Math.random() * width,
        Math.random() * height,
        count
      ));
    }
  });

  const frames = 120;
  const animations = birds.map((bird, index) => {
    const keyframes = [];
    for (let i = 0; i < frames; i++) {
      bird.update(birds, width, height);
      keyframes.push(`${(i / frames) * 100}% { transform: translate(${bird.x}px, ${bird.y}px) rotate(${Math.atan2(bird.velocity.y, bird.velocity.x) * 180 / Math.PI}deg); }`);
    }
    return `
      #bird-${index} {
        animation: bird-${index} 20s linear infinite;
      }
      @keyframes bird-${index} {
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
      ${birds.map((bird, index) => `
        <g id="bird-${index}">
          ${bird.toSVGPath()}
        </g>
      `).join('\n')}
    </svg>
  `;

  fs.writeFileSync('./dist/github-contribution-animation.svg', svg);
}

generateAnimation().catch(console.error);