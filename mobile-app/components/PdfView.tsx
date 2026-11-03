import { StyleSheet } from 'react-native';
import Pdf from 'react-native-pdf';

// noteKey/onClose werden nur von der Web-Variante genutzt (dort übernimmt der gemeinsame Noten-Viewer).
export default function PdfView({ uri, onError }: { uri: string; noteKey?: string; onError: () => void; onClose?: () => void }) {
  return <Pdf source={{ uri }} style={styles.pdf} trustAllCerts={false} onError={onError} />;
}

const styles = StyleSheet.create({
  pdf: { flex: 1 },
});
