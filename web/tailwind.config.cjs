// The site's Tailwind theme; it scans the Rust sources for class names. Until W16 it extended the React
// app's ../tailwind.config.js; that theme is folded in here, unchanged.
module.exports = {
  content: ['./index.html', './src/**/*.rs'],
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
        tomatoRed: 'var(--tomato-red)',
        avacadoCream: 'var(--avacado-green)',
        buttonDisabled: 'var(--button-disabled)',
        buttonDisabledShadow: 'var(--button-disabled-shadow)',
        leafGreen: 'var(--leaf-green)',
        alertRed: 'var(--alert-red)',
      },
      fontFamily: {
        hanaleiFill: ['Hanalei Fill', 'sans-serif'],
        ADLaM: ['ADLaM Display', 'sans-serif'],
        commissioner: ['Commissioner', 'sans-serif'],
        dynapuff: ['DynaPuff', 'sans-serif'],
        Mulish: ['Mulish', 'sans-serif'],
        comic: ['Comic Neue', 'sans-serif'],
      },
      fontSize: {
        titleSize: ['80px', '96px'],
        titleSizeSM: ['32px', '38px'],
      },
      boxShadow: {
        buttonShadow: '4px 4px 0px 0px var(--choco-brown)',
        characterCard: '12px 14px 0px 0px var(--choco-brown)',
        loginShadow: '12px 14px 0px 0px var(--choco-brown)',
      },
      gridAutoColumns: {
        smallCard: 'minmax(0, 172px)',
      },
    },
  },
  plugins: [],
};
