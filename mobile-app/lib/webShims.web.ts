import { Alert, type AlertButton } from 'react-native';

// react-native-web liefert für Alert.alert keine Implementierung. Die Screens nutzen Alert.alert sowohl
// für Hinweise als auch für Rückfragen mit Buttons, daher hier auf window.alert/confirm abbilden.
Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const cancel = buttons.find(b => b.style === 'cancel');
  const confirmButtons = buttons.filter(b => b !== cancel);
  const primary = confirmButtons[confirmButtons.length - 1];
  if (window.confirm(`${text}\n\nOK = ${primary.text ?? 'Bestätigen'}`)) primary.onPress?.();
  else cancel?.onPress?.();
};
