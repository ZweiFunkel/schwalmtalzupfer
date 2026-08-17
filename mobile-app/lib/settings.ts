import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTEN_DEFAULT_SUBPATH_KEY = 'noten_default_subpath_v1';

/** Persönlicher Unterordner (relativ zum admin-konfigurierten Noten-Root), in dem der Noten-Tab startet. */
export async function getNotenDefaultSubpath(): Promise<string> {
  return (await AsyncStorage.getItem(NOTEN_DEFAULT_SUBPATH_KEY)) ?? '';
}

export async function setNotenDefaultSubpath(value: string): Promise<void> {
  await AsyncStorage.setItem(NOTEN_DEFAULT_SUBPATH_KEY, value.trim());
}

export function joinPrefix(root: string, subpath: string): string {
  const cleanRoot = root.replace(/\/+$/, '');
  const cleanSub = subpath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleanSub) return root;
  return cleanRoot ? `${cleanRoot}/${cleanSub}/` : `${cleanSub}/`;
}
