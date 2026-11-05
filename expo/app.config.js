export default ({ config }) => {
  const url = process.env.EXPO_PUBLIC_INK_URL?.trim()
  if (process.env.EAS_BUILD && (!url || new URL(url).protocol !== 'https:')) {
    throw new Error('Set EXPO_PUBLIC_INK_URL to your deployed HTTPS app URL in this EAS environment before building.')
  }
  const identifier = process.env.TALLY_APP_IDENTIFIER || 'com.sparshvedi.tally'
  return {
    ...config,
    ios: { ...config.ios, bundleIdentifier: identifier },
    android: { ...config.android, package: identifier },
  }
}
