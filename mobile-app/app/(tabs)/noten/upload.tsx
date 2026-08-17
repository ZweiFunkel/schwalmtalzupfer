import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, FlatList } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { uploadNote, folderNameFromPrefix } from '../../../lib/noten';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

export default function NotenUpload() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { prefix } = useLocalSearchParams<{ prefix?: string }>();
  const targetLabel = prefix ? folderNameFromPrefix(prefix) : 'Hauptordner';

  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const pickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*', 'audio/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    setPicked(prev => [
      ...prev,
      ...result.assets.map(a => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? undefined })),
    ]);
  };

  const removePicked = (uri: string) => setPicked(prev => prev.filter(f => f.uri !== uri));

  const upload = async () => {
    if (picked.length === 0) return;
    setUploading(true);
    let added = 0;
    let skipped = 0;
    let errors = 0;
    for (const file of picked) {
      try {
        const result = await uploadNote(prefix ?? '', file);
        added += result.added;
        skipped += result.skipped;
        errors += result.errors;
      } catch {
        errors += 1;
      }
    }
    setUploading(false);
    Alert.alert(
      'Upload abgeschlossen',
      `${added} hinzugefügt${skipped > 0 ? `, ${skipped} übersprungen (existiert bereits)` : ''}${errors > 0 ? `, ${errors} fehlgeschlagen` : ''}.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Ziel: {targetLabel}</Text>

      <Pressable style={styles.pickBtn} onPress={pickFiles} disabled={uploading}>
        <Ionicons name="document-attach-outline" size={20} color={colors.primary600} />
        <Text style={styles.pickBtnText}>Dateien auswählen</Text>
      </Pressable>

      <FlatList
        data={picked}
        keyExtractor={f => f.uri}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.fileRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.textMuted} />
            <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
            {!uploading && (
              <Pressable onPress={() => removePicked(item.uri)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textFaint} />
              </Pressable>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Noch keine Dateien ausgewählt.</Text>}
      />

      <Pressable
        style={[styles.uploadBtn, (picked.length === 0 || uploading) && styles.uploadBtnDisabled]}
        onPress={upload}
        disabled={picked.length === 0 || uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.uploadBtnText}>{picked.length} Datei(en) hochladen</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  hint: { color: colors.textMuted, fontFamily: font.medium, fontSize: 13, marginBottom: spacing.md },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary600,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  pickBtnText: { color: colors.primary600, fontFamily: font.semiBold, fontSize: 15 },
  list: { flex: 1 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fileName: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.text },
  empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl },
  uploadBtn: {
    backgroundColor: colors.primary600,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { color: '#fff', fontFamily: font.semiBold, fontSize: 15 },
  });
}
