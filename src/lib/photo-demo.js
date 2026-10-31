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
  summary:
    'Demo result: all three views are present. This preview lets you test the result screen without an AI request.',
  observations: [
    {
      area: 'overall',
      observation: 'Example observation: compare relaxed front and back outlines across check-ins.',
      uncertainty: 'Preset test copy, not an assessment of these images.',
      evidenceViews: ['front', 'back'],
    },
  ],
  suggestedFocus: [{ area: 'shoulders', reason: 'Example focus for testing the results layout.' }],
  limitations: ['This is a simulated result. It does not measure analysis accuracy or describe your body.'],
})
