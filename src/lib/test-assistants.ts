import { supabase } from './supabase'
import { uploadFileToOpenAI, getOrCreateAssistantForRoom, checkVectorStoreStatus, listVectorStoreFiles } from './assistants'

/**
 * Создает тестовые файлы для загрузки в OpenAI
 * Эти файлы будут использоваться для тестирования Assistants API
 */

/**
 * Создает текстовый файл с описанием проекта
 */
export function createTestTextFile(): Blob {
  const content = `Описание проекта Multi-User LLM Chat MVP

Это приложение для многопользовательского чата с интеграцией LLM.

Основные возможности:
- Создание комнат для чата с настраиваемым системным промптом
- Интеграция с OpenAI API для получения ответов от AI ассистента
- Семантический поиск по истории сообщений
- Ролевая модель доступа (viewer, writer, admin, owner)
- Real-time синхронизация сообщений
- Работа с файлами через Assistants API

Технологии:
- Frontend: React + TypeScript + Vite
- Backend: Supabase (PostgreSQL + Auth + Realtime + Storage)
- LLM: OpenAI API
- Vector Search: pgvector для семантического поиска
`
  return new Blob([content], { type: 'text/plain;charset=utf-8' })
}

/**
 * Создает CSV файл с тестовыми данными
 */
export function createTestCSVFile(): Blob {
  const content = `Название,Описание,Статус,Приоритет
Задача 1,Реализовать базовый UI,Завершено,Высокий
Задача 2,Интегрировать LLM API,Завершено,Высокий
Задача 3,Добавить семантический поиск,Завершено,Средний
Задача 4,Реализовать работу с файлами,В процессе,Высокий
Задача 5,Добавить мобильную версию,Запланировано,Низкий
`
  return new Blob([content], { type: 'text/csv;charset=utf-8' })
}

/**
 * Создает JSON файл с метаданными проекта
 */
export function createTestJSONFile(): Blob {
  const content = JSON.stringify({
    project: {
      name: 'Multi-User LLM Chat MVP',
      version: '1.0.0',
      description: 'Приложение для многопользовательского чата с AI',
      features: [
        'Многопользовательские комнаты',
        'Интеграция OpenAI',
        'Семантический поиск',
        'Ролевая модель доступа',
        'Real-time синхронизация',
      ],
      techStack: {
        frontend: 'React + TypeScript',
        backend: 'Supabase',
        llm: 'OpenAI API',
      },
    },
  }, null, 2)
  return new Blob([content], { type: 'application/json;charset=utf-8' })
}

/**
 * Создает текстовый файл для технических спецификаций
 * ВНИМАНИЕ: Простые PDF могут не парситься корректно OpenAI
 * Для тестирования используем текстовый файл, который гарантированно работает
 * В будущем можно использовать библиотеку для генерации PDF (например, pdfkit)
 */
export function createTestPDFFile(): Blob {
  // Для тестирования создаем текстовый файл с расширением .txt
  // который будет содержать технические спецификации
  // В будущем можно заменить на реальный PDF генератор
  const content = `ТЕХНИЧЕСКИЕ СПЕЦИФИКАЦИИ ПРОЕКТА
Multi-User LLM Chat MVP
Версия: 1.0.0

АРХИТЕКТУРА СИСТЕМЫ

Frontend:
- React 18+ с TypeScript
- Vite для сборки
- TailwindCSS для стилей
- React Router для маршрутизации

Backend:
- Supabase (PostgreSQL + Auth + Realtime + Storage)
- Row Level Security (RLS) для контроля доступа
- pgvector для векторного поиска

LLM Интеграция:
- OpenAI API (Chat Completions и Assistants API)
- Поддержка различных моделей (gpt-4o, gpt-4o-mini, и др.)

ФУНКЦИОНАЛЬНОСТЬ

1. Управление комнатами:
   - Создание, редактирование, удаление комнат
   - Настройка системного промпта
   - Выбор модели LLM

2. Сообщения:
   - Real-time синхронизация через Supabase Realtime
   - История сообщений
   - Семантический поиск по истории

3. Файлы (в разработке):
   - Загрузка файлов в Supabase Storage
   - Интеграция с OpenAI Assistants API
   - Поддержка file_search для текстовых файлов

4. Доступ:
   - Роли: viewer, writer, admin, owner
   - Контроль доступа на уровне строк (RLS)
`
  // Возвращаем как текстовый файл, но с именем PDF для совместимости
  // OpenAI будет обрабатывать его как текстовый файл
  return new Blob([content], { type: 'text/plain;charset=utf-8' })
}

