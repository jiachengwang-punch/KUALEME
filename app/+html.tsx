import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Noto+Sans+SC:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{
          __html: `
            * {
              font-family: 'Noto Sans SC', 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif !important;
              -webkit-font-smoothing: antialiased;
              box-sizing: border-box;
            }
            body {
              background: linear-gradient(45deg, #E1F0F7 0%, #F8FBFE 50%, #FFF5ED 100%);
              min-height: 100vh;
            }
            ::-webkit-scrollbar { display: none; }
          `
        }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
