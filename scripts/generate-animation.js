const fs = require('fs');
const { graphql } = require('@octokit/graphql');

// GitHub GraphQL APIの認証設定
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

// 波紋のクラス
class Ripple {
  constructor(x, y, contributionCount, duration, delay) {
    this.x = x;
    this.y = y;
    this.size = 20 + contributionCount * 3;
    this.duration = duration;
    this.delay = delay;

    if(Math.floor(Math.random() * 2) == 0) {
        this.fillColor = "none";
    } else {
        this.fillColor = "#4B9EF9"
    }
  }

  toSVG() {
    return `
      <circle
        cx="${this.x}"
        cy="${this.y}"
        r="0"
        fill="${this.fillColor}"
        stroke="#4B9EF9"
        stroke-width="1"
        opacity="0.8"
      >
        <animate
          attributeName="r"
          begin="${this.delay}"
          from="0"
          to="${this.size}"
          dur="${this.duration}s"
          fill="freeze"
          values="0; ${this.size}"
          keyTimes="0; 1" 
          keySplines="0 0.8 0.5 1; "
          calcMode="spline"
        />
        <animate
          attributeName="opacity"
          begin="${this.delay}"
          from="0.8"
          to="0.2"
          dur="${this.duration}s"
          fill="freeze"
        />
      </circle>
    `;
  }
}
// GitHubの貢献度データを取得する関数
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

  // GraphQLクエリを実行してデータを取得
  const response = await graphqlWithAuth(query, { username });
  return response.user.contributionsCollection.contributionCalendar;
}

// ランダムな位置を生成する関数
function getRandomPosition(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height
  };
}

// アニメーションを生成する関数
async function generateAnimation() {
  const username = process.env.GITHUB_REPOSITORY.split('/')[0]; // ユーザー名を取得
  const contributionData = await getContributions(username); // 貢献度データを取得
  const width = 800;
  const height = 400;
  const duration = 2 // 波紋が広がりきるまでの時間
  let delay = 0;

  // 貢献度データに基づいてRippleインスタンスを生成
  const ripples = contributionData.weeks.flatMap((week) =>
    week.contributionDays.filter(day => day.contributionCount > 0)
      .map((day) => {
        const { x, y } = getRandomPosition(width, height);
        const ripple = new Ripple(x, y, day.contributionCount, delay, duration);
        delay += Math.random() * 1;
        return ripple;
      })
  );

  // RippleインスタンスをSVG要素に変換
  const rippleSVGs = ripples.map(ripple => ripple.toSVG()).join('');

  const resetDuration = ripples.length * 0.5 + 5; // 全波紋が描写される時間 + 余裕時間
  const svg = `
    <svg 
      viewBox="0 0 ${width} ${height}" 
      xmlns="http://www.w3.org/2000/svg"
      style="background: #0D1117"
    >
      <rect width="100%" height="100%" fill="#0D1117"/>
      <g>${rippleSVGs}</g>
    </svg>
  `;

  // SVGファイルとして保存
  fs.writeFileSync('./dist/github-contribution-animation.svg', svg);
}

// アニメーション生成関数を実行し、エラーがあればログに出力
generateAnimation().catch(console.error);