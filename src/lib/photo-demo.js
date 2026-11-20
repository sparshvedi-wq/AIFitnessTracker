import front from '../assets/testing/front.jpg'
import side from '../assets/testing/side.jpg'
import back from '../assets/testing/back.jpg'

// Reused generated fictional adult fixtures; no image generation occurs here.
export const demoPhotos = { front, side, back }
export const demoReview = () => ({
  status: 'ready',
  mode: 'visual_observations',
  demo: true,
  views: Object.fromEntries(
    ['front', 'side', 'back'].map((a) => [a, { usable: true, feedback: 'Demo fixture, not checked by AI.' }]),
  ),
  summary: 'Shoulder balance and back development, within whole-body training.',
  observations: [
    {
      area: 'shoulders',
      observation: 'Your shoulders look uneven.',
      uncertainty:
        'Camera angle and how you stand can create this appearance. It does not establish a strength difference.',
      evidenceViews: ['front', 'back'],
    },
    {
      area: 'back',
      observation: 'Your back looks smaller in proportion to your torso.',
      uncertainty: 'A photo cannot measure muscle mass or tell whether an area is weak.',
      evidenceViews: ['back'],
    },
  ],
  suggestedFocus: [
    { area: 'shoulders', reason: 'A small, balanced shoulder emphasis within your usual training time.' },
    { area: 'back', reason: 'Keep pulling work in the rotation, adjusted using your logged performance.' },
  ],
  limitations: [
    'Illustrative sample findings, not an analysis of these fixtures or your body.',
    'Lighting, clothing and pose affect visible outlines.',
  ],
})
