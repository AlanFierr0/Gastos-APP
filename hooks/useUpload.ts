import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { UploadResponse } from '@/types';

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const uploadFile = useCallback(async (file: File): Promise<UploadResponse | null> => {
    try {
      setUploading(true);
      setError(null);
      setSuccess(false);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<UploadResponse>('/gastos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(true);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Error al subir el archivo';
      setError(errorMessage);
      console.error('Error uploading file:', err);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { uploadFile, uploading, error, success, reset };
}
