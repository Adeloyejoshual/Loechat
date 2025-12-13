export const hapticMedium = async () => {
  try {
    if (!window.Capacitor?.isNativePlatform()) return;
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
};