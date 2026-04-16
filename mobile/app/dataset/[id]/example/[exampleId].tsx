import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { API_BASE_URL } from '../../../../config'

interface Message { role: 'system' | 'user' | 'assistant'; content: string }
interface Example {
  id: string
  messages: Message[]
  status: string
  source: string
  notes: string | null
}

const ROLE_COLORS: Record<string, { label: string; text: string; bg: string; border: string }> = {
  system: { label: 'System', text: '#c4b5fd', bg: '#2e1065', border: '#4c1d95' },
  user: { label: 'User', text: '#93c5fd', bg: '#1e3a5f', border: '#1e40af' },
  assistant: { label: 'Assistant', text: '#86efac', bg: '#052e16', border: '#14532d' },
}

export default function ExampleEditScreen() {
  const { id, exampleId } = useLocalSearchParams<{ id: string; exampleId: string }>()
  const router = useRouter()

  const [example, setExample] = useState<Example | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/datasets/${id}/examples/${exampleId}`)
      .then((r) => r.json())
      .then((data) => {
        setExample(data)
        setMessages(data.messages)
        setNotes(data.notes ?? '')
        setLoading(false)
      })
  }, [])

  const updateMessage = (i: number, content: string) => {
    setMessages((prev) => prev.map((m, mi) => mi === i ? { ...m, content } : m))
  }

  const save = async (status?: string) => {
    if (!example || saving) return
    setSaving(true)
    const body: Record<string, unknown> = {
      messages,
      notes: notes.trim() || null,
    }
    if (status) body.status = status

    await fetch(`${API_BASE_URL}/api/datasets/${id}/examples/${exampleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    router.back()
  }

  const del = () => {
    Alert.alert('Delete Example', 'Remove this example permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await fetch(`${API_BASE_URL}/api/datasets/${id}/examples/${exampleId}`, { method: 'DELETE' })
          router.back()
        },
      },
    ])
  }

  if (loading || !example) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#60a5fa" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#030712' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.metaRow}>
          <View style={[styles.statusBadge, { backgroundColor: example.status === 'approved' ? '#052e16' : example.status === 'rejected' ? '#3f0d11' : '#422006' }]}>
            <Text style={[styles.statusText, { color: example.status === 'approved' ? '#4ade80' : example.status === 'rejected' ? '#f87171' : '#fcd34d' }]}>
              {example.status}
            </Text>
          </View>
          <Text style={styles.sourceText}>{example.source}</Text>
          <Pressable onPress={del} style={{ marginLeft: 'auto' }}>
            <Text style={{ color: '#ef4444', fontSize: 13 }}>Delete</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Messages</Text>
        {messages.map((m, i) => {
          const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.user
          return (
            <View key={i} style={[styles.messageBlock, { backgroundColor: rc.bg, borderColor: rc.border }]}>
              <Text style={[styles.roleLabel, { color: rc.text }]}>{rc.label}</Text>
              <TextInput
                style={[styles.messageInput, { color: '#e5e7eb' }]}
                value={m.content}
                onChangeText={(t) => updateMessage(i, t)}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>
          )
        })}

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add reviewer notes..."
          placeholderTextColor="#4b5563"
          multiline
        />
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <Pressable style={styles.rejectBtn} onPress={() => save('rejected')} disabled={saving}>
          <Text style={styles.rejectBtnText}>Reject</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={() => save()} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
        <Pressable style={styles.approveBtn} onPress={() => save('approved')} disabled={saving}>
          <Text style={styles.approveBtnText}>Approve</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  sourceText: { color: '#4b5563', fontSize: 12 },
  sectionLabel: {
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  messageBlock: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  messageInput: {
    fontSize: 14,
    lineHeight: 20,
    padding: 0,
    minHeight: 60,
  },
  notesInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    color: '#9ca3af',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#1f2937',
    minHeight: 72,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    backgroundColor: '#030712',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#3f0d11',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  rejectBtnText: { color: '#f87171', fontWeight: '700', fontSize: 14 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#d1d5db', fontWeight: '600', fontSize: 14 },
  approveBtn: {
    flex: 1,
    backgroundColor: '#052e16',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  approveBtnText: { color: '#4ade80', fontWeight: '700', fontSize: 14 },
})