/**
 * Создает простое PNG изображение
 * ВНИМАНИЕ: Изображения не поддерживаются file_search в Assistants API
 * Но поддерживаются Vision API через передачу в сообщениях
 * OpenAI поддерживает: PNG, JPEG, GIF, WebP (НЕ SVG)
 */
export function createTestImageFile(): Blob {
  // Используем Canvas API если доступен (в браузере)
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 150
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        // Белый фон
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, 200, 150)
        
        // Текст
        ctx.fillStyle = '#333'
        ctx.font = '16px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Test Diagram', 100, 50)
        
        // Два круга
        ctx.fillStyle = '#4CAF50'
        ctx.beginPath()
        ctx.arc(50, 100, 20, 0, 2 * Math.PI)
        ctx.fill()
        
        ctx.fillStyle = '#2196F3'
        ctx.beginPath()
        ctx.arc(150, 100, 20, 0, 2 * Math.PI)
        ctx.fill()
        
        // Линия
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(70, 100)
        ctx.lineTo(130, 100)
        ctx.stroke()
        
        // Синхронное преобразование в blob (только для синхронного использования)
        // В production лучше использовать toBlob с Promise
        const dataURL = canvas.toDataURL('image/png')
        const base64 = dataURL.split(',')[1]
        const byteCharacters = atob(base64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        return new Blob([byteArray], { type: 'image/png' })
      }
    } catch (e) {
      console.warn('Canvas API недоступен, используем fallback PNG')
    }
  }
  
  // Fallback: валидный минимальный PNG (1x1 белый пиксель)
  // Это валидный PNG файл в base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const byteCharacters = atob(pngBase64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: 'image/png' })
}

/**
 * Загружает все тестовые файлы в OpenAI и обновляет записи в БД
 * @param roomId - ID тестовой комнаты
 * @returns массив OpenAI file IDs
 */
