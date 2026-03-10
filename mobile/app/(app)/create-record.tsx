import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { installationRecordsApi, queueInstallationRecord, type CreateInstallationRecordPayload } from '@/api/installation-records.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { useAuthStore } from '@/store/auth.store';

export default function CreateRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ simCardId?: string }>();
  const simCardId = params.simCardId?.trim() ?? '';
  const userId = useAuthStore((state) => state.user?.id);
  const userBranch = useAuthStore((state) => state.user?.branch);
  const userRole = useAuthStore((state) => state.user?.role);

  const [meterTypeId, setMeterTypeId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [year, setYear] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [city, setCity] = useState('');
  const [municipality, setMunicipality] = useState('');

  useEffect(() => {
    if (userRole === 'USER' && userBranch?.name) {
      setMunicipality(userBranch.name);
    }
  }, [userRole, userBranch?.name]);
  const [measuringPoint, setMeasuringPoint] = useState('');
  const [installationDate, setInstallationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const buildPayload = (): CreateInstallationRecordPayload => {
    if (!userId || !simCardId || !meterTypeId || !serialNumber.trim()) {
      throw new Error('Tip brojila i serijski broj su obavezni.');
    }

    const lat = latitude ? parseFloat(latitude) : undefined;
    const lon = longitude ? parseFloat(longitude) : undefined;
    const yearNum = year ? parseInt(year, 10) : undefined;

    return {
      simCardId,
      installedById: userId,
      meterTypeDefinitionId: meterTypeId,
      serialNumber: serialNumber.trim(),
      year: Number.isFinite(yearNum) ? yearNum : undefined,
      installationAddress: installationAddress.trim() || undefined,
      installationDate: installationDate || undefined,
      city: city.trim() || undefined,
      municipality: municipality.trim() || undefined,
      branchId: userBranch?.id,
      measuringPoint: measuringPoint.trim() || undefined,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
      notes: notes.trim() || undefined,
      photos: photoPaths.length > 0 ? photoPaths : undefined,
    };
  };

  const meterTypesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list'],
    queryFn: () => meterTypeDefinitionsApi.list(),
    enabled: Boolean(userId),
  });

  const createMutation = useMutation({
    mutationFn: () => installationRecordsApi.create(buildPayload()),
    onSuccess: () => {
      Alert.alert('Uspjeh', 'Zapisnik je kreiran.', [
        { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') },
      ]);
    },
    onError: async (err) => {
      if (axios.isAxiosError(err) && !err.response) {
        try {
          await queueInstallationRecord(buildPayload());
          Alert.alert(
            'Offline režim',
            'Nema mreže. Zapisnik je sačuvan lokalno i biće automatski poslan kada se veza uspostavi.',
            [{ text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') }],
          );
          return;
        } catch {
          // ako čuvanje u lokalni queue padne, padamo na standardnu poruku
        }
      }

      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Kreiranje zapisnika nije uspjelo.';
      Alert.alert('Greška', msg);
    },
  });

  const meterTypeOptions = Array.isArray(meterTypesQuery.data) ? meterTypesQuery.data : [];
  const canSubmit = Boolean(
    simCardId && meterTypeId && serialNumber.trim() && userId,
  );
  const typesError =
    meterTypesQuery.isError ||
    (meterTypesQuery.data === undefined &&
      !meterTypesQuery.isLoading &&
      meterTypesQuery.isFetched);

  if (!simCardId) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        <Text style={{ color: '#dc2626' }}>
          Nedostaje SIM kartica. Vratite se na sken i zadužite karticu, zatim
          odaberite "Kreiraj zapisnik".
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            backgroundColor: '#0f766e',
            padding: 12,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff' }}>Natrag</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>Novi zapisnik ugradnje</Text>
      <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>
        Unesite podatke o brojilu koje montirate. Serijski broj i lokacija se
        unose na terenu pri montaži.
      </Text>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Tip brojila *</Text>
        <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, minHeight: 52 }}>
          {meterTypesQuery.isLoading ? (
            <View style={{ padding: 12 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : typesError ? (
            <View style={{ padding: 12 }}>
              <Text style={{ color: '#dc2626', fontSize: 14 }}>
                Nije moguće učitati tipove brojila. Provjerite mrežu i pokušajte ponovo.
              </Text>
            </View>
          ) : meterTypeOptions.length === 0 ? (
            <View style={{ padding: 12 }}>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                Nema definisanih tipova brojila. Administrator ih dodaje u aplikaciji.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
            >
              {meterTypeOptions.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setMeterTypeId(t.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    marginHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: meterTypeId === t.id ? '#0f766e' : '#f1f5f9',
                  }}
                >
                  <Text
                    style={{
                      color: meterTypeId === t.id ? '#fff' : '#334155',
                      fontWeight: meterTypeId === t.id ? '700' : '400',
                      fontSize: 15,
                    }}
                  >
                    {t.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Serijski broj brojila *</Text>
        <TextInput
          value={serialNumber}
          onChangeText={setSerialNumber}
          placeholder="Unesite serijski broj s brojila"
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Godina proizvodnje</Text>
        <TextInput
          value={year}
          onChangeText={setYear}
          placeholder="npr. 2024"
          keyboardType="number-pad"
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Adresa instalacije</Text>
        <TextInput
          value={installationAddress}
          onChangeText={setInstallationAddress}
          placeholder="Ulica, broj, mjesto"
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 4, fontWeight: '600' }}>Grad</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Grad"
            style={{
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 4, fontWeight: '600' }}>Opština</Text>
          <TextInput
            value={municipality}
            onChangeText={setMunicipality}
            placeholder="Opština"
            editable={userRole !== 'USER'}
            style={{
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              backgroundColor: userRole === 'USER' ? '#f8fafc' : undefined,
            }}
          />
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Mjerno mjesto</Text>
        <TextInput
          value={measuringPoint}
          onChangeText={setMeasuringPoint}
          placeholder="Opcionalno"
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Datum instalacije</Text>
        <TextInput
          value={installationDate}
          onChangeText={setInstallationDate}
          placeholder="YYYY-MM-DD"
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>
          GPS lokacija (preporučeno – automatski dohvat)
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Širina</Text>
            <TextInput
              value={latitude}
              onChangeText={setLatitude}
              placeholder="npr. 43.85"
              keyboardType="decimal-pad"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Dužina</Text>
            <TextInput
              value={longitude}
              onChangeText={setLongitude}
              placeholder="npr. 18.41"
              keyboardType="decimal-pad"
              style={{
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
              }}
            />
          </View>
          <Pressable
            onPress={async () => {
              setIsFetchingLocation(true);
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert(
                    'Dozvola za lokaciju',
                    'Za automatski unos GPS koordinata potrebna je dozvola za lokaciju. Omogućite je u postavkama uređaja.',
                    [{ text: 'OK' }],
                  );
                  return;
                }
                const loc = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                setLatitude(loc.coords.latitude.toFixed(6));
                setLongitude(loc.coords.longitude.toFixed(6));
              } catch (err) {
                Alert.alert(
                  'Greška',
                  'Nije moguće dohvatiti lokaciju. Provjerite da je GPS uključen.',
                  [{ text: 'OK' }],
                );
              } finally {
                setIsFetchingLocation(false);
              }
            }}
            disabled={isFetchingLocation}
            style={{
              backgroundColor: '#0f766e',
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 8,
              justifyContent: 'center',
              minHeight: 48,
            }}
          >
            {isFetchingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="locate" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  Dohvati
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Fotografije (opcionalno)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Pressable
            onPress={async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert(
                  'Dozvola za kameru',
                  'Za snimanje fotografija potrebna je dozvola za kameru.',
                  [{ text: 'OK' }],
                );
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
              });
              if (result.canceled || !result.assets[0]?.uri) return;
              setIsUploadingPhoto(true);
              try {
                const path = await installationRecordsApi.uploadPhoto(result.assets[0].uri);
                setPhotoPaths((p) => [...p, path]);
              } catch (err) {
                Alert.alert(
                  'Greška',
                  axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
                    ? err.response.data.message
                    : 'Upload fotografije nije uspio.',
                  [{ text: 'OK' }],
                );
              } finally {
                setIsUploadingPhoto(false);
              }
            }}
            disabled={isUploadingPhoto}
            style={{
              backgroundColor: '#f1f5f9',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderStyle: 'dashed',
            }}
          >
            {isUploadingPhoto ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="camera" size={24} color="#0f766e" />
                <Text style={{ color: '#0f766e', fontWeight: '600' }}>Dodaj fotografiju</Text>
              </View>
            )}
          </Pressable>
          {photoPaths.length > 0 && (
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              Dodano: {photoPaths.length}
            </Text>
          )}
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Napomena</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Opcionalno"
          multiline
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            minHeight: 60,
          }}
        />
      </View>

      <Pressable
        disabled={!canSubmit || createMutation.isPending}
        onPress={() => createMutation.mutate()}
        style={{
          backgroundColor: !canSubmit ? '#94a3b8' : '#0f766e',
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>
          {createMutation.isPending ? 'Kreiranje...' : 'Kreiraj zapisnik'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#e2e8f0',
        }}
      >
        <Text style={{ color: '#64748b' }}>Odustani</Text>
      </Pressable>
    </ScrollView>
  );
}
