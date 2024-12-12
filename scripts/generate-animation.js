const fs = require('fs');
const { graphql } = require('@octokit/graphql');

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

class Ripple {
  constructor(x, y, contributionCount) {
    this.x = x;
    this.y = y;
    this.contributionCount = contributionCount;
    this.maxRadius = 20 + contributionCount * 3; // 波紋の最大半径
    this.opacity = Math.min(0.3 + contributionCount / 100, 1);
    this.duration = 2 + contributionCount / 10; // アニメーション時間
    this.fadeDuration = 5; // 波紋の残留効果
  }

  toSVG() {
    return `
      <circle
        cx="${this.x}"
        cy="${this.y}"
        r="0"
        fill="none"
        stroke="#4B9EF9"
        stroke-width="1"
        opacity="${this.opacity}"
      >
        <animate
          attributeName="r"
          from="0"
          to="${this.maxRadius}"
          dur="${this.duration}s"
          fill="freeze"
        />
        <animate
          attributeName="opacity"
          from="${this.opacity}"
          to="${this.opacity * 0.2}"
          begin="${this.duration}s"
          dur="${this.fadeDuration}s"
          fill="freeze"
        />
      </circle>
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

function getRandomPosition(centerX, centerY, radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * radius;
  return {
    x: centerX + Math.cos(angle) * distance,
    y: centerY + Math.sin(angle) * distance,
  };
}

async function generateAnimation() {
  const username = process.env.GITHUB_REPOSITORY.split('/')[0];
  const contributionData = await getContributions(username);
  const width = 800;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const rippleRadius = Math.min(width, height) / 4; // 波紋が発生するエリアの半径

  const ripples = contributionData.weeks.flatMap((week) =>
    week.contributionDays.filter(day => day.contributionCount > 0)
      .map((day) => {
        const { x, y } = getRandomPosition(centerX, centerY, rippleRadius);
        return new Ripple(x, y, day.contributionCount);
      })
  );

  const rippleSVGs = ripples.map(ripple => ripple.toSVG()).join('');

  const resetDuration = ripples.length * 3; // 全波紋が描写される時間
  const svg = `
    <svg 
      viewBox="0 0 ${width} ${height}" 
      xmlns="http://www.w3.org/2000/svg"
      style="background: #0D1117"
    >
      <rect width="100%" height="100%" fill="#0D1117"/>
      <g>
        ${rippleSVGs}
        <rect 
          width="100%" 
          height="100%" 
          fill="#0D1117" 
          opacity="0"
        >
          <animate 
            attributeName="opacity" 
            from="0" 
            to="1" 
            begin="${resetDuration}s" 
            dur="2s" 
            fill="freeze"
          />
        </rect>
      </g>
    </svg>
  `;

  fs.writeFileSync('./dist/github-contribution-ripples.svg', svg);
}

generateAnimation().catch(console.error);
