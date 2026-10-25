import * as Sharing from 'expo-sharing';

export async function shareFile(uri: string, title?: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { dialogTitle: title });
  }
}

export async function canShareFile(): Promise<boolean> {
  return Sharing.isAvailableAsync();
}
