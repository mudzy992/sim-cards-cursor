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
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/utils/error.utils';
import { colors } from '@/theme/colors';
import { LogoWatermark } from '@/components/LogoWatermark'

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
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: colors.primaryDark,
      }}
    >
      <StatusBar style="light" />
      <LogoWatermark opacity={0.1} />

      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8, color: colors.onPrimary }}>
        SIM Tracker
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 20 }}>
        Prijava na mobilnu aplikaciju
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="rgba(255,255,255,0.65)"
        autoCapitalize="none"
        keyboardType="email-address"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        style={{
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.20)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
          backgroundColor: 'rgba(255,255,255,0.10)',
          color: colors.onPrimary,
        }}
      />

      <TextInput
        placeholder="Lozinka"
        placeholderTextColor="rgba(255,255,255,0.65)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.20)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
          backgroundColor: 'rgba(255,255,255,0.10)',
          color: colors.onPrimary,
        }}
      />

      {error ? <Text style={{ color: '#fecaca', marginBottom: 12 }}>{error}</Text> : null}

      <Pressable
        onPress={() => void submit()}
        disabled={isLoading}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          opacity: isLoading ? 0.7 : 1,
        })}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>Prijavi se</Text>
        )}
      </Pressable>

      <View style={{ marginTop: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
          Prijava putem emaila ili korisničkog imena (ime.prezime)
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.60)', marginTop: 4 }}>
          API: {process.env.EXPO_PUBLIC_API_BASE_URL ?? 'nije postavljen'}
        </Text>
      </View>
    </SafeAreaView>
  );
}
