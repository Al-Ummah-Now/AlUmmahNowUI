/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#ffa037', // New primary color
        secondary: '#8e6c53', // New secondary color
        background: '#093041', // New background color
        surface: '#ffffff', // Surface color for cards
        error: '#b00020', // Error color
        onPrimary: '#ffffff', // Text on primary color
        onSecondary: '#ffffff', // Text on secondary color
        onBackground: '#ffffff', // Text on background
        onSurface: '#000000', // Text on surface
      },
      gradientColorStops: {
        'bg-start': '#07425a',
        'bg-end': '#083f58',
      },
      boxShadow: {
        'md-elevation': '0px 2px 4px rgba(0, 0, 0, 0.2)', // Material Design elevation
        'lg-elevation': '0px 4px 8px rgba(0, 0, 0, 0.2)', // Higher elevation
      },
      borderRadius: {
        'md': '4px', // Material Design rounded corners
        'lg': '8px',
      },
    },
  },
  plugins: [],
};
