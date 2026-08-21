export type PostedJob = {
  observationId: string;
  observedAt: string;
  postedDate: string | null;
  postedDateQuality: string;
};

export const sortJobsByPostedDate = <T extends PostedJob>(jobs: T[]): T[] => [...jobs].sort((left, right) => {
  const leftPosted = left.postedDateQuality === "exact" && left.postedDate ? left.postedDate : null;
  const rightPosted = right.postedDateQuality === "exact" && right.postedDate ? right.postedDate : null;
  if (leftPosted && rightPosted) return rightPosted.localeCompare(leftPosted) || right.observedAt.localeCompare(left.observedAt) || left.observationId.localeCompare(right.observationId);
  if (leftPosted) return -1;
  if (rightPosted) return 1;
  return right.observedAt.localeCompare(left.observedAt) || left.observationId.localeCompare(right.observationId);
});

export const postedDateLabel = (job: PostedJob): string => job.postedDateQuality === "exact" && job.postedDate ? `Posted · ${job.postedDate}` : "Posted date unavailable";
