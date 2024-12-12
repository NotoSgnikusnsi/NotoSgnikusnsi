const fs = require('fs');
const { graphql } = require('@octokit/graphql');

const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

class Tree {
  constructor(x, y, contributionCount) {
    this.x = x;
    this.y = y;
    this.height = Math.min(20 + contributionCount * 2, 100);
    this.width = Math.min(5 + contributionCount / 5, 15);
    this.color = `rgb(${50 + contributionCount * 2}, ${150 + contributionCount}, 50)`;
  }

  toSVG() {
    return `
      <g class="tree">
        <rect 
          x="${this.x - this.width / 2}" 
          y="${this.y - this.height}" 
          width="${this.width}" 
          height="${this.height}"
          fill="${this.color}" 
        />
        <circle 
          cx="${this.x}" 
          cy="${this.y - this.height}" 
          r="${this.width * 1.5}" 
          fill="green" 
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
  return response.user.contributionsCollection.contributionCalendar;
}

async function generateAnimation() {
  const username = process.env.GITHUB_REPOSITORY.split('/')[0];
  const contributionData = await getContributions(username);
  const width = 800;
  const height = 400;

  // コントリビューションデータから木を生成
  const trees = contributionData.weeks.flatMap((week, weekIndex) =>
    week.contributionDays.map((day, dayIndex) => {
      if (day.contributionCount > 0) {
        return new Tree(
          50 + (weekIndex / contributionData.weeks.length) * (width - 100),
          height - 50 - (dayIndex / 7) * (height - 100),
          day.contributionCount
        );
      }
      return null;
    }).filter(Boolean)
  );

  const svg = `
    <svg 
      viewBox="0 0 ${width} ${height}" 
      xmlns="http://www.w3.org/2000/svg"
      style="background: #0D1117"
    >
      <rect width="100%" height="100%" fill="#0D1117"/>
      ${trees.map(tree => tree.toSVG()).join('')}
    </svg>
  `;

  fs.writeFileSync('./dist/github-contribution-animation.svg', svg);
}

generateAnimation().catch(console.error);