export async function uploadMockFilesToOpenAI(roomId: string): Promise<string[]> {
  try {
    // Получаем ВСЕ файлы комнаты (включая уже загруженные)
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('room_id', roomId)
    
    if (filesError) {
      throw new Error(`Ошибка получения файлов: ${filesError.message}`)
    }
    
    if (!files || files.length === 0) {
      console.log('Нет файлов для загрузки')
      return []
    }
    
    const uploadedFileIds: string[] = []
    
    // Маппинг типов файлов на функции создания
    const fileCreators: Record<string, () => Blob> = {
      'text/plain': createTestTextFile,
      'text/csv': createTestCSVFile,
      'application/json': createTestJSONFile,
      'image/png': createTestImageFile,
      'image/svg+xml': createTestImageFile,
    }
    
    // Определяем поддерживаемые типы для file_search
    // file_search поддерживает: text, markdown, json, csv, pdf
    // НЕ поддерживает: изображения (png, jpg, svg и т.д.)
    const supportedForFileSearch = ['text/plain', 'text/csv', 'application/json', 'application/pdf', 'text/markdown']
    // Изображения для Vision API (поддерживаются PNG, JPEG, GIF, WebP, но НЕ SVG)
    const unsupportedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp']
    
    // Загружаем каждый файл
    for (const file of files) {
      try {
        const isImage = unsupportedImageTypes.includes(file.file_type) || 
                       file.filename.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)
        
        // Если файл уже загружен в OpenAI
        if (file.openai_file_id) {
          if (isImage) {
            // Для изображений ВСЕГДА перезагружаем при инициализации,
            // чтобы гарантировать правильный формат (PNG)
            // Это необходимо, так как старые файлы могли быть загружены как SVG
            console.log(`🔄 Изображение ${file.filename} будет перезагружено для гарантии правильного формата...`)
            // Продолжаем дальше для перезагрузки (не используем старый file_id)
          } else {
            console.log(`✅ Файл ${file.filename} уже загружен в OpenAI, ID: ${file.openai_file_id}`)
            uploadedFileIds.push(file.openai_file_id)
            continue
          }
        }
        
        // Пропускаем изображения при первичной загрузке для file_search
        // Но загружаем их в OpenAI для использования через Vision API
        if (isImage) {
          // Проверяем, поддерживается ли формат изображения для Vision API
          // OpenAI поддерживает: PNG, JPEG, GIF, WebP (НЕ SVG)
          const supportedImageFormats = /\.(png|jpeg|jpg|gif|webp)$/i
          const isSupportedFormat = supportedImageFormats.test(file.filename)
          
          if (!isSupportedFormat && file.file_type === 'image/svg+xml') {
            console.warn(`⏭️  Файл ${file.filename} пропущен: SVG не поддерживается Vision API. Используйте PNG, JPEG, GIF или WebP.`)
            continue
          }
          
          console.log(`📸 Загрузка изображения ${file.filename} в OpenAI для Vision API...`)
          // Загружаем изображение для использования в сообщениях
          try {
            // Создаем PNG изображение (OpenAI поддерживает PNG)
            const blob = createTestImageFile()
            
            // Убеждаемся, что имя файла имеет правильное расширение для PNG
            // Если оригинальное имя файла было SVG или другим форматом, меняем на PNG
            let fileName = file.filename
            if (!fileName.toLowerCase().endsWith('.png')) {
              fileName = fileName.replace(/\.(svg|jpg|jpeg|gif|webp)$/i, '.png')
              console.log(`📝 Изменено имя файла с ${file.filename} на ${fileName} для корректной загрузки PNG`)
            }
            
            const arrayBuffer = await blob.arrayBuffer()
            
            // Проверяем, что это действительно PNG (первые 8 байт должны быть PNG сигнатура)
            const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
            const fileHeader = new Uint8Array(arrayBuffer.slice(0, 8))
            const isPng = fileHeader.every((byte, index) => byte === pngSignature[index])
            
            if (!isPng) {
              console.error(`❌ Ошибка: созданное изображение не является валидным PNG`)
              continue
            }
            
            const openaiFileId = await uploadFileToOpenAI(arrayBuffer, fileName)
            
            // Обновляем запись в БД
            const { error: updateError } = await supabase
              .from('files')
              .update({ openai_file_id: openaiFileId })
              .eq('id', file.id)
            
            if (updateError) {
              console.error(`Ошибка обновления изображения ${file.filename}:`, updateError)
            } else {
              console.log(`✅ Изображение ${file.filename} загружено в OpenAI для Vision API, ID: ${openaiFileId}`)
            }
          } catch (error) {
            console.error(`Ошибка загрузки изображения ${file.filename}:`, error)
          }
          continue
        }
        
        // Определяем, какой файл создавать по типу или имени
        let blob: Blob
        
        if (file.filename.includes('.csv') || file.file_type === 'text/csv') {
          blob = createTestCSVFile()
        } else if (file.filename.includes('.json') || file.file_type === 'application/json') {
          blob = createTestJSONFile()
        } else if (file.filename.includes('.pdf') || file.file_type === 'application/pdf') {
          // ВНИМАНИЕ: Простые PDF могут не парситься корректно OpenAI
          // Для тестирования пропускаем PDF или заменяем на текстовый файл
          // В будущем можно использовать библиотеку для генерации PDF (например, pdfkit)
          console.warn(`⚠️  PDF файл ${file.filename} пропущен. Для корректной работы нужен валидный PDF (требует специальной библиотеки для генерации).`)
          continue
          // Вместо этого можно использовать текстовый файл:
          // blob = createTestPDFFile()
        } else if (file.filename.includes('.png') || file.filename.includes('.svg') || file.filename.includes('.jpg')) {
          // Изображения пропускаем (см. проверку выше)
          continue
        } else {
          // По умолчанию текстовый файл
          blob = createTestTextFile()
        }
        
        // Конвертируем Blob в ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer()
        
        // Загружаем в OpenAI
        console.log(`📤 Загрузка файла ${file.filename} в OpenAI...`)
        const openaiFileId = await uploadFileToOpenAI(arrayBuffer, file.filename)
        
        // Обновляем запись в БД
        const { error: updateError } = await supabase
          .from('files')
          .update({ openai_file_id: openaiFileId })
          .eq('id', file.id)
        
        if (updateError) {
          console.error(`Ошибка обновления файла ${file.filename}:`, updateError)
        } else {
          console.log(`✅ Файл ${file.filename} загружен в OpenAI, ID: ${openaiFileId}`)
          uploadedFileIds.push(openaiFileId)
        }
      } catch (error) {
        console.error(`Ошибка загрузки файла ${file.filename}:`, error)
        // Продолжаем с другими файлами
      }
    }
    
    console.log(`📊 Всего файлов для Assistant: ${uploadedFileIds.length}`)
    return uploadedFileIds
  } catch (error) {
    console.error('Error uploading mock files to OpenAI:', error)
    throw error
  }
}

