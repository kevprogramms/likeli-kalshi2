# Modern SaaS Landing Page - Crypto Portfolio

A pixel-perfect, premium landing page for a crypto portfolio management platform. Built with React, Tailwind CSS, and Framer Motion for smooth scroll-triggered animations.

## Features

- **Premium Design**: Soft sage-green background with a centered white card layout featuring subtle gradients
- **Smooth Animations**: Scroll-triggered transitions using Framer Motion with professional easing
- **Responsive**: Fully responsive design that adapts beautifully from mobile to desktop
- **Interactive Elements**:
  - Layered hero headlines with depth
  - Animated CTA pill with multicolor spinner
  - Portfolio cards with circular progress indicators
  - Dashboard with line chart and real-time crypto data
  - Scroll indicator with bounce animation

## Design Highlights

### Layout
- Full viewport page with sage-green background (#B2C2A1)
- Large white rounded card (max-width 1200px, height 720px)
- 24px border radius with premium shadow (0 24px 70px rgba(0,0,0,0.12))
- Subtle gradient from white to light gray

### Components
1. **Navigation**: Centered horizontal nav with logo, links, and CTA button
2. **Hero Section**: Layered headlines, subtext, and CTA pill
3. **Bottom Image Strip**: Textured area with scroll indicator
4. **Portfolio Card**: 4-row crypto list with values, changes, and progress rings
5. **Dashboard Card**: Total savings, line chart, and portfolio summary

## Installation

### Prerequisites
- Node.js >= 18
- npm, yarn, or pnpm

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

3. **View the landing page**:
   - In browser: Navigate to `/landing` route
   - Or open `landing-page-standalone.html` directly in a browser for a quick preview

## File Structure

```
src/
├── pages/
│   └── LandingPage.jsx          # Main landing page component
├── App.jsx                       # Router configuration (includes /landing route)
├── index.css                     # Global styles + Tailwind directives
├── main.jsx                      # App entry point

Root files:
├── landing-page-standalone.html  # Standalone HTML version (no build needed)
├── tailwind.config.js            # Tailwind configuration
├── postcss.config.js             # PostCSS configuration
└── package.json                  # Dependencies
```

## Component Architecture

### `LandingPage.jsx`
Main container with scroll tracking and state management.

**Child Components:**
- `Navigation` - Top nav bar with logo, links, and CTA
- `HeroSection` - Layered headlines and intro content
- `CTAPill` - Animated pill with logo and spinner
- `BottomImageStrip` - Textured image area with scroll indicator
- `PortfolioCard` - Crypto portfolio list with progress rings
- `DashboardSection` - Large image with text overlay
- `DashboardCard` - Analytics card with chart and portfolio list

### Key Dependencies

```json
{
  "react": "^19.2.3",
  "react-dom": "^19.2.3",
  "framer-motion": "^11.11.17",
  "tailwindcss": "^3.4.16"
}
```

## Animations

### Scroll-Triggered Transitions
- **Hero fade out**: Opacity 1 → 0 on scroll (0-30%)
- **Portfolio slide in**: Y: 100 → 0, Opacity: 0 → 1 (20-50%)
- **Dashboard reveal**: Y: 100 → 0, Opacity: 0 → 1 (40-70%)

### Motion Details
- Easing: `easeOut` for smooth, premium feel
- No bouncy effects (avoids gimmicky appearance)
- Subtle hover states on interactive elements

## Customization

### Colors
Edit `tailwind.config.js`:
```js
colors: {
  'sage': '#B2C2A1',  // Main background color
}
```

### Fonts
The design uses **Inter** font family. It's loaded via Google Fonts in the standalone HTML or configured in Tailwind for the React version.

### Content
Update the portfolio data in `LandingPage.jsx`:
```jsx
const portfolioItems = [
  { icon: '₿', ticker: 'BTC', name: 'Bitcoin', value: '$4,235.17', change: '+1.00%', positive: true, progress: 75 },
  // Add more items...
];
```

### Images
Replace placeholder images by updating:
- Bottom bark texture: Line 261 in `LandingPage.jsx`
- Dashboard background: Line 414 in `LandingPage.jsx`

Use actual image URLs:
```jsx
backgroundImage: `url('/path/to/your/image.jpg')`
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Optimized animations using GPU-accelerated transforms
- Lazy loading ready (add `loading="lazy"` to images)
- Minimal JavaScript bundle (React + Framer Motion only)
- Smooth 60fps scroll performance

## Deployment

### Build for Production
```bash
npm run build
# or
yarn build
# or
pnpm build
```

The built files will be in the `dist/` directory.

### Static Deployment
The `landing-page-standalone.html` file can be deployed to any static host:
- Netlify
- Vercel
- GitHub Pages
- AWS S3
- Any CDN

Just upload the HTML file - no build step required!

## Responsive Breakpoints

- **Mobile**: < 768px
  - Stack navigation items (hidden links)
  - Reduce headline sizes
  - Full-width cards
  - Dashboard below image

- **Tablet**: 768px - 1024px
  - Show nav links
  - Medium card sizes
  - Side-by-side layout begins

- **Desktop**: > 1024px
  - Full layout
  - Maximum spacing
  - Dashboard card floats right

## Credits

**Design Inspiration**: Modern fintech/crypto SaaS platforms
**Built with**: React, Tailwind CSS, Framer Motion
**Typography**: Inter font family
**Icons**: Custom SVG illustrations

## License

This landing page design is provided as-is for your project.

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Viewing Options

1. **React Development**: `npm run dev` → Navigate to `/landing`
2. **Standalone HTML**: Open `landing-page-standalone.html` in browser
3. **Production Build**: `npm run build` → Deploy `dist/` folder

---

**Need help?** Check the component comments in `LandingPage.jsx` for detailed documentation.
