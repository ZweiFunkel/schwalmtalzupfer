import { StyleSheet } from 'react-native';
import Pdf from 'react-native-pdf';

export default function PdfView({ uri, onError }: { uri: string; onError: () => void }) {
  return <Pdf source={{ uri }} style={styles.pdf} trustAllCerts={false} onError={onError} />;
}

const styles = StyleSheet.create({
  pdf: { flex: 1 },
});