/**
 * Инициализирует Assistant для тестовой комнаты
 * Загружает файлы в OpenAI и создает Assistant с прикрепленными файлами
 * @param roomId - ID тестовой комнаты
 * @param systemPrompt - системный промпт (если не указан, берется из комнаты)
 * @param model - модель (если не указана, берется из комнаты)
 * @returns конфигурация Assistant
 */
export async function initializeTestAssistant(
  roomId: string,
  systemPrompt?: string,
  model?: string
): Promise<{ assistantId: string; threadId: string; fileIds: string[] }> {
  try {
    // 1. Загружаем файлы в OpenAI
    console.log('📤 Загрузка файлов в OpenAI...')
    const fileIds = await uploadMockFilesToOpenAI(roomId)
    
    if (fileIds.length === 0) {
      console.warn('⚠️ Нет файлов для прикрепления к Assistant')
    }
    
    // 2. Получаем настройки комнаты, если не указаны
    if (!systemPrompt || !model) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('system_prompt, model')
        .eq('id', roomId)
        .single()
      
      if (roomError) {
        throw new Error(`Ошибка получения настроек комнаты: ${roomError.message}`)
      }
      
      systemPrompt = systemPrompt || room.system_prompt || 'Вы - полезный ассистент.'
      model = model || room.model || 'gpt-4o'
    }
    
    // 3. Создаем или получаем Assistant
    console.log('🤖 Создание/получение Assistant...')
    const assistantConfig = await getOrCreateAssistantForRoom(
      roomId,
      systemPrompt,
      model,
      fileIds
    )
    
    console.log('✅ Assistant инициализирован:', {
      assistantId: assistantConfig.assistantId,
      threadId: assistantConfig.threadId,
      fileIds,
      fileCount: fileIds.length,
    })
    
    // Проверяем статус vector store и файлы через некоторое время после создания
    setTimeout(async () => {
      try {
        // Получаем информацию об Assistant, чтобы узнать vector store ID
        const assistantInfo = await fetch(
          `https://api.openai.com/v1/assistants/${assistantConfig.assistantId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
              'OpenAI-Beta': 'assistants=v2',
            },
          }
        )
        
        if (assistantInfo.ok) {
          const assistant = await assistantInfo.json()
          const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || []
          
          if (vectorStoreIds.length > 0) {
            const vsId = vectorStoreIds[0]
            console.log('🔍 Проверка vector store:', vsId)
            
            const vsStatus = await checkVectorStoreStatus(vsId)
            console.log('📊 Vector store status:', {
              id: vsId,
              status: vsStatus.status,
              file_counts: vsStatus.file_counts,
              name: vsStatus.name,
            })
            
            const vsFiles = await listVectorStoreFiles(vsId)
            console.log(`📁 Файлов в vector store: ${vsFiles.length}`)
            vsFiles.forEach((file: any, index: number) => {
              console.log(`  ${index + 1}. File ID: ${file.id}, Status: ${file.status}, Error: ${file.last_error?.message || 'none'}`)
            })
            
            // Предупреждаем, если не все файлы обработаны
            const completedFiles = vsFiles.filter((f: any) => f.status === 'completed')
            if (completedFiles.length < fileIds.length) {
              console.warn(`⚠️ Только ${completedFiles.length} из ${fileIds.length} файлов обработаны. Возможно, некоторые еще индексируются.`)
            }
          }
        }
      } catch (err) {
        console.warn('Could not check vector store status:', err)
      }
    }, 5000)
    
    return {
      assistantId: assistantConfig.assistantId,
      threadId: assistantConfig.threadId,
      fileIds,
    }
  } catch (error) {
    console.error('Error initializing test assistant:', error)
    throw error
  }
}

