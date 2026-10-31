import { z } from 'zod';

export const angles = ['front', 'side', 'back'] as const;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const ageGroups = ['13-17', '18+'] as const;
export type AgeGroup = typeof ageGroups[number];

const photo = z.object({
  angle: z.enum(angles),
  base64: z.string().min(4).max(4 * Math.ceil(MAX_IMAGE_BYTES / 3)),
}).strict();

export const assessmentRequest = z.object({
  consent: z.literal(true),
  ageGroup: z.enum(ageGroups),
  ownPhotosConfirmed: z.boolean(),
  synthetic: z.literal(true).optional(),
  guardianPermission: z.boolean(),
  goal: z.string().trim().min(3).max(500),
  focusPreferences: z.array(z.enum(['You decide', 'Overall balance', 'Shoulders', 'Back', 'Chest', 'Arms', 'Legs', 'Glutes'])).max(3).optional(),
  photos: z.array(photo).length(3),
}).strict().superRefine((value, context) => {
  if (value.synthetic ? value.ownPhotosConfirmed : !value.ownPhotosConfirmed) context.addIssue({ code: 'custom', message: 'Confirm the correct photo source.' });
  if (value.ageGroup === '13-17' && !value.guardianPermission) {
    context.addIssue({ code: 'custom', message: 'Parent or guardian permission is required for teen access.' });
  }
  if (new Set(value.photos.map((item) => item.angle)).size !== 3) {
    context.addIssue({ code: 'custom', message: 'Include exactly one front, side, and back photo.' });
  }
});

const quality = z.object({
  usable: z.boolean(),
  feedback: z.string().max(400),
});
export const photoQuality = quality;
export const qualityRequest = z.object({
  consent: z.literal(true),
  ownPhotosConfirmed: z.boolean(),
  synthetic: z.literal(true).optional(),
  ageGroup: z.enum(ageGroups),
  guardianPermission: z.boolean(),
  photo,
}).strict().superRefine((value, context) => {
  if (value.synthetic ? value.ownPhotosConfirmed : !value.ownPhotosConfirmed) context.addIssue({ code: 'custom', message: 'Confirm the correct photo source.' });
  if (value.ageGroup === '13-17' && !value.guardianPermission) context.addIssue({ code: 'custom', message: 'Parent or guardian permission is required.' });
});
export type PhotoQuality = z.infer<typeof photoQuality>;

export const modelAssessment = z.object({
  views: z.object({ front: quality, side: quality, back: quality }),
  summary: z.string().max(1000),
  observations: z.array(z.object({
    area: z.enum(['shoulders', 'chest', 'back', 'arms', 'legs', 'glutes', 'overall']),
    observation: z.string().max(500),
    uncertainty: z.string().max(400),
    evidenceViews: z.array(z.enum(angles)).min(1).max(3),
  })).max(5),
  suggestedFocus: z.array(z.object({
    area: z.enum(['shoulders', 'chest', 'back', 'arms', 'legs', 'glutes', 'overall']),
    reason: z.string().max(500),
  })).max(3),
  limitations: z.array(z.string().max(400)).min(1).max(5),
});

export type AssessmentInput = z.infer<typeof assessmentRequest>;
export type ModelAssessment = z.infer<typeof modelAssessment>;
export type PreparedPhoto = { angle: typeof angles[number]; base64: string };

// The server, rather than the model, decides whether insights can be shown.
export function reviewAssessment(result: ModelAssessment) {
  const usable = angles.every((angle) => result.views[angle].usable);
  return {
    mode: 'visual_observations' as const,
    status: usable ? 'ready' as const : 'retake_required' as const,
    views: result.views,
    summary: usable ? result.summary : 'Please replace the flagged photos before continuing.',
    observations: usable ? result.observations : [],
    suggestedFocus: usable ? result.suggestedFocus : [],
    limitations: result.limitations,
  };
}
