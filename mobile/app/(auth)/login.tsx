import { useRouter } from 'expo-router';
import axios from 'axios';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { useServerHealth } from '@/hooks/useServerHealth'

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { status: serverStatus, check: checkServer } = useServerHealth({ timeoutMs: 2500 });

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
        padding: 20,
        backgroundColor: colors.primaryDark,
      }}
    >
      <StatusBar style="light" />
      <LogoWatermark opacity={0.1} />

      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={0}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8, color: colors.onPrimary }}>
          SIM Tracker
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 20 }}>
          Prijava na mobilnu aplikaciju
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor:
                serverStatus === 'online'
                  ? 'rgba(34,197,94,0.16)'
                  : serverStatus === 'offline'
                    ? 'rgba(239,68,68,0.16)'
                    : 'rgba(255,255,255,0.10)',
              borderWidth: 1,
              borderColor:
                serverStatus === 'online'
                  ? 'rgba(34,197,94,0.40)'
                  : serverStatus === 'offline'
                    ? 'rgba(239,68,68,0.40)'
                    : 'rgba(255,255,255,0.20)',
            }}
          >
            <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
              Server:{' '}
              {serverStatus === 'online'
                ? 'Online'
                : serverStatus === 'offline'
                  ? 'Offline'
                  : 'Provjera...'}
            </Text>
          </View>

          <Pressable
            onPress={() => void checkServer()}
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : 1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.20)',
              backgroundColor: 'rgba(255,255,255,0.08)',
            })}
          >
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>Provjeri</Text>
          </Pressable>
        </View>

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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
