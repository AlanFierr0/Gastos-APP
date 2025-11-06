import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney, formatDate } from '../utils/format.js';
import * as api from '../api/index.js';

export default function Upload() {
  const { t, refreshExpenses, refreshIncome } = useApp();
  const { register, handleSubmit, reset, watch } = useForm();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const selectedFile = watch('file');

  const getErrorMessage = (error) => {
    if (!error) return t('uploadFailed');
    
    const errorMessage = error?.response?.data?.message || error?.message || String(error);
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('file size') || lowerMessage.includes('size exceeds') || lowerMessage.includes('tamaño')) {
      return t('errorFileTooLarge');
    }
    if (lowerMessage.includes('only excel') || lowerMessage.includes('allowed') || lowerMessage.includes('formato')) {
      return t('errorInvalidFileFormat');
    }
    if (lowerMessage.includes('empty') || lowerMessage.includes('vacío') || lowerMessage.includes('no sheets')) {
      return t('errorFileEmpty');
    }
    if (lowerMessage.includes('too many rows') || lowerMessage.includes('demasiadas filas')) {
      return t('errorTooManyRows');
    }
    if (lowerMessage.includes('amount and date') || lowerMessage.includes('monto y fecha') || lowerMessage.includes('columns')) {
      return t('errorMissingColumns');
    }
    if (lowerMessage.includes('no file') || lowerMessage.includes('no se subió')) {
      return t('errorNoFile');
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('network')) {
      return t('errorNetwork');
    }
    if (errorMessage && errorMessage.length < 200) {
      return errorMessage;
    }
    return t('uploadFailed');
  };

  // Preview records
  const onFileSelect = async (values) => {
    if (!values.file?.[0]) return;
    setLoading(true);
    setStatus('Analizando gastos e ingresos...');
    
    try {
      const form = new FormData();
      form.append('file', values.file[0]);
      const result = await api.previewExcel(form);
      const records = result.records || [];
      setPreviewData(records);
      
      let message = '';
      if (records.length === 0) {
        message = '⚠️ El archivo se procesó correctamente pero no se encontraron registros válidos.';
      }
      
      // Show errors and warnings from preview
      if (result.errors && result.errors.length > 0) {
        message += message ? '\n\n' : '';
        message += `❌ Errores encontrados durante el análisis (${result.errors.length}):\n`;
        result.errors.slice(0, 10).forEach((err, idx) => {
          const errInfo = err.item || err.category || 'Desconocido';
          const errMonth = err.month ? ` mes ${err.month}/${err.year || '?'}` : '';
          const errValue = err.value ? ` valor: ${err.value}` : '';
          const errMsg = err.error || err.reason || 'Error desconocido';
          message += `  ${idx + 1}. ${errInfo}${errMonth}${errValue}: ${errMsg}\n`;
        });
        if (result.errors.length > 10) {
          message += `  ... y ${result.errors.length - 10} errores más.\n`;
        }
      }
      
      if (result.warnings && result.warnings.length > 0) {
        message += message ? '\n\n' : '';
        message += `⚠️ Advertencias encontradas durante el análisis (${result.warnings.length}):\n`;
        result.warnings.slice(0, 10).forEach((warn, idx) => {
          const warnInfo = warn.item || warn.category || 'Desconocido';
          const warnMonth = warn.month ? ` mes ${warn.month}/${warn.year || '?'}` : '';
          const warnValue = warn.value ? ` valor: ${warn.value}` : '';
          const warnMsg = warn.reason || 'Advertencia';
          message += `  ${idx + 1}. ${warnInfo}${warnMonth}${warnValue}: ${warnMsg}\n`;
        });
        if (result.warnings.length > 10) {
          message += `  ... y ${result.warnings.length - 10} advertencias más.\n`;
        }
      }
      
      if (message) {
        setStatus(message);
      } else {
        setStatus(null);
      }
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setStatus(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecord = (index) => {
    if (!previewData) return;
    const updated = previewData.filter((_, i) => i !== index);
    setPreviewData(updated);
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const handleEditRecord = (index) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = (index, updatedRecord) => {
    if (!previewData) return;
    const updated = [...previewData];
    updated[index] = updatedRecord;
    setPreviewData(updated);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.length === 0) {
      setStatus(t('noRecordsToImport'));
      return;
    }
    setLoading(true);
    setStatus(t('uploading'));
    try {
      const result = await api.confirmImport(previewData);
      let message = result.message || t('importSuccess');
      
      // Build detailed message with errors and warnings
      if (result.errors && result.errors.length > 0) {
        message += `\n\n❌ Errores (${result.errors.length}):\n`;
        result.errors.forEach((err, idx) => {
          const errInfo = err.item || err.category || err.record?.categoryName || err.record?.source || 'Desconocido';
          const errMonth = err.month ? ` mes ${err.month}/${err.year || '?'}` : '';
          const errValue = err.value ? ` valor: ${err.value}` : '';
          const errMsg = err.error || err.reason || 'Error desconocido';
          message += `  ${idx + 1}. ${errInfo}${errMonth}${errValue}: ${errMsg}\n`;
        });
      }
      
      if (result.warnings && result.warnings.length > 0) {
        message += `\n⚠️ Advertencias (${result.warnings.length}):\n`;
        result.warnings.forEach((warn, idx) => {
          const warnInfo = warn.item || warn.category || 'Desconocido';
          const warnMonth = warn.month ? ` mes ${warn.month}/${warn.year || '?'}` : '';
          const warnValue = warn.value ? ` valor: ${warn.value}` : '';
          const warnMsg = warn.reason || 'Advertencia';
          message += `  ${idx + 1}. ${warnInfo}${warnMonth}${warnValue}: ${warnMsg}\n`;
        });
      }
      
      setStatus(message);
      setPreviewData(null);
      reset();
      await Promise.all([
        refreshExpenses(),
        refreshIncome(),
      ]);
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setStatus(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreviewData(null);
    setEditingIndex(null);
    setStatus(null);
    reset();
  };

  return (
    <div className={`flex flex-col gap-6 ${previewData ? 'w-full max-w-full' : 'max-w-6xl'}`}>
      <header>
        <p className="text-4xl font-black tracking-[-0.033em]">{t('uploadTitle')}</p>
        <p className="text-[#616f89] dark:text-gray-400">{t('uploadSubtitle')}</p>
      </header>

      {!previewData ? (
        <Card>
          <form onSubmit={handleSubmit(onFileSelect)} className="flex flex-col gap-4">
            <input 
              type="file" 
              accept=".xlsx,.csv" 
              className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white hover:file:bg-primary/90" 
              {...register('file')} 
            />
            <div className="flex justify-end">
              <button 
                disabled={loading || !selectedFile?.[0]} 
                className="h-12 px-5 rounded-lg bg-primary text-white font-bold disabled:opacity-50"
              >
                {loading ? 'Analizando...' : 'Analizar archivo'}
              </button>
            </div>
          </form>
        </Card>
      ) : previewData ? (
        <div className="flex flex-col gap-6 pb-24">
          <Card>
            <div className="mb-4">
              <p className="text-2xl font-bold">{t('previewTitle')}</p>
              <p className="text-sm text-[#616f89] dark:text-gray-400">{t('previewSubtitle')}</p>
            </div>
            <div className="mb-4 text-sm">
              <strong>{t('previewRecords')}:</strong> {previewData.length}
            </div>
          </Card>

          {previewData.length > 0 ? (
            <Card>
              <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-2">{t('type')}</th>
                      <th className="text-left p-2">{t('category')}</th>
                      <th className="text-left p-2">{t('concept') || 'Concepto'}</th>
                      <th className="text-left p-2">{t('amount')}</th>
                      <th className="text-left p-2">{t('date')}</th>
                      <th className="text-left p-2">{t('notes')}</th>
                      <th className="text-left p-2">{t('edit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((record, index) => (
                      <RecordRow
                        key={index}
                        record={record}
                        index={index}
                        isEditing={editingIndex === index}
                        onEdit={handleEditRecord}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onRemove={handleRemoveRecord}
                        t={t}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noRecordsToImport')}</p>
            </Card>
          )}

          {/* Fixed bottom action bar */}
          <div className="fixed bottom-0 left-64 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 shadow-lg z-50">
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="h-12 px-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('cancelImport')}
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={loading || previewData.length === 0}
                className="h-12 px-8 rounded-lg bg-primary text-white font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {loading ? t('uploading') : t('confirmImport')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status && (
        <Card className={
          status.includes('✅') || status.includes(t('importSuccess')?.slice(0, 10) || '') || status.includes('exitosamente')
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : status.includes('❌') || status.includes(t('uploadFailed')?.slice(0, 5) || '') || status.includes('Error') || status.includes('error')
            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            : status.includes('⚠️') || status.includes('Advertencia') || status.includes('Warning')
            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
            : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/30'
        }>
          <div className="pb-24">
            <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{status}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function RecordRow({ record, index, isEditing, onEdit, onSave, onCancel, onRemove, t }) {
  const [editedRecord, setEditedRecord] = useState(record);

  React.useEffect(() => {
    if (isEditing) {
      setEditedRecord(record);
    }
  }, [isEditing, record]);

  const handleSave = () => {
    onSave(index, editedRecord);
  };

  const handleFieldChange = (field, value) => {
    setEditedRecord({ ...editedRecord, [field]: value });
  };

  if (isEditing) {
    return (
      <tr className="border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
        <td className="p-2">
          <select
            value={editedRecord.kind}
            onChange={(e) => handleFieldChange('kind', e.target.value)}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          >
            <option value="expense">{t('expense')}</option>
            <option value="income">{t('income')}</option>
          </select>
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editedRecord.categoria || ''}
            onChange={(e) => handleFieldChange('categoria', e.target.value)}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editedRecord.nombre || ''}
            onChange={(e) => handleFieldChange('nombre', e.target.value)}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            step="0.01"
            value={editedRecord.amount || ''}
            onChange={(e) => handleFieldChange('amount', Number(e.target.value))}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          <input
            type="date"
            value={editedRecord.date ? new Date(editedRecord.date).toISOString().slice(0, 10) : ''}
            onChange={(e) => handleFieldChange('date', new Date(e.target.value).toISOString())}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editedRecord.nota || ''}
            onChange={(e) => handleFieldChange('nota', e.target.value || '')}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              className="px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600"
            >
              ✓
            </button>
            <button
              onClick={onCancel}
              className="px-2 py-1 rounded bg-gray-500 text-white text-xs hover:bg-gray-600"
            >
              ✕
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="p-2">{record.kind === 'income' ? t('income') : t('expense')}</td>
      <td className="p-2">{record.categoria || '-'}</td>
      <td className="p-2">{record.nombre || '-'}</td>
      <td className="p-2">{formatMoney(record.amount, record.currency || 'ARS', { sign: 'auto' })}</td>
      <td className="p-2">{formatDate(record.date)}</td>
      <td className="p-2">{record.nota || '-'}</td>
      <td className="p-2">
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(index)}
            className="px-2 py-1 rounded bg-primary/10 text-primary dark:bg-primary/20 text-xs hover:bg-primary/20"
          >
            {t('editRecord')}
          </button>
          <button
            onClick={() => onRemove(index)}
            className="px-2 py-1 rounded bg-red-500/10 text-red-500 dark:bg-red-500/20 text-xs hover:bg-red-500/20"
          >
            {t('removeRecord')}
          </button>
        </div>
      </td>
    </tr>
  );
}
