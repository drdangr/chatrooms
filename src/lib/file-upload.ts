import { supabase } from './supabase'
import { uploadFileToOpenAI } from './assistants'

/**
 * Максимальный размер файла (50 MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

/**
 * Поддерживаемые типы файлов
 */
const SUPPORTED_FILE_TYPES = {
  // Текстовые файлы
  'text/plain': ['.txt', '.md', '.log'],
  'text/csv': ['.csv'],
  'text/markdown': ['.md'],
  'application/json': ['.json'],
  // Изображения
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  // Документы
  'application/pdf': ['.pdf'],
  // Архивы (опционально)
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
}

/**
 * Валидация файла
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Проверка размера
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
    }
  }

  // Проверка типа файла
  const extension = '.' + file.name.split('.').pop()?.toLowerCase()
  const isSupported = Object.values(SUPPORTED_FILE_TYPES).some((extensions) =>
    extensions.includes(extension)
  )

  if (!isSupported) {
    return {
      valid: false,
      error: `Неподдерживаемый тип файла. Поддерживаются: ${Object.values(SUPPORTED_FILE_TYPES).flat().join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * Определяет MIME-тип файла по расширению
 */
export function getFileType(filename: string): string {
  const extension = '.' + filename.split('.').pop()?.toLowerCase()
  
  for (const [mimeType, extensions] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if (extensions.includes(extension)) {
      return mimeType
    }
  }
  
  return 'application/octet-stream'
}

/**
 * Загружает файл в Supabase Storage
 * @param file - файл для загрузки
 * @param roomId - ID комнаты
 * @param userId - ID пользователя
 * @returns URL файла в Storage
 */
export async function uploadFileToStorage(
  file: File,
  roomId: string,
  userId: string
): Promise<string> {
  try {
    // Валидация
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Генерируем уникальное имя файла
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}-${randomId}.${fileExtension}`
    const filePath = `${roomId}/${fileName}`

    // Загружаем файл в Storage
    const { data, error } = await supabase.storage
      .from('files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      throw new Error(`Ошибка загрузки в Storage: ${error.message}`)
    }

    // Получаем публичный URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('files').getPublicUrl(filePath)

    if (!publicUrl) {
      throw new Error('Не удалось получить публичный URL файла')
    }

    return publicUrl
  } catch (error) {
    console.error('Error uploading file to storage:', error)
    throw error
  }
}

/**
 * Сохраняет метаданные файла в БД
 * @param roomId - ID комнаты
 * @param userId - ID пользователя
 * @param filename - оригинальное имя файла
 * @param fileUrl - URL файла в Storage
 * @param fileType - MIME-тип файла
 * @param fileSize - размер файла
 * @param openaiFileId - OpenAI file ID (если загружен в OpenAI)
 * @returns ID созданной записи
 */
export async function saveFileMetadata(
  roomId: string,
  userId: string,
  filename: string,
  fileUrl: string,
  fileType: string,
  fileSize: number,
  openaiFileId?: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('files')
      .insert({
        room_id: roomId,
        uploaded_by: userId,
        filename,
        file_url: fileUrl,
        file_type: fileType,
        size: fileSize,
        openai_file_id: openaiFileId || null,
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Ошибка сохранения метаданных: ${error.message}`)
    }

    return data.id
  } catch (error) {
    console.error('Error saving file metadata:', error)
    throw error
  }
}

/**
 * Загружает файл в OpenAI (для Assistants API)
 * @param file - файл для загрузки
 * @returns OpenAI file ID
 */
export async function uploadFileToOpenAIFromBlob(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    return await uploadFileToOpenAI(arrayBuffer, file.name)
  } catch (error) {
    console.error('Error uploading file to OpenAI:', error)
    throw error
  }
}

/**
 * Основная функция для загрузки файла
 * Загружает файл в Supabase Storage и OpenAI (если нужно), сохраняет метаданные
 * @param file - файл для загрузки
 * @param roomId - ID комнаты
 * @param userId - ID пользователя
 * @param uploadToOpenAI - загружать ли файл в OpenAI (для Assistants API)
 * @returns ID файла в БД и OpenAI file ID (если загружен)
 */
