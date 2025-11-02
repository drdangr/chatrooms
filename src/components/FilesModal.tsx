import { useState } from 'react'
import { deleteFile as deleteFileUtil, uploadFile, validateFile } from '../lib/file-upload'
import { permissions, Role } from '../lib/roles'

interface RoomFile {
  id: string
  filename: string
  file_type: string
  size: number
  file_url: string
  openai_file_id: string | null
  created_at: string
}

interface FilesModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  userId: string
  userRole: Role
  files: RoomFile[]
  onFilesUpdate: () => Promise<void>
  onFileDeleted?: () => Promise<void>
}

export default function FilesModal({
  isOpen,
  onClose,
  roomId,
  userId,
  userRole,
  files,
  onFilesUpdate,
  onFileDeleted,
}: FilesModalProps) {
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [dragActive, setDragActive] = useState(false)

  if (!isOpen) return null

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files)
    }
  }

  const handleFileUpload = async (selectedFiles: FileList | globalThis.File[]) => {
    if (!roomId || !userId || !permissions.canSendMessages(userRole)) {
      alert('У вас нет прав для загрузки файлов')
      return
    }

    const filesArray: globalThis.File[] = selectedFiles instanceof FileList 
      ? Array.from(selectedFiles) 
      : selectedFiles
    if (filesArray.length === 0) return

    setUploadingFiles(true)
    const progress: Record<string, number> = {}

    try {
      // Гибридный подход: всегда загружаем файлы в OpenAI для возможности использования Assistants API
      const shouldUploadToOpenAI = true

      for (const file of filesArray) {
        // Валидация
        const validation = validateFile(file)
        if (!validation.valid) {
          alert(`Файл "${file.name}": ${validation.error}`)
          continue
        }

        try {
          progress[file.name] = 0
          setUploadProgress({ ...progress })

          // Загружаем файл (всегда в OpenAI для гибридного подхода)
          const result = await uploadFile(
            file,
            roomId,
            userId,
            shouldUploadToOpenAI
          )

          progress[file.name] = 100
          setUploadProgress({ ...progress })

          console.log(`✅ Файл ${file.name} загружен, ID: ${result.fileId}`)

          // Если файл загружен в OpenAI, Assistant будет создан автоматически при следующем сообщении
          if (result.openaiFileId) {
            console.log('📋 Файл загружен в OpenAI, Assistant будет создан автоматически при первом сообщении')
          }
        } catch (error) {
          console.error(`Ошибка загрузки файла ${file.name}:`, error)
          alert(`Ошибка загрузки файла "${file.name}": ${(error as Error).message}`)
        }
      }

      // Перезагружаем список файлов
      await onFilesUpdate()
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Ошибка при загрузке файлов: ' + (error as Error).message)
    } finally {
      setUploadingFiles(false)
      setUploadProgress({})
    }
  }

  const handleDeleteFile = async (fileId: string, fileUrl: string, openaiFileId: string | null) => {
    if (!userId || !permissions.canSendMessages(userRole)) {
      alert('У вас нет прав для удаления файлов')
      return
    }

    if (!confirm('Удалить этот файл?')) {
      return
    }

    try {
      await deleteFileUtil(fileId, fileUrl, openaiFileId, userId)
      await onFilesUpdate()
      if (onFileDeleted) {
        await onFileDeleted()
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Ошибка при удалении файла: ' + (error as Error).message)
    }
  }

  const getFileIcon = (fileType: string, filename: string) => {
    if (fileType?.startsWith('image/')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    } else if (fileType === 'application/pdf') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    } else if (fileType === 'text/csv' || filename.endsWith('.csv')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    } else {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800">Файлы комнаты</h2>
            {files.length > 0 && (
              <span className="text-sm text-gray-500">({files.length})</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Закрыть"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Зона drag & drop */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-100'
                : 'border-blue-300 bg-white hover:border-blue-400 hover:bg-blue-50'
            } ${uploadingFiles ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              id="file-upload-modal"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
              disabled={uploadingFiles || !permissions.canSendMessages(userRole)}
            />
            <label
              htmlFor="file-upload-modal"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <div className="text-base font-medium text-gray-700 mb-1">
                  {dragActive ? 'Отпустите файлы здесь' : 'Перетащите файлы сюда или нажмите для выбора'}
                </div>
                <div className="text-sm text-gray-500">
                  Поддерживаются: текстовые файлы, изображения (PNG, JPEG, GIF, WebP), PDF, JSON, CSV
                </div>
              </div>
            </label>

            {uploadingFiles && (
              <div className="mt-4 space-y-2">
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="truncate">{fileName}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Список файлов */}
          {files.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Загруженные файлы:</h3>
              <div className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors text-sm group"
                  >
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 flex-1 min-w-0"
                      title={`${file.filename} • ${file.file_type} • ${(file.size / 1024).toFixed(1)} KB`}
                    >
                      {getFileIcon(file.file_type, file.filename)}
                      <span className="font-medium text-gray-700 truncate max-w-[200px]">
                        {file.filename}
                      </span>
                      {file.openai_file_id && (
                        <span className="text-green-600" title="Загружен в OpenAI">
                          ✅
                        </span>
                      )}
                      <svg 
                        className="w-4 h-4 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    {permissions.canSendMessages(userRole) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          handleDeleteFile(file.id, file.file_url, file.openai_file_id)
                        }}
                        className="ml-1 p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700 transition-colors opacity-0 group-hover:opacity-100"
                        title="Удалить файл"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Файлы пока не загружены</p>
              <p className="text-sm mt-1">Загрузите файлы через drag & drop или выберите их</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

