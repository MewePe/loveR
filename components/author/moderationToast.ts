// Toast after saving a chapter/episode: the API's `moderation` result (lib/moderation.ts SubmitOutcome) when the
// content was checked, or the plain success message when only the price changed.
export function showModerationResult(
    toast: { success: (msg: string) => void; error: (msg: string) => void },
    moderation: { status: string; message: string } | null | undefined,
    fallback: string,
) {
    if (!moderation) toast.success(fallback);
    else if (moderation.status === 'APPROVED') toast.success(moderation.message);
    else toast.error(moderation.message); // held or blocked: shown longer
}
