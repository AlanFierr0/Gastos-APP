import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Upload() {
  const { api } = useApp();
  const { register, handleSubmit, reset } = useForm();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (values) => {
    if (!values.file?.[0]) return;
    setLoading(true);
    setStatus('Analyzing your file...');
    try {
      const form = new FormData();
      form.append('file', values.file[0]);
      await api.uploadExcel(form); // assumes NestJS endpoint /upload
      setStatus('File validated. Ready to synchronize.');
      reset();
    } catch (e) {
      setStatus('Upload failed. Please ensure the file format is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <p className="text-4xl font-black tracking-[-0.033em]">Import Your Expense History</p>
        <p className="text-[#616f89] dark:text-gray-400">Upload and synchronize historical data from Excel or CSV files.</p>
      </header>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <input type="file" accept=".xlsx,.csv" className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white hover:file:bg-primary/90" {...register('file')} />
          <div className="flex justify-end">
            <button disabled={loading} className="h-12 px-5 rounded-lg bg-primary text-white font-bold disabled:opacity-50">{loading ? 'Uploading...' : 'Synchronize Data'}</button>
          </div>
        </form>
      </Card>

      {status && (
        <div className={
          status.startsWith('File validated')
            ? 'rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20'
            : status.startsWith('Upload failed')
            ? 'rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'
            : 'rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/30'
        }>
          <p className="text-sm">{status}</p>
        </div>
      )}
    </div>
  );
}





