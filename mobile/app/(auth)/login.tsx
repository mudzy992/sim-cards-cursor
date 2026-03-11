import { useRouter } from 'expo-router';
import axios from 'axios';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/utils/error.utils';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await login({ emailOrUsername, password });
      router.replace('/(app)/(tabs)/home');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setError('Pogrešan email/korisničko ime ili lozinka.');
        return;
      }

      setError(getApiErrorMessage(error, 'Prijava nije uspjela.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>SIM Tracker</Text>
      <Text style={{ color: '#64748b', marginBottom: 20 }}>Prijava na mobilnu aplikaciju</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        style={{
          borderWidth: 1,
          borderColor: '#cbd5e1',
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
        }}
      />

      <TextInput
        placeholder="Lozinka"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: '#cbd5e1',
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
        }}
      />

      {error ? <Text style={{ color: '#dc2626', marginBottom: 12 }}>{error}</Text> : null}

      <Pressable
        onPress={() => void submit()}
        disabled={isLoading}
        style={{
          backgroundColor: '#0f766e',
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Prijavi se</Text>}
      </Pressable>

      <View style={{ marginTop: 16 }}>
        <Text style={{ color: '#64748b' }}>Prijava putem emaila ili korisničkog imena (ime.prezime)</Text>
        <Text style={{ color: '#64748b', marginTop: 4 }}>
          API: {process.env.EXPO_PUBLIC_API_BASE_URL ?? 'nije postavljen'}
        </Text>
      </View>
    </SafeAreaView>
  );
}
