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
    this.maxRadius = 20 + contributionCount * 2; // 波紋の最大半径
    this.opacity = Math.min(0.3 + contributionCount / 100, 1);
    this.duration = 2 + contributionCount / 10; // アニメーション時間
  }

  toSVG() {
    return `
      <circle
        cx="${this.x}"
        cy="${this.y}"
        r="0"
        fill="none"
        stroke="#4B9EF9"
        stroke-width="2"
        opacity="${this.opacity}"
      >
        <animate
          attributeName="r"
          from="0"
          to="${this.maxRadius}"
          dur="${this.duration}s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          from="${this.opacity}"
          to="0"
          dur="${this.duration}s"
          repeatCount="indefinite"
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

async function generateAnimation() {
  const username = process.env.GITHUB_REPOSITORY.split('/')[0];
  const contributionData = await getContributions(username);
  const width = 800;
  const height = 400;

  const ripples = contributionData.weeks.flatMap((week, weekIndex) =>
    week.contributionDays.filter(day => day.contributionCount > 0)
      .map((day, dayIndex) => new Ripple(
        50 + (weekIndex / 52) * (width - 100),
        50 + (dayIndex / 7) * (height - 100),
        day.contributionCount
      ))
  );

  const svg = `
    <svg 
      viewBox="0 0 ${width} ${height}" 
      xmlns="http://www.w3.org/2000/svg"
      style="background: #0D1117"
    >
      <rect width="100%" height="100%" fill="#1A1B26"/>
      <g>
        ${ripples.map(ripple => ripple.toSVG()).join('')}
      </g>
    </svg>
  `;

  fs.writeFileSync('./dist/github-contribution-animation.svg', svg);
}

generateAnimation().catch(console.error);
