# Extension Icons

This directory contains the icons for the Auto Language Switcher extension.

## Files

- `icon.svg` - Main icon in SVG format (vector graphics, scalable)
- `icon-128.png` - Icon in PNG format at 128x128 pixels (placeholder)

## Usage

The SVG icon is used for development and can be scaled to any size. For production, you should convert the SVG to PNG format at the required sizes:

- `icon-128.png` - 128x128 pixels (marketplace icon)
- `icon-48.png` - 48x48 pixels (extension explorer)
- `icon-32.png` - 32x32 pixels (file icon)

## Converting SVG to PNG

You can use online tools like:
- https://cloudconvert.com/svg-to-png
- https://convertio.co/svg-png/

Or command-line tools:
```bash
# Using ImageMagick
convert icon.svg -resize 128x128 icon-128.png
convert icon.svg -resize 48x48 icon-48.png
convert icon.svg -resize 32x32 icon-32.png
```

## Icon Design

The icon features:
- A blue keyboard representing input devices
- Yellow arrows indicating language switching
- Both Arabic (أ) and English (A) letters showing bilingual support
- Clean, modern design suitable for VSCode marketplace
