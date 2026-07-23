import { z } from "zod";
import { nonEmptyIdSchema } from "./common";

export const generationCountSchema = z.union([z.literal(20), z.literal(30), z.literal(50)]);

export const startGenerationInputSchema = z.object({
  topicId: nonEmptyIdSchema,
  count: generationCountSchema.default(30),
  idempotencyKey: z.string().min(16).max(128)
});

const guitarStringSchema = z.number().int().min(1).max(6);
const fretSchema = z.number().int().min(0).max(24);

export const guitarDiagramSchema = z.object({
  title: z.string().max(80),
  startFret: z.number().int().min(1).max(20),
  positions: z
    .array(
      z.object({
        string: guitarStringSchema,
        fret: fretSchema,
        finger: z.number().int().min(0).max(4).nullable(),
        label: z.string().max(8).nullable()
      })
    )
    .max(18),
  openStrings: z.array(guitarStringSchema).max(6),
  mutedStrings: z.array(guitarStringSchema).max(6),
  highlightedNotes: z.array(z.object({ string: guitarStringSchema, fret: fretSchema })).max(18)
});

export const generatedCardSchema = z.object({
  candidateId: z.string().min(1).max(64),
  kind: z.enum(["text", "diagram", "illustration"]),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(1_000),
  hint: z.string().max(300),
  explanation: z.string().max(1_500),
  tags: z.array(z.string().min(1).max(40)).max(8),
  illustrationPrompt: z.string().max(800).nullable(),
  guitarDiagram: guitarDiagramSchema.nullable()
});

export const generatedCardBatchSchema = z.object({
  cards: z.array(generatedCardSchema).min(1).max(50)
});

export const verificationItemSchema = z.object({
  candidateId: z.string().min(1).max(64),
  verdict: z.enum(["pass", "revise", "reject"]),
  revisedQuestion: z.string().max(500).nullable(),
  revisedAnswer: z.string().max(1_000).nullable(),
  revisedExplanation: z.string().max(1_500).nullable(),
  reasonCode: z.enum(["ok", "incorrect", "ambiguous", "answer_leak", "time_sensitive", "unsafe", "duplicate"])
});

export const verificationBatchSchema = z.object({
  results: z.array(verificationItemSchema).min(1).max(50)
});

export type GeneratedCard = z.infer<typeof generatedCardSchema>;
export type GeneratedCardBatch = z.infer<typeof generatedCardBatchSchema>;
export type VerificationBatch = z.infer<typeof verificationBatchSchema>;
export type GuitarDiagram = z.infer<typeof guitarDiagramSchema>;
