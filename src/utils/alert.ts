import Swal from 'sweetalert2';

const baseTheme = {
  confirmButtonColor: '#f43f5e',
  cancelButtonColor: '#9ca3af',
  fontFamily: 'Nunito, sans-serif',
  borderRadius: '16px',
};

export function showAlert(title: string, text: string, icon: 'success' | 'error' | 'info' | 'warning' = 'info') {
  return Swal.fire({ title, text, icon, ...baseTheme, confirmButtonColor: '#f43f5e' });
}

export function showError(message: string) {
  return Swal.fire({ title: 'Ops! 😢', text: message, icon: 'error', ...baseTheme });
}

export function showSuccess(title: string, text?: string) {
  return Swal.fire({ title, text, icon: 'success', ...baseTheme, timer: 2000, timerProgressBar: true });
}

export async function showConfirm(title: string, text: string): Promise<boolean> {
  const result = await Swal.fire({
    title, text, icon: 'question', showCancelButton: true,
    confirmButtonText: 'Sim', cancelButtonText: 'Cancelar',
    ...baseTheme,
  });
  return result.isConfirmed;
}
