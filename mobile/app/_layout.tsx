import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#030712' },
          headerTintColor: '#f9fafb',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#030712' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Labelmakr' }} />
        <Stack.Screen name="dataset/[id]" options={{ title: 'Dataset' }} />
        <Stack.Screen
          name="dataset/[id]/review"
          options={{ title: 'Review', presentation: 'modal' }}
        />
        <Stack.Screen
          name="dataset/[id]/example/[exampleId]"
          options={{ title: 'Edit Example', presentation: 'modal' }}
        />
      </Stack>
    </>
  )
}
