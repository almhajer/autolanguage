const sharp = require('sharp');
const fs = require('fs');

// Create a simple 128x128 PNG icon
const svg = `
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="24" fill="#2563EB"/>
  <rect x="16" y="56" width="96" height="56" rx="8" fill="#1E40AF"/>
  <rect x="24" y="64" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="40" y="64" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="56" y="64" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="72" y="64" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="88" y="64" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="24" y="78" width="12" height="10" rx="2" fill="#93C5FD"/>
  <rect x="40" y="78" width="12" height="10" rx="2" fill="#93C5FD"/>
  <rect x="56" y="78" width="12" height="10" rx="2" fill="#93C5FD"/>
  <rect x="72" y="78" width="12" height="10" rx="2" fill="#93C5FD"/>
  <rect x="88" y="78" width="12" height="10" rx="2" fill="#93C5FD"/>
  <rect x="24" y="92" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="40" y="92" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="56" y="92" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="72" y="92" width="12" height="10" rx="2" fill="#60A5FA"/>
  <rect x="88" y="92" width="12" height="10" rx="2" fill="#60A5FA"/>
  <path d="M32 32 L40 24 L48 32" stroke="#FBBF24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M48 32 L40 40 L32 32" stroke="#FBBF24" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="64" y="40" font-family="Arial" font-size="24" font-weight="bold" fill="#FBBF24" text-anchor="middle">أ</text>
  <text x="64" y="24" font-family="Arial" font-size="24" font-weight="bold" fill="#FBBF24" text-anchor="middle">A</text>
</svg>
`;

async function generateIcons() {
    try {
        // Generate 128x128 PNG
        await sharp(Buffer.from(svg))
            .resize(128, 128)
            .png()
            .toFile('resources/icon-128.png');

        // Generate 48x48 PNG
        await sharp(Buffer.from(svg))
            .resize(48, 48)
            .png()
            .toFile('resources/icon-48.png');

        // Generate 32x32 PNG
        await sharp(Buffer.from(svg))
            .resize(32, 32)
            .png()
            .toFile('resources/icon-32.png');

        console.log('Icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error);
        process.exit(1);
    }
}

generateIcons();
