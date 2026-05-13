/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens mirrored from main_app.py
        bg:      '#F5F5F7',
        sidebar: '#FFFFFF',
        card:    '#FFFFFF',
        border:  '#E5E7EB',
        accent: {
          DEFAULT: '#3B82F6',
          hover:   '#2563EB',
          light:   '#EFF6FF'
        },
        ink: {
          DEFAULT: '#111827',   // TEXT
          2:       '#374151',   // TEXT_2
          muted:   '#6B7280'    // TEXT_MUTED
        },
        danger: {
          DEFAULT: '#EF4444',
          light:   '#FEE2E2'
        }
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        card: '12px'
      }
    }
  },
  plugins: []
}
