import { useEffect, useRef } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxKeyIntervalMs?: number;
}

/**
 * Custom React hook for capturing USB / Bluetooth Barcode Scanner input.
 * Hardware scanners output keys extremely rapidly (< 35ms between key events)
 * and send an Enter key when finished.
 */
export function useBarcodeScanner({
  onScan,
  minChars = 3,
  maxKeyIntervalMs = 35,
}: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently inside an editable element that isn't the POS main barcode buffer,
      // UNLESS the keystroke timing is characteristic of a hardware barcode scanner.
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter key indicates end of barcode scan sequence
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minChars) {
          // If rapid timing occurred or buffer is filled, trigger scan
          const scannedBarcode = bufferRef.current.trim();
          bufferRef.current = '';
          if (scannedBarcode) {
            onScan(scannedBarcode);
            if (isInput) {
              e.preventDefault();
            }
          }
        }
        bufferRef.current = '';
        return;
      }

      // If key is a printable character (length === 1)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // If time difference between keys is larger than threshold, reset buffer if not focused on barcode field
        if (timeDiff > maxKeyIntervalMs && !isInput) {
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, minChars, maxKeyIntervalMs]);
}
