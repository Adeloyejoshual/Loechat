export const playSound = (src, enabled = true) => {
  if (!enabled) return;

  const audio = new Audio(src);
  audio.volume = 0.7;
  audio.play().catch(() => {});
};