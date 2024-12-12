const fs = require('fs');
const { graphql } = require('@octokit/graphql');

// GitHub GraphQL APIの認証設定
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

// Rippleクラスの定義
class Ripple {
  constructor(x, y, contributionCount, delay) {
    this.x = x;
    this.y = y;
    this.contributionCount = contributionCount;
    this.maxRadius = 20 + contributionCount * 3; // 波紋の最大半径
    this.opacity = Math.min(0.3 + contributionCount / 100, 1); // 波紋の透明度
    this.duration = 4 + contributionCount / 5; // アニメーション時間
    this.fadeDuration = 5; // 波紋の残留効果
    this.delay = delay; // アニメーション開始の遅延時間
  }

  // RippleインスタンスをSVG要素として表現するメソッド
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
          begin="${this.delay}s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          from="${this.opacity}"
          to="${this.opacity * 0.2}"
          begin="${this.delay}s"
          dur="${this.fadeDuration}s"
          repeatCount="indefinite"
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
function getRandomPosition(centerX, centerY, radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * radius;
  return {
    x: centerX + Math.cos(angle) * distance,
    y: centerY + Math.sin(angle) * distance,
  };
}

// アニメーションを生成する関数
async function generateAnimation() {
  const username = process.env.GITHUB_REPOSITORY.split('/')[0]; // ユーザー名を取得
  const contributionData = await getContributions(username); // 貢献度データを取得
  const width = 800;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const rippleRadius = Math.min(width, height) / 4; // 波紋が発生するエリアの半径

  // 貢献度データに基づいてRippleインスタンスを生成
  let delay = 0;
  const ripples = contributionData.weeks.flatMap((week) =>
    week.contributionDays.filter(day => day.contributionCount > 0)
      .map((day) => {
        const { x, y } = getRandomPosition(centerX, centerY, rippleRadius);
        const ripple = new Ripple(x, y, day.contributionCount, delay);
        delay += 0.5; // 各波紋の表示を0.5秒ずつ遅らせる
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
            repeatCount="indefinite"
          />
        </rect>
      </g>
    </svg>
  `;

  // SVGファイルとして保存
  fs.writeFileSync('./dist/github-contribution-animation.svg', svg);
}

// アニメーション生成関数を実行し、エラーがあればログに出力
generateAnimation().catch(console.error);