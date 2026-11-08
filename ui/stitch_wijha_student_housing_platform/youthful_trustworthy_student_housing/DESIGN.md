---
name: Youthful & Trustworthy Student Housing
colors:
  surface: '#FFFFFF'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3e4947'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#95482f'
  on-secondary: '#ffffff'
  secondary-container: '#fc9a7b'
  on-secondary-container: '#753019'
  tertiary: '#005c4c'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b7763'
  on-tertiary-container: '#a1fbe2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59e'
  on-secondary-fixed: '#3a0b00'
  on-secondary-fixed-variant: '#77311a'
  tertiary-fixed: '#9af3da'
  tertiary-fixed-dim: '#7ed7bf'
  on-tertiary-fixed: '#002019'
  on-tertiary-fixed-variant: '#005142'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
  page-bg: '#F4FBF9'
  text-muted: '#6B7280'
  border-subtle: '#D6E4E0'
  status-approved: '#2E9E6B'
  status-pending: '#E0A100'
  status-rejected: '#C0392B'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 54px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 48px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 34px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 30px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 28px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 22px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

# WIJHA (وجهة) Design System

## Brand
WIJHA is a student housing platform that connects university students with property owners.
Mood: trustworthy, friendly, youthful, clean. It should feel safe to pay and to rent through.
Logo: use the uploaded logo as is (a mint-teal "W" with a brown map pin, WIJHA wordmark below). Do not redraw or recolor it. Keep clear space around it.

## Language and direction
- Arabic first. All UI text in clear, simple Arabic.
- Right-to-left (RTL) layout everywhere: the logo sits at the top right, text aligns right, icons that imply direction (arrows, chevrons) are mirrored.
- Numbers and prices: Western digits, currency shown as "ج.م" (EGP).

## Colors
- Brand mint-teal (from the logo): #7FD8C0, used for backgrounds of highlights, chips, illustrations, section accents
- Dark teal (accessible on white, for buttons and links): #0F766E
- Brand brown (from the logo pin): #833A22, used for secondary actions, badges, key highlights
- Page background: #F4FBF9
- Surface (cards): #FFFFFF
- Text: #1F2937, muted text: #6B7280, borders: #D6E4E0
- Status: approved #2E9E6B, pending #E0A100, rejected #C0392B
- Text on dark teal or brown is white. Never put white text on the light mint.

## Typography
- Font: Cairo (Arabic and Latin), fallback Tajawal.
- Headings bold, body regular. Generous line height (about 1.7) for Arabic.
- Scale: page title 28-32, section title 20-22, body 16, small 13-14.

## Layout and shape
- The site will be used heavily on mobile AND on desktop. Both must be designed with the same quality. Design every screen for 390px (mobile) and 1280px (desktop). Desktop is not a stretched mobile layout, and mobile is not a squeezed desktop layout.
- Mobile: single column, bottom navigation bar, sticky bottom action bar for the main call to action, filters in a bottom sheet, touch targets at least 44px, easy one-handed use.
- Desktop: use the width well (multi-column grids, filter sidebar on search results, two-column unit details and booking with a sticky summary card), top navigation bar, comfortable max content width.
- Same components, colors, and content on both, so the product feels like one product.
- 8px spacing grid, generous white space.
- Rounded corners 12-16px, soft shadows, thin light borders.

## Components
- Primary button: dark teal background, white text. Secondary button: brown outline.
- Unit card: photo on top, name, area, price per bed, gender badge (male or female apartment), rating, team-verified badge.
- Inputs: large, clear labels above the field, helper text below, clear error state.
- Status chips: approved, pending, rejected (colors above).
- Booking flow: stepper at the top, order summary card, clear policy text.
- Upload fields for ID photo, university card photo, and unit photos with preview.
- Icons: simple outline icons with rounded ends.

## Imagery
Real-looking apartment and student-life photos, warm natural light. No stock-photo clutter.

## Tone of text
Short, friendly, reassuring. Explain money and cancellation rules plainly, with no legal jargon.
