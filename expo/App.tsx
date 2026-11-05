import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Platform, Pressable, Share, StyleSheet, Text, View, useColorScheme } from 'react-native'
import Constants from 'expo-constants'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import Storage from 'expo-sqlite/kv-store'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as Speech from 'expo-speech'
import * as Haptics from 'expo-haptics'
import * as Notifications from 'expo-notifications'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { createDeviceService } from './src/device-service'
import { isAppOrigin, MAX_SNAPSHOT, parseRequest, resolveInkUrl, responseScript } from './src/protocol'

const AWAKE_TAG = 'tally-ink-workout'
const CUE_CHANNEL = 'workout-timers'

// Timer cues only matter while Tally is in the background; in the app, the
// player already shows and speaks them.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
})

async function cuePermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CUE_CHANNEL, { name: 'Workout timers', importance: Notifications.AndroidImportance.HIGH })
  }
  const current = await Notifications.getPermissionsAsync()
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true
  if (!current.canAskAgain) return false
  return (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })).granted
}

export default function App() {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}><InkApp /><StatusBar style="auto" /></SafeAreaProvider>
}

function InkApp() {
  // WebView 14 defaults its additional-props generic to undefined; explicitly
  // use object so strict React 19 types retain the component's native props.
  const web = useRef<WebView<object>>(null)
  // The shell around the web app matches the device theme until the app paints its own.
  const ground = { backgroundColor: useColorScheme() === 'light' ? '#F4F1EA' : '#131416' }
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [reload, setReload] = useState(0)
  const address = useMemo(() => {
    try { return { url: resolveInkUrl(Constants.expoConfig?.hostUri, process.env.EXPO_PUBLIC_INK_URL), error: null } }
    catch (error) { return { url: '', error: error instanceof Error ? error.message : 'The Ink app URL is unavailable.' } }
  }, [])
  const origin = address.url ? new URL(address.url).origin : ''
  const service = useMemo(() => {
    let awakeQueue: Promise<unknown> = Promise.resolve()
    return createDeviceService({
      load: key => Storage.getItemAsync(key),
      save: (key, raw) => Storage.setItemAsync(key, raw),
      remove: key => Storage.removeItemAsync(key),
      saveStatus: setSaveFailed,
      say: async text => { await Speech.stop(); Speech.speak(text, { rate: 1.05 }) },
      haptic: strong => strong ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      awake: async active => {
        const work = awakeQueue.then(() => active ? activateKeepAwakeAsync(AWAKE_TAG) : deactivateKeepAwake(AWAKE_TAG))
        awakeQueue = work.catch(() => {})
        await work
      },
      shareText: text => Share.share({ message: text }),
      scheduleCue: async (seconds, title, body) => {
        if (!await cuePermission()) return null
        return Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, ...(Platform.OS === 'android' ? { channelId: CUE_CHANNEL } : {}) },
        })
      },
      cancelCue: id => Notifications.cancelScheduledNotificationAsync(id),
      exportBackup: async raw => {
        if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.')
        const now = new Date()
        const localDate = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-')
        const file = new File(Paths.cache, `tally-backup-${localDate}.json`)
        file.create({ overwrite: true })
        file.write(raw)
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save Tally backup' })
        return null
      },
      pickBackup: async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false })
        if (result.canceled) return null
        const asset = result.assets[0]
        if (asset.size && asset.size > MAX_SNAPSHOT) throw new Error('The backup is too large.')
        return new File(asset.uri).text()
      },
    })
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') web.current?.injectJavaScript("window.dispatchEvent(new Event('tally:background'));true;")
    })
    return () => subscription.remove()
  }, [])

  const photoPickerOpen = useRef(false)
  async function pickPhoto(camera: boolean) {
    if (photoPickerOpen.current) throw new Error('Finish the current photo selection first.')
    photoPickerOpen.current = true
    const cacheUris: string[] = []
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Camera permission is off. Enable it in Settings or use Camera roll.')
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: .85, exif: false }
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
      if (result.canceled) return null
      const asset = result.assets[0]
      if (asset.uri.startsWith(Paths.cache.uri)) cacheUris.push(asset.uri)
      const scale = Math.min(1, 1536 / Math.max(asset.width, asset.height))
      const context = ImageManipulator.manipulate(asset.uri)
      context.resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) })
      const rendered = await context.renderAsync()
      const normalized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: .82, base64: true })
      if (normalized.uri.startsWith(Paths.cache.uri)) cacheUris.push(normalized.uri)
      if (!normalized.base64 || normalized.base64.length > 4 * 1024 * 1024) throw new Error('This photo is too large. Choose a smaller image.')
      return 'data:image/jpeg;base64,' + normalized.base64
    } finally {
      for (const uri of new Set(cacheUris)) { try { new File(uri).delete() } catch { /* OS may already have reclaimed cache. */ } }
      photoPickerOpen.current = false
    }
  }

  useEffect(() => () => {
    void Speech.stop().catch(() => {})
    void deactivateKeepAwake(AWAKE_TAG).catch(() => {})
  }, [])

  async function onMessage(event: WebViewMessageEvent) {
    let request
    try { request = parseRequest(event.nativeEvent.data, event.nativeEvent.url, origin) }
    catch { return } // Never expose native data or actions to another origin.
    try {
      const result = request.method === 'photo.pick' ? await pickPhoto(request.payload.camera === true) : await service.handle(request.method, request.payload)
      web.current?.injectJavaScript(responseScript(request.id, result))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'This device action could not finish.'
      web.current?.injectJavaScript(responseScript(request.id, null, message))
    }
  }

  async function retrySave() {
    if (retrying) return
    setRetrying(true)
    try { await service.retrySave() } catch { /* Keep the save warning visible. */ }
    finally { setRetrying(false) }
  }

  const problem = address.error || connectionError
  return <SafeAreaView style={[styles.safe, ground]} edges={['top', 'bottom']}>
    {saveFailed && <View style={styles.saveWarning} accessibilityLiveRegion="polite"><Text style={styles.saveText}>Changes haven’t saved on this device yet.</Text><Pressable accessibilityRole="button" disabled={retrying} onPress={() => void retrySave()}><Text style={styles.link}>{retrying ? 'Saving…' : 'Retry save'}</Text></Pressable></View>}
    {problem ? <View style={styles.center}><Text style={styles.heading}>Open Tally</Text><Text style={styles.text}>{problem}</Text><Text style={styles.text}>{process.env.EXPO_PUBLIC_INK_URL ? 'Check your internet connection and try again. Your saved training stays on this device.' : 'Keep your computer running and connect to the same Wi-Fi. Your saved training stays on this device.'}</Text>{!!address.url && <Text style={styles.url}>{address.url}</Text>}<Pressable accessibilityRole="button" style={styles.button} onPress={() => { setConnectionError(null); setReload(n => n + 1) }}><Text style={styles.buttonText}>Try again</Text></Pressable></View> : <WebView<object>
      key={reload}
      ref={web}
      source={{ uri: address.url }}
      originWhitelist={[origin]}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || isAppOrigin(request.url, origin)}
      onMessage={event => void onMessage(event)}
      onError={() => setConnectionError('We couldn’t reach Tally. Please try again.')}
      onHttpError={event => { if (event.nativeEvent.url === address.url && event.nativeEvent.statusCode >= 400) setConnectionError(`The Ink server returned HTTP ${event.nativeEvent.statusCode}.`) }}
      onContentProcessDidTerminate={() => web.current?.reload()}
      startInLoadingState
      renderLoading={() => <View style={[styles.center, styles.loading, ground]}><ActivityIndicator color="#7AA2FF" /><Text style={styles.text}>Opening Tally…</Text></View>}
      style={[styles.web, ground]}
      javaScriptEnabled
      domStorageEnabled
      incognito={false}
      bounces={false}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      mediaPlaybackRequiresUserAction={false}
      setSupportMultipleWindows={false}
      allowsLinkPreview={false}
    />}
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#131416' },
  web: { flex: 1, backgroundColor: '#131416' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 16, backgroundColor: '#131416' },
  loading: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  heading: { color: '#ECE9E2', fontSize: 25, fontWeight: '600', textAlign: 'center' },
  text: { color: '#B9B5AC', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  url: { color: '#7AA2FF', fontSize: 13, textAlign: 'center' },
  button: { borderRadius: 20, paddingVertical: 14, paddingHorizontal: 26, backgroundColor: '#ECE9E2' },
  buttonText: { color: '#131416', fontSize: 16, fontWeight: '600' },
  saveWarning: { padding: 12, gap: 8, backgroundColor: '#24252A' },
  saveText: { color: '#ECE9E2', fontSize: 14 },
  link: { color: '#7AA2FF', fontSize: 14, fontWeight: '600', paddingVertical: 6 },
})
