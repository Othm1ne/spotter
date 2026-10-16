import { buildProgramPrompt, parseProgram, templateProgram, type Candidate, type ProgramDraft } from '@/lib/program';
import type { Profile } from '@/lib/profile';

import { aiChat, aiConfigured } from './ai';

export type GeneratedProgram = {
  draft: ProgramDraft;
  /** Set when the AI couldn't be used and the offline template was built instead. */
  fallbackReason: unknown | null;
};

/**
 * Asks the AI to build the program from the allowed exercises. If it is unavailable, or its
 * answer doesn't validate, the offline template is used so the user always gets a program.
 */
export async function generateProgram(profile: Profile, candidates: Candidate[], now: Date): Promise<GeneratedProgram> {
  if (!aiConfigured) return { draft: templateProgram(profile, candidates), fallbackReason: 'not_configured' };
  try {
    const raw = await aiChat(
      [
        { role: 'system', content: 'You are an expert strength coach who designs evidence-based training programs. Reply with JSON only.' },
        { role: 'user', content: buildProgramPrompt(profile, candidates, now) },
      ],
      { json: true, maxTokens: 2000 }
    );
    const draft = parseProgram(raw, candidates, profile);
    if (draft) return { draft, fallbackReason: null };
    return { draft: templateProgram(profile, candidates), fallbackReason: 'invalid' };
  } catch (e) {
    return { draft: templateProgram(profile, candidates), fallbackReason: e };
  }
}
