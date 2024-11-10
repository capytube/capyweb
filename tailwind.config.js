// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        grassGreen: 'var(--grass-green)',
        darkGreen: 'var(--dark-green)',
        chocoBrown: 'var(--choco-brown)',
        babyCronYellow: 'var(--babycorn-yellow)',
        siteGreen: 'var(--site-green)',
        darkOrange: 'var(--dark-orange)',
        custard: 'var(--custard)',
        cream: 'var(--cream)',
        persimmon: 'var(--persimmon)',
      },
      fontFamily: {
        hanaleiFill: ['Hanalei Fill', 'sans-serif'],
        ADLaM: ['ADLaM Display', 'sans-serif'],
        commissioner: ['Commissioner', 'sans-serif'],
        dynapuff: ['DynaPuff', 'sans-serif'],
      },
      fontSize: {
        titleSize: ['80px', '96px'],
        titleSizeSM: ['32px', '38px'],
      },
      boxShadow: {
        buttonShadow: '4px 4px 0px 0px var(--choco-brown)',
        characterCard: '12px 14px 0px 0px var(--choco-brown)',
      },
      gridAutoColumns: {
        smallCard: 'minmax(0, 172px)',
      },
    },
  },
  plugins: [],
};
