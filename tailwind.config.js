/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF8F5",
        "paper-deep": "#F2ECE3",
        "paper-line": "#E3DACD",
        ink: "#2B2B2B",
        "ink-soft": "#5C5751",
        "ink-faint": "#6F675D",
        vermilion: "#B33A2B",
        "vermilion-deep": "#8E2B20",
        stone: "#3E6B8A",
        "stone-deep": "#2E5067",
        ochre: "#8A6D3B",
        jade: "#4F7A63",
      },
      fontFamily: {
        serif: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Songti SC"',
          "STSong",
          "SimSun",
          "serif",
        ],
        sans: [
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        paper: "0 1px 2px rgba(43, 43, 43, 0.04), 0 8px 24px rgba(43, 43, 43, 0.06)",
        float: "0 10px 34px rgba(43, 43, 43, 0.14)",
      },
      transitionTimingFunction: {
        paper: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
