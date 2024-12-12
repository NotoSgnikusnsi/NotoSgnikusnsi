const fs = require('fs');
const { graphql } = require('@octokit/graphql');

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

class Star {
  constructor(x, y, contributionCount) {
    this.x = x;
    this.y = y;
    this.size = Math.min(3 + contributionCount / 3, 8);
    this.brightness = Math.min(0.3 + contributionCount / 100, 1);
    this.connections = [];
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 0.2 + Math.random() * 0.3;
    this.orbitRadius = Math.random() * 20;
    this.baseX = x;
    this.baseY = y;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(time) {
    // 星が軌道を描くような動き
    this.x = this.baseX + Math.cos(this.angle + time * this.speed) * this.orbitRadius;
    this.y = this.baseY + Math.sin(this.angle + time * this.speed) * this.orbitRadius;
    
    // 明るさのパルス効果
    this.currentBrightness = this.brightness * (0.7 + 0.3 * Math.sin(time * 2 + this.phase));
  }

  toSVG() {
    return `
      <g class="star-group">
        <circle 
          cx="${this.x}" 
          cy="${this.y}" 
          r="${this.size}"
          fill="#4B9EF9"
          opacity="${this.currentBrightness}"
        >
          <animate
            attributeName="r"
            values="${this.size};${this.size * 1.2};${this.size}"
            dur="${2 + Math.random()}s"
            repeatCount="indefinite"
          />
        </circle>
        <circle 
          cx="${this.x}" 
          cy="${this.y}" 
          r="${this.size * 1.5}"
          fill="none"
          stroke="#4B9EF9"
          stroke-width="0.5"
          opacity="${this.currentBrightness * 0.3}"
        >
          <animate
            attributeName="r"
            values="${this.size * 1.5};${this.size * 2};${this.size * 1.5}"
            dur="${3 + Math.random()}s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    `;
  }
}

class Constellation {
  constructor(stars) {
    this.stars = stars;
    this.connectStars();
  }

  connectStars() {
    for (let i = 0; i < this.stars.length; i++) {
      for (let j = i + 1; j < this.stars.length; j++) {
        const dist = Math.hypot(
          this.stars[i].x - this.stars[j].x,
          this.stars[i].y - this.stars[j].y
        );
        if (dist < 100) {
          this.stars[i].connections.push(j);
        }
      }
    }
  }

  toSVG(time) {
    this.stars.forEach(star => star.update(time));

    const connections = this.stars.flatMap((star, i) =>
      star.connections.map(j => {
        const other = this.stars[j];
        const dist = Math.hypot(star.x - other.x, star.y - other.y);
        const opacity = Math.max(0, 1 - dist / 100) * 0.3;
        return `
          <line 
            x1="${star.x}" 
            y1="${star.y}" 
            x2="${other.x}" 
            y2="${other.y}"
            stroke="#4B9EF9"
            stroke-width="0.5"
            opacity="${opacity}"
          >
            <animate
              attributeName="opacity"
              values="${opacity};${opacity * 0.5};${opacity}"
              dur="3s"
              repeatCount="indefinite"
            />
          </line>
        `;
      })
    );

    return `
      <g class="connections">${connections.join('')}</g>
      <g class="stars">${this.stars.map(star => star.toSVG()).join('')}</g>
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
                date
              }
            }
          }
        }
      }
    }
  `;

  const response = await graphqlWithAuth(query, { username });
  return response.user.contributionsCollection.contributionCalendar;
}

async function generateAnimation() {
  const username = process.env.GITHUB_REPOSITORY.split('/')[0];
  const contributionData = await getContributions(username);
  const width = 800;
  const height = 400;
  
  // コントリビューションデータから星を生成
  const stars = contributionData.weeks.flatMap((week, weekIndex) =>
    week.contributionDays.filter(day => day.contributionCount > 0)
      .map((day, dayIndex) => new Star(
        50 + (weekIndex / 52) * (width - 100),
        50 + (dayIndex / 7) * (height - 100),
        day.contributionCount
      ))
  );

  const constellation = new Constellation(stars);

  // アニメーションのキーフレームを生成
  const frames = 60;
  const animations = Array.from({ length: frames }, (_, i) => {
    const time = (i / frames) * Math.PI * 2;
    return constellation.toSVG(time);
  });

  const svg = `
    <svg 
      viewBox="0 0 ${width} ${height}" 
      xmlns="http://www.w3.org/2000/svg"
      style="background: #0D1117"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="#0D1117"/>
      <g filter="url(#glow)">
        ${animations[0]}
      </g>
    </svg>
  `;

  fs.writeFileSync('./dist/github-contribution-animation.svg', svg);
}

generateAnimation().catch(console.error);