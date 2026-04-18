import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message?: string) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message ?? '');
    return;
  }
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:rgba(52,73,94,0.95)', 'color:#fff',
    'padding:13px 22px', 'border-radius:14px',
    'font-size:14px', 'line-height:1.5', 'z-index:99999',
    'box-shadow:0 4px 24px rgba(0,0,0,0.18)', 'max-width:320px',
    'text-align:center', 'pointer-events:none',
    'opacity:1', 'transition:opacity 0.3s ease',
  ].join(';');
  el.innerHTML = message
    ? `<div style="font-weight:600;margin-bottom:3px">${title}</div><div style="opacity:0.75;font-size:13px">${message}</div>`
    : `<div style="font-weight:600">${title}</div>`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => { if (document.body.contains(el)) document.body.removeChild(el); }, 350);
  }, 2800);
}

export function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel' },
      { text: '确认', style: 'destructive', onPress: onConfirm },
    ]);
    return;
  }
  if (window.confirm(`${title}\n${message}`)) onConfirm();
}
