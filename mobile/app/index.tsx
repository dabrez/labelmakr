import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { API_BASE_URL } from '../config'

interface DatasetStats {
  id: string
  name: string
  description: string | null
  stats: { total: number; pending: number; approved: number; rejected: number }
}

export default function DatasetsScreen() {
  const router = useRouter()
  const [datasets, setDatasets] = useState<DatasetStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/datasets`)
      setDatasets(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    await fetch(`${API_BASE_URL}/api/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
    })
    setNewName(''); setNewDesc('')
    setCreating(false); setShowCreate(false)
    load()
  }

  const del = (id: string, name: string) => {
    Alert.alert('Delete Dataset', `Delete "${name}" and all its examples?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await fetch(`${API_BASE_URL}/api/datasets/${id}`, { method: 'DELETE' })
          load()
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#60a5fa" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.createBtn} onPress={() => setShowCreate(true)}>
        <Text style={styles.createBtnText}>+ New Dataset</Text>
      </Pressable>

      <FlatList
        data={datasets}
        keyExtractor={(d) => d.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#60a5fa" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>No datasets yet</Text>
            <Text style={styles.emptyHint}>Create one to start collecting training data.</Text>
          </View>
        }
        renderItem={({ item: d }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/dataset/${d.id}`)}
            onLongPress={() => del(d.id, d.name)}
          >
            <Text style={styles.cardName}>{d.name}</Text>
            {d.description ? <Text style={styles.cardDesc}>{d.description}</Text> : null}
            <View style={styles.statsRow}>
              <StatBadge label="Total" value={d.stats.total} color="#e5e7eb" />
              <StatBadge label="Pending" value={d.stats.pending} color="#fcd34d" />
              <StatBadge label="Approved" value={d.stats.approved} color="#4ade80" />
              <StatBadge label="Rejected" value={d.stats.rejected} color="#f87171" />
            </View>
            <View style={styles.cardActions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => router.push(`/dataset/${d.id}/review`)}
              >
                <Text style={styles.actionBtnText}>Review</Text>
              </Pressable>
              <Text style={styles.longPressHint}>Hold to delete</Text>
            </View>
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Dataset</Text>
            <TextInput
              style={styles.input}
              placeholder="Dataset name"
              placeholderTextColor="#6b7280"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={[styles.input, { height: 72 }]}
              placeholder="Description (optional)"
              placeholderTextColor="#6b7280"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowCreate(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, !newName.trim() && { opacity: 0.5 }]} onPress={create} disabled={!newName.trim() || creating}>
                <Text style={styles.modalConfirmText}>{creating ? 'Creating...' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ marginRight: 12 }}>
      <Text style={{ color, fontWeight: '700', fontSize: 15 }}>{value}</Text>
      <Text style={{ color: '#6b7280', fontSize: 11 }}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  createBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardName: { color: '#f9fafb', fontWeight: '700', fontSize: 17, marginBottom: 2 },
  cardDesc: { color: '#6b7280', fontSize: 13, marginBottom: 8 },
  statsRow: { flexDirection: 'row', marginTop: 8, marginBottom: 12 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionBtnText: { color: '#60a5fa', fontSize: 13, fontWeight: '600' },
  longPressHint: { color: '#374151', fontSize: 11, marginLeft: 'auto' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#d1d5db', fontWeight: '600', fontSize: 16 },
  emptyHint: { color: '#6b7280', fontSize: 13, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: { color: '#f9fafb', fontWeight: '700', fontSize: 18, marginBottom: 4 },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    color: '#f9fafb',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: '#d1d5db', fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
})
