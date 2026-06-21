'use client';

import { useState, useCallback } from 'react';
import type { RecipientRow } from '@/lib/types';

interface UseRecipientsReturn {
  recipients: RecipientRow[];
  fileName: string | null;
  setRecipients: (rows: RecipientRow[], fileName: string) => void;
  clearRecipients: () => void;
  count: number;
}

export function useRecipients(): UseRecipientsReturn {
  const [recipients, setRecipientsState] = useState<RecipientRow[]>([]);
  const [fileName, setFileName]          = useState<string | null>(null);

  const setRecipients = useCallback((rows: RecipientRow[], name: string) => {
    setRecipientsState(rows);
    setFileName(name);
  }, []);

  const clearRecipients = useCallback(() => {
    setRecipientsState([]);
    setFileName(null);
  }, []);

  return {
    recipients,
    fileName,
    setRecipients,
    clearRecipients,
    count: recipients.length,
  };
}
