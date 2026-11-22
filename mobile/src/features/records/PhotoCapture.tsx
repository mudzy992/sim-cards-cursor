import axios from 'axios';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { installationRecordsApi } from '@/api/installation-records.api';
import { useTranslation } from '@/i18n/i18n.store';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { hapticSuccess, hapticTap } from '@/utils/haptics';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const CAPTURE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.7,
  exif: false,
};

export function PhotoCapture({
  isOnline,
  serialNumber,
  year,
  uploadedPaths,
  localUris,
  onUploaded,
  onLocal,
  loading,
  onLoading,
}: {
  isOnline: boolean;
  serialNumber: string;
  year: string;
  uploadedPaths: string[];
  localUris: string[];
  onUploaded: (paths: string[]) => void;
  onLocal: (uris: string[]) => void;
  loading: boolean;
  onLoading: (v: boolean) => void;
}) {
  const { palette, type } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const handleAsset = async (
    asset: ImagePicker.ImagePickerAsset | undefined,
  ) => {
    const uri = asset?.uri;
    if (!uri) return;
    if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_PHOTO_BYTES) {
      Alert.alert(
        t('mobile.records.photos.tooLargeTitle'),
        t('mobile.records.photos.tooLargeMessage'),
      );
      return;
    }
    onLoading(true);
    try {
      if (!isOnline) {
        onLocal([...localUris, uri]);
        hapticSuccess();
        return;
      }
      const parsedYear = year ? Number.parseInt(year, 10) : undefined;
      const path = await installationRecordsApi.uploadPhoto(uri, {
        serialNumber: serialNumber.trim(),
        year:
          typeof parsedYear === 'number' && Number.isFinite(parsedYear)
            ? parsedYear
            : undefined,
      });
      onUploaded([...uploadedPaths, path]);
      hapticSuccess();
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        onLocal([...localUris, uri]);
        hapticSuccess();
        return;
      }
      const message =
        axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : t('mobile.records.photos.uploadFailed');
      Alert.alert(t('mobile.common.error'), message);
    } finally {
      onLoading(false);
    }
  };

  const captureFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('mobile.records.photos.cameraPermTitle'),
        t('mobile.records.photos.cameraPermBody'),
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(CAPTURE_OPTIONS);
    await handleAsset(result.canceled ? undefined : result.assets[0]);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('mobile.records.photos.galleryPermTitle'),
        t('mobile.records.photos.galleryPermBody'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(CAPTURE_OPTIONS);
    await handleAsset(result.canceled ? undefined : result.assets[0]);
  };

  const removeLocalAt = (index: number) => {
    hapticTap();
    onLocal(localUris.filter((_, idx) => idx !== index));
  };

  const removeUploadedAt = (index: number) => {
    hapticTap();
    onUploaded(uploadedPaths.filter((_, idx) => idx !== index));
  };

  const hasPhotos = localUris.length > 0 || uploadedPaths.length > 0;

  return (
    <View testID="photo-capture-section">
      <Text style={[type.sectionLabel, styles.heading]}>
        {t('mobile.records.photos.heading')}
      </Text>
      <Panel>
        <View style={styles.statuses}>
          <StatusBadge
            tone="success"
            label={t('mobile.records.photos.uploadedBadge', {
              count: uploadedPaths.length,
            })}
          />
          <StatusBadge
            tone={localUris.length ? 'warning' : 'neutral'}
            label={t('mobile.records.photos.queuedBadge', {
              count: localUris.length,
            })}
          />
        </View>

        {hasPhotos ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewRow}
            testID="photo-preview-strip"
          >
            {localUris.map((uri, index) => (
              <View
                key={`local-${uri}-${index}`}
                style={styles.thumbCard}
                testID={`photo-local-item-${index}`}
              >
                <Image
                  source={{ uri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
                <View style={styles.thumbTagLocal}>
                  <Text style={styles.thumbTagText}>
                    {t('mobile.records.photos.queuedTag')}
                  </Text>
                </View>
                <Pressable
                  testID={`photo-remove-local-${index}`}
                  onPress={() => removeLocalAt(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.records.photos.removePhotoLabel')}
                  hitSlop={8}
                  style={styles.removeButton}
                >
                  <Ionicons name="close" size={14} color={palette.inverse} />
                </Pressable>
              </View>
            ))}
            {uploadedPaths.map((filePath, index) => {
              const fileName =
                filePath.split('/').pop() || `#${index + 1}`;
              return (
                <View
                  key={`uploaded-${filePath}-${index}`}
                  style={styles.uploadedCard}
                  testID={`photo-uploaded-item-${index}`}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color={palette.success}
                  />
                  <Text style={styles.uploadedName} numberOfLines={2}>
                    {fileName}
                  </Text>
                  <View style={styles.thumbTagUploaded}>
                    <Text style={styles.thumbTagText}>
                      {t('mobile.records.photos.uploadedTag')}
                    </Text>
                  </View>
                  <Pressable
                    testID={`photo-remove-uploaded-${index}`}
                    onPress={() => removeUploadedAt(index)}
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.records.photos.removePhotoLabel')}
                    hitSlop={8}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close" size={14} color={palette.inverse} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        <Text style={[type.caption, styles.help]}>
          {t('mobile.records.photos.helpText')}
        </Text>
        <View style={styles.actions}>
          <ActionButton
            testID="photo-camera-btn"
            title={t('mobile.records.photos.cameraButton')}
            icon="camera-outline"
            onPress={() => void captureFromCamera()}
            loading={loading}
            variant="secondary"
          />
          <ActionButton
            testID="photo-gallery-btn"
            title={t('mobile.records.photos.galleryButton')}
            icon="images-outline"
            onPress={() => void pickFromGallery()}
            loading={loading}
            variant="secondary"
          />
        </View>
      </Panel>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => ({
  heading: { marginBottom: spacing.md },
  statuses: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  previewRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  thumbCard: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.warningBorder,
    backgroundColor: palette.surfaceSunken,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  thumbImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  uploadedCard: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.successBorder,
    backgroundColor: palette.successSoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xs,
    position: 'relative' as const,
  },
  uploadedName: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600' as const,
    color: palette.textPrimary,
    textAlign: 'center' as const,
  },
  thumbTagLocal: {
    position: 'absolute' as const,
    left: 4,
    bottom: 4,
    backgroundColor: palette.warning,
    borderRadius: radii.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  thumbTagUploaded: {
    position: 'absolute' as const,
    left: 4,
    bottom: 4,
    backgroundColor: palette.success,
    borderRadius: radii.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  thumbTagText: {
    color: palette.inverse,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  removeButton: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.dangerSolid,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  help: {
    marginVertical: spacing.lg,
    lineHeight: 18,
    color: palette.textSecondary,
  },
  actions: { gap: spacing.sm },
});
