import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, SafeAreaWrapper, Text } from '@/components';
import { CoachPanel } from '@/components/CoachPanel';
import { isAppleHealthAvailable, readAppleHealth } from '@/services/appleHealth';
import { askCoach, CoachMessage, CoachResponse } from '@/services/coachApi';
import { BRAND_COLORS, spacing, useContentBottomPadding } from '@/utils';
import { useAuthStore } from '@/stores/useAuthStore';

const SOURCE_LABELS: Record<string, string> = {
  nutrition_today: "Today's meal logs", nutrition_week: '7 days of meal logs',
  profile_goals: 'Your saved goals', apple_health: 'Apple Health summary',
};
type Turn = CoachMessage & { result?: CoachResponse };

// Noom's small daily actions + Apple Health's explicit data-sharing controls.
export function CoachScreen() {
  const navigation = useNavigation();
  const userId = useAuthStore(state => state.userInfo?.userId);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [shareHealth, setShareHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const epoch = useRef(0);
  const lock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const bottom = useContentBottomPadding(spacing.xl);
  useFocusEffect(useCallback(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; epoch.current += 1; lock.current = false;
      setTurns([]); setDraft(''); setShareHealth(false); setBusy(false); setError('');
    };
  }, [userId]));

  async function send(text = draft) {
    const message = text.trim();
    if (!message || message.length > 2000 || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const visit = epoch.current;
    try {
      const health = shareHealth ? await readAppleHealth(true) : null;
      if (!mounted.current || visit !== epoch.current) return;
      const history = turns.map(({ role, content }) => ({ role, content }));
      const result = await askCoach(message, history, shareHealth, health);
      if (!mounted.current || visit !== epoch.current) return;
      setTurns(previous => [...previous, { role: 'user' as const, content: message },
        { role: 'assistant' as const, content: result.answer, result }].slice(-12));
      setDraft('');
    } catch {
      if (mounted.current && visit === epoch.current) setError(shareHealth
        ? 'Coach could not complete this request. Check Apple Health access or turn off sharing, then retry.'
        : 'Coach is temporarily unavailable. Please try again shortly.');
    } finally {
      if (visit === epoch.current) {
        lock.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  function toggleSharing(value: boolean) {
    setShareHealth(value);
    // Clear derived health information when the conversation's consent changes.
    setTurns([]); setError('');
  }
  return <SafeAreaWrapper><KeyboardAvoidingView style={styles.flex}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
      <Button title="Back" variant="text" onPress={() => navigation.goBack()} />
      <Text variant="heading1" weight="bold">Your AI Coach</Text>
      <Text muted>Find one useful next step from your meal logs and saved goals.</Text>
      <CoachPanel>
        <View style={styles.row}>
          <Text weight="semibold" style={styles.flex}>Share today's Apple Health summary with AI</Text>
          <Switch value={shareHealth} onValueChange={toggleSharing} disabled={busy || !isAppleHealthAvailable()}
            accessibilityLabel="Share today's Apple Health summary with AI" />
        </View>
        <Text variant="caption" muted>Optional. Sending a message shares your meal totals, saved goals and recent conversation with our Gemini AI provider. Turning on this switch also shares today's activity, sleep and weight summary. Changing this choice clears the conversation.</Text>
        {!isAppleHealthAvailable() && <Text variant="caption" muted>Apple Health sharing is available in the native iOS app.</Text>}
      </CoachPanel>
      {turns.length === 0 && <CoachPanel>
        <Text weight="semibold">Start with your day</Text>
        {['What is one habit I can focus on today?', 'Review my logged nutrition this week.'].map(prompt =>
          <Button key={prompt} title={prompt} variant="outline" disabled={busy} onPress={() => { void send(prompt); }} />)}
      </CoachPanel>}
      {turns.map((turn, index) => <Animated.View key={index}
        entering={FadeInDown.springify().damping(12).stiffness(150)}>
        <CoachPanel>
          <Text weight="semibold">{turn.role === 'user' ? 'You' : 'Metriful Coach'}</Text>
          <Text selectable>{turn.content}</Text>
          {turn.result && <>
            <Text variant="caption" muted>Data read: {[...new Set(turn.result.tools.map(tool =>
              SOURCE_LABELS[tool.name] ?? tool.name))].join(' · ')}</Text>
            <Text variant="caption" muted>{turn.result.disclaimer}</Text>
          </>}
        </CoachPanel>
      </Animated.View>)}
      {error !== '' && <Text color={BRAND_COLORS.error} accessibilityLiveRegion="polite">{error}</Text>}
      <CoachPanel>
        <TextInput value={draft} onChangeText={setDraft} maxLength={2000} multiline editable={!busy}
          placeholder="Ask about your nutrition or daily habits" placeholderTextColor={BRAND_COLORS.textMuted}
          accessibilityLabel="Message to AI Coach" style={styles.input} />
        <Button title="Ask Coach" onPress={() => { void send(); }} loading={busy} disabled={busy || !draft.trim()} />
        <Button title="Clear conversation" variant="text" disabled={busy || turns.length === 0}
          onPress={() => { setTurns([]); setError(''); }} />
        <Text variant="caption" muted>AI-generated guidance. Verify with a healthcare professional. Conversations stay in memory for this visit; your AI provider processes submitted data.</Text>
      </CoachPanel>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaWrapper>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
  input: { minHeight: 80, color: BRAND_COLORS.textPrimary, fontSize: 16, textAlignVertical: 'top' },
});