export async function uploadFile(
  file: File,
  roomId: string,
  userId: string,
  uploadToOpenAI: boolean = false
): Promise<{ fileId: string; openaiFileId?: string }> {
  try {
    // Валидация
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const fileType = getFileType(file.name)

    // 1. Загружаем в Supabase Storage
    console.log('📤 Загрузка файла в Supabase Storage...')
    const fileUrl = await uploadFileToStorage(file, roomId, userId)

    // 2. Загружаем в OpenAI (если нужно)
    let openaiFileId: string | undefined
    if (uploadToOpenAI) {
      try {
        console.log('📤 Загрузка файла в OpenAI...')
        openaiFileId = await uploadFileToOpenAIFromBlob(file)
        console.log(`✅ Файл загружен в OpenAI, ID: ${openaiFileId}`)
      } catch (openaiError) {
        console.warn('⚠️ Не удалось загрузить файл в OpenAI:', openaiError)
        // Продолжаем, даже если загрузка в OpenAI не удалась
      }
    }

    // 3. Сохраняем метаданные в БД
    const fileId = await saveFileMetadata(
      roomId,
      userId,
      file.name,
      fileUrl,
      fileType,
      file.size,
      openaiFileId
    )

    console.log('✅ Файл успешно загружен')
    return { fileId, openaiFileId }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

/**
 * Удаляет файл из OpenAI (если загружен)
 * @param openaiFileId - OpenAI file ID
 */
export async function deleteFileFromOpenAI(openaiFileId: string): Promise<void> {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key не настроен')
    }

    const response = await fetch(`https://api.openai.com/v1/files/${openaiFileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // Игнорируем ошибку 404 (файл уже удален)
      if (response.status !== 404) {
        throw new Error(`Ошибка удаления файла из OpenAI: ${errorData.error?.message || response.statusText}`)
      }
    }
  } catch (error) {
    console.error('Error deleting file from OpenAI:', error)
    // Не пробрасываем ошибку дальше, чтобы удаление продолжилось
  }
}

/**
 * Извлекает путь файла из URL Supabase Storage
 * @param fileUrl - публичный URL файла
 * @returns путь файла в Storage
 */
function extractStoragePath(fileUrl: string): string | null {
  try {
    // URL формат: https://[project].supabase.co/storage/v1/object/public/files/[roomId]/[filename]
    const url = new URL(fileUrl)
    const pathParts = url.pathname.split('/storage/v1/object/public/files/')
    if (pathParts.length === 2) {
      return pathParts[1] // roomId/filename
    }
    return null
  } catch (error) {
    console.error('Error extracting storage path:', error)
    return null
  }
}

/**
 * Удаляет файл из Storage, OpenAI (если загружен) и БД
 * @param fileId - ID файла в БД
 * @param fileUrl - URL файла в Storage
 * @param openaiFileId - OpenAI file ID (опционально)
 * @param userId - ID пользователя (для проверки прав)
 */
export async function deleteFile(
  fileId: string,
  fileUrl: string,
  openaiFileId: string | null,
  userId: string
): Promise<void> {
  try {
    // 1. Удаляем из OpenAI (если есть)
    if (openaiFileId) {
      console.log('🗑️  Удаление файла из OpenAI...')
      await deleteFileFromOpenAI(openaiFileId)
    }

    // 2. Удаляем из Supabase Storage
    const storagePath = extractStoragePath(fileUrl)
    if (storagePath) {
      console.log('🗑️  Удаление файла из Storage...')
      const { error: storageError } = await supabase.storage
        .from('files')
        .remove([storagePath])

      if (storageError) {
        console.warn('⚠️ Не удалось удалить файл из Storage:', storageError)
        // Продолжаем удаление из БД даже если Storage ошибка
      }
    }

    // 3. Удаляем запись из БД
    console.log('🗑️  Удаление записи из БД...')
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('uploaded_by', userId) // Проверка прав доступа

    if (dbError) {
      throw new Error(`Ошибка удаления из БД: ${dbError.message}`)
    }

    console.log('✅ Файл успешно удален')
  } catch (error) {
    console.error('Error deleting file:', error)
    throw error
  }
}

