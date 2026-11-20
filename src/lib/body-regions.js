// Hand-traced broad training regions on the M1 render (1024 × 1536).
// UI selection geometry only; not a medical/anatomical measurement.
const shoulder = 'M326 324 Q345 311 389 316 L391 406 Q359 425 312 409 Q307 363 326 324Z'
const arm = 'M303 418 Q345 431 382 421 L355 534 Q339 547 305 536 L282 536 Q282 475 303 418Z'
const leg =
  'M381 768 Q431 797 496 788 L495 1014 Q472 1031 463 1070 L460 1110 Q469 1254 448 1395 L366 1395 Q348 1248 357 1114 L368 1063 Q354 920 381 768Z'
export const BODY_REGIONS = {
  front: [
    { area: 'Shoulders', paths: [shoulder], mirror: true, label: [24, 'left'] },
    {
      area: 'Chest',
      paths: ['M404 319 Q511 281 618 319 L619 444 Q566 457 512 478 Q458 457 405 444Z'],
      label: [29, 'right'],
    },
    { area: 'Biceps', paths: [arm], mirror: true, label: [43, 'left'] },
    { area: 'Core', paths: ['M414 481 Q512 507 610 481 L602 588 Q511 615 422 588Z'], label: [46, 'right'] },
    { area: 'Legs', paths: [leg], mirror: true, label: [70, 'left'] },
  ],
  back: [
    { area: 'Shoulders', paths: [shoulder], mirror: true, label: [24, 'left'] },
    {
      area: 'Back',
      paths: ['M404 318 Q511 276 620 318 L620 446 L601 589 Q511 610 422 589 L405 446Z'],
      label: [34, 'right'],
    },
    { area: 'Triceps', paths: [arm], mirror: true, label: [43, 'left'] },
    {
      area: 'Glutes',
      paths: ['M402 680 Q436 672 469 720 L500 778 Q431 790 385 747Z'],
      mirror: true,
      label: [52, 'right'],
    },
    { area: 'Legs', paths: [leg], mirror: true, label: [72, 'left'] },
  ],
}
export const BODY_RENDER = { front: '/onboarding/m1-neutral.webp', back: '/onboarding/m1-photo-back.webp' }
