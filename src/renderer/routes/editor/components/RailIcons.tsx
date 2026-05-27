import React from 'react'

const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
} as const

export const FilesIcon = () => (
  <svg {...svgProps}>
    <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/>
    <path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/>
  </svg>
)

export const GitIcon = () => (
  <svg {...svgProps}>
    <line x1="6" y1="3" x2="6" y2="15"/>
    <circle cx="18" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <path d="M18 9a9 9 0 0 1-9 9"/>
  </svg>
)

export const CompileIcon = () => (
  <svg {...svgProps}>
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
)
